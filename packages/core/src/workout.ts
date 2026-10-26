import { exerciseById } from "./library";
import type { Exercise, Workout, WorkoutItem } from "./types";

/** Item keys are UUIDs so a new item can be saved to the database under the same id. */
export const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(16).slice(2)}`;

/** Mobility work rests 30 s, isolation and core work 60 s, compound work 90 s. */
export const defaultRestFor = (exercise: Exercise): number =>
  exercise.pattern === "Mobility" ? 30 : exercise.pattern === "Isolation" || exercise.pattern === "Core" ? 60 : 90;

/** Next free block letter: A, B1/B2 and C in use → "D". */
export const nextGroupLetter = (items: WorkoutItem[]): string =>
  String.fromCharCode(65 + new Set(items.map((i) => i.group[0])).size);

export function addExercise(workout: Workout, exercise: Exercise, key = newKey()): Workout {
  const item: WorkoutItem = {
    key,
    group: nextGroupLetter(workout.items),
    exerciseId: exercise.id,
    sets: 3,
    reps: "10",
    kg: 0,
    rpe: 7,
    restSeconds: defaultRestFor(exercise),
    lastTime: "New exercise",
  };
  return { ...workout, items: [...workout.items, item] };
}

export const updateItem = (workout: Workout, key: string, patch: Partial<WorkoutItem>): Workout => ({
  ...workout,
  items: workout.items.map((it) => (it.key === key ? { ...it, ...patch } : it)),
});

export const removeItem = (workout: Workout, key: string): Workout => ({
  ...workout,
  items: workout.items.filter((it) => it.key !== key),
});

export const swapExercise = (workout: Workout, key: string, exerciseId: number): Workout =>
  updateItem(workout, key, { exerciseId, lastTime: "New exercise" });

export const isSuperset = (item: WorkoutItem): boolean => item.group.length > 1;

/* ---------- AI adjustments ----------
   Each proposal is a pure function so the coach sees an exact diff before accepting.
   In the real build the proposal comes from the Claude API and is stored as an ai_suggestion. */

export interface Adjustment {
  id: "short" | "beginner";
  title: string;
  note: string;
  apply: (w: Workout) => Workout;
}

export const ADJUSTMENTS: Adjustment[] = [
  {
    id: "short",
    title: "30-minute version",
    note: "Drops the finisher, trims rest by 30 s and cuts the main lift to 3 sets.",
    apply: (w) => ({
      ...w,
      minutes: 30,
      items: w.items
        .filter((i) => i.group !== "C")
        .map((i) => ({ ...i, sets: i.group === "A" ? 3 : i.sets, restSeconds: Math.max(0, i.restSeconds - 30) })),
    }),
  },
  {
    id: "beginner",
    title: "Beginner version",
    note: "Swaps the trap bar for a goblet squat, lowers RPE targets by 1 and adds reps.",
    apply: (w) => ({
      ...w,
      items: w.items.map((i) =>
        i.group === "A" ? { ...i, exerciseId: 9, kg: 16, reps: "8", rpe: i.rpe - 1 } : { ...i, rpe: i.rpe - 1 },
      ),
    }),
  },
];

export type ItemChange =
  | { kind: "removed"; before: WorkoutItem }
  | { kind: "changed" | "same"; before: WorkoutItem; after: WorkoutItem };

export function diffWorkouts(before: Workout, after: Workout): ItemChange[] {
  return before.items.map((b) => {
    const a = after.items.find((x) => x.key === b.key);
    if (!a) return { kind: "removed", before: b };
    const changed = a.exerciseId !== b.exerciseId || a.sets !== b.sets || a.restSeconds !== b.restSeconds || a.rpe !== b.rpe || a.reps !== b.reps || a.kg !== b.kg;
    return { kind: changed ? "changed" : "same", before: b, after: a };
  });
}

export const exerciseFor = (item: WorkoutItem): Exercise => exerciseById(item.exerciseId);
