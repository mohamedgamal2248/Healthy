import { MIN_DAILY_KCAL } from "@/config/pricing";

export type Goal = "lose" | "gain" | "maintain";
export type Activity = "low" | "medium" | "high";
export type Sex = "male" | "female";

export const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.375, medium: 1.55, high: 1.725 };

export type PlanInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  goal: Goal;
  activity: Activity;
  conditions: string[];
  /** Cumulative weekly adjustment in kcal (from weight trend). */
  adjustment?: number;
};

export function clampCalories(k: number): number {
  return Math.max(MIN_DAILY_KCAL, Math.round(k / 10) * 10);
}

/** Mifflin-St Jeor BMR. */
export function bmr(i: Pick<PlanInput, "weightKg" | "heightCm" | "age" | "sex">): number {
  return 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === "male" ? 5 : -161);
}

/** Daily calorie target: TDEE shifted by goal and trend adjustment, never below the 1,200 kcal floor. */
export function dailyCalories(i: PlanInput): number {
  const tdee = bmr(i) * ACTIVITY_FACTOR[i.activity];
  let delta = i.goal === "lose" ? -Math.min(500, tdee * 0.2) : i.goal === "gain" ? 300 : 0;
  const pregnant = i.conditions.includes("pregnancy");
  // No deficit while pregnant: guidance stays at maintenance or above.
  if (pregnant && delta < 0) delta = 0;
  const adj = Math.max(-300, Math.min(300, i.adjustment ?? 0));
  let target = tdee + delta + (pregnant ? Math.max(0, adj) : adj);
  if (!pregnant && i.goal === "lose") target = Math.min(target, tdee); // never above maintenance when losing
  return clampCalories(target);
}

/** Water target in 250 ml cups (about 35 ml/kg), 8..14 cups. */
export function dailyWaterCups(weightKg: number): number {
  return Math.max(8, Math.min(14, Math.round((weightKg * 35) / 250)));
}

/** Weekly trend adjustment (kcal) from the last two official weights. Bounded and gentle. */
export function weeklyAdjustment(goal: Goal, prevKg: number | null, currentKg: number, previousAdjustment: number): number {
  if (prevKg === null) return previousAdjustment;
  const change = currentKg - prevKg; // kg this week
  let adj = previousAdjustment;
  if (goal === "lose" && change > -0.2) adj -= 100; // not losing: trim a little
  else if (goal === "lose" && change < -1) adj += 100; // losing too fast: ease off
  else if (goal === "gain" && change < 0.1) adj += 100;
  else if (goal === "gain" && change > 0.7) adj -= 100;
  else if (goal === "maintain" && change > 0.7) adj -= 100;
  else if (goal === "maintain" && change < -0.7) adj += 100;
  return Math.max(-300, Math.min(300, adj));
}

export const SPLIT = { breakfast: 0.25, lunch: 0.4, dinner: 0.35 } as const;
