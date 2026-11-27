/** Daily reminder rules (pure, unit-tested). */
export type ReminderInput = { lastCompletedDate: string | null; today: string; streak: number; lang: "ar" | "en" };

/** Remind only people who have not completed a challenge today (their own local date). */
export const needsReminder = (lastCompletedDate: string | null, today: string) => lastCompletedDate !== today;

/** Streak lengths worth celebrating (and worth a nudge the day before). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

/** Deterministic pick: the same person gets the same line on a given day, different people and days get different lines. A missing seed gives the first (original) line. */
const pick = <T,>(arr: readonly T[], seed?: number): T => arr[Math.abs(Math.trunc(seed ?? 0)) % arr.length];

/** Stable small number from text (username + date) so wording rotates without storing anything. */
export function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function reminderText({ streak, lang, seed }: Pick<ReminderInput, "streak" | "lang"> & { seed?: number }): { title: string; body: string } {
  const ar = lang === "ar";
  if (streak > 0 && (STREAK_MILESTONES as readonly number[]).includes(streak + 1)) {
    const n = streak + 1;
    return ar
      ? { title: `تحدٍّ واحد يوصلك إلى ${n} أيام`, body: `سلسلتك ${streak} يوم. أنجز تحدي اليوم وسجّل رقمًا جديدًا.` }
      : { title: `One challenge to reach ${n} days`, body: `You're on a ${streak}-day streak. Finish today's challenge and hit a new mark.` };
  }
  if (ar) {
    return streak > 0
      ? pick([
          { title: `سلسلتك ${streak} يوم`, body: "تحدٍّ واحد صغير يحافظ عليها. خدها الآن." },
          { title: `حافظ على سلسلتك: ${streak} يوم`, body: "دقيقة واحدة وتحدٍّ صغير يكفيان لتكمل اليوم." },
          { title: "لا تكسر السلسلة", body: `وصلت ${streak} يوم. تحدي اليوم سهل، ابدأ الآن.` },
        ], seed)
      : pick([
          { title: "تحدي اليوم في انتظارك", body: "ابدأ بتحدٍّ صغير النهارده، دقيقة واحدة تكفي." },
          { title: "ابدأ سلسلة جديدة اليوم", body: "أنجز تحدّيًا واحدًا فقط، والباقي أسهل." },
          { title: "وقتك الآن", body: "تحدٍّ لدقيقة يفتح لك يومًا صحيًا." },
        ], seed);
  }
  return streak > 0
    ? pick([
        { title: `Your ${streak}-day streak`, body: "One quick challenge keeps it going. Do it now." },
        { title: `Keep your ${streak}-day streak alive`, body: "One small challenge is all it takes to finish today." },
        { title: "Don't break the chain", body: `You're at ${streak} days. Today's challenge is easy, start now.` },
      ], seed)
    : pick([
        { title: "Today's challenge is waiting", body: "Start with one small challenge. A minute is enough." },
        { title: "Start a new streak today", body: "Finish just one challenge, the rest gets easier." },
        { title: "Your moment", body: "A one-minute challenge opens a healthy day." },
      ], seed);
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
export function smartReminderText(i: { streak: number; lang: "ar" | "en"; day: DaySnapshot | null; seed?: number }): { title: string; body: string } {
  const base = reminderText({ streak: i.streak, lang: i.lang, seed: i.seed });
  const d = i.day;
  if (!d || !d.target) return base;
  const ar = i.lang === "ar";
  const left = Math.round(d.target - d.eatenKcal);
  const protLeft = d.proteinTarget ? Math.round(d.proteinTarget - d.eatenProtein) : 0;
  if (d.entries === 0) {
    return ar
      ? pick([
          { title: "لسه مسجّلتش أكلك النهارده", body: "سجّل أول وجبة في ثواني وشوف فاضلك كام. وتحدي اليوم في انتظارك." },
          { title: "ماذا أكلت اليوم؟", body: "سجّل وجبتك الأولى في ثواني وتابع سعراتك. وتحدي اليوم ينتظرك." },
          { title: "يومك بلا تسجيل بعد", body: "وجبة واحدة تسجّلها تفتح لك الأرقام كلها. وتحدي اليوم ينتظرك." },
        ], i.seed)
      : pick([
          { title: "You haven't logged any food yet", body: "Log your first meal in seconds and see what's left. Today's challenge is waiting too." },
          { title: "What did you eat today?", body: "Log your first meal in seconds and track your calories. Today's challenge is waiting too." },
          { title: "Nothing logged yet today", body: "One logged meal opens up all your numbers. Today's challenge is waiting too." },
        ], i.seed);
  }
  if (left < 150) return base; // reached the goal (or past it): no numbers, just the challenge
  const protPart = protLeft >= 15;
  if (ar) {
    return {
      title: `فاضلك ${nf(Math.round(left / 10) * 10, true)} سعر النهارده`,
      body: protPart
        ? pick([`وفاضل ${nf(protLeft, true)} جم بروتين. وجبة غنية بالبروتين تكمّل يومك، وتحدي اليوم في انتظارك.`, `ينقصك ${nf(protLeft, true)} جم بروتين. بيض أو زبادي أو فراخ يكمّلونها، وتحدي اليوم ينتظرك.`], i.seed)
        : pick(["وجبة خفيفة تكمّل يومك، وتحدي اليوم في انتظارك.", "سناك خفيف يكفي، وتحدي اليوم ينتظرك."], i.seed),
    };
  }
  return {
    title: `${Math.round(left / 10) * 10} kcal left today`,
    body: protPart
      ? pick([`And ${protLeft} g of protein to go. A protein-rich meal rounds off your day. Today's challenge is waiting too.`, `${protLeft} g of protein to go. Eggs, yogurt or chicken will cover it. Today's challenge is waiting too.`], i.seed)
      : pick(["A light meal rounds off your day. Today's challenge is waiting too.", "A light snack is enough. Today's challenge is waiting too."], i.seed),
  };
}

/** Notice for a monthly plan that ends soon. */
export function expiryText({ daysLeft, lang }: { daysLeft: number; lang: "ar" | "en" }): { title: string; body: string } {
  const d = Math.max(0, daysLeft);
  if (lang === "ar") return { title: d <= 1 ? "خطتك تنتهي غدًا" : `خطتك تنتهي بعد ${d} أيام`, body: "جدّد من صفحة الباقات للحفاظ على طلبات Healthy AI ونظامك الأسبوعي." };
  return { title: d <= 1 ? "Your plan ends tomorrow" : `Your plan ends in ${d} days`, body: "Renew from the Pricing page to keep your Healthy AI requests and weekly plan." };
}

/** Celebration when a streak reaches a milestone. `record` = it is also the person's longest streak so far. */
export function streakMilestoneText({ days, record, lang }: { days: number; record: boolean; lang: "ar" | "en" }): { title: string; body: string } {
  if (lang === "ar") return { title: `${days} يوم متتالي`, body: record ? "رقم قياسي جديد لك. أحسنت، واصل." : "إنجاز رائع. أحسنت، واصل." };
  return { title: `${days} days in a row`, body: record ? "A new personal record. Well done, keep going." : "Great work. Well done, keep going." };
}

/** Celebration when the weekly group challenge is finished (7 check-ins). */
export function groupFinishText({ lang }: { lang: "ar" | "en" }): { title: string; body: string } {
  return lang === "ar"
    ? { title: "أنهيت تحدي الأسبوع", body: "7 أيام كاملة مع المجتمع. حصلت على شارة المنهي." }
    : { title: "You finished the weekly challenge", body: "7 full days with the community. You earned the finisher badge." };
}
