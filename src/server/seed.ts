import { db, must } from "./supabase";
import { CHALLENGE_SEEDS } from "@/data/challenges";
import { MEAL_SEEDS } from "@/data/meals";

let done = false;

/** Inserts the seed challenges and meals when those tables are empty. Never overwrites admin edits. */
export async function ensureSeeded(): Promise<void> {
  if (done) return;
  const c = await db().from("hl_challenges").select("id", { count: "exact", head: true });
  if ((c.count ?? 0) === 0) {
    must(await db().from("hl_challenges").upsert(CHALLENGE_SEEDS.map((x) => ({ ...x, active: true })), { onConflict: "id", ignoreDuplicates: true }));
  }
  const m = await db().from("hl_meals").select("id", { count: "exact", head: true });
  // Top up whenever the seed list grew (ignoreDuplicates keeps admin edits to existing meals intact).
  if ((m.count ?? 0) < MEAL_SEEDS.length) {
    must(
      await db().from("hl_meals").upsert(
        MEAL_SEEDS.map((x) => ({
          id: x.id, cuisine: x.cuisine, origin_ar: x.origin_ar ?? null, origin_en: x.origin_en ?? null, meal_type: x.meal_type, name_ar: x.name_ar, name_en: x.name_en, time_min: x.time_min, calories: x.calories,
          protein_g: x.protein_g, cost_egp: x.cost_egp, why_ar: x.why_ar, why_en: x.why_en, tags: x.tags, ingredients: x.ingredients, steps: x.steps,
          ingredient_keys: Array.from(new Set(x.ingredients.map((i) => i.key).filter(Boolean))), active: true,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
  }
  done = true;
}
