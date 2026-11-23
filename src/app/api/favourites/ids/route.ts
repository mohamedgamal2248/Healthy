import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";

/** Just the ids of my favourites (tiny), so public pages can show the heart without a private full list. */
export const GET = route(async (req) => {
  const a = await requireUser(req);
  const favs = must(await db().from("hl_favourites").select("source_type,source_id").eq("username", a.username).limit(2000)) as { source_type: "meal" | "recipe"; source_id: string }[];
  return ok({ meals: favs.filter((f) => f.source_type === "meal").map((f) => f.source_id), recipes: favs.filter((f) => f.source_type === "recipe").map((f) => f.source_id) });
});
