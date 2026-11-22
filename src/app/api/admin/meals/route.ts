import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireAdmin } from "@/server/auth";
import { audit } from "@/server/audit";
import { invalidateCatalogueCache } from "@/server/meals";
import { INGREDIENT_MAP, MEAL_TAGS } from "@/data/ingredients";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok({ meals: must(await db().from("hl_meals").select("*").order("meal_type").order("id")) });
});

const Body = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  meal_type: z.enum(["breakfast", "lunch", "dinner"]),
  name_ar: z.string().min(2).max(140),
  name_en: z.string().min(2).max(140),
  photo_url: z.string().url().max(500).nullable().optional(),
  time_min: z.number().int().min(1).max(240),
  calories: z.number().int().min(20).max(2000),
  protein_g: z.number().int().min(0).max(200),
  cost_egp: z.number().int().min(0).max(2000),
  why_ar: z.string().min(2).max(300),
  why_en: z.string().min(2).max(300),
  tags: z.array(z.enum(MEAL_TAGS.map((t) => t.key) as [string, ...string[]])).max(6),
  ingredients: z.array(z.object({ item: z.string().min(1).max(80), qty: z.string().min(1).max(60), key: z.string().refine((k) => k in INGREDIENT_MAP).optional() })).min(2).max(25),
  steps: z.array(z.string().min(2).max(400)).min(2).max(15),
  active: z.boolean().default(true),
});

/** Add / edit / deactivate a catalogue meal. */
export const POST = route(async (req) => {
  const adm = await requireAdmin(req);
  const p = Body.safeParse(await readJson(req));
  if (!p.success) throw E.bad("بيانات الوجبة غير صالحة: " + p.error.issues[0]?.path.join("."), "Invalid meal data: " + p.error.issues[0]?.path.join("."));
  const ingredient_keys = Array.from(new Set(p.data.ingredients.map((i) => i.key).filter(Boolean)));
  must(await db().from("hl_meals").upsert({ ...p.data, ingredient_keys }, { onConflict: "id" }));
  invalidateCatalogueCache();
  await audit(adm.username, "meal.upsert", p.data.id, { active: p.data.active, name_ar: p.data.name_ar });
  return ok({ ok: true });
});
