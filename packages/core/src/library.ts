import { EXERCISES } from "./data/exercises";
import type { BodyArea, Exercise, TrainingType } from "./types";

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

/* One exercise against a lower-cased query: name, alias, pattern ("hinge"), type ("yoga") or equipment ("cable"). */
function match(exercise: Exercise, q: string): ExerciseHit | null {
  const inName = exercise.name.toLowerCase().includes(q);
  const alias = exercise.aliases.find((a) => a.includes(q));
  if (inName || alias || exercise.pattern.toLowerCase() === q || exercise.type.toLowerCase() === q || exercise.equipment.toLowerCase().includes(q)) {
    return !inName && alias ? { exercise, matchedAlias: alias } : { exercise };
  }
  return null;
}

/** Name, alias ("rdl"), movement pattern ("hinge"), type ("yoga") or equipment ("cable") search. */
export function searchExercises(query: string, limit = 6, library: Exercise[] = EXERCISES): ExerciseHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ExerciseHit[] = [];
  for (const exercise of library) {
    const hit = match(exercise, q);
    if (hit) hits.push(hit);
    if (hits.length === limit) break;
  }
  return hits;
}

export interface LibraryFilter {
  query?: string;
  area?: BodyArea | "All";
  type?: TrainingType | "All";
}

/** The library screen: body area and type filters, plus a search that also covers muscles ("glutes"). */
export function filterLibrary({ query = "", area = "All", type = "All" }: LibraryFilter, library: Exercise[] = EXERCISES): Exercise[] {
  const q = query.trim().toLowerCase();
  return library.filter(
    (e) =>
      (area === "All" || e.category === area) &&
      (type === "All" || e.type === type) &&
      (!q || match(e, q) !== null || e.muscles.some((m) => m.toLowerCase().includes(q))),
  );
}

/** Same movement pattern, different exercise: what the Swap sheet offers. Same body area first. */
export const alternativesFor = (exercise: Exercise, limit = 3, library: Exercise[] = EXERCISES): Exercise[] =>
  library
    .filter((e) => e.id !== exercise.id && e.pattern === exercise.pattern)
    .sort((a, b) => Number(b.category === exercise.category) - Number(a.category === exercise.category))
    .slice(0, limit);
