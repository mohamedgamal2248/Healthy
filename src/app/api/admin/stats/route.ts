import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireAdmin } from "@/server/auth";

/** Aggregate totals only. No individual health profiles are ever listed in admin. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [users, completed, recipes, plans] = await Promise.all([
    count(db().from("hl_profiles").select("username", { count: "exact", head: true })),
    count(db().from("hl_user_challenges").select("id", { count: "exact", head: true }).eq("status", "completed")),
    count(db().from("hl_ai_requests").select("id", { count: "exact", head: true }).eq("type", "recipe").eq("status", "completed")),
    count(db().from("hl_subscriptions").select("username", { count: "exact", head: true }).gt("expires_at", new Date().toISOString())),
  ]);
  const paid = must(await db().from("hl_purchases").select("amount_pi").eq("status", "completed")) as { amount_pi: number }[];
  return ok({ users, challengesCompleted: completed, recipesGenerated: recipes, plansActive: plans, piReceived: Math.round(paid.reduce((s, p) => s + Number(p.amount_pi), 0) * 1e4) / 1e4 });
});
