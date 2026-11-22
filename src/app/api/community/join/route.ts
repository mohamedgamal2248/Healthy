import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { currentGroup } from "@/server/community";

/** One-tap join. No entry fee and no prize in Pi: ranking and badges only. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("join", a.username, 30, 3600);
  const g = await currentGroup(a.today);
  must(await db().from("hl_group_challenge_members").upsert({ group_id: g.id, username: a.username }, { onConflict: "group_id,username", ignoreDuplicates: true }));
  const c = await db().from("hl_group_challenge_members").select("group_id", { count: "exact", head: true }).eq("username", a.username);
  if ((c.count ?? 0) >= 4) await db().from("hl_badges").upsert({ username: a.username, badge_key: "regular_4w" }, { onConflict: "username,badge_key", ignoreDuplicates: true });
  return ok({ joined: true });
});
