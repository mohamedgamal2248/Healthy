import { MIN_DAILY_KCAL } from "@/config/pricing";

export { DISCLAIMER_AR, DISCLAIMER_EN } from "@/lib/texts";
export const DOCTOR_NOTE_AR = "راجع طبيبك المعالج قبل اتباع أي نظام غذائي.";
export const DOCTOR_NOTE_EN = "Review any plan with your treating doctor before following it.";

export const REFUSAL_AR = "عذرًا، لا أستطيع المساعدة في التشخيص أو العلاج أو وضع نظام غذائي لطفل. أقدّم نصائح غذائية عامة فقط، وننصحك بمراجعة الطبيب المختص.";
export const REFUSAL_EN = "Sorry, I can't help with diagnosis, treatment or a diet plan for a child. I only give general nutrition guidance; please see a qualified doctor.";

const CONDITION_CAUTION: Record<string, { ar: string; en: string }> = {
  diabetes: { ar: "تنبيه للسكري: راقب حجم الحصة وتجنّب السكريات المضافة، وراجع طبيبك قبل اتباع هذه الوصفة.", en: "Diabetes caution: watch portion size, avoid added sugar and check with your doctor before following this recipe." },
  hypertension: { ar: "تنبيه للضغط: قلّل الملح والمخللات والأجبان المالحة، وراجع طبيبك قبل اتباع هذه الوصفة.", en: "Hypertension caution: keep salt, pickles and salty cheese low and check with your doctor before following this recipe." },
  pregnancy: { ar: "تنبيه للحمل: راجع طبيبك قبل أي تغيير غذائي، وتأكد من أن الأكل مطهو جيدًا ومن مصدر آمن.", en: "Pregnancy caution: check with your doctor before any dietary change and make sure food is well cooked and from a safe source." },
};

export function cautionsFor(conditions: string[]): { ar: string; en: string }[] {
  return conditions.filter((c) => CONDITION_CAUTION[c]).map((c) => CONDITION_CAUTION[c]);
}
export const hasMedicalFlag = (conditions: string[]) => conditions.some((c) => c in CONDITION_CAUTION);

// Requests we politely refuse: diagnosis, treatment, medication / supplement doses, a plan for a child.
const REFUSAL_PATTERNS = [
  /تشخيص|شخّص|شخص لي|عندي (مرض|ورم|سرطان)|أعراض مرض/,
  /(علاج|يعالج|أعالج|دواء|أدوية|روشتة)\s*(ل|من)?/,
  /جرعة|جرعات|مكمل|مكملات|فيتامينات\s*حبوب|حبوب\s*تخسيس/,
  /(دايت|رجيم|نظام|خطة|وجبات|أكل)[^.؟!]{0,25}(لطفل|لابني|لبنتي|للرضيع|لرضيع|لأطفال|لولدي|لابنتي)/,
  /diagnos|prescri|treat my|cure|dosage|supplement|diet (plan )?for (my )?(child|kid|baby|son|daughter)/i,
];

export function isRefusalRequest(text: string): boolean {
  return REFUSAL_PATTERNS.some((p) => p.test(text));
}

// Words that must never appear in generated output (fasting, medicine, supplements, doses).
const FORBIDDEN_OUTPUT = /صيام|صوم متقطع|مكمل|مكملات|دواء|أدوية|جرعة|جرعات|يعالج|يشفي|علاج للسكر|supplement|dosage|medication|fasting|cures?\b/i;
export const outputIsSafe = (text: string) => !FORBIDDEN_OUTPUT.test(text);

export const kcalAboveFloor = (dailyKcal: number) => dailyKcal >= MIN_DAILY_KCAL;
