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
  type: "breakfast" | "lunch" | "dinner" | "snack";
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

/** Portions stay realistic: three-quarters to one and a half servings. Bigger targets get snacks, never triple plates. */
export const STEP = 0.25, MIN_SERV = 0.75, MAX_SERV = 1.5;

/** Simple, cheap Egyptian snacks used to reach high calorie targets without oversized portions. Halal, no nuts. */
type Snack = { id: string; name_ar: string; name_en: string; calories: number; protein_g: number; tags: string[] };
export const SNACKS: Snack[] = [
  { id: "snack-yogurt-banana", name_ar: "زبادي بالموز", name_en: "Yogurt with banana", calories: 230, protein_g: 10, tags: ["low_salt"] },
  { id: "snack-eggs-bread", name_ar: "بيضتين مسلوقتين مع ربع رغيف بلدي", name_en: "Two boiled eggs with a quarter baladi loaf", calories: 240, protein_g: 15, tags: ["diabetes_friendly"] },
  { id: "snack-cottage-cucumber", name_ar: "جبنة قريش بالخيار وربع رغيف", name_en: "Cottage cheese, cucumber and a quarter loaf", calories: 210, protein_g: 18, tags: ["diabetes_friendly"] },
  { id: "snack-milk-oats", name_ar: "كوب لبن بالشوفان", name_en: "Milk with oats", calories: 280, protein_g: 13, tags: ["low_salt"] },
  { id: "snack-lentil-soup", name_ar: "كوب شوربة عدس", name_en: "Cup of lentil soup", calories: 220, protein_g: 13, tags: ["diabetes_friendly", "low_salt"] },
  { id: "snack-tuna-salad", name_ar: "سلطة تونة صغيرة", name_en: "Small tuna salad", calories: 200, protein_g: 20, tags: ["diabetes_friendly"] },
  { id: "snack-fruit", name_ar: "تفاحة وبرتقالة", name_en: "An apple and an orange", calories: 150, protein_g: 2, tags: ["low_salt"] },
  { id: "snack-rice-pudding", name_ar: "رز بلبن", name_en: "Rice pudding (roz bel laban)", calories: 300, protein_g: 8, tags: ["low_salt"] },
  { id: "snack-tahini-molasses", name_ar: "ربع رغيف بلدي بالطحينة والعسل الأسود", name_en: "Baladi bread with tahini and molasses", calories: 330, protein_g: 8, tags: ["low_salt"] },
  { id: "snack-dates-milk", name_ar: "بلح مع كوب لبن", name_en: "Dates with a glass of milk", calories: 320, protein_g: 9, tags: ["low_salt"] },
  { id: "snack-egg-potato-sandwich", name_ar: "ساندوتش بيض وبطاطس مسلوقة", name_en: "Egg and boiled potato sandwich", calories: 400, protein_g: 15, tags: [] },
  { id: "snack-oats-banana-honey", name_ar: "شوفان باللبن والموز والعسل", name_en: "Oats with milk, banana and honey", calories: 420, protein_g: 14, tags: ["low_salt"] },
  { id: "snack-foul-sandwich", name_ar: "ساندوتش فول صغير", name_en: "Small foul sandwich", calories: 300, protein_g: 12, tags: ["diabetes_friendly"] },
];
/** At most this many snacks per day. */
const MAX_SNACKS = 3;
/** Daily protein target (g) for a body weight and goal: 1.4-1.8 g/kg, the common range for active adults. */
export function proteinTarget(weightKg: number, goal: string): number {
  const perKg = goal === "gain" ? 1.8 : goal === "lose" ? 1.6 : 1.4;
  return Math.round(weightKg * perKg);
}
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
      if (x.s.type === "snack") return; // snacks stay one serving
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
 * Build a 7-day plan from the catalogue. Portions are scaled (0.75x .. 1.5x servings, quarter steps), snacks are added when meals alone cannot reach the target, so slot calories land
 * near the target split (25 / 40 / 35 %) and then the whole day is balanced to the daily target (+-5%). Returns `gaps`: slots where no catalogue meal carries the
 * required condition tags, so the caller can complete them with AI (or leave them out when AI is off).
 */
export function buildWeekPlan(opts: { meals: PlanMealRef[]; calorieTarget: number; conditions: string[]; goal: string; weekStart: string; seed: string; weightKg?: number }) {
  const target = clampCalories(opts.calorieTarget);
  // Protein: aim for the realistic range, never far above it. Without a weight, assume ~1.6 g per 20 kcal of target / 25.
  const protTarget = opts.weightKg ? proteinTarget(opts.weightKg, opts.goal) : Math.round(target / 20);
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
          const protOver = Math.max(0, (m.protein_g * servings) / (protTarget * SPLIT[type]) - 1.1); // above its protein share
          const score = fit + protOver * 2 + (used.get(m.id) ?? 0) * 0.15 + (prevDay.has(m.id) ? 0.5 : 0) - (prefer && m.tags.includes(prefer) ? 0.1 : 0) + (hash(`${opts.seed}:${d}:${m.id}`) % 100) / 5000;
          return { m, servings, score };
        })
        .sort((a, b) => a.score - b.score);
      const { m, servings } = scored[0];
      used.set(m.id, (used.get(m.id) ?? 0) + 1);
      today.add(m.id);
      slots.push({ type, source: "catalogue", meal_id: m.id, name_ar: m.name_ar, name_en: m.name_en, servings, calories: Math.round(m.calories * servings), protein_g: Math.round(m.protein_g * servings) });
    }
    prevDay = today;
    // Fill what the capped portions cannot reach with simple snacks (closest fit first, never the same one twice a day).
    const snackPool = SNACKS.filter((x) => req.every((t) => x.tags.includes(t)));
    for (let k = 0; k < MAX_SNACKS; k++) {
      const reach = slots.reduce((n, x) => n + (x.type === "snack" ? x.calories : x.calories * (MAX_SERV / x.servings)), 0); // what this day could reach at most
      if (reach >= target * 1.02) break;
      const gap = Math.max(150, (target * 1.02 - reach) / (MAX_SNACKS - k));
      const pick = snackPool
        .filter((x) => !slots.some((y) => y.meal_id === x.id))
        .map((x) => ({ x, score: Math.abs(x.calories - gap) + Math.max(0, x.protein_g - 10) * 4 + (hash(`${opts.seed}:${d}:${x.id}`) % 40) }))
        .sort((a, b) => a.score - b.score)[0];
      if (!pick) break;
      slots.push({ type: "snack", source: "catalogue", meal_id: pick.x.id, name_ar: pick.x.name_ar, name_en: pick.x.name_en, servings: 1, calories: pick.x.calories, protein_g: pick.x.protein_g });
    }
    rebalanceDay(slots, target);
    days.push({ date: addDays(opts.weekStart, d), slots, total_kcal: slots.reduce((s, x) => s + x.calories, 0) });
  }
  return { days, gaps, calorieTarget: target };
}
