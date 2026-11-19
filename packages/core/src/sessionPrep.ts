/* Before-session card: what an in-person trainer needs in the 30 seconds before a client walks in.
   Pure: built from what APEX already holds. Watch-outs come first because they matter most. */

import { HEALTH_QUESTIONS } from "./lifestyle";
import { exerciseById } from "./library";
import type { PreviousSession, Workout } from "./types";

export interface PrepInput {
  name: string;
  workout: Workout | null;
  previous: PreviousSession | null;
  /** The client's intake: health answers (true = yes), detail, injuries and goal. Null when not filled in. */
  intake: { health: Record<string, boolean>; healthDetail: string; injuries: string; goal: string } | null;
  /** The coach's pinned private notes on this client. */
  pinned: string[];
  /** Why the health score is down, in plain words (Insight). */
  healthReasons: string[];
  /** The latest readiness score (0–100), when the client checked in before training. */
  readiness?: number | null;
}

export interface Prep {
  watch: string[];
  lastTime: string | null;
  plan: { title: string; lines: string[] } | null;
  goal: string | null;
}

const SHORT: Record<string, string> = {
  heart: "Heart condition or high blood pressure", chest: "Chest pain or tightness", dizzy: "Dizziness or fainting",
  condition: "Long-term condition", medication: "On prescribed medication", joints: "Bone, joint or muscle problem",
  pregnant: "Pregnant or recently gave birth", advised: "Doctor-advised exercise only",
};

export function sessionPrep(p: PrepInput): Prep {
  const watch: string[] = [];
  if (p.intake) {
    for (const q of HEALTH_QUESTIONS) if (p.intake.health[q.key]) watch.push(SHORT[q.key] ?? q.text);
    if (p.intake.healthDetail.trim()) watch.push(p.intake.healthDetail.trim());
    if (p.intake.injuries.trim()) watch.push(`Injuries: ${p.intake.injuries.trim()}`);
  }
  for (const n of p.pinned) if (n.trim()) watch.push(n.trim());
  if (p.readiness != null && p.readiness < 50) watch.push(`Low readiness last time (${p.readiness}/100): ask how they slept`);
  for (const r of p.healthReasons) watch.push(r);
  const lastTime = p.previous ? `${p.previous.workoutName}: ${p.previous.sets} sets, ${Math.round(p.previous.volumeKg).toLocaleString("en-GB")} kg moved in ${p.previous.minutes} min` : null;
  const plan = p.workout && p.workout.items.length
    ? { title: `${p.workout.name} · about ${p.workout.minutes} min`, lines: p.workout.items.map((i) => `${i.group} · ${exerciseById(i.exerciseId).name} · ${i.sets}×${i.reps}${i.kg ? ` at ${i.kg} kg` : ""}${i.note ? ` · ${i.note}` : ""}`) }
    : null;
  return { watch: [...new Set(watch)].slice(0, 8), lastTime, plan, goal: p.intake?.goal.trim() || null };
}
