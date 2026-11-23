import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { foodDay, resolveEntry, MAX_ENTRIES_PER_DAY } from "@/server/food";

const Manual = z.object({ source: z.literal("manual"), name: z.string().trim().min(1).max(120), calories: z.number().int().min(0).max(5000), protein_g: z.number().min(0).max(500).optional() });
const Ref = z.object({ source: z.enum(["meal", "recipe"]), mealId: z.string().max(60).optional(), recipeId: z.string().uuid().optional() });

/** Today's food diary: entries, totals and the daily target. */
export const GET = route(async (req) => ok(await foodDay(await requireUser(req))));

/** Add an item. Catalogue and AI items are resolved on the server; manual entries are validated and capped. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("food", a.username, 120, 3600);
  const body = await readJson(req);
  const count = (await db().from("hl_food_log").select("id", { count: "exact", head: true }).eq("username", a.username).eq("date", a.today)).count ?? 0;
  if (count >= MAX_ENTRIES_PER_DAY) throw E.bad("وصلت للحد الأقصى لعناصر اليوم.", "You reached today's entry limit.");
  const manual = Manual.safeParse(body);
  const row = manual.success
    ? { name: manual.data.name, calories: manual.data.calories, protein_g: manual.data.protein_g ?? 0, source: "manual" as const, source_id: null }
    : await (async () => { const r = Ref.safeParse(body); if (!r.success) throw E.bad(); return resolveEntry(a, r.data); })();
  must(await db().from("hl_food_log").insert({ username: a.username, date: a.today, ...row }));
  return ok(await foodDay(a));
});

export const DELETE = route(async (req) => {
  const a = await requireUser(req);
  const { id } = await readJson<{ id?: string }>(req);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw E.bad();
  must(await db().from("hl_food_log").delete().eq("id", id).eq("username", a.username));
  return ok(await foodDay(a));
});
