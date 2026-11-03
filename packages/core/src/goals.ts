/* Goals and badges.
   A goal is a lift (best kg on one exercise), a body weight, or anything else with a number (e.g. 10 strict pull-ups).
   Lift and body weight goals fill themselves in from logged sets and measurements; custom goals are updated by hand.
   Badges are earned from what the client has already done in the app: nothing is stored for them.
   Behind one interface like ApexStore: the demo keeps goals in localStorage, the live app in client_goals
   (supabase/migrations/20261103150000_goals.sql). Pure, so it is unit tested. */

import type { Point } from "./checkins";
import { addDays, habitApplies, isDone, type Habit, type HabitTick } from "./lifestyle";
import { localDate } from "./recovery";

export type GoalKind = "lift" | "bodyweight" | "custom";

export interface Goal {
  id: string;
  kind: GoalKind;
  /** e.g. "Trap bar 80 kg". */
  title: string;
  /** Lift goals only. */
  exerciseId: number | null;
  target: number;
  /** "kg" for lifts and body weight; anything short for custom goals, e.g. "reps" or "km". */
  unit: string;
  /** Where they started, so progress can be shown as a share of the way there. */
  startValue: number | null;
  /** Custom goals: the latest number, typed in by the client or coach. Ignored for lifts and body weight. */
  currentValue: number | null;
  /** YYYY-MM-DD, or null for no date. */
  dueOn: string | null;
  createdAt: string;
}

/** What the app already knows that goals read from. */
export interface GoalInputs {
  /** Heaviest kg lifted per exercise id. */
  bestKg: Record<number, number>;
  /** Body weight over time, oldest first (measurementSeries(m, "weightKg")). */
  weights: Point[];
}

export interface GoalProgress {
  current: number | null;
  /** 0–100 of the way from start to target. */
  pct: number;
  achieved: boolean;
  /** "down" when the target is below where they started, e.g. losing weight. */
  direction: "up" | "down";
  /** How far is left, in the goal's unit (always ≥ 0). Null with no current value. */
  left: number | null;
}

