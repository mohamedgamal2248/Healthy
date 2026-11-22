import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { hasActivePlan } from "@/server/credits";
import { planForWeek } from "@/server/plan";
import { weekStart, addDays } from "@/lib/dates";
import { INGREDIENT_MAP } from "@/data/ingredients";
import { E } from "@/server/http";

type Slot = { meal_id?: string; servings: number; recipe?: { ingredients?: { item: string }[] } };

/** Shopping list for this week's plan: ingredient -> how many meals use it (free-text quantities can't be summed safely). */
export const GET = route(async (req) => {
  const a = await requireVerified(req);
  if (!(await hasActivePlan(a.username))) throw E.needPlan();
  const url = new URL(req.url);
  const week = url.searchParams.get("week") === "next" ? addDays(weekStart(a.today), 7) : weekStart(a.today);
  const plan = await planForWeek(a.username, week);
  if (!plan) return ok({ week, items: [] });
  const slots = plan.plan.days.flatMap((d) => d.slots) as Slot[];
  const ids = [...new Set(slots.map((s) => s.meal_id).filter(Boolean) as string[])];
  const meals = ids.length ? (must(await db().from("hl_meals").select("id,ingredients").in("id", ids)) as { id: string; ingredients: { item: string; qty: string; key?: string }[] }[]) : [];
  const byId = new Map(meals.map((m) => [m.id, m]));
  const agg = new Map<string, { key: string | null; item: string; group: string; uses: number; sample: string[] }>();
  const add = (k: string | null, item: string, qty?: string) => {
    const id = k ?? `x:${item}`;
    const cur = agg.get(id) ?? { key: k, item: k ? INGREDIENT_MAP[k]?.ar ?? item : item, group: k ? INGREDIENT_MAP[k]?.group ?? "other" : "other", uses: 0, sample: [] };
    cur.uses++;
    if (qty && cur.sample.length < 3 && !cur.sample.includes(qty)) cur.sample.push(qty);
    agg.set(id, cur);
  };
  for (const s of slots) {
    if (s.meal_id && byId.has(s.meal_id)) for (const i of byId.get(s.meal_id)!.ingredients) { if (i.key) add(i.key, i.item, i.qty); }
    else if (s.recipe?.ingredients) for (const i of s.recipe.ingredients) add(null, i.item);
  }
  const order = ["protein", "dairy", "veg", "fruit", "grain", "other"];
  const items = [...agg.values()].sort((x, y) => order.indexOf(x.group) - order.indexOf(y.group) || y.uses - x.uses);
  return ok({ week, items });
});
