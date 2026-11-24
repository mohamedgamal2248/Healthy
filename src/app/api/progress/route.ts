import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { loadStreak } from "@/server/challenges";
import { effectiveStreak } from "@/lib/streak";
import { addDays } from "@/lib/dates";
import { dailyWaterCups } from "@/lib/nutrition";
import { dailyTarget } from "@/server/food";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const from = addDays(a.today, -6);
  const [weights, habits, streak, badges, done, food, target] = await Promise.all([
    // newest first so the cap keeps the most recent year, then put back in date order
    db().from("hl_weight_logs").select("weight_kg,logged_date,is_official").eq("username", a.username).gte("logged_date", addDays(a.today, -366)).order("logged_date", { ascending: false }).limit(400),
    db().from("hl_habit_logs").select("date,water_cups,sleep_hours,steps").eq("username", a.username).gte("date", from).order("date"),
    loadStreak(a.username),
    db().from("hl_badges").select("badge_key,earned_at").eq("username", a.username),
    db().from("hl_user_challenges").select("date").eq("username", a.username).eq("status", "completed").gte("date", from).lte("date", a.today),
    db().from("hl_food_log").select("date,calories").eq("username", a.username).gte("date", from).lte("date", a.today).limit(300),
    dailyTarget(a),
  ]);
  // Average over fully logged days only: an empty day is "not logged", and a day under half the target is a partial log
  // (one snack entered), not "ate 300 kcal". Counting those would make the average look like starvation.
  const allDays = new Map<string, number>();
  for (const r of must(food) as { date: string; calories: number }[]) allDays.set(r.date, (allDays.get(r.date) ?? 0) + r.calories);
  const minFullDay = target ? target * 0.5 : 800;
  const perDay = new Map([...allDays].filter(([, kcal]) => kcal >= minFullDay));
  const avgCalories = perDay.size ? Math.round([...perDay.values()].reduce((n, v) => n + v, 0) / perDay.size) : null;
  const hs = must(habits) as { date: string; water_cups: number | null; sleep_hours: number | null; steps: number | null }[];
  return ok({
    today: a.today,
    weights: (must(weights) as unknown[]).reverse(),
    goal: a.profile.goal,
    calories: { avg7: avgCalories, daysLogged: perDay.size, partialDays: allDays.size - perDay.size, target },
    habitToday: hs.find((h) => h.date === a.today) ?? null,
    habitsWeek: hs,
    streak: { current: effectiveStreak(streak, a.today), longest: streak.longest, total: streak.total },
    badges: must(badges),
    weekDays: [...new Set((must(done) as { date: string }[]).map((r) => r.date))],
    waterTarget: a.profile.weight_kg ? dailyWaterCups(Number(a.profile.weight_kg)) : 8,
  });
});
