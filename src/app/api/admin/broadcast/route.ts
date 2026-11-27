import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";
import { NOTIFY_BATCH, sendPiNotifications, type PiNotification } from "@/server/pi-notify";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "@/server/push";

export const maxDuration = 120;

const AUDIENCES = ["all", "inactive7", "active7", "ar", "en"] as const;
const ROUTES = ["/today", "/plan", "/meals", "/progress", "/community", "/diary"] as const;
const Body = z.object({
  action: z.enum(["preview", "send"]),
  id: z.string().uuid().optional(),
  audience: z.enum(AUDIENCES),
  subroute: z.enum(ROUTES).default("/today"),
  title_ar: z.string().trim().max(60).default(""),
  body_ar: z.string().trim().max(160).default(""),
  title_en: z.string().trim().max(60).default(""),
  body_en: z.string().trim().max(160).default(""),
});
type Aud = { username: string; pi_uid: string | null; language: string | null; notify_pi: boolean };

/** Text for one person: their own language when written, otherwise the other one. */
function textFor(b: z.infer<typeof Body>, lang: string | null): { title: string; body: string } | null {
  const ar = b.title_ar && b.body_ar ? { title: b.title_ar, body: b.body_ar } : null;
  const en = b.title_en && b.body_en ? { title: b.title_en, body: b.body_en } : null;
  return (lang === "ar" ? ar ?? en : en ?? ar);
}

async function audience(kind: (typeof AUDIENCES)[number], today: string) {
  return must(await db().rpc("hl_broadcast_audience", { p_audience: kind, p_today: today })) as Aud[];
}

/** History of the last announcements. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const rows = must(await db().from("hl_broadcasts").select("id,audience,title_ar,body_ar,title_en,body_en,recipients,pi_requested,pi_delivered,push_devices,push_sent,status,created_at").order("created_at", { ascending: false }).limit(15));
  return ok({ broadcasts: rows });
});

/**
 * Owner announcement to many people at once. "preview" only counts who would receive it. "send" is idempotent on the id the
 * page generated (a second click or a retry is refused), is limited to a few per day, and records the outcome.
 * Pi notifications respect each person's "notify_pi" choice; Web Push goes only to devices that subscribed themselves.
 */
export const POST = route(async (req) => {
  const a = await requireAdmin(req);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("اكتب العنوان والنص بلغة واحدة على الأقل.", "Write a title and message in at least one language.");
  const b = parsed.data;
  if (!textFor(b, "ar") && !textFor(b, "en")) throw E.bad("اكتب العنوان والنص بلغة واحدة على الأقل.", "Write a title and message in at least one language.");

  const people = await audience(b.audience, a.today);
  const piTargets = people.filter((p) => p.notify_pi && p.pi_uid && textFor(b, p.language));
  const names = people.filter((p) => textFor(b, p.language)).map((p) => p.username);
  let devices = 0;
  if (b.action === "preview") {
    if (pushConfigured() && names.length) {
      for (let k = 0; k < names.length; k += 200) {
        const { count } = await db().from("hl_push_subscriptions").select("endpoint", { count: "exact", head: true }).in("username", names.slice(k, k + 200));
        devices += count ?? 0;
      }
    }
    return ok({ people: people.length, pi: piTargets.length, devices, truncated: people.length >= 5000 });
  }

  if (!b.id) throw E.bad();
  await rateLimit("admin-broadcast", a.username, 5, 86400);
  const ins = await db().from("hl_broadcasts").insert({ id: b.id, admin: a.username, audience: b.audience, subroute: b.subroute, title_ar: b.title_ar || null, body_ar: b.body_ar || null, title_en: b.title_en || null, body_en: b.body_en || null, recipients: names.length });
  if (ins.error) {
    if (ins.error.code === "23505") throw new HttpError(409, "already_sent", "هذا الإشعار أُرسل من قبل.", "This announcement was already sent.");
    throw new Error(ins.error.message);
  }

  const out = { pi_requested: 0, pi_delivered: 0, push_devices: 0, push_sent: 0, push_removed: 0 };
  try {
    for (let k = 0; k < piTargets.length; k += NOTIFY_BATCH) {
      const items: PiNotification[] = piTargets.slice(k, k + NOTIFY_BATCH).map((p) => ({ user_uid: p.pi_uid!, ...textFor(b, p.language)!, subroute: b.subroute }));
      const r = await sendPiNotifications(items);
      out.pi_requested += r.requested; out.pi_delivered += r.delivered;
    }
    if (pushConfigured()) {
      const byUser = new Map(people.map((p) => [p.username, p]));
      for (let k = 0; k < names.length; k += 200) {
        const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth,username").in("username", names.slice(k, k + 200))) as (Sub & { username: string })[];
        out.push_devices += subs.length;
        for (let j = 0; j < subs.length; j += 10) {
          await Promise.all(subs.slice(j, j + 10).map(async (s) => {
            const t = textFor(b, byUser.get(s.username)?.language ?? null);
            if (!t) return;
            const r = await sendPush(s, t, { urgency: "normal" });
            if (r === "ok") out.push_sent++;
            else if (r === "gone") { await dropSubscription(s.endpoint); out.push_removed++; }
          }));
        }
      }
    }
    await db().from("hl_broadcasts").update({ pi_requested: out.pi_requested, pi_delivered: out.pi_delivered, push_devices: out.push_devices, push_sent: out.push_sent, status: "done", finished_at: new Date().toISOString() }).eq("id", b.id);
  } catch (e) {
    await db().from("hl_broadcasts").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", b.id);
    throw e;
  }
  await audit(a.username, "broadcast", b.audience, { id: b.id, recipients: names.length, pi: out.pi_delivered, push: out.push_sent });
  return ok(out);
});
