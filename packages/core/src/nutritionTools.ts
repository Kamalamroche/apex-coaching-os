/* Nutrition helpers for the coach and the client: a target calculator and "describe a meal" logging.
 * Pure functions, no network and no AI: the calculator is the Mifflin-St Jeor equation, and meals are
 * matched against APEX's own food list. */

import { scalePortion, searchFoods } from "./lifestyle";
import type { Food } from "./types";

/* ---------- Smart targets ---------- */

export type Sex = "female" | "male";
export type ActivityLevel = "low" | "light" | "moderate" | "high";
export type NutritionGoal = "lose" | "maintain" | "gain";

export const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { key: "low", label: "Low", hint: "Desk job, little training", factor: 1.2 },
  { key: "light", label: "Light", hint: "Trains 1 to 3 days a week", factor: 1.375 },
  { key: "moderate", label: "Moderate", hint: "Trains 3 to 5 days a week", factor: 1.55 },
  { key: "high", label: "High", hint: "Trains 6 or more days, or a physical job", factor: 1.725 },
];

export const NUTRITION_GOALS: { key: NutritionGoal; label: string }[] = [
  { key: "lose", label: "Lose fat" },
  { key: "maintain", label: "Maintain" },
  { key: "gain", label: "Build muscle" },
];

export interface TargetInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: NutritionGoal;
}

export interface SuggestedTargets {
  /** Calories burned at rest. */
  bmr: number;
  /** Calories to stay the same weight. */
  maintenance: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const round = (v: number, to: number) => Math.round(v / to) * to;

/** What still stops a suggestion, or null when the numbers are usable. */
export function targetInputsProblem(i: Partial<TargetInputs>): string | null {
  if (i.age == null || i.age < 14 || i.age > 90) return "Add an age between 14 and 90.";
  if (i.heightCm == null || i.heightCm < 120 || i.heightCm > 230) return "Add a height between 120 and 230 cm.";
  if (i.weightKg == null || i.weightKg < 30 || i.weightKg > 300) return "Add a weight between 30 and 300 kg.";
  return null;
}

/**
 * Daily calories and macros from body stats, activity and goal.
 * Mifflin-St Jeor for resting calories, times an activity factor for maintenance.
 * Lose fat: 20% under maintenance. Build muscle: 10% over.
 * Protein 2.0 g per kg when losing fat (keeps muscle), 1.8 g otherwise. Fat 25% of calories, never under 0.6 g per kg. Carbs fill the rest.
 */
export function suggestTargets(i: TargetInputs): SuggestedTargets | null {
  if (targetInputsProblem(i)) return null;
  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === "male" ? 5 : -161);
  const factor = ACTIVITY_LEVELS.find((a) => a.key === i.activity)?.factor ?? 1.2;
  const maintenance = bmr * factor;
  const kcal = round(maintenance * (i.goal === "lose" ? 0.8 : i.goal === "gain" ? 1.1 : 1), 10);
  const proteinG = round(i.weightKg * (i.goal === "lose" ? 2 : 1.8), 5);
  const fatG = round(Math.max((kcal * 0.25) / 9, i.weightKg * 0.6), 5);
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4, 5));
  return { bmr: Math.round(bmr), maintenance: round(maintenance, 10), kcal, proteinG, carbsG, fatG };
}

/* ---------- Describe a meal ---------- */

export interface MealItem {
  /** The words the client typed for this item. */
  text: string;
  food: Food;
  /** Portions of `food` (1.5 = one and a half). */
  factor: number;
  /** True when only one word matched, so the client should check it. */
  guess: boolean;
  /** The name to log, e.g. "Egg, large × 2" or "Chicken breast, cooked, 150 g". */
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ParsedMeal {
  items: MealItem[];
  /** Parts nothing matched, so the client can search for them or quick add. */
  unmatched: string[];
}

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, "½": 0.5 };
// Everyday words that aren't in the food names.
const SYNONYMS: Record<string, string> = { toast: "bread", yoghurt: "yogurt", porridge: "porridge oats" };
// Container words that only say how it was served.
const SERVING = /^(?:(?:slices?|pieces?|bowls?|glass(?:es)?|cups?|mugs?|handfuls?|portions?|servings?|tins?|cans?|scoops?|pots?)\s+(?:of\s+)?|of\s+)/;

