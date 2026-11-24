import { SPLIT, clampCalories } from "./nutrition";
import { addDays, hash } from "./dates";

export type PlanMealRef = { id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; calories: number; protein_g: number; tags: string[]; cuisine?: string; ingredients?: { item: string }[] };

/** Imported / expensive ingredients and dishes: kept out of the default plan, available only with "international / premium" on. */
const PREMIUM = /shrimp|prawn|جمبري|avocado|افوكادو|أفوكادو|coconut|جوز الهند|bulgogi|بولجوجي|curry|كاري|salmon|سلمون|teriyaki|تيرياكي|tom-?yum|توم يام|taco|تاكو|prosciutto|truffle|ratatouille|burrito|bibimbap|bruschetta|minestrone|pesto/i;
/** The affordable Egyptian set used by default: Egyptian dishes without premium ingredients. */
export function isAffordable(m: PlanMealRef): boolean {
  if (m.cuisine && m.cuisine !== "egyptian") return false;
  return !PREMIUM.test(`${m.id} ${m.name_en} ${m.name_ar} ${(m.ingredients ?? []).map((i) => i.item).join(" ")}`);
}
/** The meals a plan may use: affordable Egyptian ones by default, everything when the user opts into international / premium. */
export const planPool = (meals: PlanMealRef[], premium: boolean) => (premium ? meals : meals.filter(isAffordable));

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

const STEP = 0.25, MIN_SERV = 0.5, MAX_SERV = 3;
const roundStep = (n: number) => Math.round(n / STEP) * STEP;
/** Daily totals must land within this share of the target (plan acceptance: +-5%; we aim tighter). */
export const PLAN_TOLERANCE = 0.05;

/**
 * Scale portions (never the number of meals) so a day's total matches the target: each step moves one slot by a quarter
 * serving, always the step that gets closest. Stops inside +-3% or when no slot has room left. Calories and protein follow.
 */
export function rebalanceDay(slots: PlanSlot[], target: number): void {
  const per = slots.map((s) => ({ s, kcal: s.calories / s.servings, prot: s.protein_g / s.servings }));
  const total = () => slots.reduce((n, x) => n + x.calories, 0);
  for (let i = 0; i < 60; i++) {
    const diff = target - total();
    if (Math.abs(diff) <= target * 0.03) break;
    let best: { k: number; delta: number } | null = null;
    per.forEach((x, k) => {
      const dir = diff > 0 ? 1 : -1;
      const next = x.s.servings + dir * STEP;
      if (next < MIN_SERV - 1e-9 || next > MAX_SERV + 1e-9) return;
      const delta = dir * STEP * x.kcal;
      if (Math.abs(diff - delta) >= Math.abs(diff)) return; // would overshoot further than it helps
      if (!best || Math.abs(diff - delta) < Math.abs(diff - best.delta)) best = { k, delta };
    });
    if (!best) break;
    const x = per[(best as { k: number }).k];
    x.s.servings = roundStep(x.s.servings + Math.sign((best as { delta: number }).delta) * STEP);
    x.s.calories = Math.round(x.kcal * x.s.servings);
    x.s.protein_g = Math.round(x.prot * x.s.servings);
  }
}

/**
 * Build a 7-day plan from the catalogue. Portions are scaled (0.5x .. 3x servings, quarter steps) so slot calories land
 * near the target split (25 / 40 / 35 %) and then the whole day is balanced to the daily target (+-5%). Returns `gaps`: slots where no catalogue meal carries the
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
          const servings = Math.max(MIN_SERV, Math.min(MAX_SERV, roundStep(slotKcal / m.calories)));
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
    rebalanceDay(slots, target);
    days.push({ date: addDays(opts.weekStart, d), slots, total_kcal: slots.reduce((s, x) => s + x.calories, 0) });
  }
  return { days, gaps, calorieTarget: target };
}
