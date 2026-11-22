import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { currentGroup } from "@/server/community";

/** One-tap join. No entry fee and no prize in Pi: ranking and badges only. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  const g = await currentGroup(a.today);
  must(await db().from("hl_group_challenge_members").upsert({ group_id: g.id, username: a.username }, { onConflict: "group_id,username", ignoreDuplicates: true }));
  return ok({ joined: true });
});
