import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { getBalances } from "@/server/credits";
import { quickstartState } from "@/server/quickstart";

/** The person's quick-start progress. Also grants (once) the credit for any finished step. */
export const GET = route(async (req) => {
  const a = await requireUser(req);
  await rateLimit("quickstart", a.username, 120, 3600);
  const s = await quickstartState(a.username);
  return ok({ ...s, balances: s.fresh.length && s.kyc ? await getBalances(a.username) : null });
});
