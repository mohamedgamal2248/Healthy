export type MealEn = { ingredients: { item: string; qty: string }[]; steps: string[] };
export const MEALS_EN_BASE: Record<string, MealEn> = {
  "foul-balady": {
    ingredients: [
      { item: "Cooked fava beans (foul medames)", qty: "3/4 cup" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Tomato", qty: "1 small" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "half a loaf" },
      { item: "Olive oil", qty: "1 tsp" },
      { item: "Cumin", qty: "a pinch" },
    ],
    steps: [
      "Warm the foul over low heat with 1/2 cup of water.",
      "Mash half of it with a fork and leave the rest as whole beans.",
      "Add the lemon juice, cumin and olive oil, and stir.",
      "Chop the tomato and place it on top of the foul.",
      "Serve with half a loaf of baladi bread.",
    ],
  },
  "veggie-omelette": {
    ingredients: [
      { item: "Eggs", qty: "2" },
      { item: "Bell pepper", qty: "a quarter" },
      { item: "Tomato", qty: "half" },
      { item: "Onion, chopped", qty: "1 tbsp" },
      { item: "Oil", qty: "1 tsp" },
      { item: "Black pepper", qty: "a pinch" },
    ],
    steps: [
      "Dice the pepper, tomato and onion into small cubes.",
      "Sauté them in the oil for 2 minutes over medium heat.",
      "Whisk the eggs with the black pepper and pour over the vegetables.",
      "Let it set, then fold in half and serve.",
    ],
  },
  "cottage-plate": {
    ingredients: [
      { item: "Cottage cheese", qty: "3/4 cup (150 g)" },
      { item: "Cucumber", qty: "1" },
      { item: "Tomato", qty: "1" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "half a loaf" },
      { item: "Mint leaves", qty: "2" },
      { item: "Olive oil", qty: "1/2 tsp" },
    ],
    steps: [
      "Wash the cucumber and tomato and slice them.",
      "Put the cottage cheese on a plate and arrange the vegetables around it.",
      "Drizzle with olive oil and sprinkle with mint.",
      "Serve with half a loaf of bread.",
    ],
  },
  "oats-milk-banana": {
    ingredients: [
      { item: "Rolled oats", qty: "40 g (4 tbsp)" },
      { item: "Milk", qty: "1 cup" },
      { item: "Banana", qty: "half" },
      { item: "Cinnamon", qty: "a pinch" },
    ],
    steps: [
      "Heat the milk until warm, without letting it boil hard.",
      "Add the oats and stir for 3 minutes until thickened.",
      "Slice the banana on top, sprinkle with cinnamon and serve warm.",
    ],
  },
  "tuna-baladi-sandwich": {
    ingredients: [
      { item: "Canned tuna (drained)", qty: "half a can" },
      { item: "Lettuce", qty: "2 leaves" },
      { item: "Cucumber", qty: "half" },
      { item: "Tomato", qty: "half" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "1 small loaf" },
      { item: "Lemon", qty: "half a lemon" },
    ],
    steps: [
      "Drain the tuna well and flake it with a fork.",
      "Mix it with the lemon juice and a little black pepper.",
      "Open the loaf and fill it with the lettuce, cucumber and tomato, then the tuna.",
    ],
  },
  "eggs-tomato": {
    ingredients: [
      { item: "Eggs", qty: "2" },
      { item: "Tomatoes", qty: "2" },
      { item: "Onion", qty: "a quarter" },
      { item: "Oil", qty: "1 tsp" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "half a loaf" },
    ],
    steps: [
      "Chop the onion and tomatoes and sauté them in the oil until the tomatoes soften.",
      "Let the sauce reduce a little, then crack the eggs over it.",
      "Cover the pan for 3 minutes until the eggs are cooked.",
      "Serve with half a loaf of bread.",
    ],
  },
  "yogurt-oats-apple": {
    ingredients: [
      { item: "Plain yogurt", qty: "1 cup (200 g)" },
      { item: "Rolled oats", qty: "3 tbsp" },
      { item: "Apple", qty: "half" },
      { item: "Cinnamon", qty: "a pinch" },
    ],
    steps: [
      "Put the yogurt in a bowl and let it sit out of the fridge for 10 minutes.",
      "Add the oats and stir.",
      "Dice the apple into small cubes and add it with the cinnamon.",
    ],
  },
  "foul-egg": {
    ingredients: [
      { item: "Cooked fava beans (foul medames)", qty: "1 cup" },
      { item: "Egg", qty: "1" },
      { item: "Tomato", qty: "half" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Olive oil", qty: "1 tsp" },
    ],
    steps: [
      "Boil the egg for 10 minutes, then cool and peel it.",
      "Warm the foul and season with lemon, cumin and olive oil.",
      "Serve the foul with the egg cut in half and the tomato slices.",
    ],
  },
  "spinach-egg-cottage": {
    ingredients: [
      { item: "Eggs", qty: "2" },
      { item: "Chopped spinach", qty: "1 cup" },
      { item: "Cottage cheese", qty: "3 tbsp" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Sauté the spinach and garlic in the oil for 2 minutes until wilted.",
      "Whisk the eggs with the cottage cheese and pour over the spinach.",
      "Cook covered over low heat for 5 minutes until set.",
      "Flip it or serve as it is.",
    ],
  },
  "baked-sweet-potato-yogurt": {
    ingredients: [
      { item: "Sweet potato, medium", qty: "1" },
      { item: "Plain yogurt", qty: "1/2 cup" },
      { item: "Cinnamon", qty: "a pinch" },
    ],
    steps: [
      "Wash the sweet potato and prick it with a fork.",
      "Bake at 200 degrees C for 30 minutes until soft.",
      "Split it open and top with the yogurt and cinnamon.",
    ],
  },
  "lentil-soup-salad": {
    ingredients: [
      { item: "Yellow lentils", qty: "1/2 cup" },
      { item: "Carrot", qty: "1" },
      { item: "Onion", qty: "half" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Cumin", qty: "1/2 tsp" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Cucumber", qty: "1" },
      { item: "Tomato", qty: "1" },
    ],
    steps: [
      "Rinse the lentils and put them in a pot with the onion, carrot and garlic in 3 cups of water.",
      "Bring to a boil, then simmer for 20-25 minutes until the lentils break down.",
      "Blend with an immersion blender, or leave it chunky if you prefer.",
      "Add the cumin, a little salt and the lemon juice.",
      "Serve with a cucumber and tomato salad.",
    ],
  },
  "grilled-chicken-rice": {
    ingredients: [
      { item: "Chicken breast", qty: "150 g" },
      { item: "Cooked rice", qty: "1 cup" },
      { item: "Cucumber", qty: "1" },
      { item: "Tomato", qty: "1" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Marinate the chicken in crushed garlic, lemon and black pepper for 20 minutes.",
      "Roast it in the oven or cook in a non-stick pan for 6 minutes per side.",
      "Boil the rice until cooked.",
      "Dice the cucumber and tomato into a salad with lemon and serve everything together.",
    ],
  },
  "megadara": {
    ingredients: [
      { item: "Brown lentils", qty: "1/2 cup" },
      { item: "Rice", qty: "1/4 cup" },
      { item: "Onion, large", qty: "1" },
      { item: "Oil", qty: "1 tbsp" },
      { item: "Cumin", qty: "1/2 tsp" },
      { item: "Tomato and cucumber for the salad", qty: "1 of each" },
    ],
    steps: [
      "Boil the lentils for 15 minutes, then add the rice and 1 cup of water.",
      "Simmer on low heat for 15 minutes until the water is absorbed.",
      "Fry the sliced onion in the oil until golden.",
      "Stir half the onion into the megadara, top with the rest and serve with the salad.",
    ],
  },
  "baked-tilapia-veg": {
    ingredients: [
      { item: "Tilapia, cleaned", qty: "200 g" },
      { item: "Zucchini", qty: "1" },
      { item: "Tomato", qty: "1" },
      { item: "Onion", qty: "half" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Cumin", qty: "a pinch" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Marinate the fish in garlic, lemon and cumin for 20 minutes.",
      "Arrange the zucchini, tomato and onion slices in a baking tray.",
      "Place the fish on top and drizzle with the oil.",
      "Bake at 200 degrees C for 25 minutes.",
    ],
  },
  "chickpea-tuna-salad": {
    ingredients: [
      { item: "Boiled chickpeas", qty: "3/4 cup" },
      { item: "Tuna (drained)", qty: "half a can" },
      { item: "Tomato", qty: "1" },
      { item: "Cucumber", qty: "1" },
      { item: "Lemon", qty: "1" },
      { item: "Tahini", qty: "1 tbsp" },
    ],
    steps: [
      "Dice the tomato and cucumber.",
      "Combine the chickpeas and tuna with them.",
      "Whisk the tahini with the lemon juice and a little water until it forms a sauce.",
      "Pour the sauce over the salad and toss.",
    ],
  },
  "okra-tomato-rice": {
    ingredients: [
      { item: "Okra", qty: "200 g" },
      { item: "Crushed tomato", qty: "1/2 cup" },
      { item: "Onion", qty: "half" },
      { item: "Garlic", qty: "2 cloves" },
      { item: "Cooked rice", qty: "3/4 cup" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Sauté the onion and garlic in the oil until softened.",
      "Add the tomato and cook for 5 minutes.",
      "Add the okra and 1/4 cup of water, cover and simmer on low heat for 25 minutes.",
      "Serve over the rice.",
    ],
  },
  "molokhia-chicken": {
    ingredients: [
      { item: "Skinless chicken thigh or breast", qty: "150 g" },
      { item: "Chopped molokhia (jute leaves)", qty: "1 cup" },
      { item: "Garlic", qty: "3 cloves" },
      { item: "Dried coriander", qty: "1 tsp" },
      { item: "Rice", qty: "1/2 cup" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Boil the chicken with an onion and a bay leaf, then strain the broth.",
      "Bring the broth to a boil and add the molokhia.",
      "Fry the garlic and coriander in the oil until golden and stir them into the molokhia.",
      "Serve with the lightly grilled chicken and the rice.",
    ],
  },
  "zucchini-cottage-tagine": {
    ingredients: [
      { item: "Zucchini", qty: "2" },
      { item: "Cottage cheese", qty: "1/2 cup" },
      { item: "Tomato", qty: "1" },
      { item: "Onion", qty: "a quarter" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Slice the zucchini into rounds and brown them lightly in the oil.",
      "Layer them in a baking dish with the tomato slices, onion and garlic.",
      "Cover with the cottage cheese and bake at 200 degrees C for 18 minutes.",
    ],
  },
  "white-bean-stew": {
    ingredients: [
      { item: "Boiled white beans", qty: "1 cup" },
      { item: "Crushed tomato", qty: "1/2 cup" },
      { item: "Onion", qty: "half" },
      { item: "Garlic", qty: "2 cloves" },
      { item: "Oil", qty: "1 tsp" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "half a loaf" },
    ],
    steps: [
      "Sauté the onion and garlic in the oil.",
      "Add the crushed tomato and cook for 5 minutes.",
      "Add the beans, 1/2 cup of water and a little salt.",
      "Simmer on low heat for 20 minutes and serve with the bread.",
    ],
  },
  "chicken-potato-tray": {
    ingredients: [
      { item: "Chicken breast or thigh", qty: "150 g" },
      { item: "Potato, large", qty: "1" },
      { item: "Carrot", qty: "1" },
      { item: "Onion", qty: "half" },
      { item: "Garlic", qty: "2 cloves" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Cut the potato, carrot and onion into medium pieces.",
      "Toss them with the chicken, garlic, oil and spices.",
      "Roast at 200 degrees C for 35-40 minutes, turning once.",
    ],
  },
  "shakshuka": {
    ingredients: [
      { item: "Eggs", qty: "2" },
      { item: "Tomatoes", qty: "3" },
      { item: "Bell pepper", qty: "half" },
      { item: "Onion", qty: "a quarter" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Sauté the onion, pepper and garlic in the oil.",
      "Add the chopped tomatoes and cook until they turn into a sauce.",
      "Make two wells in the sauce and crack the eggs into them.",
      "Cover for 4 minutes until the eggs are cooked.",
    ],
  },
  "tuna-corn-salad": {
    ingredients: [
      { item: "Tuna (drained)", qty: "half a can" },
      { item: "Boiled corn", qty: "3 tbsp" },
      { item: "Lettuce", qty: "3 leaves" },
      { item: "Cucumber", qty: "1" },
      { item: "Tomato", qty: "1" },
      { item: "Lemon", qty: "half a lemon" },
    ],
    steps: [
      "Chop the lettuce, cucumber and tomato.",
      "Add the corn and the drained tuna.",
      "Dress with lemon, olive oil and black pepper.",
    ],
  },
  "chicken-rocket-salad": {
    ingredients: [
      { item: "Chicken breast", qty: "150 g" },
      { item: "Rocket (arugula)", qty: "2 cups" },
      { item: "Tomato", qty: "1" },
      { item: "Cucumber", qty: "half" },
      { item: "Lemon", qty: "1" },
      { item: "Olive oil", qty: "1 tsp" },
    ],
    steps: [
      "Season the chicken with lemon, black pepper and garlic.",
      "Cook it in a non-stick pan for 6 minutes per side.",
      "Slice it and place on the rocket and vegetables.",
      "Drizzle with lemon juice and olive oil.",
    ],
  },
  "lentil-kofta-baked": {
    ingredients: [
      { item: "Boiled lentils", qty: "1 cup" },
      { item: "Grated carrot", qty: "half" },
      { item: "Grated onion", qty: "half" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Rolled oats", qty: "2 tbsp" },
      { item: "Cumin and coriander", qty: "1/2 tsp" },
    ],
    steps: [
      "Partly mash the boiled lentils.",
      "Mix in the carrot, onion, garlic, oats and spices.",
      "Shape into patties and place on a tray brushed with a little oil.",
      "Bake at 200 degrees C for 20 minutes, flipping once.",
    ],
  },
  "baba-ganoush-yogurt": {
    ingredients: [
      { item: "Eggplant, large", qty: "1" },
      { item: "Plain yogurt", qty: "1/2 cup" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Lemon", qty: "half a lemon" },
      { item: "Baladi bread (Egyptian flatbread)", qty: "a quarter of a loaf" },
    ],
    steps: [
      "Roast the whole eggplant over a flame or in the oven until soft.",
      "Peel it and mash with a fork.",
      "Mix the yogurt with crushed garlic, lemon and a little salt.",
      "Serve the eggplant with the yogurt sauce.",
    ],
  },
  "chicken-veg-soup": {
    ingredients: [
      { item: "Chicken breast", qty: "100 g" },
      { item: "Carrot", qty: "1" },
      { item: "Zucchini", qty: "1" },
      { item: "Onion", qty: "half" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Lemon", qty: "half a lemon" },
    ],
    steps: [
      "Boil the chicken breast with the onion in 3 cups of water for 20 minutes.",
      "Remove the chicken and shred it.",
      "Add the carrot and zucchini to the broth and cook for 10 minutes.",
      "Return the chicken and add the garlic, black pepper and lemon.",
    ],
  },
  "lemon-grilled-fish-rocket": {
    ingredients: [
      { item: "Fish fillet or tilapia", qty: "200 g" },
      { item: "Lemon", qty: "1" },
      { item: "Garlic", qty: "2 cloves" },
      { item: "Rocket (arugula)", qty: "1 cup" },
      { item: "Tomato", qty: "1" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Marinate the fish in lemon juice, garlic and pepper for 15 minutes.",
      "Grill it for 5-6 minutes per side.",
      "Serve over the rocket and tomato with lemon slices.",
    ],
  },
  "boiled-eggs-yogurt-cucumber": {
    ingredients: [
      { item: "Eggs", qty: "2" },
      { item: "Plain yogurt", qty: "1 cup" },
      { item: "Cucumber", qty: "1" },
      { item: "Mint leaves", qty: "a few" },
      { item: "Garlic", qty: "half a clove" },
    ],
    steps: [
      "Boil the eggs for 10 minutes, then cool and peel them.",
      "Dice the cucumber and stir it into the yogurt with the garlic and mint.",
      "Serve the eggs alongside the salad.",
    ],
  },
  "hummus-veg-sticks": {
    ingredients: [
      { item: "Boiled chickpeas", qty: "1 cup" },
      { item: "Tahini", qty: "1 tbsp" },
      { item: "Lemon", qty: "1" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Carrot", qty: "1" },
      { item: "Cucumber", qty: "1" },
    ],
    steps: [
      "Mash the chickpeas, or blend them with the tahini, lemon and garlic.",
      "Add a little cold water until smooth.",
      "Cut the carrot and cucumber into sticks and serve with the hummus.",
    ],
  },
  "chicken-veg-saute": {
    ingredients: [
      { item: "Chicken breast, cubed", qty: "150 g" },
      { item: "Zucchini", qty: "1" },
      { item: "Carrot", qty: "half" },
      { item: "Bell pepper", qty: "half" },
      { item: "Garlic", qty: "1 clove" },
      { item: "Oil", qty: "1 tsp" },
    ],
    steps: [
      "Brown the chicken in the oil for 5 minutes until it changes color.",
      "Add the garlic and carrot and stir for 3 minutes.",
      "Add the zucchini and pepper and cook for 5 minutes, stirring.",
      "Season with black pepper and cumin and serve hot.",
    ],
  },
};
