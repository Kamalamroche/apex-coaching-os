/* Reads a program written as text: what comes out of a PDF from another app, an email or a
   WhatsApp message. Understands lines such as
     "A1) Back Squat 4 x 6-8 @ 80kg RPE 8, rest 2 min"
     "Romanian deadlifts – 3 sets of 10"
     "Plank 3x40s"
   and headings such as "Week 2", "Day 1 – Upper" or "Monday". Every exercise name is matched
   against the library; the coach checks the matches before anything is saved. */

import { EXERCISES } from "./data/exercises";
import { matchExercise, type ExerciseMatch } from "./exerciseMatch";
import type { Exercise } from "./types";

export interface ParsedItem {
  /** 1-based line number in the text. */
  line: number;
  text: string;
  /** The exercise name as written. */
  name: string;
  /** "A", or "B1"/"B2" when the text marks a superset. Letters are filled in when it doesn't. */
  group: string;
  sets: number;
  /** "8", "6-8", "40s" or "AMRAP". */
  reps: string;
  /** 0 when no load is given. Pounds are converted. */
  kg: number;
  rpe: number | null;
  restSeconds: number | null;
  /** Best library match, null when nothing is close. */
  match: ExerciseMatch | null;
  candidates: ExerciseMatch[];
  /** True when the match can be used without the coach checking it. */
  confident: boolean;
}

export interface ParsedDay {
  /** The heading as written, or "Day 1" when the text has none. */
  title: string;
  week: number;
  /** 0 = Monday / Day 1 … 6. */
  dayIndex: number;
  items: ParsedItem[];
}

export interface ParsedProgram {
  /** A line such as "Strength block – Phase 1" before the first exercise, if there is one. */
  name: string | null;
  days: ParsedDay[];
  /** Lines that weren't understood, so the coach can see what was left out. */
  skipped: { line: number; text: string }[];
}

const LB_TO_KG = 0.45359237;
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const REPS = String.raw`(\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:s|sec|secs|seconds)?|amrap|max)`;
const SETS_X_REPS = new RegExp(String.raw`(\d{1,2})\s*(?:sets?\s*)?[x×*]\s*${REPS}(?:\s*reps?)?`, "i");
const SETS_OF_REPS = new RegExp(String.raw`(\d{1,2})\s*sets?\s*(?:of\s*)?${REPS}(?:\s*reps?)?`, "i");
const LOAD = /@?\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?|lb|lbs|pounds?)\b/i;
const BARE_LOAD = /@\s*(\d+(?:[.,]\d+)?)(?!\s*%)/;
const RPE = /\brpe\s*:?\s*(\d+(?:[.,]\d)?)/i;
const REST = /\brest\s*:?\s*(\d+(?:[.,]\d+)?)\s*(s|secs?|seconds|m|mins?|minutes|')?|(\d+(?:[.,]\d+)?)\s*(s|secs?|seconds|m|mins?|minutes|')\s*rest\b/i;
const GROUP = /^([A-Ha-h])(\d)?\s*[).:\-–]\s*/;
const BULLET = /^(?:[•·▪◦*\-–]|\d{1,2}[.)])\s*/;
const HEADING = /^(week\s*\d+|day\s*\d+|session\s*\d+|workout\s*[a-z0-9]+|(?:mon|tues|wednes|thurs|fri|satur|sun)day|upper|lower|push|pull|legs|full[\s-]?body|conditioning|arms|chest|back|shoulders)\b/i;
const PROGRAM_NAME = /\b(program|programme|plan|block|phase|cycle)\b/i;

const num = (s: string) => Number(s.replace(",", "."));

function restSeconds(text: string): number | null {
  const m = REST.exec(text);
  if (!m) return null;
  const value = num(m[1] ?? m[3] ?? "0");
  const unit = (m[2] ?? m[4] ?? "s").toLowerCase();
  return Math.round(unit.startsWith("m") || unit === "'" ? value * 60 : value);
}

function load(text: string): number {
  const m = LOAD.exec(text);
  if (m) {
    const v = num(m[1] ?? "0");
    return /^(lb|pound)/i.test(m[2] ?? "") ? Math.round(v * LB_TO_KG * 2) / 2 : v;
  }
  const bare = BARE_LOAD.exec(text);
  return bare ? num(bare[1] ?? "0") : 0;
}

const cleanReps = (r: string) => {
  const s = r.toLowerCase().replace(/\s+/g, "").replace("–", "-");
  if (s === "amrap" || s === "max") return s.toUpperCase();
  return s.replace(/(secs?|seconds)$/, "s");
};

