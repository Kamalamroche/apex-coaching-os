/* Program Copilot: one typed instruction changes the whole program, shown as a diff the coach accepts.
     "swap barbell for dumbbells in weeks 3 and 4"   "deload week 4"
     "add a set to squats"   "replace bench press with push-ups from week 2"
     "add 2.5 kg to deadlifts"   "rest 90 s on everything"   "reps 8-10 on lateral raises in week 2"
   Rule-based, like progression.ts: it never guesses silently. If it can't read the instruction it
   says so and shows examples; if a swap has no good counterpart, that item is left alone and listed. */

import { fitPlan } from "./blocks";
import { EXERCISES } from "./data/exercises";
import { matchExercise, normaliseName } from "./exerciseMatch";
import { exerciseById } from "./library";
import { DAY_NAMES, sortDays } from "./program";
import { roundLoad } from "./progression";
import type { Exercise, Program, ProgramDay, WorkoutItem } from "./types";

export const COPILOT_EXAMPLES = [
  "Swap barbell for dumbbells in weeks 3 and 4",
  "Deload week 4",
  "Add a set to squats",
  "Replace bench press with push-ups from week 2",
  "Add 2.5 kg to deadlifts",
  "Rest 90 s on everything",
];

export interface Scope {
  weeks: number[] | null;
  fromWeek: number | null;
  dayIndex: number | null;
}

export type Action =
  | { kind: "swapEquipment"; from: string; to: string }
  | { kind: "swapExercise"; from: Exercise; to: Exercise }
  | { kind: "sets"; delta: number }
  | { kind: "load"; kg: number | null; percent: number | null }
  | { kind: "deload"; percent: number }
  | { kind: "rest"; seconds: number }
  | { kind: "reps"; reps: string };

export interface Command {
  action: Action;
  scope: Scope;
  /** Only these exercises; null means every exercise in scope. */
  target: Exercise | null;
  /** Plain description of what will happen, for the coach to confirm. */
  summary: string;
}

export interface CopilotChange {
  dayKey: string;
  day: string;
  before: WorkoutItem;
  after: WorkoutItem;
}

export interface CopilotResult {
  command: Command;
  program: Program;
  changes: CopilotChange[];
  /** Items in scope the instruction couldn't apply to, e.g. no dumbbell version of a movement. */
  skipped: { day: string; item: WorkoutItem; why: string }[];
}

const EQUIPMENT: Record<string, string> = {
  barbell: "Barbell", barbells: "Barbell", bar: "Barbell",
  dumbbell: "Dumbbell", dumbbells: "Dumbbell", db: "Dumbbell", dbs: "Dumbbell",
  kettlebell: "Kettlebell", kettlebells: "Kettlebell", kb: "Kettlebell", kbs: "Kettlebell",
  cable: "Cable", cables: "Cable", machine: "Machine", machines: "Machine",
  bodyweight: "Bodyweight", band: "Resistance band", bands: "Resistance band",
};
const EQUIP_WORD = Object.keys(EQUIPMENT).join("|");
const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };

/** Week and day words, removed from the text so they don't read as an exercise name. */
function readScope(text: string): { scope: Scope; rest: string } {
  let rest = text;
  let weeks: number[] | null = null;
  let fromWeek: number | null = null;
  let dayIndex: number | null = null;
  const take = (re: RegExp, f: (m: RegExpExecArray) => void) => {
    const m = re.exec(rest);
    if (m) { f(m); rest = rest.replace(m[0], " "); }
  };
  take(/\b(?:from|after|starting(?: in)?)\s+week\s+(\d+)(?:\s+on(?:wards)?)?/i, (m) => { fromWeek = Number(m[1]); });
  take(/\b(?:in|on|for|during)?\s*weeks?\s+(\d+)\s*(?:-|–|to|through)\s*(\d+)/i, (m) => {
    const a = Number(m[1]), b = Number(m[2]);
    weeks = Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
  });
  take(/\b(?:in|on|for|during)?\s*weeks?\s+((?:\d+\s*(?:,|and|&)?\s*)+)/i, (m) => { weeks = (m[1] ?? "").match(/\d+/g)?.map(Number) ?? null; });
  take(/\b(?:on|for)?\s*(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|mon|tue|wed|thu|fri|sat|sun)\b/i, (m) => {
    dayIndex = DAY_NAMES.findIndex((d) => (m[1] ?? "").toLowerCase().startsWith(d.toLowerCase()));
  });
  take(/\b(?:on|for|to)?\s*(?:everything|every exercise|all exercises|all|the whole program)\b/i, () => undefined);
  return { scope: { weeks, fromWeek, dayIndex }, rest: rest.replace(/\s+/g, " ").trim() };
}

/** "squats", "the bench", "deadlifts" → an exercise. The program's own exercises come first,
    so "squats" means the squat this client does, then the whole library. Null when nothing is close. */
function readNamed(name: string, inProgram: Exercise[]): Exercise | null {
  const clean = name.replace(/^(?:the|my|all|every)\s+/i, "").replace(/\b(\w{3,}[^s\W])s\b/gi, "$1").trim();
  if (!clean) return null;
  for (const pool of [inProgram, EXERCISES]) {
    const m = matchExercise(clean, pool);
    if (m.best && m.best.score >= 0.6) return m.best.exercise;
  }
  return null;
}

