import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireCron } from "@/server/cron-auth";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "@/server/push";
import { NOTIFY_BATCH, sendPiNotifications, type PiNotification } from "@/server/pi-notify";
import { expiryText, seedOf, smartReminderText } from "@/lib/reminder";
import { processDueBroadcasts } from "@/server/broadcast";
import { daySnapshots } from "@/server/reminder-context";
import { addDays } from "@/lib/dates";

export const maxDuration = 120;
const BATCH = 500;
const MAX_ROUNDS = 20; // up to 10,000 people per run; later runs pick up the rest

type Claimed = { username: string; pi_uid: string | null; language: string | null; notify_pi: boolean; title: string; body: string };
type Out = { broadcasts?: number; due: number; pi: { requested: number; delivered: number; errors: number }; push: { devices: number; sent: number; removed: number; failed: number }; expiry: number };

/** Send one notification to a person on every channel they allow (Pi Notification Center + their registered browsers). */
async function deliver(items: Claimed[], out: Out, kind: "reminder" | "expiry") {
  // Log first so the owner can see how many of these led to opening the app. A logging problem never blocks sending.
  if (items.length) { try { must(await db().from("hl_notif_log").insert(items.map((i) => ({ username: i.username, kind })))); } catch (e) { console.error("[reminders] log", e instanceof Error ? e.message : e); } }
  const pi: PiNotification[] = items.filter((i) => i.notify_pi && i.pi_uid).map((i) => ({ user_uid: i.pi_uid!, title: i.title, body: i.body, subroute: "/today" }));
  for (let k = 0; k < pi.length; k += NOTIFY_BATCH) {
    const r = await sendPiNotifications(pi.slice(k, k + NOTIFY_BATCH));
    out.pi.requested += r.requested; out.pi.delivered += r.delivered; if (r.error) out.pi.errors++;
  }
  if (!pushConfigured()) return;
  const byUser = new Map(items.map((i) => [i.username, i]));
  const names = [...byUser.keys()];
  for (let k = 0; k < names.length; k += 200) {
    const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth,username").in("username", names.slice(k, k + 200))) as (Sub & { username: string })[];
    out.push.devices += subs.length;
    for (const s of subs) {
      const it = byUser.get(s.username)!;
      const r = await sendPush(s, { title: it.title, body: it.body }, { urgency: "high" }); // high priority so phones deliver it with the browser closed
      if (r === "ok") out.push.sent++;
      else if (r === "gone") { await dropSubscription(s.endpoint); out.push.removed++; }
      else out.push.failed++;
    }
  }
}

/**
 * Hourly job (database scheduler; Vercel Cron is the daily fallback). Each person is reminded at THEIR chosen local hour,
 * once per local day, and only if they have not done a challenge yet. Claiming happens in SQL, so overlapping runs never double-send.
 */
export const GET = route(async (req) => {
  requireCron(req);
  const out: Out = { due: 0, pi: { requested: 0, delivered: 0, errors: 0 }, push: { devices: 0, sent: 0, removed: 0, failed: 0 }, expiry: 0 };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const rows = must(await db().rpc("hl_claim_reminders", { p_limit: BATCH })) as { username: string; pi_uid: string | null; language: string | null; current_streak: number; last_completed_date: string | null; local_date: string; notify_pi: boolean }[];
    if (!rows.length) break;
    out.due += rows.length;
    // The text is built from each person's real day (calories and protein left, or "log your first meal"). If that lookup
    // fails the plain challenge reminder still goes out.
    const days = await daySnapshots(rows.map((r) => ({ username: r.username, local_date: r.local_date }))).catch((e) => { console.error("[reminders] day snapshot", e instanceof Error ? e.message : e); return new Map(); });
    await deliver(rows.map((r) => {
      const alive = !!r.last_completed_date && r.last_completed_date >= addDays(r.local_date, -1); // a stale streak number would mislead
      const t = smartReminderText({ streak: alive ? r.current_streak : 0, lang: r.language === "ar" ? "ar" : "en", day: days.get(r.username) ?? null, seed: seedOf(`${r.username}:${r.local_date}`) });
      return { username: r.username, pi_uid: r.pi_uid, language: r.language, notify_pi: r.notify_pi, ...t };
    }), out, "reminder");
    if (rows.length < BATCH) break;
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const rows = must(await db().rpc("hl_claim_expiry_notices", { p_limit: BATCH })) as { username: string; pi_uid: string | null; language: string | null; expires_at: string; notify_pi: boolean }[];
    if (!rows.length) break;
    out.expiry += rows.length;
    await deliver(rows.map((r) => {
      const daysLeft = Math.ceil((Date.parse(r.expires_at) - Date.now()) / 86400_000);
      return { username: r.username, pi_uid: r.pi_uid, language: r.language, notify_pi: r.notify_pi, ...expiryText({ daysLeft, lang: r.language === "ar" ? "ar" : "en" }) };
    }), out, "expiry");
    if (rows.length < BATCH) break;
  }
  try { out.broadcasts = await processDueBroadcasts(); } catch (e) { console.error("[reminders] broadcasts", e instanceof Error ? e.message : e); }
  return ok(out);
});
