import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";

export const REFERRAL_CREDITS = 1; // AI requests each, for the inviter and the invited
export const REFERRAL_CAP = 10;    // rewarded invites per inviter
const NEW_USER_WINDOW_MS = 3 * 86400_000;

/** Record "who invited me". Only brand-new, KYC-verified accounts can be attached, once, never to themselves. */
export async function claimReferral(a: Auth, ref: string) {
  const code = ref.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(code) || code === a.username.toLowerCase()) throw E.bad("رابط الدعوة غير صالح.", "Invalid invite link.");
  if (!a.profile.kyc_verified) throw E.kyc();
  if (Date.now() - new Date(a.profile.created_at).getTime() > NEW_USER_WINDOW_MS) throw new HttpError(400, "not_new", "الدعوة تنطبق على الحسابات الجديدة فقط.", "Invites only apply to new accounts.");
  const inviter = must(await db().from("hl_profiles").select("username,kyc_verified,deleted_at").ilike("username", code).maybeSingle()) as { username: string; kyc_verified: boolean; deleted_at: string | null } | null;
  if (!inviter || inviter.deleted_at || !inviter.kyc_verified) throw E.bad("رابط الدعوة غير صالح.", "Invalid invite link.");
  must(await db().from("hl_referrals").upsert({ invited: a.username, referrer: inviter.username }, { onConflict: "invited", ignoreDuplicates: true }));
  return { referrer: inviter.username };
}

/** Called after the invited user's FIRST completed challenge: atomic, one reward per invited user. */
export async function rewardReferralIfAny(username: string): Promise<boolean> {
  const r = must(await db().rpc("hl_reward_referral", { p_invited: username, p_credits: REFERRAL_CREDITS, p_cap: REFERRAL_CAP })) as string | null;
  return !!r;
}

export async function referralStats(username: string) {
  const rows = must(await db().from("hl_referrals").select("rewarded").eq("referrer", username)) as { rewarded: boolean }[];
  return { invited: rows.length, rewarded: rows.filter((r) => r.rewarded).length, cap: REFERRAL_CAP, credits: REFERRAL_CREDITS };
}
