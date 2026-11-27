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
  plan_monthly: { key: "plan_monthly", kind: "plan", usd: num(process.env.PRICE_PLAN_USD, 2), fixedPi: num(process.env.PRICE_PLAN_PI, 3), credits: 60, days: 30 },
  pack_small: { key: "pack_small", kind: "pack", usd: num(process.env.PRICE_PACK_SMALL_USD, 0.5), fixedPi: num(process.env.PRICE_PACK_SMALL_PI, 1), credits: 10, days: 0 },
  pack_large: { key: "pack_large", kind: "pack", usd: num(process.env.PRICE_PACK_LARGE_USD, 1.25), fixedPi: num(process.env.PRICE_PACK_LARGE_PI, 2.5), credits: 30, days: 0 },
};

/** Credits earned once by finishing the 7-day starter challenge (no free credits at sign-up). */
export const TRIAL_CREDITS = 3;
export const RECIPE_COST = 1;
export const PLAN_REGENERATE_COST = 1;
/** Hard nutrition floor for any generated daily plan. */
export const MIN_DAILY_KCAL = 1200;

/** A price quote is locked into the purchase for this long; after that a new quote is required. */
export const QUOTE_TTL_MIN = 30;

/** Provider price list used only to ESTIMATE cost per request (Meta Muse Ember, standard tier, USD per 1M tokens). */
export const AI_PRICES = { inputPerM: 0.1, outputPerM: 0.5, searchEach: 0.0025 } as const;

/** Abuse / cost controls for every AI request. */
export const AI_LIMITS = {
  maxPromptChars: 400,          // user text per request
  // No per-hour or per-day cap on paid generations: a credit is the limit, and the person paid for it.
  failedPerHour: num(process.env.AI_LIMIT_FAILED_PER_HOUR, 15), // refunded / failed attempts per user per hour: the model costs money even when the credit is given back
  followUpsPerRecipePerDay: 8,
  followUpsPerDay: 20,
  globalPerDay: num(process.env.AI_GLOBAL_DAILY_CAP, 20000), // emergency brake across all users (a runaway bug), far above normal use
  timeoutMs: 60_000,            // longer than this = failed + automatic refund
  inFlightWindowMs: 90_000,     // a user can have only one generation running at a time
} as const;

/** The short chat assistant: each message is one paid request, so its size is capped on both sides. */
export const CHAT = {
  maxUserWords: 40,      // a question, not an essay
  maxUserChars: 240,
  maxReplyWords: 70,     // answers stay short (the prompt asks for ~50; this is the hard cap)
  historyMessages: 4,    // earlier messages sent along for context (2 exchanges)
  historyChars: 800,     // total size of that history
  timeoutMs: 30_000,
} as const;

export const isItemKey = (k: unknown): k is ItemKey => typeof k === "string" && k in PRICING;
