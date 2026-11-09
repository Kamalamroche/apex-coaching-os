/* Meal plans the coach writes, recipes, and the weekly shopping list. Pure, tested. */

import { FOODS } from "./data/foods";
import { RECIPES, type Recipe, type RecipeTag } from "./data/recipes";
import { MEALS, scalePortion, sumMacros, type FoodEntry, type Macros, type Meal } from "./lifestyle";
import type { Food } from "./types";

export { RECIPES, type Recipe, type RecipeTag };

/** One line of a plan: a food from the list, a recipe, or something the coach typed. */
export interface PlanItem {
  id: string;
  name: string;
  foodId?: number;
  recipeId?: string;
  /** Portions of the food or servings of the recipe. */
  factor: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface PlanDay {
  id: string;
  /** "Training day", "Rest day", "Day 1". */
  name: string;
  meals: Record<Meal, PlanItem[]>;
}

export interface MealPlan {
  days: PlanDay[];
  /** A line from the coach for the whole plan. */
  note: string;
  updatedAt: string;
}

export const MAX_PLAN_DAYS = 4;
export const PLAN_DAY_NAMES = ["Training day", "Rest day", "Day 3", "Day 4"];

export const emptyMeals = (): Record<Meal, PlanItem[]> => ({ breakfast: [], lunch: [], dinner: [], snack: [] });
export const newPlanDay = (n: number): PlanDay => ({ id: `day-${Date.now().toString(36)}-${n}`, name: PLAN_DAY_NAMES[n] ?? `Day ${n + 1}`, meals: emptyMeals() });

const foodById = new Map(FOODS.map((f) => [f.id, f]));
/** A recipe from the APEX library or, when given, the coach's own recipes. */
export const recipeById = (id: string, coach: Recipe[] = []): Recipe | undefined => RECIPES.find((r) => r.id === id) ?? coach.find((r) => r.id === id);

/**
 * The recipe's photo: original APEX food photography in apps/web/public/recipes (small = 480 px wide, for cards),
 * or the photo a coach added to their own recipe. Null when a coach recipe has none.
 */
export const recipePhoto = (r: Recipe, small = false): string | null => (r.byCoach ? r.photo || null : `/recipes/${r.id}${small ? "-480" : ""}.webp`);

const asMacros = (f: Food): Macros => ({ kcal: f.kcal, proteinG: f.protein, carbsG: f.carbs, fatG: f.fat });

/** One serving of a recipe, added up from its ingredients. */
export function recipeMacros(r: Recipe): Macros {
  const m = sumMacros(r.ingredients.map((i) => { const f = foodById.get(i.foodId); return f ? scalePortion(asMacros(f), i.factor) : { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }; }));
  return { kcal: Math.round(m.kcal), proteinG: Math.round(m.proteinG), carbsG: Math.round(m.carbsG), fatG: Math.round(m.fatG) };
}

/** Recipes with all of the tags (all recipes when none), optionally for one meal. The coach's own come first. */
/** Does the recipe carry this tag? Vegan recipes also count as vegetarian and dairy free. */
export function recipeHasTag(r: Recipe, t: RecipeTag): boolean {
  if (r.tags.includes(t)) return true;
  return (t === "Vegetarian" || t === "Dairy free") && r.tags.includes("Vegan");
}

/** The client's diet needs this recipe doesn't meet, e.g. ["Vegetarian"]. Empty means it fits. */
export function dietMisses(r: Recipe, diet: readonly RecipeTag[]): RecipeTag[] {
  return diet.filter((t) => !recipeHasTag(r, t));
}

/** A short label for a recipe that doesn't fit the client's diet, e.g. "Not vegetarian", or null when it fits. */
export function dietWarning(r: Recipe, diet: readonly RecipeTag[]): string | null {
  const miss = dietMisses(r, diet);
  return miss.length ? `Not ${miss.map((t) => t.toLowerCase()).join(" or ")}` : null;
}

const NOTE_SKIP = new Set("allergy allergic allergies intolerant intolerance keen like likes dislike dislikes hate dont don't eat eats eating food foods avoid avoids really much very please never with without some any free nothing none also just bit lot love only from that this have can't cant make makes feel sick bloated mild severe not and the but for too get off all bad raw".split(" "));
/** Everyday words a client writes, and the foods they cover. */
const NOTE_GROUPS: Record<string, string[]> = {
  nut: ["nut", "almond", "cashew", "walnut", "peanut", "hazelnut", "pecan", "pistachio"],
  dairy: ["milk", "cheese", "yoghurt", "yogurt", "skyr", "cream", "feta", "halloumi", "mozzarella", "parmesan", "cottage", "quark", "whey"],
  lactose: ["milk", "cheese", "yoghurt", "yogurt", "skyr", "cream", "quark", "cottage"],
  gluten: ["bread", "pasta", "wrap", "sourdough", "couscous", "noodle", "tortilla", "bagel", "pitta", "flour", "spaghetti", "wholemeal"],
  wheat: ["bread", "pasta", "wrap", "sourdough", "couscous", "noodle", "tortilla", "bagel", "pitta", "flour", "spaghetti", "wholemeal"],
  fish: ["fish", "salmon", "cod", "tuna", "mackerel", "haddock", "sardine", "trout"],
  shellfish: ["prawn", "shrimp", "crab", "mussel", "lobster"],
  seafood: ["fish", "salmon", "cod", "tuna", "mackerel", "haddock", "sardine", "trout", "prawn", "shrimp", "crab", "mussel"],
  pork: ["pork", "ham", "bacon", "chorizo", "sausage", "gammon"],
  egg: ["egg"],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh"],
  beef: ["beef", "steak", "burger"],
};
const singular = (w: string) => (w.length > 4 && w.endsWith("oes") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const wordsOf = (t: string) => t.toLowerCase().split(/[^a-z']+/).filter(Boolean).map(singular);

/**
 * Words from the client's allergy or food notes that this recipe contains, e.g. ["peanut"] for
 * "Peanut allergy" and a peanut butter shake. A simple word match to prompt the coach, not a guarantee.
 */
export function notesClash(r: Recipe, notes: string): string[] {
  const terms = [...new Set(wordsOf(notes).filter((w) => w.length >= 3 && !NOTE_SKIP.has(w)))];
  if (!terms.length) return [];
  const have = new Set([...wordsOf(r.name), ...r.ingredients.flatMap((i) => wordsOf(foodById.get(i.foodId)?.name ?? ""))]);
  return terms.filter((t) => (NOTE_GROUPS[t] ?? [t]).some((w) => have.has(w)));
}

export function filterRecipes(tags: RecipeTag[], meal?: Meal, coach: Recipe[] = []): Recipe[] {
  return [...coach, ...RECIPES].filter((r) => (!meal || r.meal === meal) && tags.every((t) => recipeHasTag(r, t)));
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i-${Math.random().toString(36).slice(2)}`);

export function planItemFromFood(f: Food, factor = 1): PlanItem {
  return { id: uid(), name: factor === 1 ? f.name : `${f.name} × ${factor}`, foodId: f.id, factor, ...scalePortion(asMacros(f), factor) };
}

export function planItemFromRecipe(r: Recipe, factor = 1): PlanItem {
  return { id: uid(), name: factor === 1 ? r.name : `${r.name} × ${factor}`, recipeId: r.id, factor, ...scalePortion(recipeMacros(r), factor) };
}

export const mealTotals = (items: PlanItem[]): Macros => sumMacros(items);
export const planDayTotals = (d: PlanDay): Macros => sumMacros(MEALS.flatMap((m) => d.meals[m.key]));

/** True when every item planned for that meal is already in the log for the day (matched by name). */
export function mealLogged(food: FoodEntry[], day: string, meal: Meal, items: PlanItem[]): boolean {
  if (!items.length) return false;
  const names = food.filter((f) => f.day === day && f.meal === meal).map((f) => f.name);
  return items.every((i) => names.includes(i.name));
}

/** The plan day to show for a date: Training day when a workout is planned that day, Rest day otherwise, else the first. */
export function planDayFor(plan: MealPlan, training: boolean | null): PlanDay | undefined {
  if (!plan.days.length) return undefined;
  if (training !== null) {
    const want = training ? /train/i : /rest/i;
    const hit = plan.days.find((d) => want.test(d.name));
    if (hit) return hit;
  }
  return plan.days[0];
}

/* ---------- Shopping list ---------- */

export interface ShoppingLine {
  key: string;
  name: string;
  group: string;
  /** "1.2 kg", "750 ml", "6", "2 tins". */
  amount: string;
}

const PER = /,\s*(\d+(?:\.\d+)?)\s*(g|ml)\b/;
const UNIT_WORDS: [RegExp, string, string][] = [[/\b1 tin\b/, "tin", "tins"], [/\bhalf tin\b/, "tin", "tins"], [/\b1 slice\b/, "slice", "slices"], [/\b(\d) rashers\b/, "rasher", "rashers"], [/\bscoop\b/, "scoop", "scoops"], [/\b1 tbsp\b/, "tbsp", "tbsp"]];

/** "Chicken breast, cooked, 100 g" → "Chicken breast, cooked". */
const shortName = (name: string) => name.replace(/,\s*(?:\d[^,]*|half[^,]*|1 [^,]*|medium|large|plain|regular)$/i, "");

function amountText(f: Food, portions: number): string {
  const per = f.name.match(PER);
  if (per) {
    const total = Number(per[1]) * portions;
    const unit = per[2]!;
    if (total >= 1000) return `${(Math.round(total / 100) / 10).toLocaleString("en-GB")} ${unit === "g" ? "kg" : "litres"}`;
    return `${Math.round(total / 10) * 10 || Math.round(total)} ${unit}`;
  }
  const n = Math.ceil(portions * 2) / 2;
  const half = /\bhalf\b/.test(f.name) ? n / 2 : n;
  for (const [re, one, many] of UNIT_WORDS) {
    if (re.test(f.name)) {
      const m = f.name.match(/\b(\d) rashers\b/);
      const count = Math.ceil(half * (m ? Number(m[1]) : 1));
      return `${count} ${count === 1 ? one : many}`;
    }
  }
  return `${Math.ceil(half)}`;
}

/**
 * Everything the plan needs for `days` days (the plan's days repeat in order), recipes broken into ingredients,
 * added up per food and grouped like a supermarket. Lines the coach typed by hand are listed as they are.
 */
export function shoppingList(plan: MealPlan, days = 7, coach: Recipe[] = []): ShoppingLine[] {
  if (!plan.days.length) return [];
  const portions = new Map<number, number>();
  const extra = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = plan.days[i % plan.days.length]!;
    for (const m of MEALS) for (const item of d.meals[m.key]) {
      const r = item.recipeId ? recipeById(item.recipeId, coach) : undefined;
      if (r) for (const ing of r.ingredients) portions.set(ing.foodId, (portions.get(ing.foodId) ?? 0) + ing.factor * item.factor);
      else if (item.foodId && foodById.has(item.foodId)) portions.set(item.foodId, (portions.get(item.foodId) ?? 0) + item.factor);
      else extra.set(item.name, (extra.get(item.name) ?? 0) + 1);
    }
  }
  const order = ["Protein", "Dairy", "Vegetables", "Fruit", "Carbs", "Fats, nuts and seeds", "Meals and snacks", "Drinks"];
  const lines: ShoppingLine[] = [...portions].map(([id, n]) => {
    const f = foodById.get(id)!;
    return { key: `f${id}`, name: shortName(f.name), group: f.group ?? "Other", amount: amountText(f, n) };
  });
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length);
  lines.sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name));
  for (const [name, n] of extra) lines.push({ key: `x${name}`, name, group: "Other", amount: `${n}` });
  return lines;
}

/* ---------- The coach's own recipes ---------- */

export const MAX_RECIPE_STEPS = 12;
/** Room for a ~640 px WebP photo; the database refuses rows over 200 kB. */
export const MAX_RECIPE_PHOTO_CHARS = 150_000;

export const newCoachRecipe = (meal: Meal = "dinner"): Recipe => ({ id: uid(), name: "", meal, minutes: 15, tags: [], ingredients: [], steps: [""], byCoach: true });

/** What's wrong with a coach recipe, in words for the coach, or null when it can be saved. */
export function recipeProblem(r: Recipe): string | null {
  if (!r.name.trim()) return "Give the recipe a name.";
  if (r.name.trim().length > 80) return "Keep the name under 80 characters.";
  if (!r.ingredients.length) return "Add at least one ingredient.";
  if (r.ingredients.some((i) => !foodById.has(i.foodId) || !(i.factor > 0 && i.factor <= 20))) return "Check the ingredient amounts.";
  if (!r.steps.some((s) => s.trim())) return "Write at least one step of the method.";
  if (r.steps.length > MAX_RECIPE_STEPS || r.steps.some((s) => s.length > 400)) return "Keep the method to 12 short steps.";
  if (!(r.minutes >= 1 && r.minutes <= 600)) return "Check the cooking time.";
  if (r.photo && (r.photo.length > MAX_RECIPE_PHOTO_CHARS || !/^(data:image\/(webp|jpeg|png);base64,|https:\/\/)/.test(r.photo))) return "That photo is too big. Try another.";
  return null;
}

export interface CoachRecipeRow { id: string; coach_id: string; recipe: Omit<Recipe, "id" | "byCoach">; updated_at?: string }

export function toCoachRecipeRow(r: Recipe, coachId: string): CoachRecipeRow {
  const { id, byCoach: _b, ...rest } = r;
  return {
    id, coach_id: coachId,
    recipe: { ...rest, name: rest.name.trim(), steps: rest.steps.map((s) => s.trim()).filter(Boolean).slice(0, MAX_RECIPE_STEPS), ingredients: rest.ingredients.filter((i) => foodById.has(i.foodId)) },
  };
}

export function fromCoachRecipeRow(row: CoachRecipeRow): Recipe {
  const x = row.recipe ?? ({} as CoachRecipeRow["recipe"]);
  return {
    id: row.id, byCoach: true, name: String(x.name ?? "Recipe"), meal: MEALS.some((m) => m.key === x.meal) ? x.meal : "dinner",
    minutes: Number(x.minutes) || 15, tags: Array.isArray(x.tags) ? x.tags : [], ingredients: Array.isArray(x.ingredients) ? x.ingredients.filter((i) => foodById.has(i.foodId)) : [],
    steps: Array.isArray(x.steps) ? x.steps.map(String) : [], ...(typeof x.photo === "string" && x.photo ? { photo: x.photo } : {}),
  };
}

/* ---------- Database row ---------- */

export interface MealPlanRow { client_id: string; plan: { days: PlanDay[]; note: string }; updated_at: string }

export const toMealPlanRow = (p: MealPlan, clientId: string): MealPlanRow => ({
  client_id: clientId,
  plan: { days: p.days.slice(0, MAX_PLAN_DAYS).map((d) => ({ ...d, name: d.name.slice(0, 40) })), note: p.note.slice(0, 500) },
  updated_at: p.updatedAt,
});

export function fromMealPlanRow(r: MealPlanRow): MealPlan {
  const days = Array.isArray(r.plan?.days) ? r.plan.days : [];
  return { days: days.map((d) => ({ ...d, meals: { ...emptyMeals(), ...d.meals } })), note: r.plan?.note ?? "", updatedAt: r.updated_at };
}

/** Priya's sample plan: a training day and a rest day built from recipes and foods. */
export function sampleMealPlan(now = new Date()): MealPlan {
  const R = (id: string, f = 1) => ({ ...planItemFromRecipe(recipeById(id)!, f), id: `demo-${id}` });
  const F = (id: number, f = 1) => ({ ...planItemFromFood(foodById.get(id)!, f), id: `demo-f${id}` });
  return {
    note: "Same breakfast every day keeps it easy. Swap any dinner for another from the recipes.",
    updatedAt: now.toISOString(),
    days: [
      { id: "demo-train", name: "Training day", meals: { breakfast: [R("r-protein-oats")], lunch: [R("r-chicken-grain-bowl")], dinner: [R("r-salmon-traybake")], snack: [R("r-pb-shake")] } },
      { id: "demo-rest", name: "Rest day", meals: { breakfast: [R("r-protein-oats")], lunch: [R("r-tuna-pasta")], dinner: [R("r-turkey-chilli")], snack: [F(68), F(98)] } },
    ],
  };
}
