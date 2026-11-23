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
