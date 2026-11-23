import { db, must } from "./supabase";
import { E } from "./http";
import type { Auth } from "./auth";
import { addDays, weekStart } from "@/lib/dates";
import { dailyCalories, type Activity, type Goal, type Sex } from "@/lib/nutrition";
import { getMeal } from "./meals";

export type FoodEntry = { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; source: "meal" | "scan" | "manual"; estimated: boolean };
export const MAX_ENTRIES_PER_DAY = 40;
/** Daily macro split of the calorie target (energy share): protein 25%, carbs 50%, fat 25%. */
export const MACRO_SPLIT = { protein: 0.25, carbs: 0.5, fat: 0.25 } as const;

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Carbs/fat when only calories and protein are known (catalogue meals, text recipes, older entries):
 * the energy left after protein is shared 55% carbs / 45% fat. Always shown to the user as an estimate.
 */
export function estimateCarbsFat(calories: number, protein: number): { carbs_g: number; fat_g: number } {
  const rest = Math.max(0, calories - 4 * protein);
  return { carbs_g: r1((rest * 0.55) / 4), fat_g: r1((rest * 0.45) / 9) };
}

export function macroTargets(kcal: number | null): { protein: number; carbs: number; fat: number } | null {
  if (!kcal) return null;
  return { protein: Math.round((kcal * MACRO_SPLIT.protein) / 4), carbs: Math.round((kcal * MACRO_SPLIT.carbs) / 4), fat: Math.round((kcal * MACRO_SPLIT.fat) / 9) };
}

/** Daily calorie target: this week's plan if there is one, otherwise computed from the profile (never below the safe floor). */
export async function dailyTarget(a: Auth): Promise<number | null> {
  const plan = must(await db().from("hl_diet_plans").select("daily_calorie_target").eq("username", a.username).eq("week_start", weekStart(a.today)).maybeSingle()) as { daily_calorie_target: number } | null;
  if (plan?.daily_calorie_target) return plan.daily_calorie_target;
  const p = a.profile;
  if (!p.age || !p.sex || !p.weight_kg || !p.height_cm || !p.goal || !p.activity) return null;
  return dailyCalories({ weightKg: Number(p.weight_kg), heightCm: Number(p.height_cm), age: p.age, sex: p.sex as Sex, goal: p.goal as Goal, activity: p.activity as Activity, conditions: p.conditions });
}

type Row = { id: string; name: string; calories: number; protein_g: number | string; carbs_g: number | string | null; fat_g: number | string | null; source: FoodEntry["source"]; created_at?: string; date?: string };
const COLS = "id,name,calories,protein_g,carbs_g,fat_g,source,created_at,date";

export function toEntry(r: Row): FoodEntry {
  const protein = Number(r.protein_g);
  const known = r.carbs_g !== null && r.fat_g !== null;
  const est = known ? { carbs_g: Number(r.carbs_g), fat_g: Number(r.fat_g) } : estimateCarbsFat(r.calories, protein);
  return { id: r.id, name: r.name, calories: r.calories, protein_g: protein, ...est, source: r.source, estimated: !known };
}

export async function foodDay(a: Auth) {
  const rows = must(await db().from("hl_food_log").select(COLS).eq("username", a.username).eq("date", a.today).order("created_at", { ascending: true }).limit(MAX_ENTRIES_PER_DAY)) as Row[];
  const entries = rows.map(toEntry);
  const sum = (k: "calories" | "protein_g" | "carbs_g" | "fat_g") => r1(entries.reduce((n, e) => n + Number(e[k]), 0));
  const target = await dailyTarget(a);
  return { date: a.today, entries, totals: { calories: Math.round(sum("calories")), protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g") }, target, targets: macroTargets(target) };
}

/** The user's recent distinct foods (last 14 days, newest first) for one-tap "repeat". */
export async function recentFoods(a: Auth, limit = 6): Promise<(FoodEntry & { date: string })[]> {
  const rows = must(await db().from("hl_food_log").select(COLS).eq("username", a.username).gte("date", addDays(a.today, -14)).order("created_at", { ascending: false }).limit(60)) as Row[];
  const seen = new Set<string>();
  const out: (FoodEntry & { date: string })[] = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...toEntry(r), date: r.date ?? a.today });
    if (out.length >= limit) break;
  }
  return out;
}

