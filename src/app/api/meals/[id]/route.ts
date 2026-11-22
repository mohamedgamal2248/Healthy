import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getMeal } from "@/server/meals";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const a = await requireUser(req);
  const { id } = await params;
  const meal = await getMeal(id);
  if (!meal || !meal.active) throw E.notFound();
  const fav = must(await db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "meal").eq("source_id", id).maybeSingle());
  return ok({ meal, favourite: !!fav });
});
