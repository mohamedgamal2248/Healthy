import { ok, readJson, route, E } from "@/server/http";
import { requireDisclaimer, requireVerified } from "@/server/auth";
import { chatTurnReply } from "@/server/chef";
import { getBalances } from "@/server/credits";
import { rateLimit } from "@/server/ratelimit";

export const maxDuration = 60;

/** Short chat assistant: food, exercise and daily habits only. One message = 1 credit, refunded if the question is off topic or the answer fails. */
export const POST = route(async (req) => {
  const a = await requireVerified(req);
  requireDisclaimer(a);
  await rateLimit("chat", a.username, 60, 3600);
  const { messages, lang } = await readJson<{ messages?: unknown; lang?: string }>(req);
  if (!Array.isArray(messages)) throw E.bad();
  const r = await chatTurnReply(a, messages, lang);
  return ok({ ...r, balances: await getBalances(a.username) });
});
