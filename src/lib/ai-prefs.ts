// Preferences the user chooses once; they are sent with every AI request so answers fit them.
// Shared by the profile screen (labels) and the server (validation + prompt lines).
export const ALLERGENS = ["nuts", "dairy", "eggs", "gluten", "seafood", "sesame"] as const;
export const EQUIPMENT = ["dumbbells", "bands", "mat", "bar"] as const;
export const JOINTS = ["knees", "back", "shoulders", "wrists"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Allergen = (typeof ALLERGENS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Joint = (typeof JOINTS)[number];
export type Level = (typeof LEVELS)[number];

export const PREF_LABELS: Record<string, { ar: string; en: string }> = {
  nuts: { ar: "مكسرات", en: "Nuts" },
  dairy: { ar: "ألبان", en: "Dairy" },
  eggs: { ar: "بيض", en: "Eggs" },
  gluten: { ar: "جلوتين (قمح)", en: "Gluten (wheat)" },
  seafood: { ar: "سمك ومأكولات بحرية", en: "Fish and seafood" },
  sesame: { ar: "سمسم وطحينة", en: "Sesame and tahini" },
  dumbbells: { ar: "دمبل", en: "Dumbbells" },
  bands: { ar: "أحبال مقاومة", en: "Resistance bands" },
  mat: { ar: "مرتبة يوجا", en: "Exercise mat" },
  bar: { ar: "بار عقلة", en: "Pull-up bar" },
  knees: { ar: "الركبة", en: "Knees" },
  back: { ar: "الظهر", en: "Back" },
  shoulders: { ar: "الكتف", en: "Shoulders" },
  wrists: { ar: "الرسغ", en: "Wrists" },
  beginner: { ar: "مبتدئ", en: "Beginner" },
  intermediate: { ar: "متوسط", en: "Intermediate" },
  advanced: { ar: "متقدم", en: "Advanced" },
};

/** Free-text "foods I don't like": letters, digits, spaces and commas only, short. Treated as data in prompts. */
export function cleanDislikes(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[^\p{L}\p{N}\s,،]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
