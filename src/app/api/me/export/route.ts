import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";

/** Everything we hold about the signed-in user, as JSON (privacy: data portability). */
export const GET = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("export", a.username, 5, 3600);
  const u = a.username;
  const get = async (t: string, cols = "*") => must(await db().from(t).select(cols).eq("username", u).limit(5000));
  const { pi_uid: _p, token_version: _t, ...profile } = a.profile;
  void _p; void _t;
  const [weights, habits, plans, reports, challenges, streaks, badges, favourites, recipes, purchases, ledger] = await Promise.all([
    get("hl_weight_logs"), get("hl_habit_logs"), get("hl_diet_plans"), get("hl_weekly_reports"), get("hl_user_challenges"), get("hl_streaks"), get("hl_badges"), get("hl_favourites"), get("hl_recipes", "id,title,content,shared,created_at"), get("hl_purchases", "id,kind,item_key,amount_pi,status,txid,created_at"), get("hl_credit_ledger", "change,balance_kind,reason,created_at"),
  ]);
  return ok({ exportedAt: new Date().toISOString(), profile, weights, habits, plans, reports, challenges, streaks, badges, favourites, recipes, purchases, ledger });
});
