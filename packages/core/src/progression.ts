/* Explainable progression: next week's prescription from what the client actually logged.
   Pure and rule-based so the coach sees one plain reason per exercise and decides. Nothing
   applies until the coach accepts it (it is shown as an AI suggestion diff). */

import { exerciseById } from "./library";
import type { Exercise, Workout, WorkoutItem } from "./types";

export interface LastSet {
  kg: number;
  reps: number;
  seconds: number;
  rpe: number | null;
}

/** Reads back what formatLastTime wrote: "67.5 kg × 5 @ RPE 7", "8 reps", "35 s". Null for "First time" or "New exercise". */
export function parseLastTime(text: string): LastSet | null {
  const secs = /^(\d+(?:\.\d+)?)\s*s$/.exec(text.trim());
  if (secs) return { kg: 0, reps: 0, seconds: Number(secs[1]), rpe: null };
  const m = /^(?:(\d+(?:\.\d+)?)\s*kg\s*×\s*)?(\d+)(?:\s*reps)?(?:\s*@\s*RPE\s*(\d+(?:\.\d+)?))?$/.exec(text.trim());
  if (!m) return null;
  return { kg: Number(m[1] ?? 0), reps: Number(m[2]), seconds: 0, rpe: m[3] ? Number(m[3]) : null };
}

/** Estimated one-rep max (Epley), counting reps left in the tank from RPE: 70 kg × 5 @ RPE 8 ≈ 93 kg. */
export function estimatedOneRepMax(set: LastSet | null): number | null {
  if (!set || !set.kg || !set.reps || set.reps > 15) return null;
  const reps = set.reps + (set.rpe ? Math.max(0, 10 - set.rpe) : 0);
  return Math.round(set.kg * (1 + reps / 30) * 2) / 2;
}

/** Smallest loadable jump: 2 kg on dumbbells and kettlebells, 2.5 kg otherwise. */
export const roundingStep = (exercise: Exercise): number => (/dumbbell|kettlebell/i.test(exercise.equipment) ? 2 : 2.5);

/** Rounds to what can actually be loaded: 2.5 kg steps on barbells and machines, 2 kg on dumbbells and kettlebells. */
export function roundLoad(kg: number, exercise: Exercise): number {
  const step = roundingStep(exercise);
  return Math.max(0, Math.round(kg / step) * step);
}

/** "75%" of the item's estimated 1RM, rounded to a loadable weight. Null when there is no history to work from. */
export function kgFromPercent(item: WorkoutItem, percent: number): number | null {
  const e1rm = estimatedOneRepMax(parseLastTime(item.lastTime));
  return e1rm ? roundLoad((e1rm * percent) / 100, exerciseById(item.exerciseId)) : null;
}

const loadStep = (ex: Exercise, kg: number): number => {
  if (/dumbbell|kettlebell/i.test(ex.equipment)) return 2;
  if (ex.pattern === "Isolation" || ex.pattern === "Core") return 1;
  return (ex.pattern === "Squat" || ex.pattern === "Hinge") && kg >= 60 ? 5 : 2.5;
};

/** "8-10" → [8, 10]; "5" → [5, 5]; holds and AMRAP → null. */
const repRange = (reps: string): [number, number] | null => {
  const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(reps.trim());
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
};

export interface Progression {
  workout: Workout;
  /** One plain-English reason per item key. */
  reasons: Record<string, string>;
}

/** Next week from last week's logged sets: add load when every rep was hit at or under the target RPE,
    add a rep inside a range, hold when it was a grind, back off 5% when reps fell well short. */
export function progressWorkout(workout: Workout): Progression {
  const reasons: Record<string, string> = {};
  const items = workout.items.map((it) => {
    const ex = exerciseById(it.exerciseId);
    const last = parseLastTime(it.lastTime);
    const hold = (why: string) => { reasons[it.key] = why; return it; };
    if (!last) return hold("No logged sets yet: keep as written");
    const target = it.rpe || 8;
    const rpe = last.rpe ?? target;

    if (last.seconds) {
      const goal = Number(/^(\d+)\s*s/.exec(it.reps)?.[1] ?? 0);
      if (goal && last.seconds >= goal) {
        reasons[it.key] = `Held ${last.seconds} s (target ${goal} s): +5 s`;
        return { ...it, reps: `${goal + 5}s` };
      }
      return hold(`Held ${last.seconds} s${goal ? ` of ${goal} s` : ""}: same again`);
    }

    const range = repRange(it.reps);
    if (!range) return hold("AMRAP or custom reps: keep as written");
    const [low, high] = range;
    if (!last.kg && !it.kg) {
      // Bodyweight: progress reps.
      if (last.reps >= high && rpe <= target) {
        reasons[it.key] = `${last.reps} reps at RPE ${rpe}: +1 rep`;
        return { ...it, reps: low === high ? String(high + 1) : `${low + 1}-${high + 1}` };
      }
      return hold(`${last.reps} reps at RPE ${rpe}: same again`);
    }
    // Progress from what was actually lifted, never below what the coach has already set.
    if (last.reps >= high && rpe <= target && last.kg) {
      const kg = Math.max(it.kg, roundLoad(last.kg + loadStep(ex, last.kg), ex));
      if (kg === it.kg) return hold(`${last.kg} kg × ${last.reps} at RPE ${rpe}: ${it.kg} kg already set is the next step`);
      reasons[it.key] = `${last.kg} kg × ${last.reps} at RPE ${rpe}, every rep hit: ${kg} kg (+${Math.round((kg - last.kg) * 10) / 10} kg)`;
      return { ...it, kg };
    }
    if ((last.reps <= low - 2 || rpe >= target + 1.5) && last.kg) {
      const kg = roundLoad(last.kg * 0.95, ex);
      reasons[it.key] = `${last.kg} kg × ${last.reps} at RPE ${rpe} was a grind: back off to ${kg} kg`;
      return { ...it, kg };
    }
    if (last.reps >= low && low < high) {
      return hold(`${last.reps} of ${high} reps: same load, aim for ${Math.min(high, last.reps + 1)}`);
    }
    return hold(`${last.kg} kg × ${last.reps} at RPE ${rpe}: same again until it moves well`);
  });
  return { workout: { ...workout, items }, reasons };
}
