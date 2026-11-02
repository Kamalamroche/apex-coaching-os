/* Moving a coach's clients in and out of APEX.

   The APEX transfer format is four plain tables that open in Google Sheets or Excel:
     clients    one row per client
     program    one row per prescribed exercise (client, week, day, workout, exercise, sets, reps…)
     history    one row per logged set (client, date, exercise, kg, reps…)
     check-ins  one row per check-in (client, date, body weight, energy, mood, sleep)
   Import reads these, or exports from other apps with similar columns: headers are matched
   loosely ("Exercise name", "Load (lb)", "Athlete"), pounds are converted and UK dates read.
   Export writes the same tables, so a coach can leave with everything and bring it back. */

import { matchExercise, type MatchResult } from "./exerciseMatch";
import { EXERCISES } from "./data/exercises";
import type { ParsedProgram } from "./programText";
import type { Exercise } from "./types";

export type TableKind = "clients" | "program" | "history" | "checkins";
export type DbTrainingMode = "online" | "hybrid" | "in_person";

export interface SourceTable {
  /** File or sheet name, used in problem messages. */
  name: string;
  /** First row is the headers. */
  rows: string[][];
}

export interface ImportItem {
  group: string;
  /** As written; resolved to a library exercise before saving. */
  exercise: string;
  sets: number;
  reps: string;
  kg: number;
  rpe: number | null;
  restSeconds: number;
  notes: string;
}

export interface ImportWorkout {
  name: string;
  week: number;
  dayIndex: number;
  items: ImportItem[];
}

export interface ImportProgram {
  name: string;
  workouts: ImportWorkout[];
}

export interface ImportSet {
  exercise: string;
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
}

export interface ImportSession {
  /** YYYY-MM-DD */
  date: string;
  workoutName: string;
  minutes: number;
  rpe: number | null;
  note: string;
  sets: ImportSet[];
}

export interface ImportCheckIn {
  date: string;
  weightKg: number | null;
  energy: number | null;
  mood: number | null;
  sleepHours: number | null;
  note: string;
}

export interface ImportClient {
  name: string;
  email: string;
  goal: string;
  mode: DbTrainingMode;
  notes: string;
  program: ImportProgram | null;
  sessions: ImportSession[];
  checkIns: ImportCheckIn[];
}

export interface ImportBundle {
  clients: ImportClient[];
  /** What each table was read as. Kind is null when the columns weren't recognised. */
  tables: { name: string; kind: TableKind | null; rows: number }[];
  /** Rows that were left out, and why. */
  problems: string[];
}

/* ───────────── headers ───────────── */

type Field =
  | "client" | "email" | "goal" | "mode" | "notes" | "program" | "week" | "day" | "workout" | "group" | "exercise"
  | "sets" | "set" | "reps" | "weight" | "rpe" | "sessionRpe" | "rest" | "date" | "seconds" | "minutes"
  | "bodyweight" | "energy" | "mood" | "sleep";

const ALIASES: Record<Field, string[]> = {
  client: ["client", "clientname", "name", "fullname", "athlete", "athletename", "member", "customer", "trainee"],
  email: ["email", "emailaddress", "clientemail"],
  goal: ["goal", "goals", "objective"],
  mode: ["trainingmode", "mode", "coachingtype", "service"],
  notes: ["notes", "note", "comments", "comment", "coachnotes", "instructions"],
  program: ["program", "programme", "programname", "plan", "planname", "phase"],
  week: ["week", "weekno", "weeknumber"],
  day: ["day", "dayofweek", "dayno", "daynumber", "trainingday"],
  workout: ["workout", "workoutname", "session", "sessionname", "routine"],
  group: ["group", "block", "superset", "order", "label"],
  exercise: ["exercise", "exercisename", "movement", "lift", "exercisetitle"],
  sets: ["sets", "setcount", "numberofsets", "targetsets"],
  set: ["set", "setno", "setnumber", "setindex"],
  reps: ["reps", "rep", "repetitions", "targetreps", "repsperset"],
  weight: ["weight", "load", "kg", "lb", "lbs", "targetweight", "weightlifted"],
  rpe: ["rpe", "setrpe", "targetrpe", "effort"],
  sessionRpe: ["sessionrpe", "workoutrpe"],
  rest: ["rest", "resttime", "restseconds", "restsec", "restperiod"],
  date: ["date", "sessiondate", "completed", "completedat", "completedon", "loggedat", "submitted", "submittedat", "checkindate", "startdate", "joined"],
  seconds: ["seconds", "secs", "hold", "holdtime"],
  minutes: ["minutes", "duration", "durationmin", "durationminutes", "workoutminutes", "mins"],
  bodyweight: ["bodyweight", "bodyweightkg", "bodyweightlb", "weighin", "scaleweight"],
  energy: ["energy", "energylevel"],
  mood: ["mood"],
  sleep: ["sleep", "sleephours", "hoursofsleep", "hourssleep"],
};

