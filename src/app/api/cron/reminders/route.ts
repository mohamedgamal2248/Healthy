import { timingSafeEqual } from "node:crypto";
import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "@/server/push";
import { NOTIFY_BATCH, sendPiNotifications, type PiNotification } from "@/server/pi-notify";
import { needsReminder, reminderText } from "@/lib/reminder";
import { DEFAULT_TZ, localDate, validTz } from "@/lib/dates";

export const maxDuration = 120;
const PAGE = 500;

/** Daily reminder (Vercel Cron). Only people who have not done a challenge today (in THEIR timezone) get one. */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) throw E.notFound();
  const out = { subscriptions: 0, sent: 0, skipped: 0, removed: 0, failed: 0, pi: { candidates: 0, requested: 0, delivered: 0, errors: 0 } };
  if (pushConfigured()) await webPushPass(out);
  await piPass(out);
  return ok(out);
});

type Out = { subscriptions: number; sent: number; skipped: number; removed: number; failed: number; pi: { candidates: number; requested: number; delivered: number; errors: number } };

/** Pi Notification Center: people active in the last 30 days who have not done a challenge today. */
async function piPass(out: Out) {
  const active = new Date(Date.now() - 30 * 86400_000).toISOString();
  for (let from = 0; ; from += PAGE) {
    const profs = must(await db().from("hl_profiles").select("username,pi_uid,timezone,language").not("pi_uid", "is", null).eq("notify_pi", true).is("deleted_at", null).gte("updated_at", active).order("username").range(from, from + PAGE - 1)) as { username: string; pi_uid: string; timezone: string | null; language: string | null }[];
    if (!profs.length) break;
    const streaks = must(await db().from("hl_streaks").select("username,current_streak,last_completed_date").in("username", profs.map((p) => p.username))) as { username: string; current_streak: number; last_completed_date: string | null }[];
    const st = new Map(streaks.map((x) => [x.username, x]));
    const items: PiNotification[] = [];
    for (const p of profs) {
      out.pi.candidates++;
      const today = localDate(validTz(p.timezone || DEFAULT_TZ));
      const sk = st.get(p.username);
      if (!needsReminder(sk?.last_completed_date ?? null, today)) continue;
      const alive = sk?.last_completed_date && sk.last_completed_date >= new Date(Date.parse(today) - 86400_000).toISOString().slice(0, 10);
      const t = reminderText({ streak: alive ? sk?.current_streak ?? 0 : 0, lang: p.language === "ar" ? "ar" : "en" });
      items.push({ user_uid: p.pi_uid, title: t.title, body: t.body, subroute: "/today" });
    }
    for (let i = 0; i < items.length; i += NOTIFY_BATCH) {
      const r = await sendPiNotifications(items.slice(i, i + NOTIFY_BATCH));
      out.pi.requested += r.requested; out.pi.delivered += r.delivered; if (r.error) out.pi.errors++;
    }
    if (profs.length < PAGE) break;
  }
}

async function webPushPass(out: Out) {
  for (let from = 0; ; from += PAGE) {
    const subs = must(await db().from("hl_push_subscriptions").select("endpoint,p256dh,auth,username").order("endpoint").range(from, from + PAGE - 1)) as (Sub & { username: string })[];
    if (!subs.length) break;
    out.subscriptions += subs.length;
    const names = [...new Set(subs.map((s) => s.username))];
    const [profiles, streaks] = await Promise.all([
      db().from("hl_profiles").select("username,timezone,language,deleted_at").in("username", names),
      db().from("hl_streaks").select("username,current_streak,last_completed_date").in("username", names),
    ]);
    const prof = new Map((must(profiles) as { username: string; timezone: string | null; language: string | null; deleted_at: string | null }[]).map((p) => [p.username, p]));
    const st = new Map((must(streaks) as { username: string; current_streak: number; last_completed_date: string | null }[]).map((s) => [s.username, s]));
    for (const s of subs) {
      const p = prof.get(s.username);
      if (!p || p.deleted_at) { await dropSubscription(s.endpoint); out.removed++; continue; }
      const today = localDate(validTz(p.timezone || DEFAULT_TZ));
      const sk = st.get(s.username);
      if (!needsReminder(sk?.last_completed_date ?? null, today)) { out.skipped++; continue; }
      // The streak only counts if it was alive yesterday or today; a stale number would be misleading.
      const alive = sk?.last_completed_date && sk.last_completed_date >= new Date(Date.parse(today) - 86400_000).toISOString().slice(0, 10);
      const r = await sendPush(s, reminderText({ streak: alive ? sk?.current_streak ?? 0 : 0, lang: p.language === "ar" ? "ar" : "en" }), { urgency: "high" }); // high priority so phones deliver it even when the browser is closed
      if (r === "ok") { out.sent++; await db().from("hl_push_subscriptions").update({ last_sent_at: new Date().toISOString(), failures: 0 }).eq("endpoint", s.endpoint); }
      else if (r === "gone") { await dropSubscription(s.endpoint); out.removed++; }
      else out.failed++;
    }
    if (subs.length < PAGE) break;
  }
}
