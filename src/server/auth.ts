import { db, must } from "./supabase";
import { E } from "./http";
import { verifySession } from "./session";
import { DEFAULT_TZ, localDate, validTz } from "@/lib/dates";

export type Profile = {
  username: string;
  pi_uid: string | null;
  kyc_verified: boolean;
  age: number | null;
  sex: "male" | "female" | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal: "lose" | "gain" | "maintain" | null;
  activity: "low" | "medium" | "high" | null;
  conditions: string[];
  disclaimer_accepted_at: string | null;
  language: "ar" | "en";
  timezone: string;
  leaderboard_visible: boolean;
  token_version: number;
  deleted_at: string | null;
  created_at: string;
  timezone_changed_at: string | null;
};

export type Auth = { username: string; uid: string; profile: Profile; tz: string; today: string };

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

export async function requireUser(req: Request): Promise<Auth> {
  const claims = verifySession(bearer(req));
  if (!claims) throw E.unauth();
  const profile = must(await db().from("hl_profiles").select("*").eq("username", claims.u).maybeSingle()) as Profile | null;
  // Revocable sessions: bumping token_version (or deleting the account) invalidates every issued token.
  if (!profile || profile.deleted_at || (claims.v ?? 0) !== (profile.token_version ?? 0)) throw E.unauth();
  // Day boundaries (streaks, daily challenges, check-ins) use the timezone stored on the profile, never a per-request header.
  if (claims.uid !== profile.pi_uid && profile.pi_uid) throw E.unauth(); // token must belong to this Pi identity
  const tz = validTz(profile.timezone || DEFAULT_TZ);
  return { username: profile.username, uid: claims.uid, profile, tz, today: localDate(tz) };
}

/** Paid features and the leaderboard require a KYC-verified Pi account. */
export async function requireVerified(req: Request): Promise<Auth> {
  const a = await requireUser(req);
  if (!a.profile.kyc_verified) throw E.kyc();
  return a;
}

export function requireDisclaimer(a: Auth) {
  if (!a.profile.disclaimer_accepted_at) throw E.disclaimer();
}

export function adminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function requireAdmin(req: Request): Promise<Auth> {
  const a = await requireUser(req);
  if (!adminUsernames().includes(a.username.toLowerCase())) throw E.admin();
  return a;
}
