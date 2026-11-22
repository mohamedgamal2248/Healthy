import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const a = await requireVerified(req);
  await rateLimit("like", a.username, 120, 60);
  const { id } = await params;
  const r = must(await db().from("hl_recipes").select("id,username,shared").eq("id", id).maybeSingle()) as { username: string; shared: boolean } | null;
  if (!r || (!r.shared && r.username !== a.username)) throw E.notFound();
  const ex = must(await db().from("hl_recipe_likes").select("recipe_id").eq("recipe_id", id).eq("username", a.username).maybeSingle());
  if (ex) must(await db().from("hl_recipe_likes").delete().eq("recipe_id", id).eq("username", a.username));
  else must(await db().from("hl_recipe_likes").upsert({ recipe_id: id, username: a.username }, { onConflict: "recipe_id,username", ignoreDuplicates: true }));
  const c = await db().from("hl_recipe_likes").select("recipe_id", { count: "exact", head: true }).eq("recipe_id", id);
  must(await db().from("hl_recipes").update({ like_count: c.count ?? 0 }).eq("id", id));
  return ok({ liked: !ex, likes: c.count ?? 0 });
});
