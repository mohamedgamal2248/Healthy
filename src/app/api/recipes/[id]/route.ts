import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const a = await requireUser(req);
  const { id } = await params;
  const r = must(await db().from("hl_recipes").select("id,username,title,content,shared,like_count,save_count,created_at").eq("id", id).maybeSingle()) as { username: string; shared: boolean } | null;
  if (!r || (r.username !== a.username && !r.shared)) throw E.notFound();
  const own = r.username === a.username;
  const messages = own ? must(await db().from("hl_recipe_messages").select("id,role,content,created_at").eq("recipe_id", id).order("created_at")) : [];
  const [fav, like] = await Promise.all([
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "recipe").eq("source_id", id).maybeSingle(),
    db().from("hl_recipe_likes").select("recipe_id").eq("recipe_id", id).eq("username", a.username).maybeSingle(),
  ]);
  return ok({ recipe: r, own, messages, favourite: !!fav.data, liked: !!like.data });
});
