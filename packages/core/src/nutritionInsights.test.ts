import { describe, expect, it } from "vitest";
import { foodWeek, perMealProtein, proteinByMeal, targetChanges, targetsChangeMessage } from "./nutritionInsights";
import type { FoodEntry, Meal } from "./lifestyle";

const prev = { kcal: 1900, proteinG: 120, carbsG: 210, fatG: 60 };

describe("targets change message", () => {
  it("lists only what changed", () => {
    expect(targetChanges(prev, { ...prev, kcal: 2050, proteinG: 140 })).toEqual(["Calories 1,900 → 2,050 kcal", "Protein 120 → 140 g"]);
    expect(targetChanges(null, prev)).toEqual([]);
  });
  it("explains the change with the coach's reason", () => {
    expect(targetsChangeMessage(prev, { ...prev, kcal: 2050 }, "  Your weight has held for 3 weeks,  so a little more. ", "Priya"))
      .toBe("Hi Priya, I've updated your targets. Calories 1,900 → 2,050 kcal. Why: Your weight has held for 3 weeks, so a little more.");
  });
  it("says nothing when nothing changed, and announces first targets", () => {
    expect(targetsChangeMessage(prev, prev, "x", "Priya")).toBeNull();
    expect(targetsChangeMessage(null, prev, "", "Sam")).toBe("Hi Sam, your daily targets are set: 1,900 kcal, 120 g protein, 210 g carbs and 60 g fat.");
  });
});

const e = (day: string, meal: Meal, kcal: number, p: number): FoodEntry => ({ id: `${day}${meal}${kcal}`, day, meal, name: "x", kcal, proteinG: p, carbsG: 0, fatG: 0 });

describe("protein per meal", () => {
  it("sets a sensible per-meal goal", () => {
    expect(perMealProtein(120)).toBe(40);
    expect(perMealProtein(40)).toBe(20);
    expect(perMealProtein(300)).toBe(50);
  });
  it("finds the light meal", () => {
    const food = [e("2026-11-22", "breakfast", 300, 8), e("2026-11-22", "lunch", 600, 40), e("2026-11-22", "dinner", 700, 45)];
    const r = proteinByMeal(food, "2026-11-22", 120);
    expect(r.meals.map((m) => [m.meal, m.proteinG, m.hit])).toEqual([["breakfast", 8, false], ["lunch", 40, true], ["dinner", 45, true], ["snack", 0, false]]);
    expect(r.tip).toMatch(/^Breakfast is light on protein \(8 g\)\. Aim for about 40 g/);
  });
  it("praises an even day and stays quiet with no food", () => {
    const food = (["breakfast", "lunch", "dinner"] as Meal[]).map((m) => e("2026-11-22", m, 500, 38));
    expect(proteinByMeal(food, "2026-11-22", 120).tip).toMatch(/every main meal/);
    expect(proteinByMeal([], "2026-11-22", 120).tip).toBeNull();
  });
});

describe("food week for the check-in", () => {
  const t = () => ({ kcal: 2000, proteinG: 120, carbsG: 200, fatG: 60 });
  it("averages the logged days before today", () => {
    const food = [e("2026-11-21", "lunch", 2000, 125), e("2026-11-20", "lunch", 1800, 100), e("2026-11-22", "lunch", 5000, 0), e("2026-11-10", "lunch", 9000, 0)];
    const w = foodWeek(food, t, "2026-11-22")!;
    expect(w).toMatchObject({ logged: 2, days: 7, avgKcal: 1900, avgProteinG: 113 });
    expect(w.rating).toBeGreaterThanOrEqual(1);
    expect(w.rating).toBeLessThanOrEqual(5);
  });
  it("is null with nothing logged", () => {
    expect(foodWeek([], t, "2026-11-22")).toBeNull();
  });
});
