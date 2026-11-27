import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";
import { pushConfigured } from "@/server/push";
import { runBroadcast, textFor } from "@/server/broadcast";

export const maxDuration = 120;

const ROUTES = ["/today", "/plan", "/meals", "/progress", "/community", "/diary"] as const;
const AUDIENCE = z.string().regex(/^(all|active7|inactive3|inactive7|ar|en|paying|unpaid|country:[A-Za-z]{2})$/);
const Text = { title_ar: z.string().trim().max(60).default(""), body_ar: z.string().trim().max(160).default(""), title_en: z.string().trim().max(60).default(""), body_en: z.string().trim().max(160).default("") };
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), audience: AUDIENCE, subroute: z.enum(ROUTES).default("/today"), ...Text }),
  z.object({
    action: z.literal("send"), id: z.string().uuid(), audience: AUDIENCE, subroute: z.enum(ROUTES).default("/today"), ...Text,
    mode: z.enum(["now", "at", "local"]).default("now"),
    send_at: z.string().datetime().optional(),
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    local_hour: z.number().int().min(0).max(23).optional(),
  }),
  z.object({ action: z.literal("cancel"), id: z.string().uuid() }),
]);

/** Recent announcements with delivery and open numbers, plus how every kind of notification performed over the last 14 days. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const [broadcasts, summary] = await Promise.all([db().rpc("hl_broadcast_history"), db().rpc("hl_notif_summary", { p_days: 14 })]);
  return ok({ broadcasts: must(broadcasts), summary: must(summary), countries: must(await db().from("hl_profiles").select("country").not("country", "is", null).is("deleted_at", null).limit(5000)).map((r: { country: string }) => r.country).filter((c: string, i: number, a: string[]) => a.indexOf(c) === i).sort() });
});

/**
 * Owner announcement. "preview" counts who would receive it, "send" sends now or schedules it (one time, or a chosen hour in each
 * person's own time zone), "cancel" stops a scheduled one. Sending is idempotent on the id the page generated, limited to a few
 * per day, and only reaches people who allow announcements.
 */
export const POST = route(async (req) => {
  const a = await requireAdmin(req);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("اكتب العنوان والنص بلغة واحدة على الأقل.", "Write a title and message in at least one language.");
  const b = parsed.data;

  if (b.action === "cancel") {
    const r = must(await db().from("hl_broadcasts").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", b.id).eq("status", "scheduled").select("id")) as { id: string }[];
    if (!r.length) throw E.bad("لا يمكن إلغاء هذا الإرسال.", "This announcement cannot be cancelled.");
    await audit(a.username, "broadcast_cancel", b.id);
    return ok({ cancelled: true });
  }

  if (!textFor(b, "ar") && !textFor(b, "en")) throw E.bad("اكتب العنوان والنص بلغة واحدة على الأقل.", "Write a title and message in at least one language.");
  const people = must(await db().rpc("hl_broadcast_audience", { p_audience: b.audience, p_today: a.today })) as { username: string; pi_uid: string | null; language: string | null; notify_pi: boolean }[];
  const reach = people.filter((p) => textFor(b, p.language));
  const piTargets = reach.filter((p) => p.notify_pi && p.pi_uid);

  if (b.action === "preview") {
    let devices = 0;
    if (pushConfigured() && reach.length) {
      const names = reach.map((p) => p.username);
      for (let k = 0; k < names.length; k += 200) {
        const { count } = await db().from("hl_push_subscriptions").select("endpoint", { count: "exact", head: true }).in("username", names.slice(k, k + 200));
        devices += count ?? 0;
      }
    }
    return ok({ people: reach.length, pi: piTargets.length, devices, truncated: people.length >= 5000 });
  }

  await rateLimit("admin-broadcast", a.username, 8, 86400);
  const now = Date.now();
  if (b.mode === "at") {
    const t = b.send_at ? Date.parse(b.send_at) : NaN;
    if (!(t > now - 60_000) || t > now + 30 * 86400_000) throw E.bad("اختر وقتًا في المستقبل خلال 30 يومًا.", "Pick a time in the future, within 30 days.");
  }
  if (b.mode === "local") {
    const t = b.local_date ? Date.parse(`${b.local_date}T00:00:00Z`) : NaN;
    if (!(t > now - 2 * 86400_000) || t > now + 30 * 86400_000 || b.local_hour === undefined) throw E.bad("اختر تاريخًا وساعة صحيحين خلال 30 يومًا.", "Pick a valid date and hour within 30 days.");
  }
  const ins = await db().from("hl_broadcasts").insert({
    id: b.id, admin: a.username, audience: b.audience, subroute: b.subroute, title_ar: b.title_ar || null, body_ar: b.body_ar || null, title_en: b.title_en || null, body_en: b.body_en || null,
    mode: b.mode, send_at: b.mode === "at" ? b.send_at : null, local_date: b.mode === "local" ? b.local_date : null, local_hour: b.mode === "local" ? b.local_hour : null,
    status: b.mode === "now" ? "sending" : "scheduled",
  });
  if (ins.error) {
    if (ins.error.code === "23505") throw new HttpError(409, "already_sent", "هذا الإشعار أُرسل من قبل.", "This announcement was already sent.");
    throw new Error(ins.error.message);
  }
  await audit(a.username, b.mode === "now" ? "broadcast" : "broadcast_schedule", b.audience, { id: b.id, mode: b.mode, to: reach.length });
  if (b.mode !== "now") return ok({ scheduled: true, people: reach.length });
  const out = await runBroadcast(b.id);
  return ok({ scheduled: false, ...out });
});
