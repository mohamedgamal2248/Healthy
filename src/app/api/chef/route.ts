import { ok, readJson, route, E } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { coachGenerate } from "@/server/chef";
import { getBalances } from "@/server/credits";

export const maxDuration = 90;

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  const { prompt, kind } = await readJson<{ prompt?: string; kind?: string }>(req);
  if (typeof prompt !== "string") throw E.bad();
  const recipe = await coachGenerate(a, prompt, kind);
  return ok({ recipe, balances: await getBalances(a.username) });
});