const singular = (w: string) => (w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("oes") || w.endsWith("ches") ? w.slice(0, -2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

function findFood(foods: Food[], words: string[]): { food: Food; guess: boolean } | undefined {
  if (!words.length) return undefined;
  const tries = [words.map(singular), words];
  for (const t of tries) {
    const hit = searchFoods(foods, t.join(" "), 1)[0];
    if (hit) return { food: hit, guess: false };
  }
  // Fall back to the single most telling word, longest first ("grilled salmon fillet" → salmon fillet).
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    if (w.length < 3) continue;
    const hit = searchFoods(foods, w, 1)[0] ?? searchFoods(foods, singular(w), 1)[0];
    if (hit) return { food: hit, guess: words.length > 1 };
  }
  return undefined;
}

/**
 * Turns "2 eggs, 2 slices of toast and a banana" into foods with amounts.
 * Items split on commas, "and", "+", ";" and new lines. An amount can be a number ("2", "1.5"),
 * a word ("a", "two", "half") or a weight ("150 g", "200ml"). Weights scale by the food's portion weight.
 */
export function parseMeal(text: string, foods: Food[]): ParsedMeal {
  const clean = (p: string) => p.trim().replace(/\s+/g, " ");
  // Split on "and" too, unless the food itself has "and" in its name ("fish and chips").
  const keepsAnd = (chunk: string) => {
    const words = chunk.replace(/^[\d.]+\s*(?:kg|g|grams?|ml|l)?\s*x?\s+|^(?:a|an|one|two|three)\s+/, "").split(" ");
    const hit = searchFoods(foods, words.join(" "), 1)[0];
    return !!hit && / and /i.test(hit.name);
  };
  const parts = text.toLowerCase().split(/,|;|\+|\n|&/).map(clean).filter(Boolean)
    .flatMap((chunk) => (/\band\b/.test(chunk) && !keepsAnd(chunk) ? chunk.split(/\band\b/).map(clean).filter(Boolean) : [chunk]));
  const items: MealItem[] = [];
  const unmatched: string[] = [];
  for (const part of parts.slice(0, 20)) {
    let rest = part;
    let count: number | null = null;
    let grams: number | null = null;
    const num = rest.match(/^(\d+(?:\.\d+)?)\s*(kg|g|grams?|ml|l)?\b\s*x?\s*/);
    if (num) {
      const v = Number(num[1]);
      const unit = num[2];
      if (unit === "kg" || unit === "l") grams = v * 1000;
      else if (unit) grams = v;
      else count = v;
      rest = rest.slice(num[0].length);
    } else {
      const word = rest.match(/^(\S+)\s+/);
      if (word && word[1]! in NUMBER_WORDS) { count = NUMBER_WORDS[word[1]!]!; rest = rest.slice(word[0].length); }
    }
    rest = rest.replace(/^(?:a|an)\s+/, "").replace(SERVING, "").replace(/^(?:a|an)\s+/, "");
    const words = rest.split(" ").filter((w) => w && !["of", "the", "some", "with", "large", "small", "medium"].includes(w)).map((w) => SYNONYMS[w] ?? w).join(" ").split(" ");
    const found = findFood(foods, words);
    if (!found) { unmatched.push(part); continue; }
    const { food, guess } = found;
    const factor = grams !== null && food.grams ? Math.max(0.05, grams / food.grams) : Math.max(0.25, count ?? 1);
    const unit = /\bml\b/.test(food.name) ? "ml" : "g";
    const name = grams !== null && food.grams ? `${food.name.replace(/,\s*\d[^,]*$/, "")}, ${Math.round(grams)} ${unit}` : factor === 1 ? food.name : `${food.name} × ${factor}`;
    items.push({ text: part, food, factor, guess, name, ...scalePortion({ kcal: food.kcal, proteinG: food.protein, carbsG: food.carbs, fatG: food.fat }, factor) });
  }
  return { items, unmatched };
}
