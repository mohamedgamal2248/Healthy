import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureToday, loadStreak, reminderState } from "@/server/challenges";
import { effectiveStreak, freezeAvailable, isFrozen } from "@/lib/streak";
import { mealsOfTheDay } from "@/server/meals";
import { getBalances } from "@/server/credits";
import { groupSnapshot } from "@/server/community";
import { TRIAL_CREDITS } from "@/config/pricing";
import { todayFood } from "@/server/food";
import { addDays } from "@/lib/dates";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  // One parallel round (auth already done): every query below is independent, so the screen costs one round trip
  // of database latency instead of three, and the diary is read once for the day, the week strip and "recent".
  const from = addDays(a.today, -6);
  const streakP = loadStreak(a.username);
  const [{ rows, swapUsed }, streak, meals, badges, favs, reminder, balances, community, rewarded, coachUsed, tf, doneDays] = await Promise.all([
    ensureToday(a),
    streakP,
    mealsOfTheDay(a.today),
    db().from("hl_badges").select("badge_key, earned_at").eq("username", a.username),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "meal"),
    streakP.then((s) => reminderState(a, s)),
    a.profile.kyc_verified ? getBalances(a.username) : Promise.resolve(null),
    a.profile.kyc_verified ? groupSnapshot(a.username, a.today).catch(() => null) : Promise.resolve(null),
    db().from("hl_credit_ledger").select("id", { count: "exact", head: true }).eq("username", a.username).eq("reason", "trial_grant"),
    db().from("hl_recipes").select("id", { count: "exact", head: true }).eq("username", a.username).eq("hidden", false),
    todayFood(a, 3),
    db().from("hl_user_challenges").select("date").eq("username", a.username).eq("status", "completed").gte("date", from).lte("date", a.today),
  ]);
  const food = tf.day;
  const recent = tf.recent;
  // Week strip: the last 7 local days with whether a challenge was done and whether food was logged.
  const doneSet = new Set((must(doneDays) as { date: string }[]).map((r) => r.date));
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { date: d, challenge: doneSet.has(d), food: tf.foodDates.has(d) }; });
  return ok({
    date: a.today,
    challenges: rows,
    swapUsed,
    streak: { current: effectiveStreak(streak, a.today), longest: streak.longest, total: streak.total, frozen: isFrozen(streak, a.today), freezeReady: freezeAvailable(streak, a.today) },
    completedToday: rows.filter((r) => r.status === "completed").length,
    meals,
    badges: must(badges),
    favourites: (must(favs) as { source_id: string }[]).map((f) => f.source_id),
    reminder,
    balances,
    community,
    starter: { rewarded: (rewarded.count ?? 0) > 0, reward: TRIAL_CREDITS },
    checklist: { profile: !!a.profile.disclaimer_accepted_at, challenge: streak.total > 0, coach: (coachUsed.count ?? 0) > 0 },
    food: { totals: food.totals, calories: food.totals.calories, target: food.target, targets: food.targets, entries: food.entries.length, recent },
    week,
    profileReady: !!a.profile.disclaimer_accepted_at,
  });
});
