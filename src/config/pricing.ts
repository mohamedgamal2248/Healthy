// Single source of truth for prices and credit amounts. Change values here (or via env) only.
// Server verification of every Pi payment compares against these numbers.
const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export type ItemKey = "plan_monthly" | "pack_small" | "pack_large";

export type PricedItem = {
  key: ItemKey;
  kind: "plan" | "pack";
  pricePi: number;
  credits: number;
  /** Days of plan access granted (plan only). */
  days: number;
};

export const PRICING: Record<ItemKey, PricedItem> = {
  plan_monthly: { key: "plan_monthly", kind: "plan", pricePi: num(process.env.PRICE_PLAN_PI, 3), credits: 20, days: 30 },
  pack_small: { key: "pack_small", kind: "pack", pricePi: num(process.env.PRICE_PACK_SMALL_PI, 1), credits: 10, days: 0 },
  pack_large: { key: "pack_large", kind: "pack", pricePi: num(process.env.PRICE_PACK_LARGE_PI, 2.5), credits: 30, days: 0 },
};

export const TRIAL_CREDITS = 3;
export const RECIPE_COST = 1;
export const PLAN_REGENERATE_COST = 1;
/** Hard nutrition floor for any generated daily plan. */
export const MIN_DAILY_KCAL = 1200;

export const isItemKey = (k: unknown): k is ItemKey => typeof k === "string" && k in PRICING;
