import { db, must } from "./supabase";
import { TRIAL_CREDITS } from "@/config/pricing";

export type Balances = { plan: number; pack: number; trial: number; total: number; planExpiresAt: string | null; planActive: boolean };

/** Balances are derived from the append-only ledger (expired plan credits are settled first). */
export async function getBalances(username: string): Promise<Balances> {
  const rows = must(await db().rpc("hl_credit_balances", { p_user: username })) as { plan: number; pack: number; trial: number; plan_expires_at: string | null }[];
  const r = rows?.[0] ?? { plan: 0, pack: 0, trial: 0, plan_expires_at: null };
  const exp = r.plan_expires_at;
  return { plan: r.plan, pack: r.pack, trial: r.trial, total: r.plan + r.pack + r.trial, planExpiresAt: exp, planActive: !!exp && new Date(exp).getTime() > Date.now() };
}

export async function hasActivePlan(username: string): Promise<boolean> {
  const row = must(await db().from("hl_subscriptions").select("expires_at").eq("username", username).maybeSingle()) as { expires_at: string } | null;
  return !!row && new Date(row.expires_at).getTime() > Date.now();
}

/** Atomic: one transaction with a per-user advisory lock. Returns the kind spent, or null if empty. */
export async function spendCredit(username: string, requestId: string): Promise<"plan" | "pack" | "trial" | null> {
  const kind = must(await db().rpc("hl_spend_credit", { p_user: username, p_request: requestId })) as "plan" | "pack" | "trial" | null;
  return kind ?? null;
}

export async function refundCredit(requestId: string): Promise<boolean> {
  return must(await db().rpc("hl_refund_request", { p_request: requestId })) as boolean;
}

/** Idempotent: a unique index guarantees the trial is granted exactly once per user. */
export async function grantTrial(username: string): Promise<boolean> {
  return must(await db().rpc("hl_grant_trial", { p_user: username, p_credits: TRIAL_CREDITS })) as boolean;
}
