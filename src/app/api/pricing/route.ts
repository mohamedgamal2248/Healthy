import { ok, route } from "@/server/http";
import { PRICING, TRIAL_CREDITS, QUOTE_TTL_MIN } from "@/config/pricing";
import { quoteAll } from "@/server/pi-price";

/** Live quotes: USD target converted at the current OKX PI/USDT rate, rounded up to whole Pi. */
export const GET = route(async () => {
  const quotes = await quoteAll();
  return ok({
    items: quotes.map((q) => ({ key: q.key, kind: PRICING[q.key].kind, pricePi: q.pricePi, usd: q.usd, credits: PRICING[q.key].credits, days: PRICING[q.key].days })),
    rate: { usdPerPi: quotes[0].rate.usdPerPi, source: quotes[0].rate.source, asOf: quotes[0].rate.asOf, mode: quotes[0].mode },
    quoteTtlMin: QUOTE_TTL_MIN,
    trialCredits: TRIAL_CREDITS,
    network: process.env.NEXT_PUBLIC_PI_NETWORK ?? "testnet",
  });
});
