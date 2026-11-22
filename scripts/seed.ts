// Seeds challenges and meals into Supabase. Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
import { createClient } from "@supabase/supabase-js";
import { CHALLENGE_SEEDS } from "../src/data/challenges";
import { MEAL_SEEDS } from "../src/data/meals";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const ch = await sb.from("challenges").upsert(CHALLENGE_SEEDS.map((c) => ({ ...c, active: true })), { onConflict: "id", ignoreDuplicates: true });
  if (ch.error) throw ch.error;

  const rows = MEAL_SEEDS.map((m) => ({
    id: m.id, meal_type: m.meal_type, name_ar: m.name_ar, name_en: m.name_en, time_min: m.time_min,
    calories: m.calories, protein_g: m.protein_g, cost_egp: m.cost_egp, why_ar: m.why_ar, why_en: m.why_en,
    tags: m.tags, ingredients: m.ingredients, steps: m.steps,
    ingredient_keys: Array.from(new Set(m.ingredients.map((i) => i.key).filter(Boolean))),
    active: true,
  }));
  // ignoreDuplicates keeps admin edits to already-seeded meals intact.
  const ml = await sb.from("meals").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (ml.error) throw ml.error;
  console.log(`Seeded ${CHALLENGE_SEEDS.length} challenges and ${MEAL_SEEDS.length} meals.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
