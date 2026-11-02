/* Row shapes from supabase/migrations and pure converters to and from the domain types.
   Kept here (no Supabase client) so they can be unit tested. */

import type { SessionSets } from "./session";
import type { BlockStyle, Message, PreviousSession, SetTarget, SessionLog, Workout, WorkoutItem, WorkoutSummary } from "./types";

export interface WorkoutRow {
  id: string;
  name: string;
  week: number;
  est_minutes: number | null;
}

export interface WorkoutItemRow {
  id: string;
  workout_id: string;
  position: number;
  group_label: string;
  exercise_id: number;
  sets: number;
  reps: string;
  load_kg: number | null;
  target_rpe: number | null;
  rest_seconds: number;
  /** Per-set targets. Missing until the program-builder migration has run. */
  set_plan?: SetTarget[] | null;
  block_style?: BlockStyle | null;
}

export interface LoggedSetRow {
  session_id: string;
  workout_item_id: string | null;
  exercise_id: number;
  set_index: number;
  load_kg: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
}

export interface SessionRow {
  id: string;
  finished_at: string | null;
  session_rpe: number | null;
  sets_completed: number | null;
  volume_kg: number | null;
  prs: number;
  started_at: string;
  note?: string | null;
  /** Added in 20261026000000_session_summary.sql; missing until that has run. */
  summary?: WorkoutSummary | null;
}

export interface PreviousSessionRow {
  started_at: string;
  finished_at: string;
  sets_completed: number | null;
  volume_kg: number | null;
  workouts: { name: string } | null;
}

export interface MessageRow {
  sender_id: string;
  body: string;
  created_at: string;
}

/** "67.5 kg × 5", "35 s" or "8 reps" from the client's most recent set of an exercise. */
export function formatLastTime(set: Pick<LoggedSetRow, "load_kg" | "reps" | "seconds" | "rpe"> | undefined): string {
  if (!set) return "First time";
  if (set.seconds) return `${set.seconds} s`;
  const rpe = set.rpe ? ` @ RPE ${Number(set.rpe)}` : "";
  if (set.load_kg) return `${Number(set.load_kg)} kg × ${set.reps ?? 0}${rpe}`;
  return `${set.reps ?? 0} reps${rpe}`;
}

/** Most recent set per exercise. Expects rows newest first. */
export function latestSetByExercise<T extends { exercise_id: number }>(rowsNewestFirst: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const r of rowsNewestFirst) if (!m.has(r.exercise_id)) m.set(r.exercise_id, r);
  return m;
}

export function toWorkout(
  row: WorkoutRow,
  items: WorkoutItemRow[],
  ofWeeks: number,
  lastSets: Map<number, Pick<LoggedSetRow, "load_kg" | "reps" | "seconds" | "rpe">> = new Map(),
): Workout {
  return {
    name: row.name,
    week: row.week,
    ofWeeks,
    minutes: row.est_minutes ?? 45,
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        key: r.id,
        group: r.group_label,
        exerciseId: Number(r.exercise_id),
        sets: r.sets,
        reps: r.reps,
        kg: Number(r.load_kg ?? 0),
        rpe: Number(r.target_rpe ?? 7),
        restSeconds: r.rest_seconds,
        lastTime: formatLastTime(lastSets.get(Number(r.exercise_id))),
        ...(r.set_plan?.length ? { setPlan: r.set_plan } : {}),
        ...(r.block_style ? { blockStyle: r.block_style } : {}),
      })),
  };
}

export const toItemRows = (workout: Workout, workoutId: string): WorkoutItemRow[] =>
  workout.items.map((it: WorkoutItem, position) => ({
    id: it.key,
    workout_id: workoutId,
    position,
    group_label: it.group,
    exercise_id: it.exerciseId,
    sets: it.sets,
    reps: it.reps,
    load_kg: it.kg || null,
    target_rpe: it.rpe || null,
    rest_seconds: it.restSeconds,
    set_plan: it.setPlan ?? null,
    block_style: it.blockStyle ?? null,
  }));

/** Completed sets only. A rep target such as "40s" is a hold, so its number goes to `seconds`.
    A distance ("1000m") has no column of its own yet, so its metres go to `reps`. */
export function toLoggedSetRows(sets: SessionSets, workout: Workout, sessionId: string): LoggedSetRow[] {
  return workout.items.flatMap((it) =>
    (sets[it.key] ?? []).flatMap((s, i) => {
      if (!s.done) return [];
      const n = Number(s.reps) || null;
      const isHold = it.reps.trim().endsWith("s");
      return [{
        session_id: sessionId,
        workout_item_id: it.key,
        exercise_id: it.exerciseId,
        set_index: i,
        load_kg: Number(s.kg) || null,
        reps: isHold ? null : n,
        seconds: isHold ? n : null,
        rpe: null,
      }];
    }),
  );
}

export function toSessionLog(row: SessionRow, workoutName: string): SessionLog | null {
  if (!row.finished_at) return null;
  const minutes = Math.max(1, Math.round((Date.parse(row.finished_at) - Date.parse(row.started_at)) / 60000));
  return {
    workoutName,
    sets: row.sets_completed ?? 0,
    volumeKg: Number(row.volume_kg ?? 0),
    minutes,
    rpe: Number(row.session_rpe ?? 0),
    prs: row.prs,
    ...(row.note ? { note: row.note } : {}),
    ...(row.summary ? { summary: row.summary } : {}),
  };
}

export const toPreviousSession = (row: PreviousSessionRow): PreviousSession => ({
  workoutName: row.workouts?.name ?? "Last session",
  sets: row.sets_completed ?? 0,
  volumeKg: Number(row.volume_kg ?? 0),
  minutes: Math.max(1, Math.round((Date.parse(row.finished_at) - Date.parse(row.started_at)) / 60000)),
});

/** Heaviest logged load per exercise. */
export function bestKgByExercise(rows: Pick<LoggedSetRow, "exercise_id" | "load_kg">[]): Record<number, number> {
  const best: Record<number, number> = {};
  for (const r of rows) {
    const kg = Number(r.load_kg ?? 0);
    const id = Number(r.exercise_id);
    if (kg > 0 && kg > (best[id] ?? 0)) best[id] = kg;
  }
  return best;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const toMessages = (rows: MessageRow[], coachId: string): Message[] =>
  rows.map((r) => ({ from: r.sender_id === coachId ? "coach" : "client", text: r.body, time: hhmm(r.created_at) }));
