import { describe, expect, it } from "vitest";
import { foodFromOff, isBarcode } from "./barcode";

describe("isBarcode", () => {
  it("checks the check digit", () => {
    expect(isBarcode("5000159484695")).toBe(true);
    expect(isBarcode("5000159484696")).toBe(false);
    expect(isBarcode("96385074")).toBe(true);
    expect(isBarcode("036000291452")).toBe(true);
    expect(isBarcode("abc")).toBe(false);
    expect(isBarcode("12345")).toBe(false);
  });
});

describe("foodFromOff", () => {
  it("uses the serving and scales macros", () => {
    const f = foodFromOff("5000159484695", { product_name: "Protein Bar Choc", brands: "Acme, Acme UK", serving_quantity: "60", nutriments: { "energy-kcal_100g": 350, proteins_100g: 33.3, carbohydrates_100g: 30, fat_100g: 10 } })!;
    expect(f).toMatchObject({ name: "Acme Protein Bar Choc, 60 g", grams: 60, kcal: 210, protein: 20, carbs: 18, fat: 6, group: "Scanned" });
    expect(f.id).toBeLessThan(0);
  });
  it("falls back to 100 g and kJ, and ml for drinks", () => {
    const f = foodFromOff("96385074", { product_name: "Oat drink", quantity: "1 l", nutriments: { "energy-kj_100g": 192, proteins_100g: 1 } })!;
    expect(f).toMatchObject({ name: "Oat drink, 100 ml", grams: 100, kcal: 46, protein: 1, carbs: 0 });
  });
  it("needs calories", () => {
    expect(foodFromOff("96385074", { product_name: "Mystery", nutriments: {} })).toBeNull();
    expect(foodFromOff("96385074", null)).toBeNull();
  });
});
