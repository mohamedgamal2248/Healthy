// Ingredient keys used for the "I have these ingredients" matching. Cheap, local, available in Egypt.
export type IngredientDef = { key: string; ar: string; en: string; group: "protein" | "veg" | "grain" | "dairy" | "fruit" };

export const INGREDIENTS: IngredientDef[] = [
  { key: "foul", ar: "فول مدمس", en: "Fava beans (foul)", group: "protein" },
  { key: "lentils", ar: "عدس", en: "Lentils", group: "protein" },
  { key: "chickpeas", ar: "حمص", en: "Chickpeas", group: "protein" },
  { key: "white_beans", ar: "فاصوليا بيضاء", en: "White beans", group: "protein" },
  { key: "eggs", ar: "بيض", en: "Eggs", group: "protein" },
  { key: "chicken", ar: "فراخ", en: "Chicken", group: "protein" },
  { key: "tuna", ar: "تونة", en: "Tuna", group: "protein" },
  { key: "fish", ar: "سمك", en: "Fish", group: "protein" },
  { key: "cottage", ar: "جبنة قريش", en: "Cottage cheese", group: "dairy" },
  { key: "yogurt", ar: "زبادي", en: "Yogurt", group: "dairy" },
  { key: "milk", ar: "لبن", en: "Milk", group: "dairy" },
  { key: "rice", ar: "أرز", en: "Rice", group: "grain" },
  { key: "oats", ar: "شوفان", en: "Oats", group: "grain" },
  { key: "bread", ar: "عيش بلدي", en: "Baladi bread", group: "grain" },
  { key: "potato", ar: "بطاطس", en: "Potatoes", group: "grain" },
  { key: "sweet_potato", ar: "بطاطا", en: "Sweet potato", group: "grain" },
  { key: "tomato", ar: "طماطم", en: "Tomatoes", group: "veg" },
  { key: "cucumber", ar: "خيار", en: "Cucumber", group: "veg" },
  { key: "onion", ar: "بصل", en: "Onion", group: "veg" },
  { key: "garlic", ar: "ثوم", en: "Garlic", group: "veg" },
  { key: "pepper", ar: "فلفل رومي", en: "Bell pepper", group: "veg" },
  { key: "carrot", ar: "جزر", en: "Carrot", group: "veg" },
  { key: "zucchini", ar: "كوسة", en: "Zucchini", group: "veg" },
  { key: "eggplant", ar: "باذنجان", en: "Eggplant", group: "veg" },
  { key: "okra", ar: "بامية", en: "Okra", group: "veg" },
  { key: "spinach", ar: "سبانخ", en: "Spinach", group: "veg" },
  { key: "molokhia", ar: "ملوخية", en: "Molokhia", group: "veg" },
  { key: "rocket", ar: "جرجير", en: "Rocket (arugula)", group: "veg" },
  { key: "lettuce", ar: "خس", en: "Lettuce", group: "veg" },
  { key: "corn", ar: "ذرة", en: "Corn", group: "veg" },
  { key: "lemon", ar: "ليمون", en: "Lemon", group: "fruit" },
  { key: "banana", ar: "موز", en: "Banana", group: "fruit" },
  { key: "apple", ar: "تفاح", en: "Apple", group: "fruit" },
  { key: "tahini", ar: "طحينة", en: "Tahini", group: "protein" },
];

export const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map((i) => [i.key, i]));

export const MEAL_TAGS = [
  { key: "weight_loss", ar: "تخسيس", en: "Weight loss" },
  { key: "muscle_gain", ar: "بناء عضلات", en: "Muscle gain" },
  { key: "diabetes_friendly", ar: "مناسب للسكر", en: "Diabetes-friendly" },
  { key: "low_salt", ar: "قليل الملح (للضغط)", en: "Low salt" },
  { key: "vegetarian", ar: "نباتي", en: "Vegetarian" },
  { key: "budget", ar: "ميزانية محدودة", en: "Tight budget" },
] as const;
export type MealTag = (typeof MEAL_TAGS)[number]["key"];
