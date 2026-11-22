import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { currentGroup, groupSnapshot, latestRecipes, leaderboard, topRecipes } from "@/server/community";

/** Leaderboard + top recipes: verified Pioneers only. */
export const GET = route(async (req) => {
  const a = await requireVerified(req);
  const group = await currentGroup(a.today);
  const [me, checked, board, top, latest, snap] = await Promise.all([
    db().from("hl_group_challenge_members").select("days_completed").eq("group_id", group.id).eq("username", a.username).maybeSingle(),
    db().from("hl_group_challenge_checks").select("date").eq("group_id", group.id).eq("username", a.username).eq("date", a.today).maybeSingle(),
    leaderboard(group.id),
    topRecipes(a),
    latestRecipes(a),
    groupSnapshot(a.username, a.today),
  ]);
  const mem = must(me) as { days_completed: number } | null;
  return ok({ group, joined: !!mem, myDays: mem?.days_completed ?? 0, checkedToday: !!must(checked), board, topRecipes: top, latestRecipes: latest, stats: { members: snap.members, checkedToday: snap.checkedToday }, hidden: !a.profile.leaderboard_visible });
});
