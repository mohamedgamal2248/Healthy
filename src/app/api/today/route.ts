import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { ensureToday, loadStreak, reminderState } from "@/server/challenges";
import { effectiveStreak } from "@/lib/streak";
import { mealsOfTheDay } from "@/server/meals";
import { getBalances } from "@/server/credits";
import { groupSnapshot } from "@/server/community";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const [{ rows, swapUsed }, streak, meals, badges, favs, reminder, balances, community] = await Promise.all([
    ensureToday(a),
    loadStreak(a.username),
    mealsOfTheDay(a.today),
    db().from("hl_badges").select("badge_key, earned_at").eq("username", a.username),
    db().from("hl_favourites").select("source_id").eq("username", a.username).eq("source_type", "meal"),
    reminderState(a),
    a.profile.kyc_verified ? getBalances(a.username) : Promise.resolve(null),
    a.profile.kyc_verified ? groupSnapshot(a.username, a.today).catch(() => null) : Promise.resolve(null),
  ]);
  return ok({
    date: a.today,
    challenges: rows,
    swapUsed,
    streak: { current: effectiveStreak(streak, a.today), longest: streak.longest, total: streak.total },
    completedToday: rows.filter((r) => r.status === "completed").length,
    meals,
    badges: must(badges),
    favourites: (must(favs) as { source_id: string }[]).map((f) => f.source_id),
    reminder,
    balances,
    community,
    profileReady: !!a.profile.disclaimer_accepted_at,
  });
});
