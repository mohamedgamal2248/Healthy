import { SPLIT, clampCalories } from "./nutrition";
import { addDays, hash } from "./dates";

export type PlanMealRef = { id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; calories: number; protein_g: number; tags: string[] };

export type PlanSlot = {
  type: "breakfast" | "lunch" | "dinner";
  source: "catalogue" | "ai";
  meal_id?: string;
  name_ar: string;
  name_en: string;
  servings: number;
  calories: number;
  protein_g: number;
  recipe?: unknown;
};
export type PlanDay = { date: string; slots: PlanSlot[]; total_kcal: number };

const TYPES = ["breakfast", "lunch", "dinner"] as const;

/** Tags the catalogue must carry for the user's declared conditions. */
export function requiredTags(conditions: string[]): string[] {
  const t: string[] = [];
  if (conditions.includes("diabetes")) t.push("diabetes_friendly");
  if (conditions.includes("hypertension")) t.push("low_salt");
  return t;
}

const round05 = (n: number) => Math.round(n * 2) / 2;

/**
 * Build a 7-day plan from the catalogue. Portions are scaled (0.5x .. 2x servings) so slot calories land
 * near the target split (25 / 40 / 35 %). Returns `gaps`: slots where no catalogue meal carries the
 * required condition tags, so the caller can complete them with AI (or leave them out when AI is off).
 */
export function buildWeekPlan(opts: { meals: PlanMealRef[]; calorieTarget: number; conditions: string[]; goal: string; weekStart: string; seed: string }) {
  const target = clampCalories(opts.calorieTarget);
  const req = requiredTags(opts.conditions);
  const prefer = opts.goal === "lose" ? "weight_loss" : opts.goal === "gain" ? "muscle_gain" : null;
  const used = new Map<string, number>();
  const days: PlanDay[] = [];
  const gaps: { dayIndex: number; type: (typeof TYPES)[number]; kcal: number }[] = [];
  let prevDay = new Set<string>();

  for (let d = 0; d < 7; d++) {
    const today = new Set<string>();
    const slots: PlanSlot[] = [];
    for (const type of TYPES) {
      const slotKcal = target * SPLIT[type];
      const candidates = opts.meals.filter((m) => m.meal_type === type && req.every((t) => m.tags.includes(t)));
      if (!candidates.length) {
        gaps.push({ dayIndex: d, type, kcal: Math.round(slotKcal) });
        continue;
      }
      const scored = candidates
        .map((m) => {
          const servings = Math.max(0.5, Math.min(2, round05(slotKcal / m.calories)));
          const fit = Math.abs(m.calories * servings - slotKcal) / slotKcal;
          const score = fit + (used.get(m.id) ?? 0) * 0.15 + (prevDay.has(m.id) ? 0.5 : 0) - (prefer && m.tags.includes(prefer) ? 0.1 : 0) + (hash(`${opts.seed}:${d}:${m.id}`) % 100) / 5000;
          return { m, servings, score };
        })
        .sort((a, b) => a.score - b.score);
      const { m, servings } = scored[0];
      used.set(m.id, (used.get(m.id) ?? 0) + 1);
      today.add(m.id);
      slots.push({ type, source: "catalogue", meal_id: m.id, name_ar: m.name_ar, name_en: m.name_en, servings, calories: Math.round(m.calories * servings), protein_g: Math.round(m.protein_g * servings) });
    }
    prevDay = today;
    days.push({ date: addDays(opts.weekStart, d), slots, total_kcal: slots.reduce((s, x) => s + x.calories, 0) });
  }
  return { days, gaps, calorieTarget: target };
}
