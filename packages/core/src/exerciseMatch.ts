/* Matches an exercise name written in another app, a spreadsheet or a PDF ("DB bench",
   "Back squats", "RDL") to the APEX library. The coach confirms anything that isn't a
   confident match before it is saved. */

import { EXERCISES } from "./data/exercises";
import type { Exercise } from "./types";

export interface ExerciseMatch {
  exercise: Exercise;
  /** 0 to 1. 1 is an exact name match, 0.95 an exact alias. */
  score: number;
}

export interface MatchResult {
  /** Best guess, null when nothing is close. */
  best: ExerciseMatch | null;
  /** Up to five options for the coach to pick from, best first. */
  candidates: ExerciseMatch[];
  /** True when the best guess can be used without asking the coach. */
  confident: boolean;
}

const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell", dbs: "dumbbell", bb: "barbell", kb: "kettlebell", kbs: "kettlebell", sa: "single arm", sl: "single leg",
  rdl: "romanian deadlift", rdls: "romanian deadlift", ohp: "overhead press", bss: "bulgarian split squat", dl: "deadlift",
  pullup: "pull up", pullups: "pull up", chinup: "chin up", chinups: "chin up", pushup: "push up", pushups: "push up",
  pulldown: "pulldown", situp: "sit up", situps: "sit up", tri: "triceps", bi: "biceps", ext: "extension", lat: "lat",
};

const EQUIPMENT_WORDS = new Set(["barbell", "dumbbell", "kettlebell", "cable", "machine", "band", "smith", "trap", "landmine", "bodyweight", "ez"]);

/** "DB Bench Press (flat)" → "dumbbell bench press flat". UK "press-up" reads as push-up. */
export function normaliseName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/press[\s-]?ups?/g, "push up")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w)
    .join(" ")
    .split(" ")
    .map((w) => (w.length >= 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w));
  return words.join(" ");
}

interface Indexed {
  exercise: Exercise;
  /** Normalised name first, then aliases. */
  names: string[];
  tokens: Set<string>[];
}

const cache = new WeakMap<Exercise[], Indexed[]>();
function index(library: Exercise[]): Indexed[] {
  let idx = cache.get(library);
  if (!idx) {
    idx = library.map((exercise) => {
      const names = [exercise.name, ...exercise.aliases].map(normaliseName);
      return { exercise, names, tokens: names.map((n) => new Set(n.split(" "))) };
    });
    cache.set(library, idx);
  }
  return idx;
}

const dice = (a: Set<string>, b: Set<string>) => {
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return (2 * common) / (a.size + b.size);
};

export function matchExercise(name: string, library: Exercise[] = EXERCISES): MatchResult {
  const q = normaliseName(name);
  if (!q) return { best: null, candidates: [], confident: false };
  const qTokens = new Set(q.split(" "));
  const saysEquipment = [...qTokens].some((t) => EQUIPMENT_WORDS.has(t));
  const scored: ExerciseMatch[] = [];
  for (const { exercise, names, tokens } of index(library)) {
    // The exact name beats an exact alias, so "RDL" picks Romanian Deadlift over a variation that also lists it.
    if (names[0] === q || names.includes(q)) {
      scored.push({ exercise, score: names[0] === q ? 1 : 0.95 });
      continue;
    }
    let score = Math.max(...tokens.map((t) => dice(qTokens, t)));
    // "Bench press" in a gym means the barbell one unless the coach says otherwise.
    if (score > 0 && !saysEquipment && normaliseName(exercise.name).startsWith("barbell ")) score = Math.min(0.99, score + 0.1);
    if (score >= 0.4) scored.push({ exercise, score: Math.round(score * 100) / 100 });
  }
  // Ties go to the shorter, more standard name.
  scored.sort((a, b) => b.score - a.score || a.exercise.name.length - b.exercise.name.length);
  const candidates = scored.slice(0, 5);
  const [best, second] = candidates;
  if (!best) return { best: null, candidates, confident: false };
  const margin = best.score - (second?.score ?? 0);
  const confident = (best.score === 1 && margin > 0) || (best.score >= 0.85 && margin >= 0.095);
  return { best, candidates, confident };
}
