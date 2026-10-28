import { exerciseById } from "./library";
import { progressWorkout } from "./progression";
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

/** Re-letters blocks top to bottom after an insert, move or link: a run of items sharing a letter
    is one block, so A, B1/B2, C… A block of one has no number; a superset is numbered 1, 2, 3. */
export function relabelGroups(items: WorkoutItem[]): WorkoutItem[] {
  const runs: WorkoutItem[][] = [];
  items.forEach((it, i) => {
    const prev = items[i - 1];
    if (prev && prev.group[0] === it.group[0]) runs.at(-1)?.push(it);
    else runs.push([it]);
  });
  return runs.flatMap((run, r) =>
    run.map((it, n) => {
      const group = String.fromCharCode(65 + r) + (run.length > 1 ? String(n + 1) : "");
      return group === it.group ? it : { ...it, group };
    }),
  );
}

/** Joins an item to the block above it as a superset, or splits it out if it is already in one. */
export function toggleSuperset(workout: Workout, key: string): Workout {
  const i = workout.items.findIndex((it) => it.key === key);
  const item = workout.items[i];
  const above = workout.items[i - 1];
  if (!item || !above) return workout;
  const joined = above.group[0] === item.group[0];
  const items = workout.items.map((it, n) => {
    if (n === i) return { ...it, group: joined ? "#" : (above.group[0] as string) };
    // Items below that shared the old block stay together, under their own letter.
    if (joined && n > i && it.group[0] === item.group[0]) return { ...it, group: "%" };
    return it;
  });
  return { ...workout, items: relabelGroups(items) };
}

/** Drops a library exercise at a position in the list (what drag and drop does). Out-of-range positions clamp. */
export function insertExercise(workout: Workout, exercise: Exercise, index: number, key = newKey()): Workout {
  const added = addExercise(workout, exercise, key).items.at(-1) as WorkoutItem;
  const at = Math.max(0, Math.min(index, workout.items.length));
  const items = [...workout.items.slice(0, at), { ...added, group: "#" }, ...workout.items.slice(at)];
  return { ...workout, items: relabelGroups(items) };
}

/** Moves an item so it ends up before whatever is at `index` now (index = length moves it to the end). */
export function moveItem(workout: Workout, key: string, index: number): Workout {
  const from = workout.items.findIndex((it) => it.key === key);
  if (from < 0) return workout;
  const at = Math.max(0, Math.min(index, workout.items.length));
  const to = at > from ? at - 1 : at;
  if (to === from) return workout;
  const items = [...workout.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved as WorkoutItem);
  return { ...workout, items: relabelGroups(items) };
}

/** An exercise read from another source (a PDF, a sheet) before it becomes a workout item. */
export interface DraftItem {
  exerciseId: number;
  /** Block as written in the source: "A", or "B1"/"B2" for a superset. */
  group: string;
  sets: number;
  reps: string;
  kg: number;
  rpe: number | null;
  restSeconds: number | null;
}

/** Adds drafted items after the current ones as new blocks, keeping the source's supersets together. */
export function appendItems(workout: Workout, drafts: DraftItem[], keys: string[] = drafts.map(() => newKey())): Workout {
  const added: WorkoutItem[] = drafts.map((d, i) => ({
    key: keys[i] ?? newKey(),
    // Lower case can't clash with the existing blocks; relabelGroups gives them the next free letters.
    group: (d.group[0] ?? "a").toLowerCase() + d.group.slice(1),
    exerciseId: d.exerciseId,
    sets: d.sets || 3,
    reps: d.reps || "10",
    kg: d.kg,
    rpe: d.rpe ?? 7,
    restSeconds: d.restSeconds ?? defaultRestFor(exerciseById(d.exerciseId)),
    lastTime: "New exercise",
  }));
  return { ...workout, items: relabelGroups([...workout.items, ...added]) };
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
  id: "progress" | "short" | "beginner";
  title: string;
  note: string;
  apply: (w: Workout) => Workout;
  /** Why each item changed, by item key, when the adjustment can explain itself. */
  reasons?: (w: Workout) => Record<string, string>;
}

export const ADJUSTMENTS: Adjustment[] = [
  {
    id: "progress",
    title: "Progress next week",
    note: "Reads what the client logged last time: more load when every rep was hit at or under target RPE, a rep more inside a range, a 5% back-off after a grind.",
    apply: (w) => progressWorkout(w).workout,
    reasons: (w) => progressWorkout(w).reasons,
  },
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
