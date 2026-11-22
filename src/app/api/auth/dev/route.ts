import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { signSession } from "@/server/session";
import { rateLimit, clientIp } from "@/server/ratelimit";

/** Local development only (never available in production builds). Not a user-facing sign-in path. */
export const POST = route(async (req) => {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") throw E.notFound();
  const { username, kyc } = await readJson<{ username?: string; kyc?: boolean }>(req);
  if (!username || !/^[A-Za-z0-9_.-]{3,32}$/.test(username)) throw E.bad();
  const verified = kyc !== false;
  must(await db().from("hl_profiles").upsert({ username, pi_uid: `dev-${username}`, kyc_verified: verified }, { onConflict: "username" }));
  const v = must(await db().from("hl_profiles").select("token_version").eq("username", username).single()) as { token_version: number };
  return ok({ token: signSession(username, `dev-${username}`, v.token_version), username, kycVerified: verified });
});
