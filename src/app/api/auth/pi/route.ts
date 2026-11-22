import { db, must } from "@/server/supabase";
import { ok, readJson, route, E, HttpError } from "@/server/http";
import { isKycVerified, verifyAccessToken } from "@/server/pi-backend";
import { signSession } from "@/server/session";
import { rateLimit, clientIp } from "@/server/ratelimit";
import { validTz } from "@/lib/dates";

/** Pi sign-in: the access token from the Pi SDK is verified server-side against the Pi API. */
export const POST = route(async (req) => {
  await rateLimit("auth", clientIp(req), 30, 600);
  const { accessToken } = await readJson<{ accessToken?: string }>(req);
  if (!accessToken || typeof accessToken !== "string") throw E.bad();
  const me = await verifyAccessToken(accessToken);
  const kyc = isKycVerified(me);
  const existing = must(await db().from("hl_profiles").select("pi_uid").eq("username", me.username).maybeSingle()) as { pi_uid: string | null } | null;
  // A different Pi identity under the same username (recycled name) must not inherit someone else's account.
  if (existing?.pi_uid && existing.pi_uid !== me.uid) throw new HttpError(409, "account_conflict", "هذا الاسم مرتبط بحساب Pi آخر. تواصل مع الدعم.", "This username is linked to a different Pi account. Please contact support.");
  if (!existing) {
    must(await db().from("hl_profiles").insert({ username: me.username, pi_uid: me.uid, kyc_verified: kyc, timezone: validTz(req.headers.get("x-tz")) }));
  } else {
    must(await db().from("hl_profiles").update({ pi_uid: me.uid, kyc_verified: kyc, deleted_at: null, updated_at: new Date().toISOString() }).eq("username", me.username));
  }
  const v = must(await db().from("hl_profiles").select("token_version").eq("username", me.username).single()) as { token_version: number };
  return ok({ token: signSession(me.username, me.uid, v.token_version), username: me.username, kycVerified: kyc });
});
