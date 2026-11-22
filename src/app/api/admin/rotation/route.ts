import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireAdmin } from "@/server/auth";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok({ overrides: must(await db().from("meal_overrides").select("*").order("date", { ascending: false }).limit(60)) });
});

/** Override the daily meal for a date + meal type. meal_id = null clears the override. */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const { date, meal_type, meal_id } = await readJson<{ date?: string; meal_type?: string; meal_id?: string | null }>(req);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["breakfast", "lunch", "dinner"].includes(meal_type ?? "")) throw E.bad();
  if (!meal_id) must(await db().from("meal_overrides").delete().eq("date", date).eq("meal_type", meal_type!));
  else {
    const m = must(await db().from("meals").select("id,meal_type").eq("id", meal_id).maybeSingle()) as { meal_type: string } | null;
    if (!m || m.meal_type !== meal_type) throw E.bad("الوجبة غير موجودة أو من نوع آخر.", "Meal not found or wrong type.");
    must(await db().from("meal_overrides").upsert({ date, meal_type, meal_id }, { onConflict: "date,meal_type" }));
  }
  return ok({ ok: true });
});
