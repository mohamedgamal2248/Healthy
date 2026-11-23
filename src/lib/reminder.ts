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

/** Notice for a monthly plan that ends soon. */
export function expiryText({ daysLeft, lang }: { daysLeft: number; lang: "ar" | "en" }): { title: string; body: string } {
  const d = Math.max(0, daysLeft);
  if (lang === "ar") return { title: d <= 1 ? "خطتك تنتهي غدًا" : `خطتك تنتهي بعد ${d} أيام`, body: "جدّد من صفحة الباقات للحفاظ على طلبات Healthy AI ونظامك الأسبوعي." };
  return { title: d <= 1 ? "Your plan ends tomorrow" : `Your plan ends in ${d} days`, body: "Renew from the Pricing page to keep your Healthy AI requests and weekly plan." };
}