const headerKey = (h: string) => h.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z]/g, "");
const inPounds = (h: string) => /\b(lbs?|pounds?)\b/i.test(h);

interface Columns {
  index: Partial<Record<Field, number>>;
  /** Columns whose header says pounds. */
  pounds: Set<number>;
}

function columnsOf(headers: string[]): Columns {
  const index: Columns["index"] = {};
  const pounds = new Set<number>();
  headers.forEach((h, i) => {
    if (inPounds(h)) pounds.add(i);
    const key = headerKey(h);
    for (const [field, aliases] of Object.entries(ALIASES) as [Field, string[]][]) {
      if (index[field] === undefined && aliases.includes(key)) {
        index[field] = i;
        return;
      }
    }
  });
  return { index, pounds };
}

/** What a table holds, from its headers. */
export function detectKind(headers: string[]): TableKind | null {
  const { index } = columnsOf(headers);
  const has = (f: Field) => index[f] !== undefined;
  if (has("exercise")) return has("date") ? "history" : "program";
  if (has("date") && (has("weight") || has("bodyweight") || has("energy") || has("mood") || has("sleep"))) return "checkins";
  if (has("client") || has("email")) return "clients";
  return null;
}

/** Whether a table says whose rows they are. Without it the coach names the client. */
export const hasClientColumn = (headers: string[]): boolean => columnsOf(headers).index.client !== undefined;

/* ───────────── values ───────────── */

