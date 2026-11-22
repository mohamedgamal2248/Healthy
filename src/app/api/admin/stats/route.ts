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
  const cost = must(await db().from("hl_ai_requests").select("est_cost_usd,status,type,input_summary,tokens_in,tokens_out,searches").not("est_cost_usd", "is", null).limit(20000)) as { est_cost_usd: number; status: string; type: string; input_summary: string | null; tokens_in: number | null; tokens_out: number | null; searches: number | null }[];
  const aiCostUsd = Math.round(cost.reduce((s, r) => s + Number(r.est_cost_usd), 0) * 1e4) / 1e4;
  const avgCostUsd = cost.length ? Math.round((aiCostUsd / cost.length) * 1e5) / 1e5 : 0;
  const refunded = cost.filter((r) => r.status === "refunded").length;
  // Cost per request kind: text requests carry a "[kind]" prefix in input_summary (older ones are plain recipes).
  const byKind = new Map<string, { n: number; refunded: number; cost: number; tin: number; tout: number; searches: number }>();
  for (const r of cost) {
    const m = /^\[(recipe|workout|challenge|scan)\]/.exec(r.input_summary ?? "");
    const kind = r.type === "plan" ? "plan" : m ? m[1] : "recipe";
    const k = byKind.get(kind) ?? { n: 0, refunded: 0, cost: 0, tin: 0, tout: 0, searches: 0 };
    k.n++; k.cost += Number(r.est_cost_usd); k.tin += r.tokens_in ?? 0; k.tout += r.tokens_out ?? 0; k.searches += r.searches ?? 0;
    if (r.status === "refunded") k.refunded++;
    byKind.set(kind, k);
  }
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  const aiByKind = [...byKind.entries()].map(([kind, k]) => ({ kind, n: k.n, refunded: k.refunded, avgCost: r5(k.cost / k.n), totalCost: r5(k.cost), avgIn: Math.round(k.tin / k.n), avgOut: Math.round(k.tout / k.n), avgSearches: Math.round((k.searches / k.n) * 100) / 100 })).sort((a, b) => b.totalCost - a.totalCost);
  const audits = must(await db().from("hl_admin_audit").select("admin,action,target,created_at").order("created_at", { ascending: false }).limit(30));
  return ok({ aiByKind, aiCostUsd, avgCostUsd, aiCalls: cost.length, aiRefunded: refunded, audit: audits, users, challengesCompleted: completed, recipesGenerated: recipes, plansActive: plans, piReceived: Math.round(paid.reduce((s, p) => s + Number(p.amount_pi), 0) * 1e4) / 1e4 });
});
