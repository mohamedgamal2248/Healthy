import { dayDiff } from "./dates";

export type StreakState = { current: number; longest: number; last: string | null; total: number };

/** Streak as shown today: a missed day (last completion older than yesterday) reads as 0. */
export function effectiveStreak(s: StreakState, today: string): number {
  if (!s.last) return 0;
  return dayDiff(today, s.last) <= 1 ? s.current : 0;
}

/** Apply a completed challenge on `today`. At least one completion per day keeps the streak alive. */
export function applyCompletion(s: StreakState, today: string): StreakState {
  const total = s.total + 1;
  if (s.last === today) return { ...s, total };
  const continues = s.last !== null && dayDiff(today, s.last) === 1;
  const current = continues ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), last: today, total };
}

export function streakBadges(current: number): string[] {
  const out: string[] = [];
  if (current >= 7) out.push("streak_7");
  if (current >= 30) out.push("streak_30");
  if (current >= 100) out.push("streak_100");
  return out;
}
