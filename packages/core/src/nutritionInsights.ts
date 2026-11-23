/* Three small nutrition helpers that need no new data:
   - telling the client what changed in their targets, and why
   - how protein is spread across the day (several decent servings beat one big one)
   - the week's food in a check-in, so the client doesn't have to rate it from memory */

import type { DayTargets, FoodEntry, Macros, Meal } from "./lifestyle";
import { nutritionScore } from "./nutritionDays";

const g = (n: number) => `${Math.round(n)} g`;
const k = (n: number) => `${Math.round(n).toLocaleString("en-GB")} kcal`;

/** The lines that changed, e.g. "Calories 1,900 → 2,050 kcal". Empty when nothing changed. */
export function targetChanges(prev: Macros | null, next: Macros): string[] {
  if (!prev) return [];
  const rows: [string, number, number, (n: number) => string][] = [
    ["Calories", prev.kcal, next.kcal, k], ["Protein", prev.proteinG, next.proteinG, g], ["Carbs", prev.carbsG, next.carbsG, g], ["Fat", prev.fatG, next.fatG, g],
  ];
  return rows.filter(([, a, b]) => Math.round(a) !== Math.round(b)).map(([l, a, b, f]) => `${l} ${f(a).replace(/ (g|kcal)$/, "")} → ${f(b)}`);
}

/** The chat message the client gets when their targets change. Null when nothing changed. */
export function targetsChangeMessage(prev: Macros | null, next: Macros, reason: string, firstName: string): string | null {
  const why = reason.trim().replace(/\s+/g, " ").slice(0, 300);
  const changes = targetChanges(prev, next);
  if (prev && !changes.length) return null;
  const hi = `Hi ${firstName || "there"}, `;
  if (!prev) return `${hi}your daily targets are set: ${k(next.kcal)}, ${g(next.proteinG)} protein, ${g(next.carbsG)} carbs and ${g(next.fatG)} fat.${why ? ` ${why}` : ""}`;
  return `${hi}I've updated your targets. ${changes.join(", ")}.${why ? ` Why: ${why}` : ""}`;
}

export interface MealProtein { meal: Meal; proteinG: number; hit: boolean }

/** A protein goal per main meal: a third of the day's protein, kept between 20 and 50 g. */
export const perMealProtein = (dayProteinG: number) => Math.max(20, Math.min(50, Math.round(dayProteinG / 3 / 5) * 5));

/** Protein eaten at each meal on a day, and whether each main meal reached the per-meal goal. */
export function proteinByMeal(food: readonly FoodEntry[], day: string, dayProteinG: number): { meals: MealProtein[]; goal: number; tip: string | null } {
  const goal = perMealProtein(dayProteinG);
  const order: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
  const meals = order.map((meal) => {
    const p = food.filter((f) => f.day === day && f.meal === meal).reduce((a, f) => a + f.proteinG, 0);
    return { meal, proteinG: Math.round(p), hit: meal !== "snack" && p >= goal * 0.8 };
  });
  const main = meals.filter((m) => m.meal !== "snack");
  const logged = main.filter((m) => m.proteinG > 0);
  if (!logged.length) return { meals, goal, tip: null };
  const low = logged.filter((m) => !m.hit);
  const label = (m: Meal) => m[0]!.toUpperCase() + m.slice(1);
  const tip = !low.length
    ? logged.length >= 3 ? "Protein at every main meal. That's ideal for building muscle." : null
    : `${label(low[0]!.meal)} is light on protein (${low[0]!.proteinG} g). Aim for about ${goal} g: eggs, Greek yoghurt, fish or tofu.`;
  return { meals, goal, tip };
}

export interface FoodWeek { logged: number; days: number; avgKcal: number; avgProteinG: number; score: number; band: "on" | "mixed" | "slipping"; rating: number }

/**
 * The 7 days before `today` (today left out), for a check-in: days logged, daily averages over the logged days,
 * the coach's nutrition score, and a 1 to 5 rating from it that the client can change.
 */
export function foodWeek(food: readonly FoodEntry[], targetFor: (day: string) => DayTargets, today: string): FoodWeek | null {
  const s = nutritionScore(food as FoodEntry[], targetFor, today);
  if (!s.logged) return null;
  const days = new Set<string>();
  let kcal = 0, protein = 0;
  const from = shift(today, -7);
  for (const f of food) if (f.day >= from && f.day < today) { days.add(f.day); kcal += f.kcal; protein += f.proteinG; }
  const n = days.size || 1;
  return { logged: s.logged, days: s.days, avgKcal: Math.round(kcal / n), avgProteinG: Math.round(protein / n), score: s.score, band: s.band, rating: Math.max(1, Math.min(5, Math.round(s.score / 20) || 1)) };
}

function shift(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
