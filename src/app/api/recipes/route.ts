import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const recipes = must(await db().from("hl_recipes").select("id,title,content,shared,like_count,save_count,created_at").eq("username", a.username).order("created_at", { ascending: false }).limit(100));
  return ok({ recipes });
});
