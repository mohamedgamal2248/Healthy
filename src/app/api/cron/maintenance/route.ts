import { db, must } from "@/server/supabase";
import { ok, route, E } from "@/server/http";
import { reconcileOne } from "@/server/purchases";

export const maxDuration = 120;

/** Daily housekeeping (Vercel Cron). Secured with CRON_SECRET: Vercel sends it as a Bearer token. */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw E.notFound();
  const now = Date.now();
  const out = { reconciled: 0, expiredPurchases: 0, cacheDeleted: 0, limitsDeleted: 0 };

  // 1. finish stuck payments
  const stuck = must(
    await db().from("hl_purchases").select("id,username,pi_payment_id").in("status", ["pending", "approved"]).not("pi_payment_id", "is", null).gte("created_at", new Date(now - 7 * 86400_000).toISOString()).limit(100),
  ) as { id: string; username: string; pi_payment_id: string }[];
  for (const p of stuck) {
    try {
      const prof = must(await db().from("hl_profiles").select("pi_uid").eq("username", p.username).maybeSingle()) as { pi_uid: string } | null;
      if (prof && (await reconcileOne({ username: p.username, uid: prof.pi_uid }, p.id, p.pi_payment_id)) === "completed") out.reconciled++;
    } catch (e) { console.error("[cron] reconcile", p.id, e instanceof Error ? e.message : e); }
  }
  // 2. quotes older than a day that never got a payment id are dead
  const dead = must(await db().from("hl_purchases").update({ status: "cancelled", fail_reason: "expired" }).eq("status", "pending").is("pi_payment_id", null).lt("created_at", new Date(now - 86400_000).toISOString()).select("id")) as { id: string }[];
  out.expiredPurchases = dead.length;
  // 3. caches
  const cache = must(await db().from("hl_ai_cache").delete().lt("created_at", new Date(now - 30 * 86400_000).toISOString()).select("key")) as { key: string }[];
  out.cacheDeleted = cache.length;
  const lim = must(await db().from("hl_rate_limits").delete().lt("window_start", new Date(now - 86400_000).toISOString()).select("key")) as { key: string }[];
  out.limitsDeleted = lim.length;
  return ok(out);
});