const cleanName = (s: string) => s.replace(/[\s:|,–\-(@]+$/, "").replace(/^[\s:|,–\-)]+/, "").trim();

/** One line as a prescription, or null if it isn't one. */
function parseLine(raw: string, line: number, library: Exercise[]): ParsedItem | null {
  let text = raw.replace(BULLET, "");
  let group = "";
  const g = GROUP.exec(text);
  if (g) {
    group = `${g[1]!.toUpperCase()}${g[2] ?? ""}`;
    text = text.slice(g[0].length);
  }
  let sets: number;
  let reps: string;
  let name: string;
  const m = SETS_X_REPS.exec(text) ?? SETS_OF_REPS.exec(text);
  if (m) {
    sets = Number(m[1]);
    reps = cleanReps(m[2] ?? "");
    name = cleanName(text.slice(0, m.index));
    // "4x8 Back squat" puts the name after the numbers.
    if (!name) name = cleanName(text.slice(m.index + m[0].length).replace(LOAD, "").replace(RPE, "").replace(REST, "").replace(BARE_LOAD, ""));
  } else {
    // A table row from a PDF: "Back Squat   4   8   60kg".
    const t = /^(.*?[a-z].*?)\s+(\d{1,2})\s+(\d{1,3}(?:\s*[-–]\s*\d{1,3})?s?)\b/i.exec(text);
    if (!t) return null;
    name = cleanName(t[1] ?? "");
    const guess = matchExercise(name, library);
    if (!guess.best || guess.best.score < 0.6) return null;
    sets = Number(t[2]);
    reps = cleanReps(t[3] ?? "");
  }
  if (!name || sets < 1 || sets > 20) return null;
  const rpe = RPE.exec(text);
  const result = matchExercise(name, library);
  return {
    line, text: raw, name, group, sets, reps,
    kg: load(text),
    rpe: rpe ? Math.min(10, num(rpe[1] ?? "0")) : null,
    restSeconds: restSeconds(text),
    match: result.best, candidates: result.candidates, confident: result.confident,
  };
}

/** Letters for items the text didn't mark: A, B, C… after any the text did use. */
function fillGroups(items: ParsedItem[]): void {
  const used = new Set(items.filter((i) => i.group).map((i) => i.group[0]));
  let next = 0;
  for (const it of items) {
    if (it.group) continue;
    while (used.has(String.fromCharCode(65 + next))) next++;
    it.group = String.fromCharCode(65 + next);
    used.add(it.group);
  }
}

export function parseProgramText(text: string, library: Exercise[] = EXERCISES): ParsedProgram {
  const days: ParsedDay[] = [];
  const skipped: ParsedProgram["skipped"] = [];
  let name: string | null = null;
  let week = 1;
  let pendingTitle: string | null = null;
  let current: ParsedDay | null = null;

  const openDay = (title: string | null) => {
    const sameWeek = days.filter((d) => d.week === week);
    const dayWord = title ? DAYS.findIndex((d) => title.toLowerCase().startsWith(d)) : -1;
    const dayNo = title ? /^day\s*(\d+)/i.exec(title) : null;
    const dayIndex = dayWord >= 0 ? dayWord : dayNo ? Math.min(6, Math.max(0, Number(dayNo[1]) - 1)) : Math.min(6, sameWeek.length);
    current = { title: title ?? `Day ${sameWeek.length + 1}`, week, dayIndex, items: [] };
    days.push(current);
  };

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.replace(/\s+/g, " ").trim();
    if (!raw || /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(raw)) return;
    const item = parseLine(raw, i + 1, library);
    if (item) {
      if (!current || pendingTitle !== null) openDay(pendingTitle);
      pendingTitle = null;
      current!.items.push(item);
      return;
    }
    const wk = /^week\s*(\d+)\b(.*)$/i.exec(raw);
    if (wk) {
      week = Math.max(1, Number(wk[1]));
      current = null;
      const rest = cleanName(wk[2] ?? "");
      if (rest && HEADING.test(rest)) pendingTitle = rest;
      return;
    }
    if (raw.length <= 48 && HEADING.test(raw)) {
      pendingTitle = raw;
      return;
    }
    if (!name && days.length === 0 && raw.length <= 60 && PROGRAM_NAME.test(raw)) {
      name = raw;
      return;
    }
    skipped.push({ line: i + 1, text: raw });
  });

  for (const d of days) fillGroups(d.items);
  return { name, days, skipped };
}
