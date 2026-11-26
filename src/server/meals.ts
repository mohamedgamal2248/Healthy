import { db, must } from "./supabase";
import { ensureSeeded } from "./seed";
import { memo } from "./memo";
import { dayNumber } from "@/lib/dates";
import type { MealIngredient } from "@/data/meals";

export type MealRow = {
  id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; photo_url: string | null;
  time_min: number; calories: number; protein_g: number; cost_egp: number; why_ar: string; why_en: string;
  cuisine: "egyptian" | "international"; origin_ar: string | null; origin_en: string | null;
  ingredients_en: { item: string; qty: string }[] | null; steps_en: string[] | null;
  tags: string[]; ingredients: MealIngredient[]; missing_keys?: string[]; ingredient_keys: string[]; steps: string[]; active: boolean;
};

let mealsCache: { at: number; rows: MealRow[] } | null = null;
const CATALOGUE_TTL_MS = 60_000;
export const invalidateCatalogueCache = () => { mealsCache = null; };

/** The whole active catalogue (~110 rows) cached in memory for a minute: every list / daily pick reads this. */
async function activeMeals(): Promise<MealRow[]> {
  if (mealsCache && Date.now() - mealsCache.at < CATALOGUE_TTL_MS) return mealsCache.rows;
  await ensureSeeded();
  const rows = must(await db().from("hl_meals").select("*").eq("active", true).order("meal_type").order("id")) as MealRow[];
  mealsCache = { at: Date.now(), rows };
  return rows;
}

/** Pantry basics assumed to be at home when matching "I have these ingredients". */
export const PANTRY_KEYS = new Set(["onion", "garlic", "lemon"]);
const MAX_MISSING = 2;

export async function listMeals(f: { cuisine?: string; type?: string; tags?: string[]; have?: string[]; q?: string }): Promise<MealRow[]> {
  const q = f.q?.trim();
  const base = (await activeMeals()).filter(
    (m) =>
      (!f.cuisine || (f.cuisine !== "egyptian" && f.cuisine !== "international") || m.cuisine === f.cuisine) &&
      (!f.type || m.meal_type === f.type) &&
      (!f.tags?.length || f.tags.every((t) => m.tags.includes(t))) &&
      (!q || m.name_ar.includes(q) || m.name_en.toLowerCase().includes(q.toLowerCase())),
  );
  if (!f.have?.length) return base;
  return matchByIngredients(base, f.have);
}

/**
 * "I have these ingredients": rank by what is missing. 0 missing = ready to cook; up to 2 missing = almost there.
 * Salt, oil, spices and (onion, garlic, lemon) are assumed available.
 */
export function matchByIngredients<T extends { id: string; ingredient_keys: string[] }>(meals: T[], haveList: string[]): (T & { missing_keys: string[] })[] {
  {
    const have = new Set(haveList);
    return meals
    .map((m) => {
      const needed = m.ingredient_keys.filter((k) => !PANTRY_KEYS.has(k));
      const missing = needed.filter((k) => !have.has(k));
      const matched = needed.length - missing.length;
      return { m: { ...m, missing_keys: missing }, missing: missing.length, matched, needed: needed.length };
    })
    .filter((x) => x.missing <= MAX_MISSING && (x.matched >= 1 || x.needed === 0))
    .sort((x, y) => x.missing - y.missing || y.matched - x.matched || (x.m.id < y.m.id ? -1 : 1))
    .map((x) => x.m);
  }
}

export async function getMeal(id: string): Promise<MealRow | null> {
  return must(await db().from("hl_meals").select("*").eq("id", id).maybeSingle()) as MealRow | null;
}

/** Breakfast / lunch / dinner of the day: admin override first, otherwise a daily rotation. */
export async function mealsOfTheDay(date: string): Promise<Record<"breakfast" | "lunch" | "dinner", MealRow | null>> {
  // Overrides are the same for every user on a date: cached briefly so each Today view does not re-read them.
  const [meals, overrides] = await Promise.all([activeMeals(), memo(`ov:${date}`, 60_000, async () => must(await db().from("hl_meal_overrides").select("meal_type, meal_id").eq("date", date)) as { meal_type: string; meal_id: string }[])]);
  const ov = new Map(overrides.map((o) => [o.meal_type, o.meal_id]));
  const pick = (type: "breakfast" | "lunch" | "dinner") => {
    const ofType = [...meals].filter((m) => m.meal_type === type).sort((x, y) => (x.id < y.id ? -1 : 1));
    const forced = ov.get(type) ? ofType.find((m) => m.id === ov.get(type)) : undefined;
    if (forced) return forced;
    return ofType.length ? ofType[dayNumber(date) % ofType.length] : null;
  };
  return { breakfast: pick("breakfast"), lunch: pick("lunch"), dinner: pick("dinner") };
}
