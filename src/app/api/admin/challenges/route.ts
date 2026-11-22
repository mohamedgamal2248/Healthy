import { z } from "zod";
import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireAdmin } from "@/server/auth";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok({ challenges: must(await db().from("challenges").select("*").order("type").order("id")) });
});

const Body = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  type: z.string().min(2).max(30),
  title_ar: z.string().min(2).max(120),
  title_en: z.string().min(2).max(120),
  target_value: z.number().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  active: z.boolean().default(true),
});

/** Create or update (including deactivate) a challenge in the rotating pool. */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const p = Body.safeParse(await readJson(req));
  if (!p.success) throw E.bad("بيانات التحدي غير صالحة (المعرّف: حروف إنجليزية صغيرة وأرقام وشرطات).", "Invalid challenge data.");
  must(await db().from("challenges").upsert(p.data, { onConflict: "id" }));
  return ok({ ok: true });
});
