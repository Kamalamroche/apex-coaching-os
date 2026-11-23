import { describe, expect, it } from "vitest";
import { cleanPortions, isTrackingStyle, portionMacros, portionsForTargets, portionsLabel, styleShows, sumPortions } from "./nutritionStyle";
import { foodFromLabel, parseNutritionLabel } from "./foodLabel";
import { foodsFromOffSearch, offSearchUrl } from "./barcode";
import { savedMealFrom, savedMealProblem, savedMealTotals, suggestMealName } from "./savedMeals";
import type { FoodEntry } from "./lifestyle";

describe("tracking style", () => {
  it("knows its styles", () => {
    expect(isTrackingStyle("portions")).toBe(true);
    expect(isTrackingStyle("keto")).toBe(false);
    expect(styleShows("protein")).toEqual({ numbers: true, carbsFat: false, portions: false, photoFirst: false });
    expect(styleShows("photos").photoFirst).toBe(true);
  });
});

describe("hand portions", () => {
  it("cleans counts to halves between 0 and 20", () => {
    expect(cleanPortions({ protein: 2.3, veg: -1, carbs: "3", fats: 99 })).toEqual({ protein: 2.5, veg: 0, carbs: 3, fats: 20 });
    expect(cleanPortions(null)).toEqual({ protein: 0, veg: 0, carbs: 0, fats: 0 });
  });
  it("estimates macros", () => {
    expect(portionMacros({ protein: 1, veg: 1, carbs: 1, fats: 1 })).toEqual({ kcal: 355, proteinG: 30, carbsG: 33, fatG: 12 });
  });
  it("turns targets into daily portions that land near them", () => {
    const t = { kcal: 2200, proteinG: 160, carbsG: 230, fatG: 70 };
    const p = portionsForTargets(t);
    const back = portionMacros(p);
    expect(Math.abs(back.kcal - t.kcal)).toBeLessThan(250);
    expect(Math.abs(back.proteinG - t.proteinG)).toBeLessThan(15);
    expect(Math.abs(back.carbsG - t.carbsG)).toBeLessThan(20);
    expect(Math.abs(back.fatG - t.fatG)).toBeLessThan(10);
  });
  it("adds up and labels", () => {
    expect(sumPortions([{ protein: 1, veg: 2, carbs: 0, fats: 0 }, null, { protein: 1, veg: 0, carbs: 1, fats: 1 }])).toEqual({ protein: 2, veg: 2, carbs: 1, fats: 1 });
    expect(portionsLabel({ protein: 2, veg: 1, carbs: 1, fats: 0 })).toBe("2 palms protein, 1 fist veg, 1 cupped hand carbs");
  });
});

describe("nutrition label", () => {
  const uk = `NUTRITION Typical values per 100g
Energy 1046kJ / 250kcal
Fat 9.1g
of which saturates 3.2g
Carbohydrate 30,5g
of which sugars 4.0g
Fibre 2.1g
Protein 11.0g
Salt 0.85g`;
  it("reads a UK label", () => {
    expect(parseNutritionLabel(uk)).toEqual({ kcal: 250, protein: 11, carbs: 30.5, fat: 9.1, fibre: 2.1, sugar: 4, salt: 0.85 });
  });
  it("converts kJ when there's no kcal", () => {
    expect(parseNutritionLabel("Energy 1674 kJ\nFat 20g\nCarbohydrate 50g\nProtein 8g")?.kcal).toBe(400);
  });
  it("gives up on text that isn't a label", () => {
    expect(parseNutritionLabel("Best before end: see lid")).toBeNull();
  });
  it("makes a 100 g food", () => {
    const f = foodFromLabel("Oat bar", parseNutritionLabel(uk)!);
    expect(f).toMatchObject({ name: "Oat bar, 100 g", grams: 100, kcal: 250, protein: 11, fibre: 2.1 });
  });
});

describe("Open Food Facts search", () => {
  it("builds a UK search address", () => {
    const u = new URL(offSearchUrl("  greek yoghurt "));
    expect(u.host).toBe("uk.openfoodfacts.org");
    expect(u.searchParams.get("search_terms")).toBe("greek yoghurt");
    expect(u.searchParams.get("fields")).toContain("code");
  });
  it("keeps products with calories, once each", () => {
    const foods = foodsFromOffSearch({ products: [
      { code: "5000000000001", product_name: "Greek Style Yoghurt", brands: "Shop", nutriments: { "energy-kcal_100g": 97, proteins_100g: 5.7, carbohydrates_100g: 4.6, fat_100g: 6 } },
      { code: "5000000000002", product_name: "Greek Style Yoghurt", brands: "Shop", nutriments: { "energy-kcal_100g": 97 } },
      { code: "5000000000003", product_name: "No numbers" },
      { code: "abc", product_name: "Bad code", nutriments: { "energy-kcal_100g": 10 } },
    ] });
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ name: "Shop Greek Style Yoghurt, 100 g", kcal: 97, group: "Open Food Facts" });
  });
});

describe("saved meals", () => {
  const e = (name: string, kcal: number, p: number): FoodEntry => ({ id: name, day: "2026-11-22", meal: "breakfast", name, kcal, proteinG: p, carbsG: 10, fatG: 5 });
  const eggs = [e("Eggs, 2", 140, 12), e("Toast", 180, 6), e("Banana", 105, 1)];
  it("saves the foods without ids or days", () => {
    const m = savedMealFrom(" Usual breakfast ", "breakfast", eggs, "m1", new Date("2026-11-22T08:00:00Z"));
    expect(m.name).toBe("Usual breakfast");
    expect(m.items[0]).toEqual({ name: "Eggs, 2", kcal: 140, proteinG: 12, carbsG: 10, fatG: 5 });
    expect(savedMealTotals(m)).toEqual({ kcal: 425, proteinG: 19 });
  });
  it("checks the name and foods", () => {
    expect(savedMealProblem("", eggs)).toMatch(/name/);
    expect(savedMealProblem("Mine", [])).toMatch(/Log the foods/);
    expect(savedMealProblem("Mine", eggs)).toBeNull();
  });
  it("suggests a name from the biggest food", () => {
    expect(suggestMealName("breakfast", eggs)).toBe("My usual breakfast: Toast");
  });
});
