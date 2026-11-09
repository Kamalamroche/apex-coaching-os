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
export const recipeById = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);

const asMacros = (f: Food): Macros => ({ kcal: f.kcal, proteinG: f.protein, carbsG: f.carbs, fatG: f.fat });

/** One serving of a recipe, added up from its ingredients. */
export function recipeMacros(r: Recipe): Macros {
  const m = sumMacros(r.ingredients.map((i) => { const f = foodById.get(i.foodId); return f ? scalePortion(asMacros(f), i.factor) : { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }; }));
  return { kcal: Math.round(m.kcal), proteinG: Math.round(m.proteinG), carbsG: Math.round(m.carbsG), fatG: Math.round(m.fatG) };
}

/** Recipes with any of the tags (all recipes when none), optionally for one meal. */
export function filterRecipes(tags: RecipeTag[], meal?: Meal): Recipe[] {
  return RECIPES.filter((r) => (!meal || r.meal === meal) && tags.every((t) => r.tags.includes(t)));
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
export function shoppingList(plan: MealPlan, days = 7): ShoppingLine[] {
  if (!plan.days.length) return [];
  const portions = new Map<number, number>();
  const extra = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = plan.days[i % plan.days.length]!;
    for (const m of MEALS) for (const item of d.meals[m.key]) {
      const r = item.recipeId ? recipeById(item.recipeId) : undefined;
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
