import { db, must } from "./supabase";
import { E } from "./http";
import type { Auth } from "./auth";
import { weekStart } from "@/lib/dates";
import { dailyCalories, type Activity, type Goal, type Sex } from "@/lib/nutrition";
import { getMeal } from "./meals";

export type FoodEntry = { id: string; name: string; calories: number; protein_g: number; source: "meal" | "scan" | "manual" };
export const MAX_ENTRIES_PER_DAY = 40;

/** Daily calorie target: this week's plan if there is one, otherwise computed from the profile (never below the safe floor). */
export async function dailyTarget(a: Auth): Promise<number | null> {
  const plan = must(await db().from("hl_diet_plans").select("daily_calorie_target").eq("username", a.username).eq("week_start", weekStart(a.today)).maybeSingle()) as { daily_calorie_target: number } | null;
  if (plan?.daily_calorie_target) return plan.daily_calorie_target;
  const p = a.profile;
  if (!p.age || !p.sex || !p.weight_kg || !p.height_cm || !p.goal || !p.activity) return null;
  return dailyCalories({ weightKg: Number(p.weight_kg), heightCm: Number(p.height_cm), age: p.age, sex: p.sex as Sex, goal: p.goal as Goal, activity: p.activity as Activity, conditions: p.conditions });
}

export async function foodDay(a: Auth) {
  const entries = must(await db().from("hl_food_log").select("id,name,calories,protein_g,source").eq("username", a.username).eq("date", a.today).order("created_at", { ascending: true }).limit(MAX_ENTRIES_PER_DAY)) as FoodEntry[];
  const calories = entries.reduce((n, e) => n + e.calories, 0);
  const protein = Math.round(entries.reduce((n, e) => n + Number(e.protein_g), 0) * 10) / 10;
  return { date: a.today, entries: entries.map((e) => ({ ...e, protein_g: Number(e.protein_g) })), totals: { calories, protein_g: protein }, target: await dailyTarget(a) };
}

type Add = { name: string; calories: number; protein_g: number; source: FoodEntry["source"]; source_id: string | null };

/** Resolve what to log from a SERVER-side source, so the client can never invent nutrition numbers for catalogue or AI items. */
export async function resolveEntry(a: Auth, b: { source?: string; mealId?: string; recipeId?: string }): Promise<Add> {
  const ar = a.profile.language === "ar";
  if (b.source === "meal" && b.mealId) {
    const m = await getMeal(b.mealId);
    if (!m || !m.active) throw E.notFound();
    return { name: (ar ? m.name_ar : m.name_en) || m.name_en, calories: Math.round(Number(m.calories)), protein_g: Number(m.protein_g), source: "meal", source_id: m.id };
  }
  if (b.source === "recipe" && b.recipeId) {
    const r = must(await db().from("hl_recipes").select("id,title,content").eq("id", b.recipeId).eq("username", a.username).maybeSingle()) as { id: string; title: string; content: { kind?: string; scan?: { dish_name: string; dish_name_local?: string; totals: { calories: { mid: number }; protein_g: { mid: number } } }; recipe?: { name: string; calories: number; protein: number } } } | null;
    if (!r) throw E.notFound();
    const c = r.content;
    if (c?.scan) return { name: (ar && c.scan.dish_name_local ? c.scan.dish_name_local : c.scan.dish_name).slice(0, 120), calories: Math.round(c.scan.totals.calories.mid), protein_g: Math.round(c.scan.totals.protein_g.mid * 10) / 10, source: "scan", source_id: r.id };
    if (c?.recipe) return { name: c.recipe.name.slice(0, 120), calories: Math.round(c.recipe.calories), protein_g: Math.round(c.recipe.protein * 10) / 10, source: "scan", source_id: r.id };
    throw E.bad("هذا العنصر لا يحتوي على سعرات يمكن إضافتها.", "This item has no calories to add.");
  }
  throw E.bad();
}
