// Single source of truth for prices, request packs and AI limits. Change values here (or via env) only.
//
// Prices are defined in USD and converted to Pi at purchase time using the live OKX PI-USDT price,
// then rounded UP to a whole Pi (e.g. 1.5 Pi -> 2 Pi). Set PRICING_MODE=fixed to use `fixedPi` instead
// (handy for Testnet, where Test-Pi has no market price).
const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export type ItemKey = "plan_monthly" | "pack_small" | "pack_large";

export type PricedItem = {
  key: ItemKey;
  kind: "plan" | "pack";
  /** Target price in US dollars. */
  usd: number;
  /** Fixed Pi price, used only when PRICING_MODE=fixed. */
  fixedPi: number;
  /** AI requests granted (1 credit = 1 AI request). */
  credits: number;
  /** Days of plan access granted (plan only). */
  days: number;
};

export const PRICING: Record<ItemKey, PricedItem> = {
  plan_monthly: { key: "plan_monthly", kind: "plan", usd: num(process.env.PRICE_PLAN_USD, 2), fixedPi: num(process.env.PRICE_PLAN_PI, 3), credits: 40, days: 30 },
  pack_small: { key: "pack_small", kind: "pack", usd: num(process.env.PRICE_PACK_SMALL_USD, 0.6), fixedPi: num(process.env.PRICE_PACK_SMALL_PI, 1), credits: 10, days: 0 },
  pack_large: { key: "pack_large", kind: "pack", usd: num(process.env.PRICE_PACK_LARGE_USD, 1.5), fixedPi: num(process.env.PRICE_PACK_LARGE_PI, 2.5), credits: 30, days: 0 },
};

/** Credits earned once by finishing the 7-day starter challenge (no free credits at sign-up). */
export const TRIAL_CREDITS = 3;
export const RECIPE_COST = 1;
export const PLAN_REGENERATE_COST = 1;
/** Hard nutrition floor for any generated daily plan. */
export const MIN_DAILY_KCAL = 1200;

/** A price quote is locked into the purchase for this long; after that a new quote is required. */
export const QUOTE_TTL_MIN = 30;

/** Abuse / cost controls for every AI request. */
export const AI_LIMITS = {
  maxPromptChars: 400,          // user text per request
  perHour: num(process.env.AI_LIMIT_PER_HOUR, 6),   // new generations per user per hour
  perDay: num(process.env.AI_LIMIT_PER_DAY, 30),    // new generations per user per day, however many credits they hold
  followUpsPerRecipePerDay: 8,
  followUpsPerDay: 20,
  globalPerDay: num(process.env.AI_GLOBAL_DAILY_CAP, 2000), // circuit breaker across all users
  timeoutMs: 60_000,            // longer than this = failed + automatic refund
  inFlightWindowMs: 90_000,     // a user can have only one generation running at a time
} as const;

export const isItemKey = (k: unknown): k is ItemKey => typeof k === "string" && k in PRICING;
