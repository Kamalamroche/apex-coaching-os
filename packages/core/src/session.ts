import type { SetEntry, Workout, WorkoutItem } from "./types";

export type SessionSets = Record<string, SetEntry[]>;

/** Pre-fill every set with the prescription so the client only taps ✓. */
export const initialSets = (workout: Workout): SessionSets =>
  Object.fromEntries(
    workout.items.map((it) => [
      it.key,
      Array.from({ length: it.sets }, () => ({ kg: it.kg ? String(it.kg) : "", reps: it.reps.replace("s", ""), done: false })),
    ]),
  );

export const completedSets = (sets: SessionSets): number => Object.values(sets).flat().filter((s) => s.done).length;

export const totalSets = (sets: SessionSets): number => Object.values(sets).flat().length;

/** Sum of kg × reps over completed sets. Holds ("40s") have no load, so they add 0. */
export const sessionVolume = (sets: SessionSets): number =>
  Object.values(sets)
    .flat()
    .filter((s) => s.done)
    .reduce((sum, s) => sum + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);

/** True when any completed set beats the previous best load for this exercise. */
export function isPersonalBest(item: WorkoutItem, sets: SetEntry[], previousBestKg: Record<number, number>): boolean {
  const best = previousBestKg[item.exerciseId];
  if (best === undefined || !item.kg) return false;
  return sets.some((s) => s.done && Number(s.kg) > best);
}

export const countPersonalBests = (workout: Workout, sets: SessionSets, previousBestKg: Record<number, number>): number =>
  workout.items.filter((it) => isPersonalBest(it, sets[it.key] ?? [], previousBestKg)).length;
