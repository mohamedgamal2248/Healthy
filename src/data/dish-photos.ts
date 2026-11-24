// Real food photos from Wikimedia Commons, used under their free licences (CC0 / public domain / CC BY / CC BY-SA).
// Every photo is credited on the /open-source page. `DISH_PHOTOS` is generated: see docs/photos.md.
export type DishPhoto = { src: string; title: string; author: string; license: string; url: string };
export const DISH_PHOTOS: Record<string, DishPhoto> = {};

// First matching rule wins; a meal whose key has no photo simply shows the text card.
const RULES: [RegExp, string][] = [
  [/koshari|megadara/, "koshari"],
  [/molokhia|bissara/, "molokhia"],
  [/taameya|falafel/, "taameya"],
  [/foul/, "foul"],
  [/shakshuka|menemen|huevos/, "shakshuka"],
  [/omelet|omelette|eggah|egg|tamago|gyeran/, "eggs"],
  [/oat|pancake|chilla/, "oats"],
  [/sweet-potato/, "sweet_potato"],
  [/cabbage-rolls|stuffed|mahshi|karniyarik/, "mahshi"],
  [/kofta|kebab/, "kofta"],
  [/chicken|shish|tawook|joojeh|turkey|shawarma|tikka/, "chicken"],
  [/fish|tilapia|sayadiya|plaki|shrimp/, "fish"],
  [/soup|harira|minestrone/, "soup"],
  [/salad|tabbouleh/, "salad"],
  [/pasta|macarona/, "pasta"],
  [/hummus|baba|cottage|yogurt/, "hummus"],
  [/tagine|stew|musaqaa/, "tagine"],
];

/** The photo for a catalogue meal, chosen by dish type from its id; null when there is none. */
export function photoForMeal(id: string): DishPhoto | null {
  for (const [re, key] of RULES) if (re.test(id) && DISH_PHOTOS[key]) return DISH_PHOTOS[key];
  return null;
}

/** Dish names shown on the landing page strip, in the order they appear. */
export const STRIP: { key: string; ar: string; en: string }[] = [
  { key: "koshari", ar: "كشري", en: "Koshari" },
  { key: "foul", ar: "فول", en: "Foul" },
  { key: "molokhia", ar: "ملوخية", en: "Molokhia" },
  { key: "kofta", ar: "كفتة", en: "Kofta" },
  { key: "shakshuka", ar: "شكشوكة", en: "Shakshuka" },
  { key: "mahshi", ar: "محشي", en: "Mahshi" },
];
