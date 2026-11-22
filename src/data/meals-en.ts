// English ingredients + steps for every catalogue meal (the Arabic originals live next to each meal).
import { MEALS_EN_BASE } from "./meals-en-base";
import { MEALS_EN_EGYPTIAN } from "./meals-en-egyptian";
import { MEALS_EN_INTERNATIONAL } from "./meals-en-international";

export type MealEn = { ingredients: { item: string; qty: string }[]; steps: string[] };
export const MEALS_EN: Record<string, MealEn> = { ...MEALS_EN_BASE, ...MEALS_EN_EGYPTIAN, ...MEALS_EN_INTERNATIONAL };
