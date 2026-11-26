import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureToday, reminderFrom } from "@/server/challenges";
import { effectiveStreak, freezeAvailable, isFrozen } from "@/lib/streak";
import { mealsOfTheDay } from "@/server/meals";
import { balancesFrom } from "@/server/credits";
import { currentGroup, groupCounts } from "@/server/community";
import { TRIAL_CREDITS } from "@/config/pricing";
import { foodFromRows, targetFrom, type Row } from "@/server/food";
import { addDays, weekStart } from "@/lib/dates";

type Bundle = {
  streak: { current_streak: number; longest_streak: number; last_completed_date: string | null; total_completed: number; freeze_used_on: string | null } | null;
  badges: { badge_key: string; earned_at: string }[]; favs: string[]; last_habit: string | null; trial: boolean; coach: boolean; done: string[];
  food: Row[]; plan_target: number | null; group_days: number | null; group_joined: boolean;
  balances: { plan: number; pack: number; trial: number; plan_expires_at: string | null } | null;
};

export const GET = route(async (req) => {
  const a = await requireUser(req);
  // Three parallel calls in total: today's challenges (may insert today's picks), the cached catalogue, and ONE
  // database function that returns everything else per user (streak, badges, diary, balances, group...).
  const kyc = !!a.profile.kyc_verified;
  const [{ rows, swapUsed }, meals, bundle, group] = await Promise.all([
    ensureToday(a),
    mealsOfTheDay(a.today),
    db().rpc("hl_today_bundle", { p_user: a.username, p_today: a.today, p_week: weekStart(a.today), p_kyc: kyc }).then((r) => must(r) as Bundle),
    kyc ? currentGroup(a.today).then(async (g) => ({ g, counts: await groupCounts(g, a.today) })).catch(() => null) : Promise.resolve(null),
  ]);
  const st = bundle.streak;
  const streak = { current: st?.current_streak ?? 0, longest: st?.longest_streak ?? 0, last: st?.last_completed_date ?? null, total: st?.total_completed ?? 0, freezeUsed: st?.freeze_used_on ?? null };
  const reminder = reminderFrom(a.today, streak.last, bundle.last_habit);
  const balances = kyc ? balancesFrom(bundle.balances) : null;
  const community = group ? { title_ar: group.g.title_ar, title_en: group.g.title_en, members: Number(group.counts.members), checkedToday: Number(group.counts.checked), joined: bundle.group_joined, myDays: bundle.group_days ?? 0 } : null;
  const tf = foodFromRows(a, bundle.food, targetFrom(a, bundle.plan_target), 3);
  const food = tf.day;
  const recent = tf.recent;
  const badges = bundle.badges;
  const favs = bundle.favs;
  // Week strip: the last 7 local days with whether a challenge was done and whether food was logged.
  const from = addDays(a.today, -6);
  const doneSet = new Set(bundle.done);
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(from, i); return { date: d, challenge: doneSet.has(d), food: tf.foodDates.has(d) }; });
  return ok({
    date: a.today,
    challenges: rows,
    swapUsed,
    streak: { current: effectiveStreak(streak, a.today), longest: streak.longest, total: streak.total, frozen: isFrozen(streak, a.today), freezeReady: freezeAvailable(streak, a.today) },
    completedToday: rows.filter((r) => r.status === "completed").length,
    meals,
    badges,
    favourites: favs,
    reminder,
    balances,
    community,
    starter: { rewarded: bundle.trial, reward: TRIAL_CREDITS },
    checklist: { profile: !!a.profile.disclaimer_accepted_at, challenge: streak.total > 0, coach: bundle.coach },
    food: { totals: food.totals, calories: food.totals.calories, target: food.target, targets: food.targets, entries: food.entries.length, recent },
    week,
    profileReady: !!a.profile.disclaimer_accepted_at,
  });
});
