// Prints SQL INSERTs for challenges + meals (for pasting into a SQL editor). Usage: npx tsx scripts/seed-sql.ts
import { CHALLENGE_SEEDS } from "../src/data/challenges";
import { MEAL_SEEDS } from "../src/data/meals";
const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
const out: string[] = [];
out.push("insert into hl_challenges (id,type,title_ar,title_en,target_value,unit) values");
out.push(CHALLENGE_SEEDS.map((c) => `(${q(c.id)},${q(c.type)},${q(c.title_ar)},${q(c.title_en)},${c.target_value ?? "null"},${q(c.unit)})`).join(",\n") + "\non conflict (id) do nothing;");
out.push("insert into hl_meals (id,meal_type,name_ar,name_en,time_min,calories,protein_g,cost_egp,why_ar,why_en,tags,ingredients,ingredient_keys,steps) values");
out.push(MEAL_SEEDS.map((m) => {
  const keys = Array.from(new Set(m.ingredients.map((i) => i.key).filter(Boolean) as string[]));
  return `(${q(m.id)},${q(m.meal_type)},${q(m.name_ar)},${q(m.name_en)},${m.time_min},${m.calories},${m.protein_g},${m.cost_egp},${q(m.why_ar)},${q(m.why_en)},${arr(m.tags)},${q(JSON.stringify(m.ingredients))}::jsonb,${arr(keys)},${q(JSON.stringify(m.steps))}::jsonb)`;
}).join(",\n") + "\non conflict (id) do nothing;");
console.log(out.join("\n"));
