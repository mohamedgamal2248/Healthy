import { ok, readJson, route } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { fridgeMeals } from "@/server/chef";
import { getBalances } from "@/server/credits";
import { rateLimit } from "@/server/ratelimit";

export const maxDuration = 90;

/** "What's in my fridge": a photo and/or typed ingredients -> 3 meal ideas (1 AI request). The photo is analysed and discarded. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  await rateLimit("fridge", a.username, 30, 3600);
  const { image, text, lang } = await readJson<{ image?: string; text?: string; lang?: string }>(req);
  const recipe = await fridgeMeals(a, image, text, lang);
  return ok({ recipe, balances: await getBalances(a.username) });
});
