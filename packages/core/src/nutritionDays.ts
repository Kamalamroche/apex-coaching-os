import { FOODS } from "./data/foods";
import { RECIPES, type Recipe, type RecipeTag } from "./data/recipes";
import type { DayTargets, NutritionTargets } from "./lifestyle";
import { dietMisses, notesClash, recipeMacros } from "./mealPlans";
import type { Program, ProgramDay } from "./types";

/* ---------- Training days and rest days ---------- */

/** 0 = Monday … 6 = Sunday, for a "YYYY-MM-DD" day. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(y!, (m ?? 1) - 1, d ?? 1).getDay() + 6) % 7;
}

/** The workout planned for that day in the client's current week, or null on a rest day. */
export function workoutOn(program: Program | null | undefined, week: number, day: string): ProgramDay | null {
  if (!program?.days.length) return null;
  const wd = weekdayOf(day);
  return program.days.find((d) => d.week === week && d.dayIndex === wd) ?? null;
}

export interface DayTarget extends DayTargets {
  /** "training" or "rest" when the coach set rest-day targets, "same" when one set of targets covers every day. */
  kind: "training" | "rest" | "same";
  note: string;
}

/** The targets for one day: rest-day numbers on a day with no workout, when the coach set them. */
export function targetsFor(t: NutritionTargets, training: boolean): DayTarget {
  if (!t.restDay) return { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, note: t.note, kind: "same" };
  return training
    ? { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, note: t.note, kind: "training" }
    : { ...t.restDay, note: t.note, kind: "rest" };
}

/**
 * A starting point for rest days: same protein and fat, about a third fewer carbs, calories from the macros.
 * Common practice for people training 3 to 5 days a week. The coach edits it before saving.
 */
export function suggestRestDay(t: DayTargets): DayTargets {
  const carbsG = Math.round((t.carbsG * 0.7) / 5) * 5;
  const kcal = Math.round((t.proteinG * 4 + carbsG * 4 + t.fatG * 9) / 10) * 10;
  return { kcal, proteinG: t.proteinG, carbsG, fatG: t.fatG };
}

/** What the coach typed for rest days, or a reason it can't be saved. */
export function restDayProblem(r: DayTargets): string | null {
  if (!(r.kcal >= 800 && r.kcal <= 6000)) return "Rest-day calories should be between 800 and 6,000.";
  if (r.proteinG < 0 || r.carbsG < 0 || r.fatG < 0) return "Macros can't be below zero.";
  return null;
}

/* ---------- Food around a workout ---------- */

export interface FuelPick {
  r: Recipe;
  /** Why it suits, e.g. "62 g carbs, light on fat". */
  why: string;
}

export interface WorkoutFuel {
  before: FuelPick[];
  after: FuelPick[];
}

/** Recipes the client can eat: none that miss their diet or contain a food from their allergy notes. */
const suitable = (list: Recipe[], diet: readonly RecipeTag[], notes: string) => list.filter((r) => !dietMisses(r, diet).length && !notesClash(r, notes).length);

/**
 * Meals to eat around a session, from the recipes. Rule of thumb from sports nutrition:
 * before (1 to 3 hours) = mostly carbs, light on fat and fibre, not too big;
 * after (within about 2 hours) = 25 g protein or more, with carbs to refill.
 * The client's diet and allergy notes are respected. `seed` rotates the picks day by day.
 */
export function workoutFuel(opts: { coach?: Recipe[]; diet?: readonly RecipeTag[]; notes?: string; seed?: number; count?: number } = {}): WorkoutFuel {
  const { coach = [], diet = [], notes = "", seed = 0, count = 3 } = opts;
  const all = suitable([...coach, ...RECIPES], diet, notes).map((r) => ({ r, m: recipeMacros(r) }));
  const rotate = <T,>(xs: T[]) => (xs.length ? xs.map((_, i) => xs[(i + seed) % xs.length]!) : xs);

  const before = all
    .filter(({ r, m }) => m.kcal >= 150 && m.kcal <= 550 && m.fatG <= 15 && m.carbsG >= 30 && (r.meal === "breakfast" || r.meal === "snack"))
    .sort((a, b) => b.m.carbsG / b.m.kcal - a.m.carbsG / a.m.kcal || a.r.minutes - b.r.minutes)
    .slice(0, count * 3);
  const after = all
    .filter(({ m }) => m.proteinG >= 25 && m.carbsG >= 25 && m.kcal <= 750)
    .sort((a, b) => b.m.proteinG / b.m.kcal - a.m.proteinG / a.m.kcal)
    .slice(0, count * 3);

  return {
    before: rotate(before).slice(0, count).map(({ r, m }) => ({ r, why: `${Math.round(m.carbsG)} g carbs, ${m.fatG <= 8 ? "light on fat" : `${Math.round(m.fatG)} g fat`}` })),
    after: rotate(after).slice(0, count).map(({ r, m }) => ({ r, why: `${Math.round(m.proteinG)} g protein, ${Math.round(m.carbsG)} g carbs` })),
  };
}

/* ---------- What's in my fridge ---------- */

/** Things almost every kitchen has, so a recipe isn't marked as missing them. */
const PANTRY = /\b(olive oil|oil|salt|pepper|spice|paprika|cumin|chilli flakes|garlic|herb|stock|soy sauce|vinegar|mustard|honey|lemon juice)\b/i;

/** One chip: foods with the same short name (e.g. two kinds of milk) share it. */
export interface FridgeFood { ids: number[]; name: string; group: string }

