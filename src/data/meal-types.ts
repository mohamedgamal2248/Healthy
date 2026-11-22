// Shared types and builders for the meal catalogue seeds.
import type { MealTag } from "./ingredients";

export type MealType = "breakfast" | "lunch" | "dinner";
export type MealIngredient = { item: string; qty: string; key?: string };
export type Cuisine = "egyptian" | "international";
export type MealSeed = {
  cuisine: Cuisine;
  /** Country / region of an international dish (Arabic + English). */
  origin_ar?: string;
  origin_en?: string;
  id: string;
  meal_type: MealType;
  name_ar: string;
  name_en: string;
  time_min: number;
  calories: number;
  protein_g: number;
  cost_egp: number;
  why_ar: string;
  why_en: string;
  tags: MealTag[];
  ingredients: MealIngredient[];
  steps: string[];
};

type I = [string, string, string?];
export function meal(
  id: string,
  meal_type: MealType,
  name_ar: string,
  name_en: string,
  time_min: number,
  calories: number,
  protein_g: number,
  cost_egp: number,
  tags: MealTag[],
  why_ar: string,
  why_en: string,
  ings: I[],
  steps: string[],
): MealSeed {
  return {
    cuisine: "egyptian", id, meal_type, name_ar, name_en, time_min, calories, protein_g, cost_egp, why_ar, why_en, tags,
    ingredients: ings.map(([item, qty, key]) => ({ item, qty, ...(key ? { key } : {}) })),
    steps,
  };
}


/** International dish: same shape, plus where it comes from. */
export function intl(origin_ar: string, origin_en: string, ...args: Parameters<typeof meal>): MealSeed {
  return { ...meal(...args), cuisine: "international", origin_ar, origin_en };
}
