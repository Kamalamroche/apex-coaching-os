import { describe, expect, it } from "vitest";
import { RECIPES } from "./data/recipes";
import { fromTargetsRow, toTargetsRow, type NutritionTargets } from "./lifestyle";
import { dietMisses, notesClash, recipeMacros } from "./mealPlans";
import { fridgeFoods, recipesFromFridge, restDayProblem, suggestRestDay, targetsFor, weekdayOf, workoutFuel, workoutOn } from "./nutritionDays";
import type { Program } from "./types";

const T: NutritionTargets = { kcal: 2200, proteinG: 150, carbsG: 250, fatG: 65, note: "" };

describe("training and rest days", () => {
  it("knows the weekday", () => {
    expect(weekdayOf("2026-11-09")).toBe(0); // Monday
    expect(weekdayOf("2026-11-15")).toBe(6);
  });
  it("finds the workout planned for a day in the current week", () => {
    const p = { name: "x", weeks: 2, days: [{ key: "a", week: 1, dayIndex: 0, name: "Upper", ofWeeks: 2, minutes: 50, items: [] }, { key: "b", week: 2, dayIndex: 2, name: "Lower", ofWeeks: 2, minutes: 50, items: [] }] } as Program;
    expect(workoutOn(p, 1, "2026-11-09")?.name).toBe("Upper");
    expect(workoutOn(p, 1, "2026-11-11")).toBeNull();
    expect(workoutOn(p, 2, "2026-11-11")?.name).toBe("Lower");
    expect(workoutOn(null, 1, "2026-11-09")).toBeNull();
  });
  it("uses rest-day targets only when set and not training", () => {
    expect(targetsFor(T, false).kind).toBe("same");
    const r = { ...T, restDay: suggestRestDay(T) };
    expect(targetsFor(r, true).kcal).toBe(2200);
    expect(targetsFor(r, false)).toMatchObject({ kind: "rest", carbsG: 175, proteinG: 150 });
  });
  it("suggests fewer carbs and matching calories for rest days", () => {
    const s = suggestRestDay(T);
    expect(s.carbsG).toBe(175);
    expect(s.kcal).toBe(Math.round((150 * 4 + 175 * 4 + 65 * 9) / 10) * 10);
    expect(restDayProblem(s)).toBeNull();
    expect(restDayProblem({ ...s, kcal: 300 })).toMatch(/between/);
  });
  it("round-trips rest days through a row, and leaves the column out when untouched", () => {
    expect("rest_day" in toTargetsRow(T, "c")).toBe(false);
    const withRest = { ...T, restDay: suggestRestDay(T) };
    expect(fromTargetsRow(toTargetsRow(withRest, "c"))).toEqual(withRest);
    expect(toTargetsRow({ ...T, restDay: null }, "c").rest_day).toBeNull();
    expect(fromTargetsRow(toTargetsRow(T, "c")).restDay).toBeUndefined();
  });
});

describe("food around a workout", () => {
  it("picks carb-led meals before and protein-led meals after", () => {
    const f = workoutFuel();
    expect(f.before).toHaveLength(3);
    expect(f.after).toHaveLength(3);
    for (const p of f.before) { expect(["breakfast", "snack"]).toContain(p.r.meal); const m = recipeMacros(p.r); expect(m.fatG).toBeLessThanOrEqual(15); expect(m.carbsG).toBeGreaterThanOrEqual(30); }
    for (const p of f.after) expect(recipeMacros(p.r).proteinG).toBeGreaterThanOrEqual(25);
  });
  it("respects diet and allergy notes", () => {
    const f = workoutFuel({ diet: ["Vegan"], notes: "peanut allergy" });
    for (const p of [...f.before, ...f.after]) {
      expect(dietMisses(p.r, ["Vegan"])).toEqual([]);
      expect(notesClash(p.r, "peanut allergy")).toEqual([]);
    }
    expect(f.after.length).toBeGreaterThan(0);
  });
  it("rotates picks by day", () => {
    expect(workoutFuel({ seed: 1 }).after[0]!.r.id).not.toBe(workoutFuel({ seed: 0 }).after[0]!.r.id);
  });
});

describe("what's in my fridge", () => {
  const foods = fridgeFoods();
  it("lists the foods recipes use, without pantry basics", () => {
    expect(foods.length).toBeGreaterThan(40);
    expect(foods.some((f) => /oil/i.test(f.name))).toBe(false);
    expect(foods.find((f) => f.name === "Chicken breast")).toBeTruthy();
    expect(new Set(foods.map((f) => f.name)).size).toBe(foods.length);
  });
  it("ranks recipes by what's missing", () => {
    const r = RECIPES[0]!;
    const have = new Set(r.ingredients.map((i) => i.foodId));
    const hits = recipesFromFridge(have);
    expect(hits[0]!.missing).toEqual([]);
    expect(hits.some((h) => h.r.id === r.id)).toBe(true);
    for (let i = 1; i < hits.length; i++) expect(hits[i]!.missing.length).toBeGreaterThanOrEqual(hits[i - 1]!.missing.length);
    expect(recipesFromFridge(new Set())).toEqual([]);
  });
});
