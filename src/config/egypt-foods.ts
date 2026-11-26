// Approximate energy per 100 g (as served / cooked) of common Egyptian foods. Used two ways: given to the photo model as a
// reference, and to correct an ingredient whose kcal strays more than 30% from its weight (a model "inventing" a number).
// General averages for guidance only; real dishes vary with oil, sugar and recipe.
export type FoodRef = { id: string; kcal: number; en: string; re: RegExp };
const r = (p: string) => new RegExp(`(?<![\\p{L}])(?:ال|و|ب|ل)*(?:${p})(?![\\p{L}])`, "u");

// Order matters: specific names first. Patterns are in normalized form (see normalizeText: ة→ه, أ/إ→ا, ى→ي, lower case).
export const FOOD_REFS: FoodRef[] = [
  { id: "koshari", kcal: 150, en: "koshari", re: r("كشري|koshari|koshary|kushari") },
  { id: "foul", kcal: 110, en: "foul medames (cooked fava beans)", re: r("فول مدمس|فول|foul|ful medames|fava beans?") },
  { id: "taameya", kcal: 330, en: "taameya / falafel (fried)", re: r("طعميه|فلافل|falafel|taameya|ta'?ameya") },
  { id: "molokhia", kcal: 55, en: "molokhia (with broth)", re: r("ملوخيه|molokh?iy?a|jute") },
  { id: "rice_pudding", kcal: 120, en: "rice pudding (roz bel laban)", re: r("رز بلبن|ارز بلبن|roz bel laban|rice pudding") },
  { id: "bechamel_pasta", kcal: 190, en: "macarona bechamel", re: r("مكرونه بشاميل|macarona bechamel|pasta bechamel|bechamel pasta") },
  { id: "mahshi", kcal: 140, en: "mahshi (stuffed vegetables with rice)", re: r("محشي|mahshi|dolma|stuffed (?:vegetables|peppers|cabbage|vine leaves|zucchini)") },
  { id: "fatta", kcal: 200, en: "fatta", re: r("فته|fatta|fattah") },
  { id: "feteer", kcal: 400, en: "feteer meshaltet", re: r("فطير|feteer|fiteer|meshaltet") },
  { id: "hawawshi", kcal: 280, en: "hawawshi", re: r("حواوشي|hawawshi") },
  { id: "kofta", kcal: 250, en: "kofta / kebab (grilled)", re: r("كفته|كباب|kofta|kebab|kabab") },
  { id: "chicken_fried", kcal: 260, en: "fried / breaded chicken", re: r("(?:فراخ|دجاج|chicken)[^,]{0,18}(?:مقليه|بانيه|مقرمشه|fried|breaded|crispy)|بانيه|fried chicken") },
  { id: "chicken_grilled", kcal: 165, en: "grilled chicken breast", re: r("(?:فراخ|دجاج|chicken)[^,]{0,18}(?:مشويه|مشوي|grilled|breast)|grilled chicken|صدور|chicken breast") },
  { id: "chicken", kcal: 215, en: "cooked chicken", re: r("فراخ|دجاج|chicken") },
  { id: "fish_fried", kcal: 230, en: "fried fish", re: r("سمك مقلي|سمك مقليه|fried fish") },
  { id: "fish", kcal: 130, en: "grilled / baked fish", re: r("سمك|fish|بلطي|بوري") },
  { id: "tuna", kcal: 116, en: "canned tuna in water", re: r("تونه|tuna") },
  { id: "beef", kcal: 250, en: "cooked beef / lamb", re: r("لحمه|لحم|beef|lamb|steak|meat") },
  { id: "liver", kcal: 165, en: "liver", re: r("كبده|كبد|liver") },
  { id: "lentil_soup", kcal: 70, en: "lentil soup", re: r("شوربه عدس|lentil soup") },
  { id: "lentils", kcal: 116, en: "cooked lentils", re: r("عدس|lentils?") },
  { id: "chickpeas", kcal: 164, en: "cooked chickpeas", re: r("حمص|chickpeas?|hummus") },
  { id: "pasta", kcal: 158, en: "cooked pasta / macaroni", re: r("مكرونه|معكرونه|شعريه|pasta|macaroni|spaghetti|vermicelli|noodles?") },
  { id: "rice", kcal: 130, en: "cooked white rice", re: r("ارز|رز|rice") },
  { id: "bread", kcal: 270, en: "baladi bread / pita", re: r("عيش|خبز|رغيف|baladi|bread|pita|toast") },
  { id: "egg_fried", kcal: 196, en: "fried egg / omelette", re: r("(?:بيض|عجه|egg|omelet+e?)[^,]{0,14}(?:مقلي|مقليه|fried|scrambled)|عجه|omelet+e?") },
  { id: "egg", kcal: 155, en: "boiled egg", re: r("بيض|بيضه|eggs?") },
  { id: "cottage", kcal: 98, en: "cottage cheese (qarish)", re: r("جبنه قريش|قريش|cottage") },
  { id: "roumi", kcal: 380, en: "roumi cheese", re: r("رومي|roumi|romy|hard cheese") },
  { id: "white_cheese", kcal: 260, en: "white cheese (domiati / feta)", re: r("جبنه بيضاء|جبنه|دمياطي|white cheese|feta|domiati|cheese") },
  { id: "yogurt", kcal: 60, en: "plain yogurt", re: r("زبادي|yogh?urt") },
  { id: "milk", kcal: 61, en: "milk", re: r("لبن|حليب|milk") },
  { id: "tahini", kcal: 595, en: "tahini", re: r("طحينه|tahini|tahina") },
  { id: "ghee", kcal: 900, en: "ghee", re: r("سمن|ghee|samna") },
  { id: "butter", kcal: 717, en: "butter", re: r("زبده|butter") },
  { id: "oil", kcal: 884, en: "cooking oil", re: r("زيت|oil") },
  { id: "sugar", kcal: 387, en: "sugar", re: r("سكر|sugar") },
  { id: "honey", kcal: 304, en: "honey", re: r("عسل|honey|molasses|دبس") },
  { id: "dates", kcal: 282, en: "dates", re: r("بلح|تمر|dates?") },
  { id: "fries", kcal: 312, en: "french fries", re: r("بطاطس مقليه|بطاطس محمره|fries|chips|french fries") },
  { id: "potato", kcal: 90, en: "boiled / baked potato", re: r("بطاطس|بطاطا|potato(?:es)?") },
  { id: "basbousa", kcal: 350, en: "basbousa", re: r("بسبوسه|basbousa|basbosa") },
  { id: "kunafa", kcal: 400, en: "kunafa", re: r("كنافه|kunafa|knafeh|kunafeh") },
  { id: "om_ali", kcal: 280, en: "om ali", re: r("ام علي|om ali|umm ali") },
  { id: "salad", kcal: 25, en: "vegetable salad", re: r("سلطه|salad|خيار|طماطم|cucumber|tomato") },
];

/** "without sugar", "بدون سكر", "من غير زيت": the named food is absent, so it must not match its own reference row. */
const NEGATED = /(?:بدون|من غير|بلا|خالي من|without|no|free of)\s+(?:(?:added|extra|اضافه|زياده)\s+)?[\p{L}]+(?:\s+(?:مضاف|مضافه|added))?/gu;

export function matchFoodRef(normalizedName: string): FoodRef | null {
  const name = normalizedName.replace(NEGATED, " ");
  for (const f of FOOD_REFS) if (f.re.test(name)) return f;
  return null;
}

/** Compact reference list for the photo prompt. */
export const FOOD_REF_PROMPT = FOOD_REFS.map((f) => `${f.en} ${f.kcal}`).join("; ");