const scopeText = (s: Scope): string => {
  const parts: string[] = [];
  if (s.weeks?.length) parts.push(s.weeks.length === 1 ? `in week ${s.weeks[0]}` : `in weeks ${s.weeks.slice(0, -1).join(", ")} and ${s.weeks.at(-1)}`);
  if (s.fromWeek) parts.push(`from week ${s.fromWeek}`);
  if (s.dayIndex !== null) parts.push(`on ${DAY_NAMES[s.dayIndex]}`);
  return parts.length ? ` ${parts.join(" ")}` : " across the whole program";
};

/** Reads one instruction. Null when it isn't one Copilot knows. */
export function parseCommand(input: string, program?: Program): Command | null {
  const inProgram = [...new Set(program?.days.flatMap((d) => d.items.map((i) => i.exerciseId)) ?? [])].map(exerciseById);
  const readExercise = (name: string) => readNamed(name, inProgram);
  const { scope, rest } = readScope(input.trim().replace(/[.!]+$/, ""));
  const where = scopeText(scope);
  const num = (s: string | undefined) => (s ? WORD_NUM[s.toLowerCase()] ?? Number(s.replace(",", ".")) : 1);

  let m = new RegExp(String.raw`^(?:swap|replace|change|switch|move)\s+(?:all\s+|the\s+)?(${EQUIP_WORD})(?:\s+(?:work|exercises|lifts|movements))?\s+(?:for|with|to|into)\s+(${EQUIP_WORD})(?:\s+(?:work|exercises|lifts|movements|versions?))?$`, "i").exec(rest);
  if (m) {
    const from = EQUIPMENT[(m[1] ?? "").toLowerCase()] ?? "", to = EQUIPMENT[(m[2] ?? "").toLowerCase()] ?? "";
    return { action: { kind: "swapEquipment", from, to }, scope, target: null, summary: `Swap ${from.toLowerCase()} exercises for ${to.toLowerCase()} versions${where}` };
  }
  m = /^(?:swap|replace|change|switch)\s+(.+?)\s+(?:for|with|to|into)\s+(.+)$/i.exec(rest);
  if (m) {
    const from = readExercise(m[1] ?? ""), to = readExercise(m[2] ?? "");
    if (!from || !to) return null;
    return { action: { kind: "swapExercise", from, to }, scope, target: from, summary: `Replace ${from.name} with ${to.name}${where}` };
  }
  m = /^deload(?:\s+by\s+(\d+)\s*%)?(?:\s+(.+))?$/i.exec(rest);
  if (m) {
    const percent = m[1] ? Number(m[1]) : 10;
    const target = m[2] ? readExercise(m[2]) : null;
    if (m[2] && !target) return null;
    return { action: { kind: "deload", percent }, scope, target, summary: `Deload ${target ? target.name : "every loaded exercise"} by ${percent}%${where}` };
  }
  m = /^(add|remove|drop|take off)\s+(a|an|one|two|three|\d+)\s+sets?(?:\s+(?:to|from|on|off)\s+(.+))?$/i.exec(rest);
  if (m) {
    const n = num(m[2]) * (/^add/i.test(m[1] ?? "") ? 1 : -1);
    const target = m[3] ? readExercise(m[3]) : null;
    if (m[3] && !target) return null;
    return { action: { kind: "sets", delta: n }, scope, target, summary: `${n > 0 ? "Add" : "Remove"} ${Math.abs(n)} set${Math.abs(n) === 1 ? "" : "s"} ${n > 0 ? "to" : "from"} ${target ? target.name : "every exercise"}${where}` };
  }
  // "add 2.5 kg to deadlifts" or "increase deadlifts by 2.5 kg"
  m = /^(?:add|increase(?:\s+by)?|\+)\s*(\d+(?:[.,]\d+)?)\s*(kg|%)\s*(?:to|on|for)?\s*(.*)$/i.exec(rest);
  const by = m ? null : /^(?:increase|raise)\s+(.+?)\s+by\s+(\d+(?:[.,]\d+)?)\s*(kg|%)$/i.exec(rest);
  if (m || by) {
    const [amount, unit, name] = m ? [m[1], m[2], m[3]] : [by?.[2], by?.[3], by?.[1]];
    const v = num(amount);
    const target = name ? readExercise(name) : null;
    if (name && !target) return null;
    const pct = (unit ?? "").includes("%");
    return { action: { kind: "load", kg: pct ? null : v, percent: pct ? v : null }, scope, target, summary: `Add ${v}${pct ? "%" : " kg"} to ${target ? target.name : "every loaded exercise"}${where}` };
  }
  m = /^(?:set\s+)?rest(?:\s+to)?\s+(\d+(?:[.,]\d+)?)\s*(s|secs?|seconds|m|mins?|minutes)?(?:\s+(?:on|for)\s+(.+))?$/i.exec(rest);
  if (m) {
    const seconds = Math.round(num(m[1]) * (/^m/i.test(m[2] ?? "") ? 60 : 1));
    const target = m[3] ? readExercise(m[3]) : null;
    if (m[3] && !target) return null;
    return { action: { kind: "rest", seconds }, scope, target, summary: `Set rest to ${seconds} s on ${target ? target.name : "every exercise"}${where}` };
  }
  m = /^(?:set\s+|change\s+)?reps(?:\s+to)?\s+(\d+(?:\s*-\s*\d+)?|\d+s)(?:\s+(?:on|for)\s+(.+))?$/i.exec(rest);
  if (m) {
    const reps = (m[1] ?? "").replace(/\s+/g, "");
    const target = m[2] ? readExercise(m[2]) : null;
    if (m[2] && !target) return null;
    return { action: { kind: "reps", reps }, scope, target, summary: `Set reps to ${reps} on ${target ? target.name : "every exercise"}${where}` };
  }
  return null;
}

