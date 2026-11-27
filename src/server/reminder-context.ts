import { db, must } from "./supabase";
import { dailyCalories, type Activity, type Goal, type Sex } from "@/lib/nutrition";
import { weekStart } from "@/lib/dates";
import type { DaySnapshot } from "@/lib/reminder";
import { macroTargets } from "./food";

type Who = { username: string; local_date: string };
type Prof = { username: string; age: number | null; sex: string | null; weight_kg: number | string | null; height_cm: number | string | null; goal: string | null; activity: string | null; conditions: string[] | null };

/**
 * Today's food and targets for the people being reminded, in three queries per chunk (not per person).
 * `local_date` is each person's own local day. Anything missing simply yields no snapshot, and the plain reminder is sent.
 */
export async function daySnapshots(people: Who[]): Promise<Map<string, DaySnapshot>> {
  const out = new Map<string, DaySnapshot>();
  for (let k = 0; k < people.length; k += 200) {
    const chunk = people.slice(k, k + 200);
    const names = chunk.map((p) => p.username);
    const dates = [...new Set(chunk.map((p) => p.local_date))];
    const weeks = [...new Set(chunk.map((p) => weekStart(p.local_date)))];
    const [food, plans, profiles] = await Promise.all([
      db().from("hl_food_log").select("username,date,calories,protein_g,auto").in("username", names).in("date", dates).limit(5000),
      db().from("hl_diet_plans").select("username,week_start,daily_calorie_target").in("username", names).in("week_start", weeks),
      db().from("hl_profiles").select("username,age,sex,weight_kg,height_cm,goal,activity,conditions").in("username", names),
    ]);
    const eaten = new Map<string, { kcal: number; prot: number; n: number }>();
    for (const r of must(food) as { username: string; date: string; calories: number; protein_g: number | string; auto: boolean }[]) {
      const key = `${r.username}|${r.date}`;
      const e = eaten.get(key) ?? { kcal: 0, prot: 0, n: 0 };
      e.kcal += Number(r.calories); e.prot += Number(r.protein_g); if (!r.auto) e.n++; // plan meals put in automatically do not count as "logged"
      eaten.set(key, e);
    }
    const planTarget = new Map((must(plans) as { username: string; week_start: string; daily_calorie_target: number }[]).map((p) => [`${p.username}|${p.week_start}`, p.daily_calorie_target]));
    const prof = new Map((must(profiles) as Prof[]).map((p) => [p.username, p]));
    for (const p of chunk) {
      let target = planTarget.get(`${p.username}|${weekStart(p.local_date)}`) ?? null;
      const pr = prof.get(p.username);
      if (!target && pr && pr.age && pr.sex && pr.weight_kg && pr.height_cm && pr.goal && pr.activity) {
        target = dailyCalories({ weightKg: Number(pr.weight_kg), heightCm: Number(pr.height_cm), age: pr.age, sex: pr.sex as Sex, goal: pr.goal as Goal, activity: pr.activity as Activity, conditions: pr.conditions ?? [] });
      }
      const e = eaten.get(`${p.username}|${p.local_date}`) ?? { kcal: 0, prot: 0, n: 0 };
      out.set(p.username, { target, proteinTarget: macroTargets(target)?.protein ?? null, eatenKcal: e.kcal, eatenProtein: e.prot, entries: e.n });
    }
  }
  return out;
}
