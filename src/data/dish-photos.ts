// Real food photos from Wikimedia Commons, used under their free licences (CC0 / public domain / CC BY / CC BY-SA).
// Every photo is credited on the /open-source page. Cropped to 8:5 and compressed to WebP (see docs/photos.md).
export type DishPhoto = { src: string; title: string; author: string; license: string; url: string };
export const DISH_PHOTOS: Record<string, DishPhoto> = {
  "foul": {
    "src": "/food/foul.webp",
    "title": "Foul Medamas.jpg",
    "author": "avlxyz",
    "license": "CC BY-SA 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Foul_Medamas.jpg"
  },
  "koshari": {
    "src": "/food/koshari.webp",
    "title": "Egyptian Food.jpg",
    "author": "Dina Said",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Egyptian_Food.jpg"
  },
  "shakshuka": {
    "src": "/food/shakshuka.webp",
    "title": "Couscous take 4.jpg",
    "author": "Karim2k",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Couscous_take_4.jpg"
  },
  "oats": {
    "src": "/food/oats.webp",
    "title": "Banana Oatmeal Breakfast Bowl (44302857265).jpg",
    "author": "Ella Olsson from Stockholm, Sweden",
    "license": "CC BY 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Banana_Oatmeal_Breakfast_Bowl_(44302857265).jpg"
  },
  "chicken": {
    "src": "/food/chicken.webp",
    "title": "Chicken and Zucchini dinner.jpg",
    "author": "Infrogmation of New Orleans",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Chicken_and_Zucchini_dinner.jpg"
  },
  "fish": {
    "src": "/food/fish.webp",
    "title": "Grilled Fish with Wild Greens.jpg",
    "author": "Christin568",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Grilled_Fish_with_Wild_Greens.jpg"
  },
  "soup": {
    "src": "/food/soup.webp",
    "title": "Bowl of lentil soup with green and red lentils.jpg",
    "author": "Whoisjohngalt",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Bowl_of_lentil_soup_with_green_and_red_lentils.jpg"
  },
  "kofta": {
    "src": "/food/kofta.webp",
    "title": "Kafta Serving.JPG",
    "author": "Miansari66",
    "license": "Public domain",
    "url": "https://commons.wikimedia.org/wiki/File:Kafta_Serving.JPG"
  },
  "salad": {
    "src": "/food/salad.webp",
    "title": "Tuna Salad with sweet corn.jpg",
    "author": "Adesolive",
    "license": "CC0",
    "url": "https://commons.wikimedia.org/wiki/File:Tuna_Salad_with_sweet_corn.jpg"
  },
  "pasta": {
    "src": "/food/pasta.webp",
    "title": "Argentine Tirabuzón Molto pasta stew with ground beef and tomato sauce.jpg",
    "author": "Horacio Cambeiro",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Argentine_Tirabuz%C3%B3n_Molto_pasta_stew_with_ground_beef_and_tomato_sauce.jpg"
  },
  "sweet_potato": {
    "src": "/food/sweet_potato.webp",
    "title": "Baked Sweet Potato on Salad.jpg",
    "author": "FitTasteTic",
    "license": "CC BY-SA 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Baked_Sweet_Potato_on_Salad.jpg"
  },
  "mahshi": {
    "src": "/food/mahshi.webp",
    "title": "Dolma felfel ou karaa.JPG",
    "author": "Auzius",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Dolma_felfel_ou_karaa.JPG"
  },
  "tagine": {
    "src": "/food/tagine.webp",
    "title": "Chicken Veg Tagine Rabat Nov25 A7CR 08908.jpg",
    "author": "Timothy A. Gonsalves",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Chicken_Veg_Tagine_Rabat_Nov25_A7CR_08908.jpg"
  },
  "taameya": {
    "src": "/food/taameya.webp",
    "title": "Bowl of falafel.jpg",
    "author": "EvanProdromou",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Bowl_of_falafel.jpg"
  }
};

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
  { key: "kofta", ar: "كفتة", en: "Kofta" },
  { key: "soup", ar: "شوربة عدس", en: "Lentil soup" },
  { key: "shakshuka", ar: "شكشوكة", en: "Shakshuka" },
  { key: "mahshi", ar: "محشي", en: "Mahshi" },
];