const LB_TO_KG = 0.45359237;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A number from "60", "60,5", "60 kg" or "135 lb" (converted). Null when there isn't one. */
export function parseKg(value: string, poundsColumn = false): number | null {
  const m = /(-?\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  const lb = m[2] ? /^lb/i.test(m[2]) : poundsColumn;
  return lb ? Math.round(n * LB_TO_KG * 10) / 10 : n;
}

const parseNum = (value: string): number | null => {
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(value);
  return m ? Number(m[1]!.replace(",", ".")) : null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** "2026-10-01", UK "01/10/2026", "1 Oct 2026", "Oct 1, 2026" or an Excel day number → "2026-10-01". */
export function parseDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) {
    let [d, mo] = [Number(m[1]), Number(m[2])];
    // Day first (UK) unless that can't be right.
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return ymd(y, mo, d);
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i.exec(v) ?? null;
  if (m) {
    const mo = MONTHS.indexOf(m[2]!.toLowerCase()) + 1;
    return mo ? ymd(Number(m[3]), mo, Number(m[1])) : null;
  }
  m = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i.exec(v);
  if (m) {
    const mo = MONTHS.indexOf(m[1]!.toLowerCase()) + 1;
    return mo ? ymd(Number(m[3]), mo, Number(m[2])) : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return null;
}

/** "Monday"/"Mon" → 0, "Day 3"/"3" → 2. Null when the text names no day. */
export function parseDayIndex(value: string): number | null {
  const v = value.trim().toLowerCase();
  const word = DAYS.findIndex((d) => v.startsWith(d));
  if (word >= 0) return word;
  const n = /(\d+)/.exec(v);
  return n ? Math.min(6, Math.max(0, Number(n[1]) - 1)) : null;
}

export function parseMode(value: string): DbTrainingMode {
  const v = value.toLowerCase();
  if (/hybrid|mixed|blend/.test(v)) return "hybrid";
  if (/in[\s-]?person|face|gym|studio|1:1|one[\s-]to[\s-]one|\bpt\b/.test(v)) return "in_person";
  return "online";
}

const repsText = (value: string): string => {
  const v = value.trim().toLowerCase().replace(/\s+/g, "").replace("–", "-");
  if (!v) return "10";
  if (/amrap|max/.test(v)) return "AMRAP";
  const hold = /^(\d+)(s|sec|secs|seconds)$/.exec(v);
  return hold ? `${hold[1]}s` : v.replace(/reps?$/, "");
};

/** "90", "90s", "2 min", "1:30" → seconds. */
export function parseRest(value: string): number | null {
  const v = value.trim();
  const mmss = /^(\d+):(\d{2})$/.exec(v);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = parseNum(v);
  if (n === null) return null;
  return Math.round(/\d\s*(m|mins?|minutes?)\b|'$/i.test(v) ? n * 60 : n);
}

/** "B1" stays; an order number such as "2" becomes "B"; blank takes the next letter. */
const groupLabel = (value: string, position: number) => {
  const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d+$/.test(v)) return String.fromCharCode(64 + Math.min(26, Math.max(1, Number(v))));
  return v.slice(0, 4) || String.fromCharCode(65 + Math.min(25, position));
};

/* ───────────── reading tables ───────────── */

export interface ReadOptions {
  /** Who the rows belong to when a table has no client column, e.g. a program from a PDF. */
  defaultClient?: string;
}

/** Reads every table into clients, matched by name (case and spacing don't matter). */
export function readTables(tables: SourceTable[], options: ReadOptions = {}): ImportBundle {
  const clients = new Map<string, ImportClient>();
  const problems: string[] = [];
  const read: ImportBundle["tables"] = [];

  const clientFor = (raw: string): ImportClient => {
    const name = raw.replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    let c = clients.get(key);
    if (!c) clients.set(key, (c = { name, email: "", goal: "", mode: "online", notes: "", program: null, sessions: [], checkIns: [] }));
    return c;
  };

  for (const table of tables) {
    const [headers = [], ...rows] = table.rows;
    if (headers.some((h) => headerKey(h) === "message")) {
      problems.push(`${table.name}: messages aren't imported. They stay in your export file.`);
      read.push({ name: table.name, kind: null, rows: rows.length });
      continue;
    }
    const kind = detectKind(headers);
    read.push({ name: table.name, kind, rows: rows.length });
    if (!kind) {
      problems.push(`${table.name}: couldn't tell what this table holds. It needs a column called Client, Exercise or Date (see the template).`);
      continue;
    }
    const { index, pounds } = columnsOf(headers);
    const cell = (row: string[], f: Field) => (index[f] === undefined ? "" : (row[index[f]!] ?? "").trim());
    const kg = (row: string[], f: Field) => (index[f] === undefined ? null : parseKg(cell(row, f), pounds.has(index[f]!)));

    rows.forEach((row, i) => {
      const where = `${table.name} row ${i + 2}`;
      const who = cell(row, "client") || (kind === "clients" ? "" : options.defaultClient ?? "");
      if (!who) {
        if (kind !== "clients" || cell(row, "email")) problems.push(`${where}: no client name`);
        return;
      }
      const client = clientFor(who);

      if (kind === "clients") {
        client.email ||= cell(row, "email");
        client.goal ||= cell(row, "goal");
        if (cell(row, "mode")) client.mode = parseMode(cell(row, "mode"));
        client.notes ||= cell(row, "notes");
        return;
      }

      if (kind === "checkins") {
        const date = parseDate(cell(row, "date"));
        if (!date) return void problems.push(`${where}: date "${cell(row, "date")}" not recognised`);
        const scale = (f: Field) => { const n = parseNum(cell(row, f)); return n === null ? null : Math.min(5, Math.max(1, Math.round(n))); };
        client.checkIns.push({
          date,
          weightKg: kg(row, index.bodyweight !== undefined ? "bodyweight" : "weight"),
          energy: scale("energy"),
          mood: scale("mood"),
          sleepHours: parseNum(cell(row, "sleep")),
          note: cell(row, "notes"),
        });
        return;
      }

      const exercise = cell(row, "exercise");
      if (!exercise) return void problems.push(`${where}: no exercise`);

      if (kind === "program") {
        const program = (client.program ??= { name: cell(row, "program") || "Imported program", workouts: [] });
        const week = Math.min(52, Math.max(1, parseNum(cell(row, "week")) ?? 1));
        const dayText = cell(row, "day");
        const workoutName = cell(row, "workout") || (dayText ? (/^\d+$/.test(dayText) ? `Day ${dayText}` : dayText) : "Workout");
        let workout = program.workouts.find((w) => w.week === week && w.name === workoutName);
        if (!workout) {
          const dayIndex = parseDayIndex(dayText) ?? Math.min(6, program.workouts.filter((w) => w.week === week).length);
          program.workouts.push((workout = { name: workoutName, week, dayIndex, items: [] }));
        }
        workout.items.push({
          group: groupLabel(cell(row, "group"), workout.items.length),
          exercise,
          sets: Math.min(20, Math.max(1, Math.round(parseNum(cell(row, "sets")) ?? 3))),
          reps: repsText(cell(row, "reps")),
          kg: kg(row, "weight") ?? 0,
          rpe: parseNum(cell(row, "rpe")),
          restSeconds: parseRest(cell(row, "rest")) ?? 90,
          notes: cell(row, "notes"),
        });
        return;
      }

      // history: one row per set, or one row per exercise with a Sets count.
      const date = parseDate(cell(row, "date"));
      if (!date) return void problems.push(`${where}: date "${cell(row, "date")}" not recognised`);
      const workoutName = cell(row, "workout") || "Imported session";
      const key = `${client.name}|${date}|${workoutName}`;
      let session = client.sessions.find((s) => `${client.name}|${s.date}|${s.workoutName}` === key);
      if (!session) client.sessions.push((session = { date, workoutName, minutes: 0, rpe: null, note: "", sets: [] }));
      session.minutes ||= parseNum(cell(row, "minutes")) ?? 0;
      session.rpe ??= parseNum(cell(row, "sessionRpe"));
      if (!session.note && cell(row, "notes")) session.note = cell(row, "notes");
      const reps = parseNum(cell(row, "reps"));
      const isHold = /s(ec)?$/i.test(cell(row, "reps"));
      const one: ImportSet = {
        exercise,
        kg: kg(row, "weight"),
        reps: isHold ? null : reps,
        seconds: isHold ? reps : parseNum(cell(row, "seconds")),
        rpe: parseNum(cell(row, "rpe")),
      };
      const count = index.set === undefined && index.sets !== undefined ? Math.min(20, Math.max(1, parseNum(cell(row, "sets")) ?? 1)) : 1;
      for (let n = 0; n < count; n++) session.sets.push({ ...one });
    });
  }

  const list = [...clients.values()];
  for (const c of list) c.sessions.sort((a, b) => a.date.localeCompare(b.date));
  return { clients: list, tables: read, problems };
}

/** A program read from PDF or pasted text, for one client. Only items with a library match are kept. */
export function programFromParsed(parsed: ParsedProgram, fallbackName: string): ImportProgram {
  return {
    name: parsed.name ?? fallbackName,
    workouts: parsed.days.map((d) => ({
      name: d.title,
      week: d.week,
      dayIndex: d.dayIndex,
      items: d.items.map((it) => ({
        group: it.group, exercise: it.name, sets: it.sets, reps: it.reps, kg: it.kg, rpe: it.rpe, restSeconds: it.restSeconds ?? 90, notes: "",
      })),
    })),
  };
}

/** Adds or merges a client, e.g. one whose program came from a PDF. */
export function mergeClient(bundle: ImportBundle, client: Partial<ImportClient> & { name: string }): ImportBundle {
  const key = client.name.trim().toLowerCase();
  const existing = bundle.clients.find((c) => c.name.toLowerCase() === key);
  if (existing) {
    const merged: ImportClient = { ...existing, program: client.program ?? existing.program, sessions: [...existing.sessions, ...(client.sessions ?? [])], checkIns: [...existing.checkIns, ...(client.checkIns ?? [])] };
    return { ...bundle, clients: bundle.clients.map((c) => (c === existing ? merged : c)) };
  }
  const fresh: ImportClient = { email: "", goal: "", mode: "online", notes: "", program: null, sessions: [], checkIns: [], ...client, name: client.name.trim() };
  return { ...bundle, clients: [...bundle.clients, fresh] };
}

/* ───────────── exercises ───────────── */

/** Every exercise name in the bundle, once each, in the order they first appear. */
export function exerciseNames(bundle: ImportBundle): string[] {
  const names = new Map<string, string>();
  const add = (n: string) => { const k = n.trim().toLowerCase(); if (!names.has(k)) names.set(k, n.trim()); };
  for (const c of bundle.clients) {
    c.program?.workouts.forEach((w) => w.items.forEach((i) => add(i.exercise)));
    c.sessions.forEach((s) => s.sets.forEach((x) => add(x.exercise)));
  }
  return [...names.values()];
}

/** The library match for each name. Confident matches are used as they are; the coach checks the rest. */
export function suggestMatches(names: string[], library: Exercise[] = EXERCISES): Record<string, MatchResult> {
  return Object.fromEntries(names.map((n) => [n.toLowerCase(), matchExercise(n, library)]));
}

/** Library id chosen for each lower-cased exercise name; null leaves that exercise out. */
export type ExerciseChoices = Record<string, number | null>;

export const defaultChoices = (matches: Record<string, MatchResult>): ExerciseChoices =>
  Object.fromEntries(Object.entries(matches).map(([k, m]) => [k, m.best && m.best.score >= 0.6 ? m.best.exercise.id : null]));

/* ───────────── database rows ───────────── */

export interface ImportRows {
  programs: { id: string; coach_id: string; client_id: string; name: string; weeks: number }[];
  program_versions: { id: string; program_id: string; version: number; published_at: string; published_by: string; change_note: string }[];
  workouts: { id: string; program_version_id: string; name: string; week: number; day_index: number; est_minutes: number }[];
  workout_items: { id: string; workout_id: string; position: number; group_label: string; exercise_id: number; sets: number; reps: string; load_kg: number | null; target_rpe: number | null; rest_seconds: number; notes: string | null }[];
  sessions: { id: string; client_id: string; started_at: string; finished_at: string; session_rpe: number | null; sets_completed: number; volume_kg: number; prs: number; note: string | null; source: "import" }[];
  logged_sets: { session_id: string; exercise_id: number; set_index: number; load_kg: number | null; reps: number | null; seconds: number | null; rpe: number | null; completed_at: string }[];
  check_ins: { client_id: string; submitted_at: string; weight_kg: number | null; energy: number | null; mood: number | null; sleep_hours: number | null; note: string | null; source: "import" }[];
  /** Exercises left out because the coach chose no match. */
  skipped: number;
}

export interface RowContext {
  coachId: string;
  clientId: string;
  now: string;
  newId: () => string;
  /** False when the client already has a program, so an imported one isn't added on top. */
  includeProgram: boolean;
}

const rpe = (n: number | null) => (n === null || !Number.isFinite(n) ? null : Math.min(10, Math.max(1, n)));
const estMinutes = (items: ImportItem[]) => Math.max(10, Math.round(items.reduce((t, i) => t + i.sets * (45 + i.restSeconds), 0) / 60));

/** Everything to insert for one client, with ids made up front so rows can reference each other. */
export function toImportRows(client: ImportClient, choices: ExerciseChoices, ctx: RowContext): ImportRows {
  const out: ImportRows = { programs: [], program_versions: [], workouts: [], workout_items: [], sessions: [], logged_sets: [], check_ins: [], skipped: 0 };
  const idOf = (name: string) => {
    const id = choices[name.trim().toLowerCase()];
    if (id == null) out.skipped++;
    return id ?? null;
  };

  if (ctx.includeProgram && client.program && client.program.workouts.length) {
    const p = client.program;
    const programId = ctx.newId();
    const versionId = ctx.newId();
    const weeks = Math.min(52, Math.max(1, ...p.workouts.map((w) => w.week)));
    out.programs.push({ id: programId, coach_id: ctx.coachId, client_id: ctx.clientId, name: p.name.slice(0, 200), weeks });
    out.program_versions.push({ id: versionId, program_id: programId, version: 1, published_at: ctx.now, published_by: ctx.coachId, change_note: "Imported" });
    const ordered = [...p.workouts].sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex);
    for (const w of ordered) {
      const workoutId = ctx.newId();
      out.workouts.push({ id: workoutId, program_version_id: versionId, name: w.name.slice(0, 200), week: w.week, day_index: w.dayIndex, est_minutes: estMinutes(w.items) });
      let position = 0;
      for (const it of w.items) {
        const exerciseId = idOf(it.exercise);
        if (exerciseId === null) continue;
        out.workout_items.push({
          id: ctx.newId(), workout_id: workoutId, position: position++, group_label: it.group || "A", exercise_id: exerciseId,
          sets: it.sets, reps: it.reps, load_kg: it.kg || null, target_rpe: rpe(it.rpe), rest_seconds: Math.max(0, it.restSeconds), notes: it.notes || null,
        });
      }
    }
  }

  for (const s of client.sessions) {
    const sessionId = ctx.newId();
    const started = `${s.date}T12:00:00.000Z`;
    const minutes = Math.max(1, Math.round(s.minutes || 60));
    const finished = new Date(Date.parse(started) + minutes * 60000).toISOString();
    const perExercise = new Map<number, number>();
    const sets: ImportRows["logged_sets"] = [];
    for (const x of s.sets) {
      const exerciseId = idOf(x.exercise);
      if (exerciseId === null) continue;
      const setIndex = perExercise.get(exerciseId) ?? 0;
      perExercise.set(exerciseId, setIndex + 1);
      sets.push({ session_id: sessionId, exercise_id: exerciseId, set_index: setIndex, load_kg: x.kg || null, reps: x.reps, seconds: x.seconds, rpe: rpe(x.rpe), completed_at: finished });
    }
    if (!sets.length) continue;
    const volume = sets.reduce((t, x) => t + (x.load_kg ?? 0) * (x.reps ?? 0), 0);
    out.sessions.push({
      id: sessionId, client_id: ctx.clientId, started_at: started, finished_at: finished, session_rpe: rpe(s.rpe),
      sets_completed: sets.length, volume_kg: Math.round(volume * 10) / 10, prs: 0, note: s.note || null, source: "import",
    });
    out.logged_sets.push(...sets);
  }

  for (const c of client.checkIns) {
    out.check_ins.push({
      client_id: ctx.clientId, submitted_at: `${c.date}T09:00:00.000Z`, weight_kg: c.weightKg, energy: c.energy, mood: c.mood,
      sleep_hours: c.sleepHours, note: c.note || null, source: "import",
    });
  }
  return out;
}

/** Counts for the preview: "8 workouts · 43 sessions · 12 check-ins". */
export function describeClient(c: ImportClient): string {
  const parts: string[] = [];
  const workouts = c.program?.workouts.length ?? 0;
  if (workouts) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`);
  if (c.sessions.length) parts.push(`${c.sessions.length} session${c.sessions.length === 1 ? "" : "s"}`);
  if (c.checkIns.length) parts.push(`${c.checkIns.length} check-in${c.checkIns.length === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Details only";
}
