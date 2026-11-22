import { db, must } from "@/server/supabase";
import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { getBalances } from "@/server/credits";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  const [purchases, balances, sub] = await Promise.all([
    db().from("purchases").select("id,kind,item_key,amount_pi,status,fail_reason,txid,created_at,completed_at").eq("username", a.username).order("created_at", { ascending: false }).limit(100),
    getBalances(a.username),
    db().from("subscriptions").select("plan_key,started_at,expires_at").eq("username", a.username).maybeSingle(),
  ]);
  return ok({ purchases: must(purchases), balances, subscription: must(sub) });
});
