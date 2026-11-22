import { PRICING, type ItemKey } from "@/config/pricing";

export type PiRate = { usdPerPi: number; source: "okx" | "cache" | "fallback"; asOf: number };
export type Quote = { key: ItemKey; usd: number; pricePi: number; rate: PiRate; mode: "live" | "fixed" };

const OKX = "https://www.okx.com/api/v5/market/ticker?instId=PI-USDT";
const TTL_MS = 45_000;
const SANE = { min: 0.005, max: 10 }; // refuse absurd prices (bad feed) instead of mispricing
let last: PiRate | null = null;

/** Live PI/USDT from OKX's public ticker (no key). Cached ~45s; falls back to the last good value. */
export async function getPiRate(): Promise<PiRate> {
  if (last && Date.now() - last.asOf < TTL_MS) return last;
  try {
    const res = await fetch(OKX, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const j = (await res.json()) as { data?: { last?: string }[] };
    const p = Number(j.data?.[0]?.last);
    if (Number.isFinite(p) && p >= SANE.min && p <= SANE.max) {
      last = { usdPerPi: p, source: "okx", asOf: Date.now() };
      return last;
    }
  } catch {
    /* fall through to the last good value */
  }
  if (last) return { ...last, source: "cache" };
  const fb = Number(process.env.PI_PRICE_FALLBACK_USD) || 0.05;
  return { usdPerPi: fb, source: "fallback", asOf: Date.now() };
}

/** USD target -> Pi, rounded UP to a whole number (never below 1 Pi). */
export function usdToPi(usd: number, usdPerPi: number): number {
  return Math.max(1, Math.ceil(usd / usdPerPi - 1e-9));
}

export async function quote(key: ItemKey): Promise<Quote> {
  const item = PRICING[key];
  if ((process.env.PRICING_MODE ?? "live") === "fixed") {
    return { key, usd: item.usd, pricePi: Math.max(1, Math.ceil(item.fixedPi)), rate: { usdPerPi: item.usd / item.fixedPi, source: "fallback", asOf: Date.now() }, mode: "fixed" };
  }
  const rate = await getPiRate();
  return { key, usd: item.usd, pricePi: usdToPi(item.usd, rate.usdPerPi), rate, mode: "live" };
}

export async function quoteAll(): Promise<Quote[]> {
  return Promise.all((Object.keys(PRICING) as ItemKey[]).map(quote));
}
