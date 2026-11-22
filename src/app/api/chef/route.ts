import { ok, readJson, route, E } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { chefGenerate } from "@/server/chef";
import { getBalances } from "@/server/credits";

export const maxDuration = 120;

export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  const { prompt } = await readJson<{ prompt?: string }>(req);
  if (typeof prompt !== "string") throw E.bad();
  const recipe = await chefGenerate(a, prompt);
  return ok({ recipe, balances: await getBalances(a.username) });
});
