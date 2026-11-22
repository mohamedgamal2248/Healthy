export type Lang = "ar" | "en";

/** The language of the user's own text wins (Arabic letters -> ar, otherwise Latin letters -> en); else the UI language. */
export function detectLang(text: string, fallback: Lang = "ar"): Lang {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar === 0 && en === 0) return fallback;
  return ar >= en ? "ar" : "en";
}

export const asLang = (v: unknown, fallback: Lang = "ar"): Lang => (v === "en" ? "en" : v === "ar" ? "ar" : fallback);

/** Appended to every system prompt. Overrides the Arabic-only wording above it. */
export function langInstruction(lang: Lang): string {
  return lang === "en"
    ? `\nLANGUAGE OVERRIDE: write EVERY text value in clear, simple ENGLISH (names, ingredients, quantities, steps, benefits, tips, refusal message). Keep the JSON keys exactly as specified. Any Arabic words in the example JSON shape are only placeholders: replace them with real English content. Use ingredients easily found in Egypt unless the user asks otherwise. If you must refuse, put the refusal message in English.`
    : `\nاللغة المطلوبة: العربية المبسّطة لكل القيم النصية، مع إبقاء مفاتيح JSON كما هي.`;
}
