/* Reading a nutrition label from a photo. The text comes from on-device OCR (tesseract.js, already in the app);
   this turns it into a food. UK and EU labels give values per 100 g; we take energy in kcal (or kJ / 4.184),
   protein, carbohydrate, fat and, when they're there, fibre, sugars and salt. */

import type { Food } from "./types";

export interface LabelValues { kcal: number; protein: number; carbs: number; fat: number; fibre?: number; sugar?: number; salt?: number }

const NUM = "(\\d{1,4}(?:[.,]\\d{1,2})?)";
const toNum = (s: string) => Number(s.replace(",", "."));

/** The first number after a word on its line (or the next line). Skips a "per 100 g" heading. */
function after(text: string, words: string[]): number | null {
  for (const w of words) {
    const re = new RegExp(`${w}[^\\n\\d<]{0,30}(?:<\\s*)?${NUM}\\s*(?:g|mg)?`, "i");
    const m = text.match(re);
    if (m) {
      const v = toNum(m[1]!);
      if (Number.isFinite(v)) return /mg/i.test(m[0].slice(-3)) ? v / 1000 : v;
    }
  }
  return null;
}

/** Energy: a kcal figure if there is one, else kJ converted. */
function energy(text: string): number | null {
  const kcal = text.match(new RegExp(`${NUM}\\s*kcal`, "i"));
  if (kcal) return Math.round(toNum(kcal[1]!));
  const kj = text.match(new RegExp(`${NUM}\\s*kj`, "i"));
  if (kj) return Math.round(toNum(kj[1]!) / 4.184);
  return null;
}

/** Values per 100 g from label text, or null when the calories or all three macros can't be read. */
export function parseNutritionLabel(raw: string): LabelValues | null {
  const text = raw.replace(/\r/g, "").replace(/[Oo](?=\d)/g, "0");
  const kcal = energy(text);
  const protein = after(text, ["protein"]);
  const carbs = after(text, ["carbohydrates?", "carbs?"]);
  const fat = after(text, ["fat(?!\\s*free)"]);
  if (kcal === null || kcal > 900 || (protein === null && carbs === null && fat === null)) return null;
  const v: LabelValues = { kcal, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 };
  if (v.protein > 100 || v.carbs > 100 || v.fat > 100) return null;
  const fibre = after(text, ["fibre", "fiber"]);
  const sugar = after(text, ["sugars?"]);
  const salt = after(text, ["salt"]);
  if (fibre !== null && fibre <= 100) v.fibre = fibre;
  if (sugar !== null && sugar <= 100) v.sugar = sugar;
  if (salt !== null && salt <= 100) v.salt = salt;
  return v;
}

/** A food from label values per 100 g, for the amount picker (one portion = 100 g). */
export function foodFromLabel(name: string, v: LabelValues): Food {
  const f: Food = { id: -Date.now() % 1e9, name: `${name.trim().slice(0, 70) || "Label food"}, 100 g`, grams: 100, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, group: "Label" };
  if (v.fibre !== undefined) f.fibre = v.fibre;
  if (v.sugar !== undefined) f.sugar = v.sugar;
  if (v.salt !== undefined) f.salt = v.salt;
  return f;
}
