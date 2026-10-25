import { EXERCISES } from "./data/exercises";
import type { Exercise } from "./types";

export function exerciseById(id: number): Exercise {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`Unknown exercise id ${id}`);
  return ex;
}

export interface ExerciseHit {
  exercise: Exercise;
  /** Set when the query matched an alias rather than the name, e.g. "rdl". */
  matchedAlias?: string;
}

/** Name, alias ("rdl"), movement pattern ("hinge") or equipment ("cable") search. */
export function searchExercises(query: string, limit = 6, library: Exercise[] = EXERCISES): ExerciseHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ExerciseHit[] = [];
  for (const exercise of library) {
    const inName = exercise.name.toLowerCase().includes(q);
    const alias = exercise.aliases.find((a) => a.includes(q));
    if (inName || alias || exercise.pattern.toLowerCase() === q || exercise.equipment.toLowerCase().includes(q)) {
      hits.push(!inName && alias ? { exercise, matchedAlias: alias } : { exercise });
    }
    if (hits.length === limit) break;
  }
  return hits;
}

/** Same movement pattern, different exercise: what the Swap sheet offers. */
export const alternativesFor = (exercise: Exercise, limit = 3, library: Exercise[] = EXERCISES): Exercise[] =>
  library.filter((e) => e.id !== exercise.id && e.pattern === exercise.pattern).slice(0, limit);
