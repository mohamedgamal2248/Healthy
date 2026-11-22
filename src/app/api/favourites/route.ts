import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const favs = must(await db().from("favourites").select("source_type, source_id, created_at").eq("username", a.username).order("created_at", { ascending: false })) as { source_type: "meal" | "recipe"; source_id: string; created_at: string }[];
  const mealIds = favs.filter((f) => f.source_type === "meal").map((f) => f.source_id);
  const recipeIds = favs.filter((f) => f.source_type === "recipe").map((f) => f.source_id);
  const [meals, recipes] = await Promise.all([
    mealIds.length ? db().from("meals").select("*").in("id", mealIds) : Promise.resolve({ data: [], error: null }),
    recipeIds.length ? db().from("recipes").select("id,title,content,username,created_at,shared").in("id", recipeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  return ok({ meals: must(meals as never), recipes: must(recipes as never) });
});

/** Toggle a favourite. Saving a shared recipe also bumps its public save count. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  const { type, id } = await readJson<{ type?: string; id?: string }>(req);
  if ((type !== "meal" && type !== "recipe") || !id) throw E.bad();
  const existing = must(await db().from("favourites").select("source_id").eq("username", a.username).eq("source_type", type).eq("source_id", id).maybeSingle());
  if (existing) must(await db().from("favourites").delete().eq("username", a.username).eq("source_type", type).eq("source_id", id));
  else {
    if (type === "meal") {
      const m = must(await db().from("meals").select("id").eq("id", id).maybeSingle());
      if (!m) throw E.notFound();
    } else {
      const r = must(await db().from("recipes").select("id,username,shared").eq("id", id).maybeSingle()) as { username: string; shared: boolean } | null;
      if (!r || (r.username !== a.username && !r.shared)) throw E.notFound();
    }
    must(await db().from("favourites").insert({ username: a.username, source_type: type, source_id: id }));
  }
  if (type === "recipe") {
    const c = await db().from("favourites").select("source_id", { count: "exact", head: true }).eq("source_type", "recipe").eq("source_id", id);
    must(await db().from("recipes").update({ save_count: c.count ?? 0 }).eq("id", id));
  }
  return ok({ favourite: !existing });
});
