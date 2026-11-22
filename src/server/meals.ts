import { db, must } from "./supabase";
import { ensureSeeded } from "./seed";
import { dayNumber } from "@/lib/dates";
import type { MealIngredient } from "@/data/meals";

export type MealRow = {
  id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; photo_url: string | null;
  time_min: number; calories: number; protein_g: number; cost_egp: number; why_ar: string; why_en: string;
  cuisine: "egyptian" | "international"; origin_ar: string | null; origin_en: string | null;
  tags: string[]; ingredients: MealIngredient[]; ingredient_keys: string[]; steps: string[]; active: boolean;
};

export async function listMeals(f: { cuisine?: string; type?: string; tags?: string[]; have?: string[]; q?: string }): Promise<MealRow[]> {
  await ensureSeeded();
  let q = db().from("hl_meals").select("*").eq("active", true).order("meal_type").order("id");
  if (f.type && ["breakfast", "lunch", "dinner"].includes(f.type)) q = q.eq("meal_type", f.type);
  if (f.cuisine === "egyptian" || f.cuisine === "international") q = q.eq("cuisine", f.cuisine);
  if (f.tags?.length) q = q.contains("tags", f.tags);
  // "I have these ingredients": every non-staple ingredient of the meal must be among the ticked ones.
  if (f.have?.length) q = q.containedBy("ingredient_keys", f.have);
  if (f.q?.trim()) q = q.ilike("name_ar", `%${f.q.trim().replace(/[%_]/g, "")}%`);
  return must(await q) as MealRow[];
}

export async function getMeal(id: string): Promise<MealRow | null> {
  return must(await db().from("hl_meals").select("*").eq("id", id).maybeSingle()) as MealRow | null;
}

/** Breakfast / lunch / dinner of the day: admin override first, otherwise a daily rotation. */
export async function mealsOfTheDay(date: string): Promise<Record<"breakfast" | "lunch" | "dinner", MealRow | null>> {
  await ensureSeeded();
  const [all, overrides] = await Promise.all([
    db().from("hl_meals").select("*").eq("active", true).order("id"),
    db().from("hl_meal_overrides").select("meal_type, meal_id").eq("date", date),
  ]);
  const meals = must(all) as MealRow[];
  const ov = new Map((must(overrides) as { meal_type: string; meal_id: string }[]).map((o) => [o.meal_type, o.meal_id]));
  const pick = (type: "breakfast" | "lunch" | "dinner") => {
    const ofType = meals.filter((m) => m.meal_type === type);
    const forced = ov.get(type) ? ofType.find((m) => m.id === ov.get(type)) : undefined;
    if (forced) return forced;
    return ofType.length ? ofType[dayNumber(date) % ofType.length] : null;
  };
  return { breakfast: pick("breakfast"), lunch: pick("lunch"), dinner: pick("dinner") };
}
