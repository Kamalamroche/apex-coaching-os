/* Barcode scanning: checking a scanned code and turning an Open Food Facts product into an APEX food.
 * Open Food Facts is a free, open database (ODbL). Values are per 100 g and, when the pack says, per serving. */

import type { Food } from "./types";

/** EAN-13, EAN-8, UPC-A (12) or UPC-E style codes with a valid check digit. */
export function isBarcode(code: string): boolean {
  const c = code.replace(/\s+/g, "");
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const digits = c.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

interface OffNutriments {
  "energy-kcal_100g"?: number;
  "energy-kj_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  salt_100g?: number;
}

export interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  quantity?: string;
  nutriments?: OffNutriments;
}

export const OFF_FIELDS = "product_name,product_name_en,brands,serving_quantity,serving_size,quantity,nutriments";

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Stable negative id from the barcode, so scanned foods never clash with the built-in list. */
const idFor = (code: string) => -Number(code.slice(-9));

/**
 * The scanned product as a food: one serving if the pack gives one (else 100 g), with macros scaled to it.
 * Null when there are no calories to go on.
 */
export function foodFromOff(code: string, p: OffProduct | null | undefined): Food | null {
  if (!p) return null;
  const n = p.nutriments ?? {};
  const kcal100 = num(n["energy-kcal_100g"]) ?? (num(n["energy-kj_100g"]) !== null ? num(n["energy-kj_100g"])! / 4.184 : null);
  if (kcal100 === null) return null;
  const serving = num(p.serving_quantity);
  const grams = serving && serving > 0 && serving <= 2000 ? Math.round(serving) : 100;
  const drink = /\bml\b|\bl\b|cl\b/i.test(`${p.serving_size ?? ""} ${p.quantity ?? ""}`);
  const unit = drink ? "ml" : "g";
  const f = grams / 100;
  const r1 = (v: number | null) => Math.round((v ?? 0) * f * 10) / 10;
  const base = (p.product_name || p.product_name_en || "Scanned food").trim().slice(0, 70);
  const brand = p.brands?.split(",")[0]?.trim();
  const name = `${brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base}, ${grams} ${unit}`;
  const food: Food = { id: idFor(code), name, grams, kcal: Math.round(kcal100 * f), protein: r1(num(n.proteins_100g)), carbs: r1(num(n.carbohydrates_100g)), fat: r1(num(n.fat_100g)), group: "Scanned" };
  // Fibre, sugar and salt when the pack lists them; left out (unknown) when it doesn't.
  if (num(n.fiber_100g) !== null) food.fibre = r1(num(n.fiber_100g));
  if (num(n.sugars_100g) !== null) food.sugar = r1(num(n.sugars_100g));
  if (num(n.salt_100g) !== null) food.salt = Math.round(num(n.salt_100g)! * f * 100) / 100;
  return food;
}