/** The foods the recipes use, minus pantry basics, grouped like the food list. Short names for chips. */
export function fridgeFoods(coach: Recipe[] = []): FridgeFood[] {
  const used = new Set([...coach, ...RECIPES].flatMap((r) => r.ingredients.map((i) => i.foodId)));
  const byName = new Map<string, FridgeFood>();
  for (const f of FOODS) {
    if (!used.has(f.id) || PANTRY.test(f.name)) continue;
    const name = shortFoodName(f.name);
    const hit = byName.get(name);
    if (hit) hit.ids.push(f.id);
    else byName.set(name, { ids: [f.id], name, group: f.group ?? "Other" });
  }
  return [...byName.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/** "Chicken breast, cooked, 100 g" → "Chicken breast". */
export const shortFoodName = (name: string) => name.split(",")[0]!.trim();

export interface FridgeMatch {
  r: Recipe;
  /** Ingredients the client doesn't have (pantry basics left out). */
  missing: string[];
  /** Share of the recipe's ingredients they have, 0 to 1. */
  have: number;
}

/**
 * Recipes ranked by how much of them the client can make from what they have.
 * Only recipes missing at most `maxMissing` ingredients, and at least one ingredient in hand.
 */
export function recipesFromFridge(have: ReadonlySet<number>, opts: { coach?: Recipe[]; diet?: readonly RecipeTag[]; notes?: string; maxMissing?: number } = {}): FridgeMatch[] {
  const { coach = [], diet = [], notes = "", maxMissing = 2 } = opts;
  if (!have.size) return [];
  const byId = new Map(FOODS.map((f) => [f.id, f]));
  const out: FridgeMatch[] = [];
  for (const r of suitable([...coach, ...RECIPES], diet, notes)) {
    const needed = r.ingredients.map((i) => byId.get(i.foodId)).filter((f): f is NonNullable<typeof f> => !!f && !PANTRY.test(f.name));
    if (!needed.length) continue;
    const missing = needed.filter((f) => !have.has(f.id)).map((f) => shortFoodName(f.name));
    const got = needed.length - missing.length;
    if (!got || missing.length > maxMissing) continue;
    out.push({ r, missing, have: got / needed.length });
  }
  return out.sort((a, b) => a.missing.length - b.missing.length || b.have - a.have || a.r.minutes - b.r.minutes);
}

/* ---------- Weekly nutrition score (coach) ---------- */

export interface NutritionScore {
  /** 0 to 100. */
  score: number;
  band: "on" | "mixed" | "slipping";
  /** Out of `days`. */
  logged: number;
  onCalories: number;
  onProtein: number;
  days: number;
  /** What to talk about first. */
  focus: "logging" | "protein" | "calories" | "praise";
}

/**
 * How the client's last full week went against their targets: days logged (30%), days within 10% of
 * calories (35%) and days hitting 90% of protein (35%). Today is left out because it isn't over.
 * `targetFor` gives each day's targets, so rest days are judged against rest-day numbers.
 */
export function nutritionScore(food: FoodEntryLike[], targetFor: (day: string) => DayTargets, today: string, days = 7): NutritionScore {
  const list = Array.from({ length: days }, (_, i) => shiftDay(today, -(i + 1)));
  let logged = 0, onCalories = 0, onProtein = 0;
  for (const d of list) {
    const eaten = food.filter((f) => f.day === d);
    if (!eaten.length) continue;
    logged++;
    const kcal = eaten.reduce((a, f) => a + f.kcal, 0);
    const protein = eaten.reduce((a, f) => a + f.proteinG, 0);
    const t = targetFor(d);
    if (t.kcal && Math.abs(kcal - t.kcal) <= t.kcal * 0.1) onCalories++;
    if (t.proteinG && protein >= t.proteinG * 0.9) onProtein++;
  }
  const score = Math.round(100 * (0.3 * logged + 0.35 * onCalories + 0.35 * onProtein) / days);
  const focus = logged < Math.ceil(days * 0.6) ? "logging" : onProtein <= onCalories && onProtein < logged ? "protein" : onCalories < logged ? "calories" : "praise";
  return { score, band: score >= 75 ? "on" : score >= 45 ? "mixed" : "slipping", logged, onCalories, onProtein, days, focus };
}

/** A short, friendly message the coach can send as it is or edit. UK English, no pressure. */
export function nutritionNudge(s: NutritionScore, firstName: string, proteinG: number): string {
  const name = firstName || "there";
  switch (s.focus) {
    case "logging":
      return `Hi ${name}, you logged food on ${s.logged} of the last ${s.days} days. Even a quick log of your main meals helps me plan for you. Could you aim for 5 days this week?`;
    case "protein":
      return `Hi ${name}, good work logging this week. Protein is the one to push: ${s.onProtein ? `you hit it on ${s.onProtein} of ${s.logged} days` : "it was a little low every day"}. Try adding a portion at breakfast, like Greek yogurt or eggs, to get closer to ${Math.round(proteinG)} g.`;
    case "calories":
      return `Hi ${name}, thanks for logging this week. Your calories were on target on ${s.onCalories} of ${s.logged} days. Planning tomorrow's meals the night before can make that easier. Want me to set you a meal plan?`;
    default:
      return `Hi ${name}, great week! You logged ${s.logged} days and hit your targets most of them. Keep it going.`;
  }
}

type FoodEntryLike = { day: string; kcal: number; proteinG: number };
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(y!, (m ?? 1) - 1, (d ?? 1) + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
