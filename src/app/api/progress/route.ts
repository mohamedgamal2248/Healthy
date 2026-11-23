import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { loadStreak } from "@/server/challenges";
import { effectiveStreak } from "@/lib/streak";
import { addDays } from "@/lib/dates";
import { dailyWaterCups } from "@/lib/nutrition";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const from = addDays(a.today, -6);
  const [weights, habits, streak, badges, done] = await Promise.all([
    db().from("hl_weight_logs").select("weight_kg,logged_date,is_official").eq("username", a.username).order("logged_date", { ascending: true }).limit(60),
    db().from("hl_habit_logs").select("date,water_cups,sleep_hours,steps").eq("username", a.username).gte("date", from).order("date"),
    loadStreak(a.username),
    db().from("hl_badges").select("badge_key,earned_at").eq("username", a.username),
    db().from("hl_user_challenges").select("date").eq("username", a.username).eq("status", "completed").gte("date", from).lte("date", a.today),
  ]);
  const hs = must(habits) as { date: string; water_cups: number | null; sleep_hours: number | null; steps: number | null }[];
  return ok({
    today: a.today,
    weights: must(weights),
    habitToday: hs.find((h) => h.date === a.today) ?? null,
    habitsWeek: hs,
    streak: { current: effectiveStreak(streak, a.today), longest: streak.longest, total: streak.total },
    badges: must(badges),
    weekDays: [...new Set((must(done) as { date: string }[]).map((r) => r.date))],
    waterTarget: a.profile.weight_kg ? dailyWaterCups(Number(a.profile.weight_kg)) : 8,
  });
});
