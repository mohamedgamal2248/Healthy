# Food photos

Real photos from Wikimedia Commons under free licences (CC0, public domain, CC BY, CC BY-SA). Nothing here is AI-generated.

- Files: `public/food/*.webp`, cropped to 8:5 and compressed (about 25-100 KB each).
- Data and credits: `src/data/dish-photos.ts` (`DISH_PHOTOS`). Every photo is credited, with its licence and source page, on `/open-source#photos`.
- Which meal shows which photo: the rules in `photoForMeal` (by dish type in the meal id). A meal without a matching photo shows the text card.
- To add one: pick a file on Commons with an acceptable licence, crop to 8:5, save as WebP, add an entry to `DISH_PHOTOS` with author, licence and page URL, and a rule if needed.
