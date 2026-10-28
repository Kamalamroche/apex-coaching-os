import { exerciseById } from "./library";
import type { SessionSets } from "./session";
import { completedSets, sessionVolume } from "./session";
import type { ExerciseTotal, MuscleWork, PersonalBest, SessionLog, TrainingHistory, Workout, WorkoutSummary } from "./types";

/* The post-workout summary: what the client sees when they finish and what their coach receives. */

/** Everyday things to picture a session's volume against, lightest first. Approximate weights in kg. */
export const FUN_WEIGHTS: { kg: number; one: string; many: string }[] = [
  { kg: 30, one: "a golden retriever", many: "golden retrievers" },
  { kg: 100, one: "a giant panda", many: "giant pandas" },
  { kg: 450, one: "a grand piano", many: "grand pianos" },
  { kg: 650, one: "a dairy cow", many: "dairy cows" },
  { kg: 1500, one: "a family car", many: "family cars" },
  { kg: 6000, one: "an African elephant", many: "African elephants" },
  { kg: 12000, one: "a double-decker bus", many: "double-decker buses" },
];

const amount = (n: number): string => (n < 10 ? String(Math.round(n * 10) / 10) : Math.round(n).toLocaleString("en-GB"));

/** "about 2.4 grand pianos": the heaviest thing that fits at least once. Null below the lightest. */
export function pictureWeight(kg: number): string | null {
  const thing = [...FUN_WEIGHTS].reverse().find((t) => kg >= t.kg);
  if (!thing) return null;
  const n = kg / thing.kg;
  return n < 1.05 ? `about ${thing.one}` : `about ${amount(n)} ${thing.many}`;
}

/** Sets per muscle over completed sets, most worked first. */
export function musclesWorked(workout: Workout, sets: SessionSets): MuscleWork[] {
  const count = new Map<string, number>();
  for (const it of workout.items) {
    const done = (sets[it.key] ?? []).filter((s) => s.done).length;
    if (!done) continue;
    for (const m of exerciseById(it.exerciseId).muscles) count.set(m, (count.get(m) ?? 0) + done);
  }
  return [...count].map(([muscle, n]) => ({ muscle, sets: n })).sort((a, b) => b.sets - a.sets);
}

/** Sets, reps (or seconds for holds) and top load per exercise, over completed sets, in workout order. */
export function exerciseTotals(workout: Workout, sets: SessionSets): ExerciseTotal[] {
  const totals = new Map<number, ExerciseTotal>();
  for (const it of workout.items) {
    const done = (sets[it.key] ?? []).filter((s) => s.done);
    if (!done.length) continue;
    const isHold = it.reps.trim().endsWith("s");
    const isDistance = /\d\s*m$/i.test(it.reps.trim());
    const t = totals.get(it.exerciseId) ?? { exerciseId: it.exerciseId, exercise: exerciseById(it.exerciseId).name, sets: 0, reps: 0, seconds: 0, topKg: 0, volumeKg: 0 };
    for (const s of done) {
      const n = Number(s.reps) || 0;
      t.sets += 1;
      if (isHold) t.seconds += n;
      else if (isDistance) t.metres = (t.metres ?? 0) + n;
      else {
        t.reps += n;
        t.volumeKg = (t.volumeKg ?? 0) + (Number(s.kg) || 0) * n;
      }
      t.topKg = Math.max(t.topKg, Number(s.kg) || 0);
    }
    totals.set(it.exerciseId, t);
  }
  return [...totals.values()];
}

/** "4 sets · 20 reps · top 72.5 kg · 1,405 kg lifted", "3 sets · 120 s" for a hold, "4 sets · 4,000 m" for a distance. */
export const describeExerciseTotal = (t: ExerciseTotal): string =>
  [`${t.sets} set${t.sets === 1 ? "" : "s"}`, t.reps ? `${t.reps} reps` : null, t.seconds ? `${t.seconds} s` : null, t.metres ? `${t.metres.toLocaleString("en-GB")} m` : null, t.topKg ? `top ${t.topKg} kg` : null, t.volumeKg ? `${t.volumeKg.toLocaleString("en-GB")} kg lifted` : null]
    .filter(Boolean)
    .join(" · ");

