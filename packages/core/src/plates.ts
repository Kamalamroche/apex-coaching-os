import type { Exercise } from "./types";

/* Plate maths for the guided player. Everything is in kg and assumes plates go on in pairs. */

/** Standard UK gym plates, heaviest first. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export interface BarOption {
  kg: number;
  label: string;
}

export const BARS: BarOption[] = [
  { kg: 20, label: "Olympic bar" },
  { kg: 15, label: "15 kg bar" },
  { kg: 10, label: "Technique bar" },
  { kg: 25, label: "Trap bar" },
];

/** Exercises loaded with plates. Dumbbells, cables and machines have their own stacks. */
export const usesPlates = (exercise: Pick<Exercise, "equipment">): boolean =>
  exercise.equipment === "Barbell" || exercise.equipment === "Trap bar";

/** Trap bars are usually heavier than an Olympic bar; everything else starts at 20 kg. */
export const defaultBarFor = (exercise: Pick<Exercise, "equipment">): number => (exercise.equipment === "Trap bar" ? 25 : 20);

export interface PlateLoad {
  /** Plates for one side, heaviest first (the order they go on). */
  perSide: number[];
  /** What the bar weighs once loaded. Equals the target unless it can't be made exactly. */
  totalKg: number;
  /** Target minus total: above 0 means the nearest lighter load was used. */
  shortKg: number;
}

/** Fewest plates per side to reach `targetKg` on a `barKg` bar, never going over the target. */
export function loadPlates(targetKg: number, barKg: number, plates: readonly number[] = PLATES_KG): PlateLoad {
  const target = Number.isFinite(targetKg) ? targetKg : 0;
  // Work in hundredths so 1.25 kg plates add up without floating point drift.
  let side = Math.max(0, Math.floor(((target - barKg) * 100) / 2 + 1e-6));
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    const unit = Math.round(p * 100);
    while (side >= unit) {
      perSide.push(p);
      side -= unit;
    }
  }
  const totalKg = barKg + 2 * perSide.reduce((s, p) => s + p, 0);
  return { perSide, totalKg, shortKg: Math.max(0, Math.round((target - totalKg) * 100) / 100) };
}

/** "25 + 10 + 1.25", or "Empty bar". */
export const describePlates = (perSide: number[]): string => (perSide.length ? perSide.join(" + ") : "Empty bar");
