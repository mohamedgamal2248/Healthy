import { dayDiff } from "./dates";

export type StreakState = { current: number; longest: number; last: string | null; total: number; /** day a "freeze" bridged one missed day */ freezeUsed?: string | null };

/** One missed day is forgiven automatically, then the freeze recharges after this many days. */
export const FREEZE_COOLDOWN_DAYS = 7;

export function freezeAvailable(s: Pick<StreakState, "freezeUsed">, today: string): boolean {
  return !s.freezeUsed || dayDiff(today, s.freezeUsed) >= FREEZE_COOLDOWN_DAYS;
}

/** True when yesterday was missed but the freeze is still protecting the streak (today's challenge completes it). */
export function isFrozen(s: StreakState, today: string): boolean {
  return !!s.last && dayDiff(today, s.last) === 2 && freezeAvailable(s, today) && s.current > 0;
}

/** Streak as shown today: one missed day is protected by the freeze; a longer gap reads as 0. */
export function effectiveStreak(s: StreakState, today: string): number {
  if (!s.last) return 0;
  const gap = dayDiff(today, s.last);
  if (gap <= 1) return s.current;
  return gap === 2 && freezeAvailable(s, today) ? s.current : 0;
}

/** Apply a completed challenge on `today`. At least one completion per day keeps the streak alive. */
export function applyCompletion(s: StreakState, today: string): StreakState {
  const total = s.total + 1;
  // A day earlier than the last counted one can never move the streak (no going back in time).
  if (s.last !== null && today < s.last) return { ...s, total };
  if (s.last === today) return { ...s, total };
  const gap = s.last !== null ? dayDiff(today, s.last) : null;
  const bridged = gap === 2 && freezeAvailable(s, today); // exactly one missed day, freeze ready
  const continues = gap === 1 || bridged;
  const current = continues ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), last: today, total, freezeUsed: bridged ? today : s.freezeUsed ?? null };
}

export function streakBadges(current: number): string[] {
  const out: string[] = [];
  if (current >= 7) out.push("streak_7");
  if (current >= 30) out.push("streak_30");
  if (current >= 100) out.push("streak_100");
  return out;
}
