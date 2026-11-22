import { ok, readJson, route, E } from "@/server/http";
import { requireUser, requireVerified } from "@/server/auth";
import { claimReferral, referralStats } from "@/server/referral";
import { rateLimit } from "@/server/ratelimit";

export const GET = route(async (req) => {
  const a = await requireUser(req);
  return ok({ code: a.username, ...(await referralStats(a.username)) });
});

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  await rateLimit("referral", a.username, 10, 3600);
  const { ref } = await readJson<{ ref?: string }>(req);
  if (!ref) throw E.bad();
  return ok(await claimReferral(a, ref));
});
