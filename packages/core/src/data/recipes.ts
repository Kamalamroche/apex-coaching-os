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
  /** Coach recipes only: a small photo the coach added (data URL or https link). Built-in recipes use recipePhoto(). */
  photo?: string;
  /** True for a recipe a coach wrote, false or missing for the APEX library. */
  byCoach?: boolean;
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
  {
    id: "r-ham-omelette", name: "Ham and mushroom omelette", meal: "breakfast", minutes: 10, tags: ["High protein",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 17, factor: 3 }, { foodId: 9, factor: 1 }, { foodId: 90, factor: 1 }, { foodId: 38, factor: 0.5 }],
    steps: ["Fry the sliced mushrooms in a non-stick pan for 3 minutes.", "Pour in the beaten eggs, scatter over the torn ham and grated cheddar.", "Cook until just set, then fold in half."],
  },
  {
    id: "r-raspberry-overnight-oats", name: "Raspberry overnight oats", meal: "breakfast", minutes: 5, tags: ["High protein",  "Vegan",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 44, factor: 1 }, { foodId: 37, factor: 1 }, { foodId: 27, factor: 1 }, { foodId: 73, factor: 1 }, { foodId: 102, factor: 0.5 }],
    steps: ["Stir the oats, soya drink, protein powder and chia together in a jar.", "Top with the raspberries, cover and chill overnight.", "Eat cold, or warm for a minute in the microwave."],
  },
  {
    id: "r-banana-pancakes", name: "Banana protein pancakes", meal: "breakfast", minutes: 15, tags: ["High protein",  "Vegetarian"],
    ingredients: [{ foodId: 67, factor: 1 }, { foodId: 17, factor: 2 }, { foodId: 44, factor: 0.6 }, { foodId: 26, factor: 0.5 }, { foodId: 71, factor: 1 }],
    steps: ["Blend the banana, eggs, oats and whey into a thick batter.", "Cook small pancakes in a non-stick pan, about 1 minute each side.", "Stack and top with the blueberries."],
  },
  {
    id: "r-breakfast-burrito", name: "Black bean breakfast burrito", meal: "breakfast", minutes: 12, tags: ["High protein",  "Vegetarian"],
    ingredients: [{ foodId: 51, factor: 1 }, { foodId: 17, factor: 2 }, { foodId: 18, factor: 1 }, { foodId: 24, factor: 0.5 }, { foodId: 87, factor: 1 }, { foodId: 38, factor: 0.5 }],
    steps: ["Soften the diced peppers in a pan, then add the black beans to warm through.", "Scramble the eggs and egg whites in the same pan.", "Fill the warm wrap, add the cheddar and roll up tightly."],
  },
  {
    id: "r-beans-egg-toast", name: "Beans on toast with a poached egg", meal: "breakfast", minutes: 10, tags: ["High protein",  "Vegetarian",  "Under 15 min"],
    ingredients: [{ foodId: 47, factor: 2 }, { foodId: 25, factor: 1 }, { foodId: 17, factor: 1 }],
    steps: ["Warm the beans in a small pan.", "Poach the egg in barely simmering water for 3 minutes.", "Pile the beans on the toast and top with the egg."],
  },
  {
    id: "r-mango-yogurt-pot", name: "Mango and raspberry yogurt pot", meal: "breakfast", minutes: 4, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 29, factor: 1.33 }, { foodId: 75, factor: 1 }, { foodId: 73, factor: 1 }, { foodId: 98, factor: 0.5 }],
    steps: ["Spoon half the yogurt into a glass and add half the fruit.", "Repeat the layers.", "Finish with the chopped almonds."],
  },
  {
    id: "r-pb-crumpets", name: "Peanut butter crumpets with skyr", meal: "breakfast", minutes: 6, tags: ["High protein",  "Vegetarian",  "Under 15 min"],
    ingredients: [{ foodId: 53, factor: 2 }, { foodId: 97, factor: 1 }, { foodId: 67, factor: 0.5 }, { foodId: 31, factor: 1 }],
    steps: ["Toast the crumpets.", "Spread with peanut butter and top with sliced banana.", "Serve with the skyr on the side."],
  },
  {
    id: "r-sweet-potato-hash", name: "Sweet potato hash with eggs", meal: "breakfast", minutes: 20, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 63, factor: 0.75 }, { foodId: 87, factor: 1 }, { foodId: 91, factor: 0.5 }, { foodId: 82, factor: 0.5 }, { foodId: 17, factor: 2 }, { foodId: 96, factor: 0.5 }],
    steps: ["Dice the sweet potato and fry in the oil for 10 minutes until golden.", "Add the onion and peppers for 4 minutes, then stir in the spinach.", "Make two wells, crack in the eggs, cover and cook until set."],
  },
  {
    id: "r-mackerel-sourdough", name: "Smoked mackerel on sourdough", meal: "breakfast", minutes: 5, tags: ["High protein",  "Under 15 min"],
    ingredients: [{ foodId: 49, factor: 1 }, { foodId: 15, factor: 0.6 }, { foodId: 43, factor: 1 }, { foodId: 89, factor: 0.5 }],
    steps: ["Toast the sourdough and spread with the cream cheese.", "Flake the mackerel on top.", "Add sliced cucumber and black pepper."],
  },
  {
    id: "r-vegan-smoothie-bowl", name: "Berry protein smoothie bowl", meal: "breakfast", minutes: 5, tags: ["High protein",  "Vegan",  "Dairy free",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 27, factor: 1 }, { foodId: 67, factor: 1 }, { foodId: 73, factor: 1 }, { foodId: 71, factor: 1 }, { foodId: 37, factor: 0.5 }, { foodId: 102, factor: 1 }],
    steps: ["Blend the protein powder, banana, raspberries and soya drink until thick.", "Pour into a bowl.", "Top with the blueberries and chia seeds."],
  },
  {
    id: "r-cottage-avo-toast", name: "Cottage cheese and avocado toast", meal: "breakfast", minutes: 6, tags: ["High protein",  "Vegetarian",  "Under 15 min"],
    ingredients: [{ foodId: 47, factor: 2 }, { foodId: 32, factor: 1.5 }, { foodId: 80, factor: 0.5 }, { foodId: 88, factor: 1 }],
    steps: ["Toast the bread.", "Spread with smashed avocado and spoon over the cottage cheese.", "Top with sliced tomatoes and black pepper."],
  },
  {
    id: "r-chicken-caesar-wrap", name: "Chicken caesar wrap", meal: "lunch", minutes: 8, tags: ["High protein",  "Under 15 min"],
    ingredients: [{ foodId: 51, factor: 1 }, { foodId: 1, factor: 1 }, { foodId: 83, factor: 1 }, { foodId: 41, factor: 1 }, { foodId: 29, factor: 0.33 }],
    steps: ["Mix the yogurt with lemon juice, a little garlic and half the parmesan.", "Toss the leaves and sliced chicken in the dressing.", "Fill the wrap, add the rest of the parmesan and roll up."],
  },
  {
    id: "r-turkey-pitta", name: "Turkey kofta pittas", meal: "lunch", minutes: 15, tags: ["High protein"],
    ingredients: [{ foodId: 52, factor: 1 }, { foodId: 3, factor: 1 }, { foodId: 89, factor: 0.5 }, { foodId: 88, factor: 1 }, { foodId: 29, factor: 0.33 }],
    steps: ["Season the turkey mince with cumin and mint, shape into small koftas and fry for 8 minutes.", "Warm the pitta and split it open.", "Fill with the koftas, cucumber, tomatoes and yogurt."],
  },
  {
    id: "r-salmon-quinoa-salad", name: "Salmon quinoa salad", meal: "lunch", minutes: 15, tags: ["High protein",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 11, factor: 1 }, { foodId: 61, factor: 1 }, { foodId: 83, factor: 1 }, { foodId: 89, factor: 1 }],
    steps: ["Bake the salmon at 200°C for 12 minutes.", "Toss the quinoa with the leaves, cucumber and a squeeze of lemon.", "Flake the salmon over the top."],
  },
  {
    id: "r-prawn-fried-rice", name: "Prawn egg fried rice", meal: "lunch", minutes: 12, tags: ["High protein",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 54, factor: 1 }, { foodId: 14, factor: 1 }, { foodId: 17, factor: 1 }, { foodId: 85, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Heat the oil in a wok and scramble the egg, then push it to one side.", "Add the rice and peas and stir-fry for 4 minutes.", "Add the prawns and a splash of soy sauce and toss until hot."],
  },
  {
    id: "r-hummus-veg-wrap", name: "Hummus and roast pepper wrap", meal: "lunch", minutes: 8, tags: ["Vegan",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 51, factor: 1 }, { foodId: 104, factor: 1 }, { foodId: 23, factor: 0.5 }, { foodId: 87, factor: 1 }, { foodId: 82, factor: 0.5 }],
    steps: ["Spread the hummus over the wrap.", "Add the chickpeas, sliced peppers and spinach.", "Roll up and cut in half."],
  },
  {
    id: "r-jacket-tuna", name: "Jacket potato with tuna and sweetcorn", meal: "lunch", minutes: 10, tags: ["High protein",  "Gluten free"],
    ingredients: [{ foodId: 64, factor: 1 }, { foodId: 12, factor: 1 }, { foodId: 92, factor: 0.5 }, { foodId: 29, factor: 0.33 }, { foodId: 83, factor: 1 }],
    steps: ["Microwave the potato for 7 to 8 minutes until soft.", "Mix the tuna, sweetcorn and yogurt with black pepper.", "Split the potato, fill it and serve with the leaves."],
  },
  {
    id: "r-tempeh-rice-bowl", name: "Sticky tempeh rice bowl", meal: "lunch", minutes: 20, tags: ["High protein",  "Vegan",  "Dairy free"],
    ingredients: [{ foodId: 20, factor: 1 }, { foodId: 55, factor: 1 }, { foodId: 81, factor: 1 }, { foodId: 84, factor: 1 }],
    steps: ["Slice the tempeh and fry until golden, then glaze with soy sauce and a little maple syrup.", "Steam the broccoli and grate the carrot.", "Serve everything over the rice."],
  },
  {
    id: "r-peanut-noodle-salad", name: "Peanut chicken noodle salad", meal: "lunch", minutes: 15, tags: ["High protein",  "Dairy free"],
    ingredients: [{ foodId: 1, factor: 1 }, { foodId: 59, factor: 1 }, { foodId: 89, factor: 1 }, { foodId: 84, factor: 1 }, { foodId: 97, factor: 1 }],
    steps: ["Whisk the peanut butter with lime juice, soy sauce and a little hot water.", "Toss the noodles with the cucumber and carrot ribbons.", "Add the sliced chicken and the dressing."],
  },
  {
    id: "r-bean-quesadilla", name: "Black bean quesadilla", meal: "lunch", minutes: 12, tags: ["Vegetarian"],
    ingredients: [{ foodId: 51, factor: 1 }, { foodId: 24, factor: 1 }, { foodId: 38, factor: 1 }, { foodId: 92, factor: 0.5 }, { foodId: 87, factor: 1 }],
    steps: ["Roughly mash the beans with a pinch of cumin.", "Spread over half the wrap, add sweetcorn, peppers and cheddar, then fold.", "Toast in a dry pan for 3 minutes each side and cut into wedges."],
  },
  {
    id: "r-med-couscous", name: "Mediterranean chickpea couscous", meal: "lunch", minutes: 15, tags: ["Vegetarian",  "Batch cook"],
    ingredients: [{ foodId: 60, factor: 1 }, { foodId: 23, factor: 1 }, { foodId: 93, factor: 1 }, { foodId: 87, factor: 1 }, { foodId: 88, factor: 1 }, { foodId: 40, factor: 1 }],
    steps: ["Pour boiling water over the couscous, cover and leave for 5 minutes.", "Griddle the courgette and peppers.", "Fork through the couscous with the veg, chickpeas and tomatoes, then crumble over the feta."],
  },
  {
    id: "r-lentil-carrot-soup", name: "Spiced lentil and carrot soup", meal: "lunch", minutes: 30, tags: ["Vegan",  "Dairy free",  "Batch cook"],
    ingredients: [{ foodId: 22, factor: 1 }, { foodId: 84, factor: 2 }, { foodId: 91, factor: 0.5 }, { foodId: 47, factor: 1 }],
    steps: ["Soften the onion in a pan, add the carrots and a teaspoon of cumin.", "Add the lentils and 400 ml of stock and simmer for 20 minutes.", "Blend until smooth and serve with the bread."],
  },
  {
    id: "r-sardines-toast", name: "Sardines on toast with salad", meal: "lunch", minutes: 8, tags: ["High protein",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 16, factor: 1 }, { foodId: 49, factor: 1 }, { foodId: 83, factor: 1 }, { foodId: 88, factor: 1 }],
    steps: ["Toast the sourdough.", "Warm the sardines in their sauce and spoon on top.", "Serve with the leaves and tomatoes."],
  },
  {
    id: "r-chicken-fajitas", name: "Chicken fajitas", meal: "dinner", minutes: 20, tags: ["High protein",  "Dairy free"],
    ingredients: [{ foodId: 1, factor: 1.5 }, { foodId: 51, factor: 2 }, { foodId: 87, factor: 2 }, { foodId: 91, factor: 0.5 }],
    steps: ["Slice the chicken, peppers and onion and toss with fajita spices.", "Cook in a hot pan for 10 to 12 minutes until charred and cooked through.", "Fill the warm wraps."],
  },
  {
    id: "r-cod-crushed-potatoes", name: "Baked cod with crushed potatoes and peas", meal: "dinner", minutes: 25, tags: ["High protein",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 13, factor: 1 }, { foodId: 62, factor: 1 }, { foodId: 85, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Bake the cod at 200°C for 12 to 15 minutes.", "Boil the potatoes until tender, add the peas for the last 3 minutes.", "Drain, crush roughly with the oil and lemon, and serve with the cod."],
  },
  {
    id: "r-steak-sweet-potato", name: "Steak with sweet potato wedges", meal: "dinner", minutes: 30, tags: ["High protein",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 6, factor: 1 }, { foodId: 63, factor: 1 }, { foodId: 86, factor: 1 }],
    steps: ["Roast the sweet potato wedges at 200°C for 25 minutes.", "Sear the steak in a very hot pan, 3 minutes each side for medium, and rest for 5.", "Steam the green beans and serve."],
  },
  {
    id: "r-pork-traybake", name: "Pork loin and root veg traybake", meal: "dinner", minutes: 35, tags: ["High protein",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 7, factor: 1.5 }, { foodId: 62, factor: 1 }, { foodId: 84, factor: 1 }, { foodId: 81, factor: 1 }, { foodId: 96, factor: 0.5 }],
    steps: ["Toss the potatoes and carrots in the oil and roast at 200°C for 15 minutes.", "Add the pork and broccoli and roast for 15 to 20 minutes more.", "Rest the pork for a few minutes before slicing."],
  },
  {
    id: "r-quorn-bolognese", name: "Quorn bolognese", meal: "dinner", minutes: 25, tags: ["High protein",  "Vegetarian",  "Batch cook"],
    ingredients: [{ foodId: 21, factor: 1.5 }, { foodId: 58, factor: 1 }, { foodId: 88, factor: 2 }, { foodId: 91, factor: 0.5 }, { foodId: 41, factor: 1 }],
    steps: ["Soften the onion, then add the Quorn and cook for 5 minutes.", "Add the chopped tomatoes and simmer for 15 minutes.", "Serve over the pasta with the parmesan."],
  },
  {
    id: "r-tofu-chickpea-curry", name: "Tofu and chickpea curry", meal: "dinner", minutes: 25, tags: ["High protein",  "Vegan",  "Dairy free",  "Gluten free"],
    ingredients: [{ foodId: 19, factor: 1 }, { foodId: 23, factor: 0.5 }, { foodId: 82, factor: 1 }, { foodId: 91, factor: 0.5 }, { foodId: 56, factor: 1 }],
    steps: ["Fry the cubed tofu until golden and set aside.", "Soften the onion with curry paste, add the chickpeas and a splash of water and simmer for 10 minutes.", "Stir in the tofu and spinach and serve with the rice."],
  },
  {
    id: "r-paprika-chicken-thighs", name: "Paprika chicken thighs with rice and greens", meal: "dinner", minutes: 30, tags: ["High protein",  "Gluten free",  "Dairy free"],
    ingredients: [{ foodId: 2, factor: 1.5 }, { foodId: 55, factor: 1 }, { foodId: 81, factor: 1 }, { foodId: 86, factor: 1 }],
    steps: ["Rub the chicken with smoked paprika and garlic and roast at 200°C for 25 minutes.", "Steam the broccoli and green beans.", "Serve with the rice."],
  },
  {
    id: "r-burger-bowl", name: "Burger bowl with potato wedges", meal: "dinner", minutes: 30, tags: ["High protein",  "Gluten free"],
    ingredients: [{ foodId: 4, factor: 1.25 }, { foodId: 62, factor: 1 }, { foodId: 83, factor: 1 }, { foodId: 88, factor: 1 }, { foodId: 38, factor: 0.5 }],
    steps: ["Roast the potato wedges at 200°C for 25 minutes.", "Shape the mince into a patty and grill for 4 minutes each side.", "Slice over the leaves and tomatoes with the cheddar and wedges."],
  },
  {
    id: "r-black-bean-chilli", name: "Black bean and sweet potato chilli", meal: "dinner", minutes: 35, tags: ["Vegan",  "Dairy free",  "Gluten free",  "Batch cook"],
    ingredients: [{ foodId: 24, factor: 1.5 }, { foodId: 63, factor: 0.5 }, { foodId: 87, factor: 1 }, { foodId: 91, factor: 0.5 }, { foodId: 55, factor: 0.75 }],
    steps: ["Soften the onion and peppers, add the diced sweet potato and chilli spices.", "Add the beans and a tin of tomatoes and simmer for 25 minutes.", "Serve over the rice."],
  },
  {
    id: "r-lamb-couscous", name: "Spiced lamb with herby couscous", meal: "dinner", minutes: 30, tags: ["High protein"],
    ingredients: [{ foodId: 8, factor: 1.25 }, { foodId: 60, factor: 1 }, { foodId: 93, factor: 1 }, { foodId: 87, factor: 1 }, { foodId: 29, factor: 0.33 }],
    steps: ["Rub the lamb with cumin and coriander and roast or grill to your liking.", "Griddle the courgette and peppers.", "Serve on the couscous with a spoon of yogurt and fresh mint."],
  },
  {
    id: "r-apple-pb", name: "Apple slices with peanut butter", meal: "snack", minutes: 2, tags: ["Vegan",  "Dairy free",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 68, factor: 1 }, { foodId: 97, factor: 1 }],
    steps: ["Slice the apple.", "Dip into the peanut butter."],
  },
  {
    id: "r-yogurt-berries", name: "Greek yogurt with blueberries", meal: "snack", minutes: 2, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 29, factor: 1.33 }, { foodId: 71, factor: 1 }, { foodId: 103, factor: 0.5 }],
    steps: ["Spoon the yogurt into a bowl.", "Top with blueberries and pumpkin seeds."],
  },
  {
    id: "r-protein-bites", name: "No-bake oat protein bites", meal: "snack", minutes: 15, tags: ["High protein",  "Vegetarian",  "Batch cook"],
    ingredients: [{ foodId: 44, factor: 0.5 }, { foodId: 26, factor: 0.5 }, { foodId: 97, factor: 1 }, { foodId: 78, factor: 0.67 }],
    steps: ["Blitz the dates, then mix with the oats, whey and peanut butter.", "Roll into three balls.", "Chill for 30 minutes. They keep for 5 days in the fridge."],
  },
  {
    id: "r-hummus-sticks", name: "Hummus and veg sticks", meal: "snack", minutes: 5, tags: ["Vegan",  "Dairy free",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 104, factor: 1 }, { foodId: 84, factor: 1 }, { foodId: 89, factor: 1 }, { foodId: 87, factor: 1 }],
    steps: ["Cut the carrot, cucumber and pepper into sticks.", "Serve with the hummus."],
  },
  {
    id: "r-eggs-tomatoes", name: "Boiled eggs with tomatoes", meal: "snack", minutes: 10, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 17, factor: 2 }, { foodId: 88, factor: 1 }],
    steps: ["Boil the eggs for 8 minutes, then cool in cold water.", "Peel, halve and season.", "Serve with the tomatoes."],
  },
  {
    id: "r-berry-shake", name: "Berry protein shake", meal: "snack", minutes: 3, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 26, factor: 1 }, { foodId: 34, factor: 1 }, { foodId: 73, factor: 1 }],
    steps: ["Blend everything with a few ice cubes until smooth."],
  },
  {
    id: "r-tuna-rice-cakes", name: "Tuna and cucumber rice cakes", meal: "snack", minutes: 3, tags: ["High protein",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 66, factor: 1 }, { foodId: 12, factor: 0.5 }, { foodId: 43, factor: 1 }, { foodId: 89, factor: 0.5 }],
    steps: ["Spread the cream cheese on the rice cakes.", "Top with tuna and sliced cucumber."],
  },
  {
    id: "r-trail-mix", name: "Dark chocolate trail mix", meal: "snack", minutes: 2, tags: ["Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 98, factor: 0.5 }, { foodId: 79, factor: 0.5 }, { foodId: 105, factor: 0.5 }, { foodId: 103, factor: 0.5 }],
    steps: ["Mix everything in a small pot."],
  },
  {
    id: "r-cottage-pineapple", name: "Cottage cheese with pineapple", meal: "snack", minutes: 2, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 32, factor: 1.5 }, { foodId: 76, factor: 1 }],
    steps: ["Spoon the cottage cheese into a bowl.", "Top with the pineapple."],
  },
  {
    id: "r-ham-rollups", name: "Ham and cream cheese roll-ups", meal: "snack", minutes: 3, tags: ["High protein",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 9, factor: 2 }, { foodId: 43, factor: 1 }, { foodId: 89, factor: 0.5 }],
    steps: ["Spread each ham slice with cream cheese.", "Add a cucumber stick and roll up."],
  },
  {
    id: "r-pb-banana-toast", name: "Peanut butter banana toast", meal: "snack", minutes: 4, tags: ["Vegan",  "Dairy free",  "Under 15 min"],
    ingredients: [{ foodId: 47, factor: 1 }, { foodId: 97, factor: 1 }, { foodId: 67, factor: 0.5 }],
    steps: ["Toast the bread.", "Spread with peanut butter and top with sliced banana."],
  },
  {
    id: "r-skyr-chocolate", name: "Skyr with strawberries and dark chocolate", meal: "snack", minutes: 3, tags: ["High protein",  "Vegetarian",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 31, factor: 1 }, { foodId: 72, factor: 1 }, { foodId: 105, factor: 0.5 }],
    steps: ["Spoon the skyr into a bowl.", "Add the strawberries and grate over the chocolate."],
  },
  {
    id: "r-vegan-banana-shake", name: "Banana soya protein shake", meal: "snack", minutes: 3, tags: ["High protein",  "Vegan",  "Dairy free",  "Gluten free",  "Under 15 min"],
    ingredients: [{ foodId: 27, factor: 1 }, { foodId: 37, factor: 1 }, { foodId: 67, factor: 1 }],
    steps: ["Blend everything with a few ice cubes until smooth."],
  },
];
