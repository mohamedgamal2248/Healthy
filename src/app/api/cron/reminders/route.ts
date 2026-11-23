import { timingSafeEqual } from "node:crypto";
import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { dropSubscription, pushConfigured, sendPush, type Sub } from "@/server/push";
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
  if (!pushConfigured()) return ok({ skipped: "push_not_configured" });

  const out = { subscriptions: 0, sent: 0, skipped: 0, removed: 0, failed: 0 };
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
      const r = await sendPush(s, reminderText({ streak: alive ? sk?.current_streak ?? 0 : 0, lang: p.language === "ar" ? "ar" : "en" }));
      if (r === "ok") { out.sent++; await db().from("hl_push_subscriptions").update({ last_sent_at: new Date().toISOString(), failures: 0 }).eq("endpoint", s.endpoint); }
      else if (r === "gone") { await dropSubscription(s.endpoint); out.removed++; }
      else out.failed++;
    }
    if (subs.length < PAGE) break;
  }
  return ok(out);
});
