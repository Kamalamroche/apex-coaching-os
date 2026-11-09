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
