import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";
import { sendPiNotifications } from "@/server/pi-notify";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "@/server/push";

export const maxDuration = 90;
const Body = z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().min(1).max(160), delaySec: z.number().int().min(0).max(60).optional() });

/**
 * Admin test: sends a notification to the ADMIN'S OWN account only (Pi Notification Center + Web Push on their devices),
 * and reports exactly what happened per channel. It cannot target other users or broadcast.
 */
export const POST = route(async (req) => {
  const a = await requireAdmin(req);
  await rateLimit("admin-notify", a.username, 30, 3600);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw E.bad("اكتب عنوانًا ونصًا قصيرين.", "Enter a short title and message.");
  const { title, body, delaySec = 0 } = parsed.data;
  // Optional delay so the admin can close the app first and see whether the notification still arrives (background delivery test).
  if (delaySec > 0) await new Promise((r) => setTimeout(r, delaySec * 1000));

  const piUid = a.profile.pi_uid;
  const pi = piUid
    ? await sendPiNotifications([{ user_uid: piUid, title, body, subroute: "/today" }])
    : { requested: 0, delivered: 0, error: "no_pi_uid" };

  const push = { configured: pushConfigured(), devices: 0, sent: 0, removed: 0, failed: 0, statuses: [] as (number | string)[] };
  if (push.configured) {
    const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth").eq("username", a.username)) as Sub[];
    push.devices = subs.length;
    for (const s of subs) {
      const detail: { status?: number | string } = {};
      const r = await sendPush(s, { title, body }, { urgency: "high", detail });
      if (detail.status !== undefined) push.statuses.push(detail.status);
      if (r === "ok") push.sent++;
      else if (r === "gone") { await dropSubscription(s.endpoint); push.removed++; }
      else push.failed++;
    }
  }
  await audit(a.username, "notify_test", a.username, { pi: pi.delivered, push: push.sent });
  return ok({ pi, push });
});
