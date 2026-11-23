/* Saved meals: a client's usual breakfast (or any meal) saved once, logged again in one tap. */

import type { FoodEntry, Meal } from "./lifestyle";

export type SavedItem = Pick<FoodEntry, "name" | "kcal" | "proteinG" | "carbsG" | "fatG" | "fibreG" | "sugarG" | "saltG">;
export interface SavedMeal { id: string; name: string; meal: Meal; items: SavedItem[]; createdAt: string }

export const SAVED_MEALS_MAX = 40;

/** A saved meal from the foods logged in one meal. */
export function savedMealFrom(name: string, meal: Meal, entries: readonly FoodEntry[], id: string, now = new Date()): SavedMeal {
  const items = entries.slice(0, 30).map((e) => {
    const i: SavedItem = { name: e.name, kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG };
    if (e.fibreG !== undefined) i.fibreG = e.fibreG;
    if (e.sugarG !== undefined) i.sugarG = e.sugarG;
    if (e.saltG !== undefined) i.saltG = e.saltG;
    return i;
  });
  return { id, name: name.trim().slice(0, 60), meal, items, createdAt: now.toISOString() };
}

export function savedMealProblem(name: string, entries: readonly FoodEntry[]): string | null {
  if (!name.trim()) return "Give it a name, e.g. My usual breakfast";
  if (name.trim().length > 60) return "Keep the name under 60 characters";
  if (!entries.length) return "Log the foods first, then save them as a meal";
  return null;
}

/** Totals for the card. */
export function savedMealTotals(m: SavedMeal): { kcal: number; proteinG: number } {
  return { kcal: Math.round(m.items.reduce((a, i) => a + i.kcal, 0)), proteinG: Math.round(m.items.reduce((a, i) => a + i.proteinG, 0)) };
}

/** A suggested name from the meal and the main food. */
export function suggestMealName(meal: Meal, entries: readonly FoodEntry[]): string {
  const label = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" }[meal];
  const main = [...entries].sort((a, b) => b.kcal - a.kcal)[0]?.name.split(",")[0];
  return main ? `My usual ${label}: ${main}`.slice(0, 60) : `My usual ${label}`;
}
