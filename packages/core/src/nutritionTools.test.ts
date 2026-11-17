import { describe, expect, it } from "vitest";
import { FOODS } from "./data/foods";
import { parseMeal, suggestTargets, targetInputsProblem } from "./nutritionTools";

describe("suggestTargets", () => {
  it("uses Mifflin-St Jeor and the goal", () => {
    const t = suggestTargets({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate", goal: "maintain" })!;
    // 800 + 1125 - 150 + 5 = 1780; × 1.55 = 2759
    expect(t.bmr).toBe(1780);
    expect(t.maintenance).toBe(2760);
    expect(t.kcal).toBe(2760);
    expect(t.proteinG).toBe(145);
    expect(t.fatG).toBe(75);
    // Macros add up close to the calories.
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal)).toBeLessThan(40);
  });
  it("cuts for fat loss and keeps protein higher", () => {
    const t = suggestTargets({ sex: "female", age: 35, heightCm: 165, weightKg: 70, activity: "light", goal: "lose" })!;
    expect(Math.abs(t.kcal - t.maintenance * 0.8)).toBeLessThanOrEqual(10);
    expect(t.proteinG).toBe(140);
    expect(t.fatG).toBeGreaterThanOrEqual(42);
  });
  it("adds for muscle gain", () => {
    const base = { sex: "male" as const, age: 25, heightCm: 175, weightKg: 70, activity: "high" as const };
    expect(suggestTargets({ ...base, goal: "gain" })!.kcal).toBeGreaterThan(suggestTargets({ ...base, goal: "maintain" })!.kcal);
  });
  it("refuses numbers out of range", () => {
    expect(targetInputsProblem({ age: 30, heightCm: 50, weightKg: 70 })).toMatch(/height/);
    expect(suggestTargets({ sex: "male", age: 8, heightCm: 180, weightKg: 80, activity: "low", goal: "maintain" })).toBeNull();
  });
});

describe("parseMeal", () => {
  it("reads counts, words and plurals", () => {
    const m = parseMeal("2 eggs, 2 slices of toast and a banana", FOODS);
    expect(m.unmatched).toEqual([]);
    expect(m.items.map((i) => [i.food.name, i.factor])).toEqual([["Egg, large", 2], ["White bread, 1 slice", 2], ["Banana, medium", 1]]);
    expect(m.items[0]!.kcal).toBe(156);
    expect(m.items[0]!.name).toBe("Egg, large × 2");
  });
  it("scales by weight", () => {
    const m = parseMeal("150g chicken breast", FOODS);
    expect(m.items[0]!.food.name).toMatch(/^Chicken breast/);
    expect(m.items[0]!.factor).toBe(1.5);
    expect(m.items[0]!.name).toBe("Chicken breast, cooked, 150 g");
    expect(m.items[0]!.proteinG).toBe(46.5);
  });
  it("keeps foods with 'and' in the name whole", () => {
    const m = parseMeal("fish and chips + coffee", FOODS);
    expect(m.items.map((i) => i.food.name)).toEqual(["Fish and chips", "Coffee, black"]);
  });
  it("lists what it can't find", () => {
    const m = parseMeal("half a jacket potato and zzz pudding", FOODS);
    expect(m.items[0]!.food.name).toBe("Jacket potato, medium");
    expect(m.items[0]!.factor).toBe(0.5);
    expect(m.unmatched).toEqual(["zzz pudding"]);
  });
  it("is empty for empty text", () => {
    expect(parseMeal("  ", FOODS)).toEqual({ items: [], unmatched: [] });
  });
});

describe("parseMeal guesses", () => {
  it("flags a one-word fallback as a guess", () => {
    const m = parseMeal("zzz cake, 2 eggs", FOODS);
    expect(m.items[0]!.guess).toBe(true);
    expect(m.items[1]!.guess).toBe(false);
  });
});
