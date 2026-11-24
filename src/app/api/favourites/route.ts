import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";
import { publicContent } from "@/server/public-content";
import { rateLimit } from "@/server/ratelimit";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const favs = must(await db().from("hl_favourites").select("source_type, source_id, created_at").eq("username", a.username).order("created_at", { ascending: false })) as { source_type: "meal" | "recipe"; source_id: string; created_at: string }[];
  const mealIds = favs.filter((f) => f.source_type === "meal").map((f) => f.source_id);
  const recipeIds = favs.filter((f) => f.source_type === "recipe").map((f) => f.source_id);
  const [meals, recipes] = await Promise.all([
    mealIds.length ? db().from("hl_meals").select("*").in("id", mealIds) : Promise.resolve({ data: [], error: null }),
    recipeIds.length ? db().from("hl_recipes").select("id,title,content,username,created_at,shared").in("id", recipeIds).eq("hidden", false) : Promise.resolve({ data: [], error: null }),
  ]);
  const rec = (must(recipes as never) as { username: string; content: { cautions?: unknown; doctor_note?: unknown } }[]).map((r) => (r.username === a.username ? r : { ...r, content: publicContent(r.content) }));
  return ok({ meals: must(meals as never), recipes: rec });
});

/** Toggle a favourite. Saving a shared recipe also bumps its public save count. */
export const POST = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("fav", a.username, 120, 60);
  const { type, id } = await readJson<{ type?: string; id?: string }>(req);
  if ((type !== "meal" && type !== "recipe") || !id) throw E.bad();
  const existing = must(await db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", type).eq("source_id", id).maybeSingle());
  if (existing) must(await db().from("hl_favourites").delete().eq("username", a.username).eq("source_type", type).eq("source_id", id));
  else {
    if (type === "meal") {
      const m = must(await db().from("hl_meals").select("id").eq("id", id).maybeSingle());
      if (!m) throw E.notFound();
    } else {
      const r = must(await db().from("hl_recipes").select("id,username,shared").eq("id", id).maybeSingle()) as { username: string; shared: boolean } | null;
      if (!r || (r.username !== a.username && !r.shared)) throw E.notFound();
    }
    // upsert: a double tap can never raise a duplicate-key error
    must(await db().from("hl_favourites").upsert({ username: a.username, source_type: type, source_id: id }, { onConflict: "username,source_type,source_id", ignoreDuplicates: true }));
  }
  if (type === "recipe") {
    const c = await db().from("hl_favourites").select("source_id", { count: "exact", head: true }).eq("source_type", "recipe").eq("source_id", id);
    must(await db().from("hl_recipes").update({ save_count: c.count ?? 0 }).eq("id", id));
  }
  return ok({ favourite: !existing });
});
