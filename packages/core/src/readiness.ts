/* Readiness: four taps before a session (sleep, energy, soreness, stress) become a 0–100 score.
   Rule-based like plateau.ts, so the client and coach can see why. On a low day the client is offered
   a lighter version of today's session; the coach's program never changes. */

import { exerciseFor } from "./workout";
import { roundLoad, roundingStep } from "./progression";
import type { Workout, WorkoutItem } from "./types";

/** Each answer is 1–5, where 5 is always the good end (slept well, full of energy, fresh, calm). */
export interface ReadinessAnswers {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
}

export type ReadinessBand = "ready" | "steady" | "low";

export interface Readiness extends ReadinessAnswers {
  score: number;
  band: ReadinessBand;
  /** True when the client chose the lighter session. */
  adjusted: boolean;
}

export const READINESS_QUESTIONS: { key: keyof ReadinessAnswers; label: string; low: string; high: string }[] = [
  { key: "sleep", label: "Sleep", low: "Poor", high: "Great" },
  { key: "energy", label: "Energy", low: "Flat", high: "Raring to go" },
  { key: "soreness", label: "Soreness", low: "Very sore", high: "Fresh" },
  { key: "stress", label: "Stress", low: "Frazzled", high: "Calm" },
];

/** Score at or above this: train as planned. */
export const READY_FROM = 70;
/** Below this: the lighter session drops a set as well. */
export const LOW_BELOW = 45;

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

/** 4 answers of 1–5 → 0–100. All 1s is 0, all 5s is 100. */
export function readinessScore(a: ReadinessAnswers): number {
  const sum = clamp(a.sleep) + clamp(a.energy) + clamp(a.soreness) + clamp(a.stress);
  return Math.round(((sum - 4) / 16) * 100);
}

export const readinessBand = (score: number): ReadinessBand => (score >= READY_FROM ? "ready" : score >= LOW_BELOW ? "steady" : "low");

export const BAND_LABEL: Record<ReadinessBand, string> = { ready: "Ready", steady: "Steady", low: "Low" };

export function readinessOf(a: ReadinessAnswers, adjusted = false): Readiness {
  const score = readinessScore(a);
  return { ...a, score, band: readinessBand(score), adjusted };
}

/** The answers pulling the score down (2 or lower), worst first, e.g. ["sleep", "soreness"]. */
export function weakSpots(a: ReadinessAnswers): (keyof ReadinessAnswers)[] {
  return READINESS_QUESTIONS.map((q) => q.key)
    .filter((k) => clamp(a[k]) <= 2)
    .sort((x, y) => clamp(a[x]) - clamp(a[y]));
}

/** What the lighter session does, per band. Ready days get nothing. */
export const LIGHTER_RULES: Record<Exclude<ReadinessBand, "ready">, { loadPct: number; dropSet: boolean; rpeDrop: number }> = {
  steady: { loadPct: 5, dropSet: false, rpeDrop: 1 },
  low: { loadPct: 10, dropSet: true, rpeDrop: 1 },
};

export function describeLighter(band: Exclude<ReadinessBand, "ready">): string {
  const r = LIGHTER_RULES[band];
  return [`${r.loadPct}% less weight`, r.dropSet ? "one set fewer on exercises with 3 or more" : null, `target RPE ${r.rpeDrop} lower`].filter(Boolean).join(", ");
}

/** One-line reason, e.g. "Readiness 38/100: sleep and soreness are low today." */
export function readinessReason(r: Readiness): string {
  const weak = weakSpots(r).map((k) => READINESS_QUESTIONS.find((q) => q.key === k)?.label.toLowerCase() ?? k);
  const why = weak.length ? `${weak.length > 1 ? `${weak.slice(0, -1).join(", ")} and ${weak.at(-1)} are` : `${weak[0]} is`} low today` : "a bit below your usual";
  return r.band === "ready" ? `Readiness ${r.score}/100: good to go.` : `Readiness ${r.score}/100: ${why}.`;
}

function lighterItem(it: WorkoutItem, band: Exclude<ReadinessBand, "ready">): WorkoutItem {
  const r = LIGHTER_RULES[band];
  const ex = exerciseFor(it);
  // Light loads can round back up to the same weight; then go one step down so the day really is lighter.
  const kg = (n: number) => {
    if (!n) return n;
    const down = roundLoad(n * (1 - r.loadPct / 100), ex);
    return down < n ? down : Math.max(0, n - roundingStep(ex));
  };
  const sets = r.dropSet && it.sets >= 3 ? it.sets - 1 : it.sets;
  return {
    ...it,
    sets,
    kg: kg(it.kg),
    rpe: Math.max(5, it.rpe - r.rpeDrop),
    ...(it.setPlan ? { setPlan: it.setPlan.slice(0, sets).map((s) => ({ ...s, kg: kg(s.kg) })) } : {}),
  };
}

/** Today's session, lighter. Same exercises and order, so the coach can compare like for like. */
export function lighterSession(workout: Workout, band: ReadinessBand): Workout {
  if (band === "ready") return workout;
  return { ...workout, items: workout.items.map((it) => lighterItem(it, band)) };
}
