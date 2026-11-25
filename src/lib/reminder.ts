/** Daily reminder rules (pure, unit-tested). */
export type ReminderInput = { lastCompletedDate: string | null; today: string; streak: number; lang: "ar" | "en" };

/** Remind only people who have not completed a challenge today (their own local date). */
export const needsReminder = (lastCompletedDate: string | null, today: string) => lastCompletedDate !== today;

export function reminderText({ streak, lang }: Pick<ReminderInput, "streak" | "lang">): { title: string; body: string } {
  if (lang === "ar") {
    return streak > 0
      ? { title: `سلسلتك ${streak} يوم`, body: "تحدٍّ واحد صغير يحافظ عليها. خدها الآن." }
      : { title: "تحدي اليوم في انتظارك", body: "ابدأ بتحدٍّ صغير النهارده، دقيقة واحدة تكفي." };
  }
  return streak > 0
    ? { title: `Your ${streak}-day streak`, body: "One quick challenge keeps it going. Do it now." }
    : { title: "Today's challenge is waiting", body: "Start with one small challenge. A minute is enough." };
}

export type DaySnapshot = {
  /** Calorie target for the day, or null when the profile is incomplete. */
  target: number | null;
  /** Protein target in grams (null when there is no calorie target). */
  proteinTarget: number | null;
  /** What the person has logged today. */
  eatenKcal: number;
  eatenProtein: number;
  entries: number;
};

const nf = (n: number, ar: boolean) => (ar ? n.toLocaleString("ar-EG") : String(n));

/**
 * The reminder built from the person's real day: what is left of their calories and protein, or a nudge to log
 * their first meal. Never shames: going over the target, or nothing to say, falls back to the plain challenge text.
 */
export function smartReminderText(i: { streak: number; lang: "ar" | "en"; day: DaySnapshot | null }): { title: string; body: string } {
  const base = reminderText({ streak: i.streak, lang: i.lang });
  const d = i.day;
  if (!d || !d.target) return base;
  const ar = i.lang === "ar";
  const left = Math.round(d.target - d.eatenKcal);
  const protLeft = d.proteinTarget ? Math.round(d.proteinTarget - d.eatenProtein) : 0;
  if (d.entries === 0) {
    return ar
      ? { title: "لسه مسجّلتش أكلك النهارده", body: `سجّل أول وجبة في ثواني وشوف فاضلك كام. وتحدي اليوم في انتظارك.` }
      : { title: "You haven't logged any food yet", body: "Log your first meal in seconds and see what's left. Today's challenge is waiting too." };
  }
  if (left < 150) return base; // reached the goal (or past it): no numbers, just the challenge
  const protPart = protLeft >= 15;
  if (ar) {
    return {
      title: `فاضلك ${nf(Math.round(left / 10) * 10, true)} سعر النهارده`,
      body: protPart ? `وفاضل ${nf(protLeft, true)} جم بروتين. وجبة غنية بالبروتين تكمّل يومك، وتحدي اليوم في انتظارك.` : "وجبة خفيفة تكمّل يومك، وتحدي اليوم في انتظارك.",
    };
  }
  return {
    title: `${Math.round(left / 10) * 10} kcal left today`,
    body: protPart ? `And ${protLeft} g of protein to go. A protein-rich meal rounds off your day. Today's challenge is waiting too.` : "A light meal rounds off your day. Today's challenge is waiting too.",
  };
}

/** Notice for a monthly plan that ends soon. */
export function expiryText({ daysLeft, lang }: { daysLeft: number; lang: "ar" | "en" }): { title: string; body: string } {
  const d = Math.max(0, daysLeft);
  if (lang === "ar") return { title: d <= 1 ? "خطتك تنتهي غدًا" : `خطتك تنتهي بعد ${d} أيام`, body: "جدّد من صفحة الباقات للحفاظ على طلبات Healthy AI ونظامك الأسبوعي." };
  return { title: d <= 1 ? "Your plan ends tomorrow" : `Your plan ends in ${d} days`, body: "Renew from the Pricing page to keep your Healthy AI requests and weekly plan." };
}