/** Exercises where a completed set beat the previous best load. One entry per exercise, heaviest set. */
export function personalBests(workout: Workout, sets: SessionSets, bestKg: Record<number, number>): PersonalBest[] {
  const top = new Map<number, number>();
  for (const it of workout.items) {
    if (!it.kg) continue;
    for (const s of sets[it.key] ?? []) {
      const kg = Number(s.kg) || 0;
      if (s.done && kg > (top.get(it.exerciseId) ?? 0)) top.set(it.exerciseId, kg);
    }
  }
  return [...top].flatMap(([exerciseId, kg]) => {
    const previousKg = bestKg[exerciseId];
    return previousKg !== undefined && kg > previousKg ? [{ exerciseId, exercise: exerciseById(exerciseId).name, kg, previousKg }] : [];
  });
}

function funLine(volumeKg: number, sets: number, minutes: number, diffKg: number | null): string {
  const picture = pictureWeight(volumeKg);
  const base = picture ? `You moved ${volumeKg.toLocaleString("en-GB")} kg today, ${picture}.` : `${sets} sets in ${minutes} minutes. Every rep counts.`;
  if (diffKg === null || !picture) return base;
  if (diffKg > 0) {
    const extra = pictureWeight(diffKg);
    return `${base} That's ${diffKg.toLocaleString("en-GB")} kg more than last time${extra ? `, ${extra} extra` : ""}.`;
  }
  if (diffKg < 0) return `${base} A little lighter than last time, and lighter days build stronger weeks.`;
  return `${base} Exactly matched last time. Consistency wins.`;
}

export function buildSummary(workout: Workout, sets: SessionSets, minutes: number, history: TrainingHistory): WorkoutSummary {
  const volumeKg = sessionVolume(sets);
  const count = completedSets(sets);
  const prev = history.previous;
  const vsLast = prev ? { volumeKg: volumeKg - prev.volumeKg, sets: count - prev.sets, minutes: minutes - prev.minutes } : null;
  const exercises = exerciseTotals(workout, sets);
  return {
    exercises,
    totalReps: exercises.reduce((n, e) => n + e.reps, 0),
    totalKg: volumeKg,
    muscles: musclesWorked(workout, sets),
    bests: personalBests(workout, sets, history.bestKg),
    vsLast,
    fun: funLine(volumeKg, count, minutes, vsLast?.volumeKg ?? null),
  };
}

/** After a session: this one becomes "last time" and its heaviest sets raise the bests. */
export function nextHistory(history: TrainingHistory, log: SessionLog, workout: Workout, sets: SessionSets): TrainingHistory {
  const bestKg = { ...history.bestKg };
  for (const it of workout.items) {
    for (const s of sets[it.key] ?? []) {
      const kg = Number(s.kg) || 0;
      if (s.done && kg > (bestKg[it.exerciseId] ?? 0)) bestKg[it.exerciseId] = kg;
    }
  }
  return { bestKg, previous: { workoutName: log.workoutName, sets: log.sets, volumeKg: log.volumeKg, minutes: log.minutes } };
}

const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-GB")}${unit}`;

/** The message the coach receives in the chat as soon as the client finishes. */
export function summaryMessage(log: SessionLog): string {
  const s = log.summary;
  const lines = [`✅ Finished ${log.workoutName}`, `${log.sets} sets · ${log.volumeKg.toLocaleString("en-GB")} kg · ${log.minutes} min · RPE ${log.rpe}`];
  if (s?.exercises?.length) {
    lines.push(`🔁 ${s.totalReps ?? 0} reps · ${(s.totalKg ?? log.volumeKg).toLocaleString("en-GB")} kg lifted in total`);
    for (const e of s.exercises) lines.push(`• ${e.exercise}: ${describeExerciseTotal(e)}`);
  }
  if (s?.muscles.length) lines.push(`💪 Worked: ${s.muscles.map((m) => m.muscle).join(", ")}`);
  for (const b of s?.bests ?? []) lines.push(`🏆 New best: ${b.exercise} ${b.kg} kg (was ${b.previousKg} kg)`);
  if (s?.vsLast) lines.push(`📈 vs last time: ${signed(s.vsLast.volumeKg, " kg")} · ${signed(s.vsLast.sets, " sets")}`);
  if (s?.fun) lines.push(s.fun);
  if (log.note?.trim()) lines.push(`📝 "${log.note.trim()}"`);
  return lines.join("\n");
}
