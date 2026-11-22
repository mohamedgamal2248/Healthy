import { ok, readJson, route } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { scanMeal } from "@/server/chef";
import { getBalances } from "@/server/credits";
import { rateLimit } from "@/server/ratelimit";

export const maxDuration = 90;

/** Meal-photo analysis (1 AI request). The image is analysed and discarded: it is never written to storage. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  await rateLimit("scan", a.username, 30, 3600);
  const { image, note, lang } = await readJson<{ image?: string; note?: string; lang?: string }>(req);
  const recipe = await scanMeal(a, image, note, lang);
  return ok({ recipe, balances: await getBalances(a.username) });
});
