import { db, must } from "@/server/supabase";
import { ok, readJson, route, E } from "@/server/http";
import { isKycVerified, verifyAccessToken } from "@/server/pi-backend";
import { signSession } from "@/server/session";

/** Pi sign-in: the access token from the Pi SDK is verified server-side against the Pi API. */
export const POST = route(async (req) => {
  const { accessToken } = await readJson<{ accessToken?: string }>(req);
  if (!accessToken || typeof accessToken !== "string") throw E.bad();
  const me = await verifyAccessToken(accessToken);
  const kyc = isKycVerified(me);
  must(await db().from("hl_profiles").upsert({ username: me.username, pi_uid: me.uid, kyc_verified: kyc, updated_at: new Date().toISOString() }, { onConflict: "username" }));
  return ok({ token: signSession(me.username, me.uid), username: me.username, kycVerified: kyc });
});
