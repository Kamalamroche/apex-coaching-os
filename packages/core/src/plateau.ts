/* Plateau alerts: an exercise whose estimated 1RM hasn't beaten its earlier best for three sessions.
   Pure and rule-based, like progression.ts, so the coach sees the numbers behind every alert.
   Suggestions change nothing until the coach picks one. */

import { alternativesFor, exerciseById } from "./library";
import { daysInWeek } from "./program";
import { estimatedOneRepMax, roundLoad } from "./progression";
import type { Exercise, Program, Workout, WorkoutItem } from "./types";

/** Best estimated 1RM per session for each exercise, oldest session first. */
export type StrengthTrend = Record<number, number[]>;

/** How many sessions in a row without a new best count as a plateau. */
export const PLATEAU_SESSIONS = 3;
/** Sessions kept per exercise: enough to see a plateau and the best before it. */
const KEEP = 8;
/** A new best has to beat the old one by more than this, so 0.5 kg of rounding isn't progress. */
const MARGIN = 0.005;

interface SetRow {
  session_id: string;
  exercise_id: number;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
}

/** Builds the trend from logged sets, newest first (as the stores query them). Sessions in `skip` (lighter days) are left out. */
export function trendFromSets(rowsNewestFirst: SetRow[], skip: ReadonlySet<string> = new Set()): StrengthTrend {
  const order: string[] = [];
  const best = new Map<string, number>();
  for (const r of rowsNewestFirst) {
    if (skip.has(r.session_id)) continue;
    const e1rm = estimatedOneRepMax({ kg: r.load_kg ?? 0, reps: r.reps ?? 0, seconds: 0, rpe: r.rpe });
    if (!e1rm) continue;
    const k = `${r.exercise_id}:${r.session_id}`;
    if (!best.has(k)) order.push(k);
    best.set(k, Math.max(best.get(k) ?? 0, e1rm));
  }
  const trend: StrengthTrend = {};
  for (const k of order.reverse()) {
    const id = Number(k.split(":")[0]);
    (trend[id] ??= []).push(best.get(k) ?? 0);
  }
  for (const id of Object.keys(trend)) trend[Number(id)] = (trend[Number(id)] ?? []).slice(-KEEP);
  return trend;
}

/** Adds one finished session's best estimated 1RM per exercise to the trend. */
export function addSessionToTrend(trend: StrengthTrend, bests: Record<number, number>): StrengthTrend {
  const next: StrengthTrend = { ...trend };
  for (const [id, e1rm] of Object.entries(bests)) next[Number(id)] = [...(trend[Number(id)] ?? []), e1rm].slice(-KEEP);
  return next;
}

export interface Plateau {
  item: WorkoutItem;
  exercise: Exercise;
  /** Best estimated 1RM before the stall. */
  bestKg: number;
  /** Estimated 1RMs of the stalled sessions, oldest first. */
  recentKg: number[];
  reason: string;
  /** Deload: same exercise, 10% lighter for a week. */
  deload: Partial<WorkoutItem>;
  /** Swap: same movement pattern, different exercise. */
  swaps: Exercise[];
}

/** True when the last PLATEAU_SESSIONS sessions didn't beat the best that came before them. */
export function isStalled(series: number[]): { bestKg: number; recentKg: number[] } | null {
  if (series.length < PLATEAU_SESSIONS) return null;
  // With only three sessions, the first is the mark to beat.
  const recent = series.length > PLATEAU_SESSIONS ? series.slice(-PLATEAU_SESSIONS) : series.slice(1);
  const before = series.slice(0, series.length - recent.length);
  const bestKg = Math.max(...before);
  return Math.max(...recent) <= bestKg * (1 + MARGIN) ? { bestKg, recentKg: recent } : null;
}

/** Stalled exercises in this workout, in workout order. */
export function findPlateaus(workout: Workout, trend: StrengthTrend | undefined): Plateau[] {
  if (!trend) return [];
  const seen = new Set<number>();
  return workout.items.flatMap((item): Plateau[] => {
    if (seen.has(item.exerciseId)) return [];
    seen.add(item.exerciseId);
    const stall = isStalled(trend[item.exerciseId] ?? []);
    if (!stall) return [];
    const exercise = exerciseById(item.exerciseId);
    const n = stall.recentKg.length;
    return [{
      item, exercise, ...stall,
      reason: `No new best in ${n} sessions: estimated 1RM ${stall.recentKg.join(", ")} kg against a best of ${stall.bestKg} kg.`,
      deload: { kg: item.kg ? roundLoad(item.kg * 0.9, exercise) : item.kg },
      swaps: alternativesFor(exercise, 3),
    }];
  });
}

/** Plateaus across one week of a program, so a stall on any training day shows up. */
export const programPlateaus = (program: Program, week: number, trend: StrengthTrend | undefined): Plateau[] =>
  findPlateaus({ name: program.name, week, ofWeeks: program.weeks, minutes: 0, items: daysInWeek(program, week).flatMap((d) => d.items) }, trend);

export type PlateauFix = { kind: "deload" } | { kind: "swap"; to: number };

/** Applies the fix the coach picked. A deload lightens this week only (10%, loadable);
    a swap replaces the exercise from this week on, keeping sets, reps and rest. Earlier weeks stay as history. */
export function applyPlateauFix(program: Program, week: number, exerciseId: number, fix: PlateauFix): Program {
  const exercise = exerciseById(exerciseId);
  return {
    ...program,
    days: program.days.map((d) => {
      const inScope = fix.kind === "deload" ? d.week === week : d.week >= week;
      if (!inScope || !d.items.some((it) => it.exerciseId === exerciseId)) return d;
      return {
        ...d,
        items: d.items.map((it) => {
          if (it.exerciseId !== exerciseId) return it;
          if (fix.kind === "deload") return { ...it, kg: it.kg ? roundLoad(it.kg * 0.9, exercise) : it.kg, ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s, kg: s.kg ? roundLoad(s.kg * 0.9, exercise) : s.kg })) } : {}) };
          return { ...it, exerciseId: fix.to, lastTime: "New exercise", kg: 0, ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s, kg: 0 })) } : {}) };
        }),
      };
    }),
  };
}
