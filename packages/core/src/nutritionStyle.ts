/* How a client tracks food, chosen by their coach. Not everyone should weigh and count:
   - macros:   full calories, protein, carbs and fat (the default)
   - protein:  just calories and protein, the two that matter most
   - portions: hand portions, no numbers to count (a palm of protein, a fist of veg, a cupped hand of carbs, a thumb of fats)
   - photos:   a photo of each meal for the coach to see, nothing to count
   Hand portions are estimates: one portion is roughly the amounts below for an average adult hand. */

import type { Macros } from "./lifestyle";

export type TrackingStyle = "macros" | "protein" | "portions" | "photos";

export const TRACKING_STYLES: { key: TrackingStyle; label: string; note: string }[] = [
  { key: "macros", label: "Full macros", note: "Calories, protein, carbs and fat. For clients who like the detail." },
  { key: "protein", label: "Protein and calories", note: "Just the two that matter most. Simpler, still precise." },
  { key: "portions", label: "Hand portions", note: "Palms, fists, cupped hands and thumbs. Nothing to weigh." },
  { key: "photos", label: "Photo diary", note: "A photo of each meal for you to see. Nothing to count." },
];

export const isTrackingStyle = (v: unknown): v is TrackingStyle => TRACKING_STYLES.some((s) => s.key === v);

export type PortionKind = "protein" | "veg" | "carbs" | "fats";
export type Portions = Record<PortionKind, number>;

export const PORTION_KINDS: { key: PortionKind; label: string; hand: string; examples: string; macros: Macros }[] = [
  { key: "protein", label: "Protein", hand: "Palm", examples: "Chicken, fish, eggs, tofu, Greek yoghurt", macros: { kcal: 120, proteinG: 24, carbsG: 2, fatG: 2 } },
  { key: "veg", label: "Veg", hand: "Fist", examples: "Broccoli, salad, peppers, carrots", macros: { kcal: 25, proteinG: 1.5, carbsG: 5, fatG: 0 } },
  { key: "carbs", label: "Carbs", hand: "Cupped hand", examples: "Rice, oats, potatoes, fruit, bread", macros: { kcal: 120, proteinG: 3, carbsG: 25, fatG: 1 } },
  { key: "fats", label: "Fats", hand: "Thumb", examples: "Oil, butter, nuts, cheese, avocado", macros: { kcal: 90, proteinG: 1, carbsG: 1, fatG: 9 } },
];

export const NO_PORTIONS: Portions = { protein: 0, veg: 0, carbs: 0, fats: 0 };

const clampCount = (n: number) => Math.max(0, Math.min(20, Math.round(n * 2) / 2));

/** Keeps only sensible counts (0 to 20, in halves). */
export function cleanPortions(p: Partial<Record<string, unknown>> | null | undefined): Portions {
  const out = { ...NO_PORTIONS };
  for (const k of PORTION_KINDS) {
    const v = Number(p?.[k.key]);
    out[k.key] = Number.isFinite(v) ? clampCount(v) : 0;
  }
  return out;
}

/** Rough calories and macros for a set of hand portions. */
export function portionMacros(p: Portions): Macros {
  const t = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const k of PORTION_KINDS) {
    const n = p[k.key];
    t.kcal += k.macros.kcal * n; t.proteinG += k.macros.proteinG * n; t.carbsG += k.macros.carbsG * n; t.fatG += k.macros.fatG * n;
  }
  return { kcal: Math.round(t.kcal), proteinG: Math.round(t.proteinG), carbsG: Math.round(t.carbsG), fatG: Math.round(t.fatG) };
}

/** Daily hand portions that land near the coach's targets. Veg is a fixed 6 fists a day (4 on a small target). */
export function portionsForTargets(t: Macros): Portions {
  const veg = t.kcal < 1600 ? 4 : 6;
  let protein = Math.max(2, Math.round(t.proteinG / 24));
  let carbs = 0;
  let fats = 1;
  // Each portion carries a little of the others (oats have protein, chicken has fat), so settle them together.
  for (let i = 0; i < 4; i++) {
    carbs = Math.max(0, Math.round((t.carbsG - veg * 5 - protein * 2 - fats) / 25));
    fats = Math.max(1, Math.round((t.fatG - protein * 2 - carbs) / 9));
    protein = Math.max(2, Math.round((t.proteinG - veg * 1.5 - carbs * 3 - fats) / 24));
  }
  return { protein, veg, carbs, fats };
}

/** Portions eaten so far, added up. */
export function sumPortions(list: readonly (Portions | null | undefined)[]): Portions {
  const out = { ...NO_PORTIONS };
  for (const p of list) if (p) for (const k of PORTION_KINDS) out[k.key] += p[k.key];
  return out;
}

/** A name for a portions entry, e.g. "2 palms protein, 1 fist veg". */
export function portionsLabel(p: Portions): string {
  const parts = PORTION_KINDS.filter((k) => p[k.key] > 0).map((k) => {
    const n = p[k.key];
    const hand = k.hand.toLowerCase();
    const plural = n === 1 ? hand : hand === "cupped hand" ? "cupped hands" : `${hand}s`;
    return `${n} ${plural} ${k.label.toLowerCase()}`;
  });
  return parts.join(", ") || "Hand portions";
}

/** What the client's food screen shows for each style. */
export function styleShows(style: TrackingStyle): { numbers: boolean; carbsFat: boolean; portions: boolean; photoFirst: boolean } {
  return {
    numbers: style === "macros" || style === "protein",
    carbsFat: style === "macros",
    portions: style === "portions",
    photoFirst: style === "photos",
  };
}
