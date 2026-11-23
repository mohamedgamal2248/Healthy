import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureToday, loadStreak, reminderState } from "@/server/challenges";
import { effectiveStreak, freezeAvailable, isFrozen } from "@/lib/streak";
import { mealsOfTheDay } from "@/server/meals";
import { getBalances } from "@/server/credits";
import { groupSnapshot } from "@/server/community";
import { TRIAL_CREDITS } from "@/config/pricing";
import { foodDay, recentFoods } from "@/server/food";
import { addDays } from "@/lib/dates";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const [{ rows, swapUsed }, streak, meals, badges, favs, reminder, balances, community, rewarded, coachUsed, food] = await Promise.all([
    ensureToday(a),
    loadStreak(a.username),
    mealsOfTheDay(a.today),
    db().from("hl_badges").select("badge_key, earned_at").eq("username", a.username),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "meal"),
    reminderState(a),
    a.profile.kyc_verified ? getBalances(a.username) : Promise.resolve(null),
    a.profile.kyc_verified ? groupSnapshot(a.username, a.today).catch(() => null) : Promise.resolve(null),
    db().from("hl_credit_ledger").select("id", { count: "exact", head: true }).eq("username", a.username).eq("reason", "trial_grant"),
    db().from("hl_recipes").select("id", { count: "exact", head: true }).eq("username", a.username),
    foodDay(a),
  ]);
  // Week strip: the last 7 local days with whether a challenge was done and whether food was logged.
  const from = addDays(a.today, -6);
  const [doneDays, foodDays, recent] = await Promise.all([
    db().from("hl_user_challenges").select("date").eq("username", a.username).eq("status", "completed").gte("date", from).lte("date", a.today),
    db().from("hl_food_log").select("date").eq("username", a.username).gte("date", from).lte("date", a.today).limit(300),
    recentFoods(a, 3),
  ]);
  const doneSet = new Set((must(doneDays) as { date: string }[]).map((r) => r.date));
  const foodSet = new Set((must(foodDays) as { date: string }[]).map((r) => r.date));
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { date: d, challenge: doneSet.has(d), food: foodSet.has(d) }; });
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
