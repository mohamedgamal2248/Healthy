// Scaling of a stored photo analysis: portion multiplier, removed ingredients and "it's actually X" swaps.
// One implementation used by the server (what gets logged) and the result screen (the live preview).
export type ScanIng = { name?: string; grams?: number; kcal: number; alternatives?: { name: string; kcal_per_100g: number }[] };
export type ScanTotals = { calories: { mid: number }; protein_g: { mid: number }; carbs_g: number; fat_g: number };
export type Swap = { i: number; a: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ingredient kcal after a swap: grams x the alternative's kcal per 100 g. Invalid swaps are ignored. */
export function ingKcal(ing: ScanIng, k: number, swap: Swap[]): number {
  const s = swap.find((x) => x.i === k);
  const alt = s ? ing.alternatives?.[s.a] : undefined;
  return alt && typeof ing.grams === "number" ? Math.max(0, (ing.grams * alt.kcal_per_100g) / 100) : Math.max(0, ing.kcal);
}

/**
 * Removing ingredients and swapping look-alikes scale every total by the share of ingredient calories kept;
 * the portion multiplier is applied on top.
 */
export function adjustScan(t: ScanTotals, ingredients: ScanIng[], portion: number, exclude: number[], swap: Swap[] = []) {
  const all = ingredients.reduce((n, i) => n + Math.max(0, i.kcal), 0);
  const kept = ingredients.reduce((n, i, k) => n + (exclude.includes(k) ? 0 : ingKcal(i, k, swap)), 0);
  const keep = all > 0 ? Math.max(0, kept / all) : 1;
  const f = keep * portion;
  return { calories: Math.round(t.calories.mid * f), protein_g: r1(t.protein_g.mid * f), carbs_g: r1(t.carbs_g * f), fat_g: r1(t.fat_g * f) };
}
