import { FOOD_PRICE_PENCE } from "./data/foodPrices";
import type { Recipe } from "./data/recipes";
import { recipeById, type MealPlan } from "./mealPlans";
import { MEALS } from "./lifestyle";

/** Recipes at or under this cost a serving count as budget friendly. */
export const BUDGET_PENCE = 200;

/** Estimated cost of one serving in pence, or null when a food has no price (e.g. in a coach recipe). */
export function recipeCost(r: Recipe): number | null {
  let p = 0;
  for (const i of r.ingredients) {
    const price = FOOD_PRICE_PENCE[i.foodId];
    if (price === undefined) return null;
    p += price * i.factor;
  }
  return Math.round(p);
}

export const isBudget = (r: Recipe) => { const c = recipeCost(r); return c !== null && c <= BUDGET_PENCE; };

/** "£1.20", "85p". */
export function formatPence(p: number): string {
  const n = Math.round(p);
  return n < 100 ? `${n}p` : `£${(n / 100).toFixed(2)}`;
}

/** A rough total for the plan's food over `days`, and how many items had no price. */
export function planCost(plan: MealPlan, days = 7, coach: Recipe[] = []): { pence: number; unpriced: number } {
  let pence = 0, unpriced = 0;
  if (!plan.days.length) return { pence, unpriced };
  for (let i = 0; i < days; i++) {
    const d = plan.days[i % plan.days.length]!;
    for (const m of MEALS) for (const item of d.meals[m.key]) {
      const r = item.recipeId ? recipeById(item.recipeId, coach) : undefined;
      const c = r ? recipeCost(r) : item.foodId !== undefined ? FOOD_PRICE_PENCE[item.foodId] ?? null : null;
      if (c === null) unpriced++;
      else pence += c * item.factor;
    }
  }
  return { pence: Math.round(pence), unpriced };
}
