import { z } from "zod";
import { after } from "next/server";
import { quickstartState } from "@/server/quickstart";
import { planToday } from "@/server/autolog";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { foodDay, recentFoods, resolveEntry, MAX_ENTRIES_PER_DAY } from "@/server/food";

const Manual = z.object({ source: z.literal("manual"), name: z.string().trim().min(1).max(120), calories: z.number().int().min(0).max(5000), protein_g: z.number().min(0).max(500).optional(), carbs_g: z.number().min(0).max(800).optional(), fat_g: z.number().min(0).max(400).optional() });
const Ref = z.object({
  source: z.enum(["meal", "recipe", "repeat"]),
  mealId: z.string().max(60).optional(),
  recipeId: z.string().uuid().optional(),
  entryId: z.string().uuid().optional(),
  portion: z.number().min(0.5).max(3).optional(),
  exclude: z.array(z.number().int().min(0).max(19)).max(20).optional(),
  swap: z.array(z.object({ i: z.number().int().min(0).max(19), a: z.number().int().min(0).max(1) })).max(20).optional(),
});

/** Today's food diary: entries, totals and the daily target. */
async function dayWithRecent(a: Awaited<ReturnType<typeof requireUser>>) {
  const [day, recent, plan] = await Promise.all([foodDay(a), recentFoods(a, 8), planToday(a)]);
  // today's plan meals: the "Add to your day" sheet offers these first
  return { ...day, recent, plan: plan.day ? plan.day.slots : null };
}

export const GET = route(async (req) => ok(await dayWithRecent(await requireUser(req))));

/** Add an item. Catalogue and AI items are resolved on the server; manual entries are validated and capped. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("food", a.username, 120, 3600);
  const body = await readJson(req);
  const count = (await db().from("hl_food_log").select("id", { count: "exact", head: true }).eq("username", a.username).eq("date", a.today)).count ?? 0;
  if (count >= MAX_ENTRIES_PER_DAY) throw E.bad("وصلت للحد الأقصى لعناصر اليوم.", "You reached today's entry limit.");
  const manual = Manual.safeParse(body);
  const row = manual.success
    ? { name: manual.data.name, calories: manual.data.calories, protein_g: manual.data.protein_g ?? 0, carbs_g: manual.data.carbs_g ?? null, fat_g: manual.data.fat_g ?? null, source: "manual" as const, source_id: null }
    : await (async () => { const r = Ref.safeParse(body); if (!r.success) throw E.bad(); return resolveEntry(a, r.data); })();
  must(await db().from("hl_food_log").insert({ username: a.username, date: a.today, ...row }));
  // The first meal of a day may be the quick-start step: credit it before answering so the balance is right; later meals do it in the background.
  if (count === 0) await quickstartState(a.username).catch(() => undefined);
  else after(() => quickstartState(a.username).then(() => undefined, () => undefined));
  return ok(await dayWithRecent(a));
});

/** Change the portion of one of today's entries (the plan's meals can be made bigger or smaller). Catalogue meals are recomputed from the catalogue; other entries are scaled. */
export const PATCH = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("food", a.username, 120, 3600);
  const { id, servings } = await readJson<{ id?: string; servings?: number }>(req);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || typeof servings !== "number" || !Number.isFinite(servings) || servings < 0.5 || servings > 3 || servings * 4 !== Math.round(servings * 4)) throw E.bad("اختر حصة بين ٠٫٥ و٣.", "Pick a portion between 0.5 and 3.");
  const row = must(await db().from("hl_food_log").select("id,calories,protein_g,carbs_g,fat_g,source,source_id,servings").eq("id", id).eq("username", a.username).eq("date", a.today).maybeSingle()) as { id: string; calories: number; protein_g: number | string; carbs_g: number | string | null; fat_g: number | string | null; source: string; source_id: string | null; servings: number | string } | null;
  if (!row) throw E.notFound();
  const old = Number(row.servings) || 1;
  let upd: { calories: number; protein_g: number; carbs_g: number | null; fat_g: number | null };
  if (row.source === "meal" && row.source_id) {
    // (a snack is resolved from the planner by the same call)
    const r = await resolveEntry(a, { source: "meal", mealId: row.source_id, portion: servings });
    upd = { calories: r.calories, protein_g: r.protein_g, carbs_g: null, fat_g: null };
  } else {
    const k = servings / old, r1 = (n: number) => Math.round(n * 10) / 10;
    upd = { calories: Math.min(5000, Math.round(row.calories * k)), protein_g: r1(Number(row.protein_g) * k), carbs_g: row.carbs_g === null ? null : r1(Number(row.carbs_g) * k), fat_g: row.fat_g === null ? null : r1(Number(row.fat_g) * k) };
  }
  // Once the person edits an entry it is theirs: it no longer counts as "added automatically".
  must(await db().from("hl_food_log").update({ ...upd, servings, auto: false }).eq("id", id).eq("username", a.username));
  return ok(await dayWithRecent(a));
});

export const DELETE = route(async (req) => {
  const a = await requireUser(req);
  const { id } = await readJson<{ id?: string }>(req);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw E.bad();
  must(await db().from("hl_food_log").delete().eq("id", id).eq("username", a.username));
  return ok(await dayWithRecent(a));
});