export const GOAL_KINDS: { kind: GoalKind; title: string; hint: string }[] = [
  { kind: "lift", title: "Lift", hint: "A weight on one exercise. Updates from logged sets" },
  { kind: "bodyweight", title: "Body weight", hint: "Up or down. Updates from check-ins and measurements" },
  { kind: "custom", title: "Something else", hint: "Pull-ups, a 5 km time, steps… Updated by hand" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export const latestWeight = (weights: Point[]): number | null => weights.at(-1)?.value ?? null;

/** The goal's current number, from logged data for lifts and body weight. */
export function goalCurrent(g: Goal, inputs: GoalInputs): number | null {
  if (g.kind === "lift") return g.exerciseId !== null ? inputs.bestKg[g.exerciseId] ?? g.startValue : g.startValue;
  if (g.kind === "bodyweight") {
    // Only weigh-ins since the goal was set count; before that, where they started.
    const since = inputs.weights.filter((p) => p.at >= g.createdAt);
    return since.at(-1)?.value ?? g.startValue;
  }
  return g.currentValue ?? g.startValue;
}

export function goalProgress(g: Goal, inputs: GoalInputs): GoalProgress {
  const current = goalCurrent(g, inputs);
  const start = g.startValue ?? (g.kind === "bodyweight" ? current : 0) ?? 0;
  const direction = g.target < start ? "down" : "up";
  if (current === null) return { current, pct: 0, achieved: false, direction, left: null };
  const achieved = direction === "down" ? current <= g.target : current >= g.target;
  const span = Math.abs(g.target - start);
  const done = direction === "down" ? start - current : current - start;
  const pct = achieved ? 100 : span === 0 ? 0 : Math.max(0, Math.min(99, Math.round((done / span) * 100)));
  return { current, pct, achieved, direction, left: round1(Math.max(0, direction === "down" ? current - g.target : g.target - current)) };
}

/** Days until the due date (negative once it has passed), or null with no date. */
export function daysToGo(g: Goal, today: string): number | null {
  if (!g.dueOn) return null;
  return Math.round((Date.parse(`${g.dueOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
}

/** A new goal of this kind, starting from where the client is now. */
export function newGoal(kind: GoalKind, inputs: GoalInputs, now = new Date()): Goal {
  const weight = latestWeight(inputs.weights);
  return {
    id: crypto.randomUUID(), kind, title: "", exerciseId: null, target: 0, unit: kind === "custom" ? "reps" : "kg",
    startValue: kind === "bodyweight" ? weight : null, currentValue: null, dueOn: null, createdAt: now.toISOString(),
  };
}

/** A sensible title when the coach doesn't write one. */
export function goalTitle(g: Pick<Goal, "kind" | "target" | "unit" | "title">, exerciseName?: string, direction?: "up" | "down"): string {
  if (g.title.trim()) return g.title.trim();
  if (g.kind === "lift") return `${exerciseName ?? "Lift"} ${g.target} kg`;
  if (g.kind === "bodyweight") return direction === "up" ? `Build up to ${g.target} kg` : `Get down to ${g.target} kg`;
  return `${g.target} ${g.unit}`;
}

/** What stops the goal from saving, or null. */
export function goalProblem(g: Goal): string | null {
  if (g.kind === "lift" && g.exerciseId === null) return "Pick the exercise.";
  if (!Number.isFinite(g.target) || g.target <= 0) return "Set a target above zero.";
  if (g.target > 100000) return "That target looks too big.";
  if (g.kind === "custom" && !g.title.trim()) return "Say what the goal is, e.g. Strict pull-ups.";
  if (g.kind === "custom" && !g.unit.trim()) return "Add a unit, e.g. reps or km.";
  if (g.title.length > 120) return "Keep the name under 120 characters.";
  if (g.unit.length > 16) return "Keep the unit short, e.g. reps.";
  if (g.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(g.dueOn)) return "Pick a proper date.";
  return null;
}

/** Open goals first (soonest date first), then reached ones. */
export function sortGoals(goals: Goal[], inputs: GoalInputs): Goal[] {
  const reached = (g: Goal) => goalProgress(g, inputs).achieved;
  return [...goals].sort((a, b) => Number(reached(a)) - Number(reached(b)) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") || a.createdAt.localeCompare(b.createdAt));
}

/* ---------- Badges ---------- */

export type BadgeKey = "first-checkin" | "four-checkins" | "habit-7" | "habit-30" | "first-goal" | "three-goals" | "first-form" | "ten-lifts";

export interface BadgeFacts {
  checkIns: number;
  /** Longest run of a habit done on every day it was due. */
  bestHabitRun: number;
  goalsReached: number;
  formChecks: number;
  /** Different exercises with a logged weight. */
  liftsLogged: number;
}

export interface Badge {
  key: BadgeKey;
  title: string;
  detail: string;
  icon: "check" | "flame" | "trophy" | "form" | "grip";
  have: number;
  need: number;
  earned: boolean;
}

const BADGES: { key: BadgeKey; title: string; detail: string; icon: Badge["icon"]; need: number; fact: keyof BadgeFacts }[] = [
  { key: "first-checkin", title: "First check-in", detail: "Sent a weekly check-in", icon: "check", need: 1, fact: "checkIns" },
  { key: "four-checkins", title: "Four check-ins", detail: "Four check-ins sent", icon: "check", need: 4, fact: "checkIns" },
  { key: "habit-7", title: "Week streak", detail: "A habit done 7 times in a row", icon: "flame", need: 7, fact: "bestHabitRun" },
  { key: "habit-30", title: "Month streak", detail: "A habit done 30 times in a row", icon: "flame", need: 30, fact: "bestHabitRun" },
  { key: "first-goal", title: "Goal reached", detail: "Hit a goal", icon: "trophy", need: 1, fact: "goalsReached" },
  { key: "three-goals", title: "Hat-trick", detail: "Hit three goals", icon: "trophy", need: 3, fact: "goalsReached" },
  { key: "first-form", title: "Form first", detail: "Sent a video for a form check", icon: "form", need: 1, fact: "formChecks" },
  { key: "ten-lifts", title: "All-rounder", detail: "Logged weights on 10 different exercises", icon: "grip", need: 10, fact: "liftsLogged" },
];

export function badges(f: BadgeFacts): Badge[] {
  return BADGES.map(({ fact, ...b }) => ({ ...b, have: Math.min(f[fact], b.need), earned: f[fact] >= b.need }));
}

/** Longest run of days a habit was ticked on every day it applied, up to today. */
export function longestHabitRun(h: Habit, ticks: HabitTick[], today: string): number {
  const mine = ticks.filter((t) => t.habitId === h.id).map((t) => t.day).sort();
  if (!mine.length) return 0;
  let best = 0;
  let run = 0;
  for (let day = mine[0]!, i = 0; day <= today && i < 1000; day = addDays(day, 1), i++) {
    if (!habitApplies(h, day)) continue;
    if (isDone(ticks, h.id, day)) best = Math.max(best, ++run);
    else if (day !== today) run = 0;
  }
  return best;
}

export const bestHabitRun = (habits: Habit[], ticks: HabitTick[], today = localDate(new Date())): number =>
  habits.reduce((m, h) => Math.max(m, longestHabitRun(h, ticks, today)), 0);

/* ---------- Store ---------- */

export interface GoalState {
  goals: Goal[];
  /** "needs-update": the database doesn't have the table yet (the SQL hasn't run). */
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
}

export interface GoalStore {
  get(): GoalState;
  subscribe(listener: () => void): () => void;
  save(goal: Goal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface GoalRow {
  id: string;
  client_id: string;
  kind: GoalKind;
  title: string;
  exercise_id: number | null;
  target: number;
  unit: string;
  start_value: number | null;
  current_value: number | null;
  due_on: string | null;
  created_at: string;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const toGoalRow = (g: Goal, clientId: string): GoalRow => ({
  id: g.id, client_id: clientId, kind: g.kind, title: g.title.trim(), exercise_id: g.kind === "lift" ? g.exerciseId : null, target: g.target, unit: g.unit.trim(),
  start_value: g.startValue, current_value: g.kind === "custom" ? g.currentValue : null, due_on: g.dueOn, created_at: g.createdAt,
});

export const fromGoalRow = (r: GoalRow): Goal => ({
  id: r.id, kind: r.kind, title: r.title, exerciseId: num(r.exercise_id), target: Number(r.target), unit: r.unit,
  startValue: num(r.start_value), currentValue: num(r.current_value), dueOn: r.due_on, createdAt: r.created_at,
});

export function sampleGoals(now = new Date()): Goal[] {
  const day = localDate(now);
  const at = (d: number) => `${addDays(day, d)}T09:00:00.000Z`;
  return [
    { id: "demo-goal-1", kind: "lift", title: "Trap bar 80 kg", exerciseId: 15, target: 80, unit: "kg", startValue: 55, currentValue: null, dueOn: addDays(day, 47), createdAt: at(-60) },
    { id: "demo-goal-2", kind: "bodyweight", title: "", exerciseId: null, target: 62, unit: "kg", startValue: 64.8, currentValue: null, dueOn: addDays(day, 30), createdAt: "2026-08-30T08:00:00.000Z" },
    { id: "demo-goal-3", kind: "custom", title: "Strict pull-ups", exerciseId: null, target: 5, unit: "reps", startValue: 0, currentValue: 3, dueOn: null, createdAt: at(-40) },
  ];
}

type Storage = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const KEY = "apex-goals-v1";

/** Demo store: kept in localStorage so the coach and client tabs share it. */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function createDemoGoalStore(storage: Storage | null = browserStorage(), target: EventTarget | null = typeof window === "undefined" ? null : window, now = new Date()): GoalStore {
  const read = (): Goal[] => {
    try {
      const raw = storage?.getItem(KEY);
      if (raw) return JSON.parse(raw) as Goal[];
    } catch { /* fall back to the sample */ }
    return sampleGoals(now);
  };
  let state: GoalState = { goals: read(), status: "ready" };
  const listeners = new Set<() => void>();
  const write = (goals: Goal[]) => {
    state = { ...state, goals };
    try { storage?.setItem(KEY, JSON.stringify(goals)); } catch { /* storage full or blocked: keep it in memory */ }
    listeners.forEach((l) => l());
  };
  target?.addEventListener("storage", (e) => {
    if ((e as StorageEvent).key !== KEY) return;
    state = { ...state, goals: read() };
    listeners.forEach((l) => l());
  });
  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async save(g) {
      const problem = goalProblem(g);
      if (problem) throw new Error(problem);
      write(state.goals.some((x) => x.id === g.id) ? state.goals.map((x) => (x.id === g.id ? g : x)) : [...state.goals, g]);
    },
    async remove(id) {
      write(state.goals.filter((g) => g.id !== id));
    },
  };
}

export function emptyGoalStore(): GoalStore {
  const state: GoalState = { goals: [], status: "ready" };
  return { get: () => state, subscribe: () => () => {}, save: async () => {}, remove: async () => {} };
}
