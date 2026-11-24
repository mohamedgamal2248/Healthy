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
  /جرعة|جرعات|جرعه|مكمل|مكملات|فيتامينات\s*حبوب|حبوب\s*تخسيس|دوا\b|انسولين|insulin|medicine|medication|pills?\b/i,
  /(دايت|رجيم|نظام|خطة|وجبات|أكل)[^.؟!]{0,25}(لطفل|لابني|لبنتي|للرضيع|لرضيع|لأطفال|لولدي|لابنتي)/,
  /diagnos|prescri|treat my|cure|dosage|supplement|diet (plan )?for (my )?(child|kid|baby|son|daughter)/i,
];

/** Fold tashkeel, tatweel, zero-width marks and hamza/ya/ta-marbuta variants so simple obfuscation does not slip through. */
export function normalizeText(t: string): string {
  return t.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
}
const CHILD_WORDS = /(طفل|اطفال|ابني|بنتي|رضيع|ولدي|ابنتي|صغيري|ولد|toddler|child|kid|baby|infant|son\b|daughter|year[- ]old)/;
const PLAN_WORDS = /(دايت|رجيم|ريجيم|نظام|خطه|وجبات|اكل|وصفه|تمرين|تحدي|diet|meal plan|plan|recipe|workout|menu)/;
export function isRefusalRequest(text: string): boolean {
  const n = normalizeText(text);
  if (CHILD_WORDS.test(n) && PLAN_WORDS.test(n)) return true;
  return REFUSAL_PATTERNS.some((p) => p.test(text) || p.test(n));
}

// Words that must never appear in generated output (fasting, medicine, supplements, doses).
const FORBIDDEN_OUTPUT = /صيام|صوم متقطع|مكمل|مكملات|دواء|أدوية|جرعة|جرعات|يعالج|يشفي|علاج للسكر|supplement|dosage|medication|fasting|\bcures?\b|medicine|insulin/i;
/** Model-written refusal text is shown to users: keep it short, plain and safe, else use our fixed text. */
export function safeRefusalText(t: unknown, fallback: string): string {
  if (typeof t !== "string") return fallback;
  const s = t.replace(/\s+/g, " ").trim();
  if (s.length < 3 || s.length > 300 || /[<>]|https?:|www\./i.test(s) || !outputIsSafe(s)) return fallback;
  return s;
}
/** True when the text states a DAILY calorie amount below the safe floor (e.g. "eat 800 calories a day"). */
export function dailyKcalTooLow(text: string): boolean {
  const n = normalizeText(text);
  const unit = "(?:kcal|calories|calorie|cal|سعر\\w*|كالوري\\w*)";
  const per = "(?:per day|a day|each day|daily|يوميا|في اليوم|كل يوم)";
  const re = [new RegExp(`(\\d{3,4})\\s*${unit}[^.\\n]{0,25}${per}`, "g"), new RegExp(`${per}[^\\d.\\n]{0,25}(\\d{3,4})\\s*${unit}`, "g")];
  return re.some((r) => [...n.matchAll(r)].some((m) => Number(m[1]) < MIN_DAILY_KCAL));
}
/**
 * Pork and alcohol never appear in anything Healthy generates (an app for Egypt: halal by default). Checked on the normalised
 * text (Arabic letters folded) with word boundaries, so "ham" never matches "hamburger" and "wine" never matches "swine flu".
 */
const HARAM_EN = /(?<![\p{L}])(?:pork|bacon|ham|prosciutto|pancetta|pepperoni|chorizo|salami|mortadella|lard|gelatin|gelatine|sausages?|hot ?dogs?|wine|beer|alcohol(?:ic)?|rum|vodka|whisk(?:e)?y|liquor|champagne|cider|brandy|cocktails?)(?![\p{L}])/iu;
const HARAM_AR = /(?<![\p{L}])(?:ال|و|ب|ل|ف)*(?:خنزير|لحم مقدد|مقدد|بيكون|جامبون|هامبرجر خنزير|لارد|جيلاتين|نبيذ|بيره|كحول|كحوليه|خمر|ويسكي|فودكا|نقانق|مارتديلا|سلامي|بيبروني|شوريزو)(?![\p{L}])/u;
/** The first pork / alcohol word found, or null. */
export function haramHit(text: string): string | null {
  const n = normalizeText(text);
  return HARAM_EN.exec(n)?.[0] ?? HARAM_AR.exec(n)?.[0] ?? null;
}
export const outputIsSafe = (text: string) => !FORBIDDEN_OUTPUT.test(text) && !haramHit(text) && !dailyKcalTooLow(text);

/** A single generated meal above this many kcal is rejected unless the user asked for a family / sharing / bulk meal. */
export const MAX_SINGLE_MEAL_KCAL = 900;
export const asksForBulk = (text: string) => /(عائل|عيل|عزوم|مشارك|للمشاركه|حفل|ضخم|تضخيم|bulk|family|sharing|share|party|feast|big meal)/i.test(normalizeText(text));

export const kcalAboveFloor = (dailyKcal: number) => dailyKcal >= MIN_DAILY_KCAL;
