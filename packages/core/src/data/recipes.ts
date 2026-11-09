import type { Meal } from "../lifestyle";

export type RecipeTag = "High protein" | "Vegetarian" | "Vegan" | "Gluten free" | "Dairy free" | "Under 15 min" | "Batch cook";

export interface Recipe {
  id: string;
  name: string;
  meal: Meal;
  minutes: number;
  tags: RecipeTag[];
  /** One serving, from the APEX food list: food id and portions of it. */
  ingredients: { foodId: number; factor: number }[];
  steps: string[];
}

/**
 * Original APEX recipes, one serving each. Macros come from the food list, so they always match what gets logged.
 * Written for APEX: simple, high-protein, UK supermarket ingredients.
 */
export const RECIPES: Recipe[] = [
  {
    id: "r-protein-oats", name: "Protein berry oats", meal: "breakfast", minutes: 8, tags: ["High protein", "Vegetarian", "Under 15 min"],
    ingredients: [{ foodId: 44, factor: 1 }, { foodId: 33, factor: 1 }, { foodId: 26, factor: 1 }, { foodId: 71, factor: 1 }],
    steps: ["Simmer the oats in the milk for 4 to 5 minutes, stirring.", "Take off the heat and stir in the whey with a splash of water until smooth.", "Top with the blueberries."],
  },
  {
    id: "r-skyr-bowl", name: "Skyr crunch bowl", meal: "breakfast", minutes: 3, tags: ["High protein", "Vegetarian", "Under 15 min"],
    ingredients: [{ foodId: 31, factor: 1.33 }, { foodId: 45, factor: 0.67 }, { foodId: 72, factor: 1 }, { foodId: 102, factor: 1 }],
    steps: ["Spoon the skyr into a bowl.", "Top with granola, sliced strawberries and chia seeds."],
  },
  {
    id: "r-eggs-sourdough", name: "Spinach eggs on sourdough", meal: "breakfast", minutes: 10, tags: ["High protein", "Vegetarian", "Under 15 min"],
    ingredients: [{ foodId: 17, factor: 3 }, { foodId: 82, factor: 1 }, { foodId: 49, factor: 1 }, { foodId: 88, factor: 1 }],
    steps: ["Wilt the spinach in a non-stick pan for a minute.", "Add the beaten eggs and stir gently over a low heat until just set.", "Serve on toasted sourdough with sliced tomatoes."],
  },
  {
    id: "r-tofu-scramble", name: "Smoky tofu scramble wrap", meal: "breakfast", minutes: 12, tags: ["High protein", "Vegan", "Dairy free", "Under 15 min"],
    ingredients: [{ foodId: 19, factor: 1.5 }, { foodId: 87, factor: 1 }, { foodId: 82, factor: 0.5 }, { foodId: 51, factor: 1 }],
    steps: ["Crumble the tofu into a hot pan with the diced peppers and a pinch of smoked paprika.", "Cook for 5 minutes, then stir in the spinach.", "Fold into a warm wrap."],
  },
  {
    id: "r-chicken-grain-bowl", name: "Lemon chicken grain bowl", meal: "lunch", minutes: 15, tags: ["High protein", "Dairy free", "Under 15 min"],
    ingredients: [{ foodId: 1, factor: 1.5 }, { foodId: 61, factor: 1 }, { foodId: 89, factor: 1 }, { foodId: 88, factor: 1 }, { foodId: 104, factor: 0.6 }],
    steps: ["Slice the cooked chicken and squeeze over half a lemon.", "Add to a bowl with the quinoa, cucumber and tomatoes.", "Finish with a spoon of hummus."],
  },
  {
    id: "r-tuna-pasta", name: "Tuna sweetcorn pasta salad", meal: "lunch", minutes: 12, tags: ["High protein", "Dairy free", "Batch cook"],
    ingredients: [{ foodId: 12, factor: 1 }, { foodId: 58, factor: 1 }, { foodId: 92, factor: 1 }, { foodId: 87, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Cook the pasta, rinse in cold water and drain.", "Mix with the tuna, sweetcorn, diced peppers and olive oil.", "Keeps for 3 days in the fridge."],
  },
  {
    id: "r-chickpea-salad", name: "Chickpea feta salad", meal: "lunch", minutes: 8, tags: ["Vegetarian", "Gluten free", "Under 15 min"],
    ingredients: [{ foodId: 23, factor: 1 }, { foodId: 40, factor: 1 }, { foodId: 89, factor: 1 }, { foodId: 88, factor: 1 }, { foodId: 83, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Rinse the chickpeas.", "Toss with the salad leaves, cucumber and tomatoes.", "Crumble over the feta and dress with olive oil and lemon."],
  },
  {
    id: "r-salmon-traybake", name: "Salmon and sweet potato traybake", meal: "dinner", minutes: 30, tags: ["High protein", "Gluten free", "Dairy free"],
    ingredients: [{ foodId: 11, factor: 1 }, { foodId: 63, factor: 1 }, { foodId: 81, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Cube the sweet potato, toss in the oil and roast at 200 °C for 15 minutes.", "Add the salmon and broccoli to the tray.", "Roast for 12 to 15 minutes more, until the salmon flakes."],
  },
  {
    id: "r-turkey-chilli", name: "Turkey and bean chilli", meal: "dinner", minutes: 35, tags: ["High protein", "Gluten free", "Dairy free", "Batch cook"],
    ingredients: [{ foodId: 3, factor: 1.5 }, { foodId: 24, factor: 1 }, { foodId: 91, factor: 0.5 }, { foodId: 87, factor: 1 }, { foodId: 88, factor: 2 }, { foodId: 55, factor: 1 }],
    steps: ["Brown the turkey mince with the onion and peppers.", "Add the chopped tomatoes, black beans, chilli and cumin, and simmer for 20 minutes.", "Serve with brown rice. Freezes well."],
  },
  {
    id: "r-beef-stirfry", name: "Ginger beef stir-fry", meal: "dinner", minutes: 15, tags: ["High protein", "Dairy free", "Under 15 min"],
    ingredients: [{ foodId: 6, factor: 0.8 }, { foodId: 95, factor: 1 }, { foodId: 59, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Slice the steak thinly.", "Stir-fry in the oil over a high heat for 2 minutes with grated ginger and garlic.", "Add the veg for 3 minutes, then the noodles and a splash of soy sauce."],
  },
  {
    id: "r-lentil-dahl", name: "Red lentil and spinach dahl", meal: "dinner", minutes: 25, tags: ["Vegan", "Gluten free", "Dairy free", "Batch cook"],
    ingredients: [{ foodId: 22, factor: 1.5 }, { foodId: 82, factor: 1 }, { foodId: 91, factor: 0.5 }, { foodId: 54, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Soften the onion in the oil with garlic, turmeric and cumin.", "Add the lentils and a little water, and simmer for 10 minutes.", "Stir in the spinach until wilted. Serve with rice."],
  },
  {
    id: "r-prawn-pasta", name: "Garlic prawn pasta", meal: "dinner", minutes: 15, tags: ["High protein", "Under 15 min"],
    ingredients: [{ foodId: 14, factor: 1.5 }, { foodId: 57, factor: 1 }, { foodId: 88, factor: 1 }, { foodId: 82, factor: 0.5 }, { foodId: 41, factor: 1 }],
    steps: ["Cook the pasta.", "Warm the prawns with garlic, cherry tomatoes and spinach in a pan.", "Toss through the pasta and finish with Parmesan."],
  },
  {
    id: "r-pb-shake", name: "Peanut butter banana shake", meal: "snack", minutes: 3, tags: ["High protein", "Vegetarian", "Under 15 min"],
    ingredients: [{ foodId: 26, factor: 1 }, { foodId: 67, factor: 1 }, { foodId: 97, factor: 1 }, { foodId: 33, factor: 1 }],
    steps: ["Blend everything with a few ice cubes until smooth."],
  },
  {
    id: "r-cottage-crackers", name: "Cottage cheese rice cakes", meal: "snack", minutes: 3, tags: ["High protein", "Vegetarian", "Gluten free", "Under 15 min"],
    ingredients: [{ foodId: 32, factor: 1 }, { foodId: 66, factor: 1 }, { foodId: 89, factor: 0.5 }],
    steps: ["Spread the cottage cheese on the rice cakes.", "Top with sliced cucumber and black pepper."],
  },
];
