import { after } from "next/server";
import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { requireVerified } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { currentGroup } from "@/server/community";
import { groupFinishText } from "@/lib/reminder";
import { notifyEvent } from "@/server/events";

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("checkin", a.username, 60, 3600);
  const g = await currentGroup(a.today);
  const mem = must(await db().from("hl_group_challenge_members").select("username").eq("group_id", g.id).eq("username", a.username).maybeSingle());
  if (!mem) throw E.bad("انضم للتحدي أولًا.", "Join the challenge first.");
  // Primary key (group, user, date) makes the daily check-in idempotent.
  await db().from("hl_group_challenge_checks").upsert({ group_id: g.id, username: a.username, date: a.today }, { onConflict: "group_id,username,date", ignoreDuplicates: true });
  const c = await db().from("hl_group_challenge_checks").select("date", { count: "exact", head: true }).eq("group_id", g.id).eq("username", a.username);
  const days = c.count ?? 0;
  must(await db().from("hl_group_challenge_members").update({ days_completed: days }).eq("group_id", g.id).eq("username", a.username));
  if (days === 7) after(() => notifyEvent(a.username, `group_${g.id}`, (lang) => groupFinishText({ lang }), "/community"));
  if (days >= 7) await db().from("hl_badges").upsert({ username: a.username, badge_key: "group_finisher" }, { onConflict: "username,badge_key", ignoreDuplicates: true });
  return ok({ days });
});