/** Hand-picked like-for-like swaps for the common barbell lifts, so the big moves always land well. */
const CURATED: Record<string, Record<number, number>> = {
  Dumbbell: { 1: 9, 2: 636, 3: 123, 5: 635, 6: 132, 16: 17, 100: 101, 112: 636, 120: 11, 122: 635, 128: 132, 139: 637 },
};

/** Types that aren't a like-for-like stand-in for a lift: a hold or a stretch never replaces a press. */
const NOT_A_SWAP = new Set(["Isometric", "Balance", "Stretching", "Mobility", "Yoga"]);

/** The closest version of a movement on other equipment. Curated pairs first; otherwise a close
    name match in the same body area and pattern. Null rather than a poor guess. */
export function counterpart(exercise: Exercise, equipment: string): Exercise | null {
  const picked = CURATED[equipment]?.[exercise.id];
  if (picked) return exerciseById(picked);
  const pool = EXERCISES.filter((e) => e.equipment === equipment && e.id !== exercise.id && (e.type === exercise.type || !NOT_A_SWAP.has(e.type)));
  const base = normaliseName(exercise.name).replace(new RegExp(`\\b(${EQUIP_WORD})\\b`, "gi"), "").trim();
  const tier = pool.filter((e) => e.pattern === exercise.pattern && e.category === exercise.category);
  const named = tier.length ? matchExercise(`${equipment} ${base}`, tier).best : null;
  return named && named.score >= 0.6 ? named.exercise : null;
}

const inScope = (d: ProgramDay, s: Scope) =>
  (!s.weeks || s.weeks.includes(d.week)) && (!s.fromWeek || d.week >= s.fromWeek) && (s.dayIndex === null || d.dayIndex === s.dayIndex);

/** Runs a command over the program. Nothing is saved: the coach sees the changes first. */
export function runCommand(program: Program, command: Command): CopilotResult {
  const { action, scope, target } = command;
  const changes: CopilotChange[] = [];
  const skipped: CopilotResult["skipped"] = [];
  const days = program.days.map((d): ProgramDay => {
    if (!inScope(d, scope)) return d;
    const label = `Week ${d.week} · ${DAY_NAMES[d.dayIndex]} · ${d.name}`;
    const items = d.items.map((it): WorkoutItem => {
      if (target && it.exerciseId !== target.id) return it;
      const ex = exerciseById(it.exerciseId);
      let next: WorkoutItem = it;
      switch (action.kind) {
        case "swapEquipment": {
          if (ex.equipment !== action.from) return it;
          const to = counterpart(ex, action.to);
          if (!to) { skipped.push({ day: label, item: it, why: `No ${action.to.toLowerCase()} version of ${ex.name} in the library` }); return it; }
          next = { ...it, exerciseId: to.id, kg: 0, lastTime: "New exercise", ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s, kg: 0 })) } : {}) };
          break;
        }
        case "swapExercise":
          next = { ...it, exerciseId: action.to.id, kg: action.to.equipment === ex.equipment ? it.kg : 0, lastTime: "New exercise" };
          break;
        case "sets": {
          const sets = Math.max(1, Math.min(20, it.sets + action.delta));
          next = { ...it, sets, ...(it.setPlan ? { setPlan: fitPlan(it.setPlan, sets) } : {}) };
          break;
        }
        case "deload":
        case "load": {
          if (!it.kg) return it;
          const factor = action.kind === "deload" ? 1 - action.percent / 100 : 1 + (action.percent ?? 0) / 100;
          const kg = (v: number) => roundLoad(action.kind === "load" && action.kg !== null ? v + action.kg : v * factor, ex);
          next = { ...it, kg: kg(it.kg), ...(it.setPlan ? { setPlan: it.setPlan.map((s) => ({ ...s, kg: s.kg ? kg(s.kg) : 0 })) } : {}) };
          break;
        }
        case "rest":
          next = { ...it, restSeconds: action.seconds };
          break;
        case "reps":
          next = { ...it, reps: action.reps };
          break;
      }
      if (JSON.stringify(next) !== JSON.stringify(it)) changes.push({ dayKey: d.key, day: label, before: it, after: next });
      return next;
    });
    return { ...d, items };
  });
  return { command, program: { ...program, days: sortDays(days) }, changes, skipped };
}