type Add = { name: string; calories: number; protein_g: number; carbs_g: number | null; fat_g: number | null; source: FoodEntry["source"]; source_id: string | null };
type ScanTotals = { calories: { mid: number }; protein_g: { mid: number }; carbs_g: number; fat_g: number };
type ScanLite = { dish_name: string; dish_name_local?: string; ingredients?: { kcal: number }[]; totals: ScanTotals };

/** Portion multiplier chosen on the result screen: ¼ steps between ½ and 3. */
export function validPortion(p: unknown): number {
  const n = typeof p === "number" ? p : 1;
  if (!Number.isFinite(n) || n < 0.5 || n > 3) return 1;
  return Math.round(n * 4) / 4;
}

/**
 * Scale a photo analysis on the SERVER from the stored result: the portion multiplier, and ingredients the user
 * removed ("fix result"). Removing ingredients scales every total by the share of ingredient calories kept.
 */
export function adjustScan(t: ScanTotals, ingredients: { kcal: number }[], portion: number, exclude: number[]) {
  const all = ingredients.reduce((n, i) => n + Math.max(0, i.kcal), 0);
  const removed = ingredients.reduce((n, i, k) => n + (exclude.includes(k) ? Math.max(0, i.kcal) : 0), 0);
  const keep = all > 0 ? Math.max(0, (all - removed) / all) : 1;
  const f = keep * portion;
  return { calories: Math.round(t.calories.mid * f), protein_g: r1(t.protein_g.mid * f), carbs_g: r1(t.carbs_g * f), fat_g: r1(t.fat_g * f) };
}

/** Resolve what to log from a SERVER-side source, so the client can never invent nutrition numbers for catalogue, AI or repeated items. */
export async function resolveEntry(a: Auth, b: { source?: string; mealId?: string; recipeId?: string; entryId?: string; portion?: number; exclude?: number[] }): Promise<Add> {
  const ar = a.profile.language === "ar";
  const portion = validPortion(b.portion);
  if (b.source === "meal" && b.mealId) {
    const m = await getMeal(b.mealId);
    if (!m || !m.active) throw E.notFound();
    const kcal = Math.round(Number(m.calories) * portion), p = r1(Number(m.protein_g) * portion);
    return { name: (ar ? m.name_ar : m.name_en) || m.name_en, calories: kcal, protein_g: p, carbs_g: null, fat_g: null, source: "meal", source_id: m.id };
  }
  if (b.source === "recipe" && b.recipeId) {
    const r = must(await db().from("hl_recipes").select("id,title,content").eq("id", b.recipeId).eq("username", a.username).maybeSingle()) as { id: string; title: string; content: { kind?: string; scan?: ScanLite; recipe?: { name: string; calories: number; protein: number } } } | null;
    if (!r) throw E.notFound();
    const c = r.content;
    if (c?.scan) {
      const ings = c.scan.ingredients ?? [];
      const exclude = [...new Set((b.exclude ?? []).filter((k) => Number.isInteger(k) && k >= 0 && k < ings.length))];
      if (ings.length && exclude.length >= ings.length) throw E.bad("لا يمكن حذف كل المكونات.", "You can't remove every ingredient.");
      const t = adjustScan(c.scan.totals, ings, portion, exclude);
      return { name: (ar && c.scan.dish_name_local ? c.scan.dish_name_local : c.scan.dish_name).slice(0, 120), ...t, source: "scan", source_id: r.id };
    }
    if (c?.recipe) return { name: c.recipe.name.slice(0, 120), calories: Math.round(c.recipe.calories * portion), protein_g: r1(c.recipe.protein * portion), carbs_g: null, fat_g: null, source: "scan", source_id: r.id };
    throw E.bad("هذا العنصر لا يحتوي على سعرات يمكن إضافتها.", "This item has no calories to add.");
  }
  if (b.source === "repeat" && b.entryId) {
    // Copy one of the user's OWN recent entries (last 30 days) as it was logged.
    const e = must(await db().from("hl_food_log").select("name,calories,protein_g,carbs_g,fat_g,source,source_id").eq("id", b.entryId).eq("username", a.username).gte("date", addDays(a.today, -30)).maybeSingle()) as { name: string; calories: number; protein_g: number; carbs_g: number | null; fat_g: number | null; source: FoodEntry["source"]; source_id: string | null } | null;
    if (!e) throw E.notFound();
    return { name: e.name, calories: e.calories, protein_g: Number(e.protein_g), carbs_g: e.carbs_g === null ? null : Number(e.carbs_g), fat_g: e.fat_g === null ? null : Number(e.fat_g), source: e.source, source_id: e.source_id };
  }
  throw E.bad();
}
