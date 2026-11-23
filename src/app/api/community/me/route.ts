import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { currentGroup, teamOf } from "@/server/community";

/** The per-user part of the community page (never cached): my participation, my likes and saves. */
export const GET = route(async (req) => {
  const a = await requireVerified(req);
  const group = await currentGroup(a.today);
  const [me, checked, likes, saves] = await Promise.all([
    db().from("hl_group_challenge_members").select("days_completed").eq("group_id", group.id).eq("username", a.username).maybeSingle(),
    db().from("hl_group_challenge_checks").select("date").eq("group_id", group.id).eq("username", a.username).eq("date", a.today).maybeSingle(),
    db().from("hl_recipe_likes").select("recipe_id").eq("username", a.username).order("created_at", { ascending: false }).limit(500),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "recipe").order("created_at", { ascending: false }).limit(500),
  ]);
  const mem = must(me) as { days_completed: number } | null;
  return ok({
    joined: !!mem, myDays: mem?.days_completed ?? 0, checkedToday: !!must(checked), myTeam: teamOf(a.username), hidden: !a.profile.leaderboard_visible,
    likedIds: (must(likes) as { recipe_id: string }[]).map((r) => r.recipe_id),
    savedIds: (must(saves) as { source_id: string }[]).map((r) => r.source_id),
  });
});
