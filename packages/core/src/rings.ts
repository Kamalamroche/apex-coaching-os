import type { Activity } from "./activity";
import { addDays, dayTotals, habitsOn, isDone, waterGoalMl, waterOn, DEFAULT_WATER_GOAL_ML, type FoodEntry, type Habit, type HabitKind, type HabitTick, type NutritionTargets, type WaterEntry } from "./lifestyle";
import { localDate } from "./recovery";
import type { RecentSession } from "./types";

/* The three daily rings and the streak. Pure: Today draws them.
   Train: a finished workout closes it, otherwise cardio minutes count towards 30.
   Move: the coach's movement habits (steps, sleep, mobility, custom); with none set, active minutes towards 45.
   Fuel: water against the goal, plus fuel habits (protein, veg) and, when the client logs food, protein or meals.
   A day counts for the streak when at least one ring is closed. */

export type RingKey = "train" | "move" | "fuel";

export interface Ring {
  key: RingKey;
  label: string;
  /** 0 to 1. */
  value: number;
  closed: boolean;
  /** "Workout done", "12 of 30 min", "2 of 3 habits", "1.5 of 2.5 L". */
  detail: string;
}

export interface RingInput {
  sessions: RecentSession[];
  activities: Activity[];
  habits: Habit[];
  ticks: HabitTick[];
  water: WaterEntry[];
  food: FoodEntry[];
  targets: NutritionTargets | null;
}

export const TRAIN_MINUTES = 30;
export const MOVE_MINUTES = 45;
const MOVE_KINDS: HabitKind[] = ["steps", "sleep", "mobility", "custom"];
const FUEL_KINDS: HabitKind[] = ["protein", "veg"];

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const ring = (key: RingKey, label: string, value: number, detail: string): Ring => {
  const v = clamp(value);
  return { key, label, value: v, closed: v >= 0.999, detail };
};

const sessionsOn = (sessions: RecentSession[], day: string) => sessions.filter((s) => localDate(new Date(s.at)) === day);
const activityMinutesOn = (activities: Activity[], day: string) =>
  Math.round(activities.filter((a) => localDate(new Date(a.startedAt)) === day).reduce((t, a) => t + a.movingSeconds, 0) / 60);

function habitShare(habits: Habit[], ticks: HabitTick[], day: string, kinds: HabitKind[]): { done: number; due: number } {
  const due = habitsOn(habits, day).filter((h) => kinds.includes(h.kind));
  return { due: due.length, done: due.filter((h) => isDone(ticks, h.id, day)).length };
}

export function trainRing(i: RingInput, day: string): Ring {
  const done = sessionsOn(i.sessions, day);
  if (done.length) return ring("train", "Train", 1, done.length > 1 ? `${done.length} workouts done` : "Workout done");
  const mins = activityMinutesOn(i.activities, day);
  return ring("train", "Train", mins / TRAIN_MINUTES, `${mins} of ${TRAIN_MINUTES} min`);
}

export function moveRing(i: RingInput, day: string): Ring {
  const h = habitShare(i.habits, i.ticks, day, MOVE_KINDS);
  if (h.due) return ring("move", "Move", h.done / h.due, `${h.done} of ${h.due} habit${h.due === 1 ? "" : "s"}`);
  const mins = activityMinutesOn(i.activities, day) + sessionsOn(i.sessions, day).reduce((t, s) => t + s.minutes, 0);
  return ring("move", "Move", mins / MOVE_MINUTES, `${mins} of ${MOVE_MINUTES} active min`);
}

export function fuelRing(i: RingInput, day: string): Ring {
  const waterHabit = habitsOn(i.habits, day).find((h) => h.kind === "water");
  const goal = waterHabit ? waterGoalMl(waterHabit.title) : DEFAULT_WATER_GOAL_ML;
  const ml = waterOn(i.water, day);
  const parts = [ml / goal];
  const h = habitShare(i.habits, i.ticks, day, FUEL_KINDS);
  if (h.due) parts.push(h.done / h.due);
  const usesFoodLog = i.food.length > 0;
  if (usesFoodLog) {
    const eaten = i.food.filter((f) => f.day === day);
    if (i.targets && i.targets.proteinG > 0) parts.push(dayTotals(i.food, day).proteinG / i.targets.proteinG);
    else parts.push(new Set(eaten.filter((f) => f.meal !== "snack").map((f) => f.meal)).size / 3);
  }
  const value = parts.reduce((a, p) => a + clamp(p), 0) / parts.length;
  const litres = (n: number) => `${Math.round(n / 100) / 10}`.replace(/\.0$/, "");
  return ring("fuel", "Fuel", value, `${litres(ml)} of ${litres(goal)} L water`);
}

export function dayRings(i: RingInput, day: string): Ring[] {
  return [trainRing(i, day), moveRing(i, day), fuelRing(i, day)];
}

const anyClosed = (i: RingInput, day: string) => dayRings(i, day).some((r) => r.closed);

/**
 * Days in a row with at least one ring closed, counting back from today. Today not closed yet doesn't
 * break it (the day isn't over). `best` is the longest run in the last `lookback` days.
 */
export function ringStreak(i: RingInput, today: string, lookback = 120): { days: number; best: number; todayClosed: boolean } {
  const todayClosed = anyClosed(i, today);
  let days = todayClosed ? 1 : 0;
  for (let d = addDays(today, -1), n = 0; n < lookback && anyClosed(i, d); d = addDays(d, -1), n++) days++;
  let best = 0;
  let run = 0;
  for (let n = lookback; n >= 0; n--) {
    if (anyClosed(i, addDays(today, -n))) best = Math.max(best, ++run);
    else run = 0;
  }
  return { days, best: Math.max(best, days), todayClosed };
}

/** The last seven days, oldest first, with how many rings each closed. */
export function ringWeek(i: RingInput, today: string): { day: string; closed: number; which: boolean[] }[] {
  return Array.from({ length: 7 }, (_, n) => {
    const day = addDays(today, n - 6);
    const which = dayRings(i, day).map((r) => r.closed);
    return { day, closed: which.filter(Boolean).length, which };
  });
}

/** A short line under the rings: what's left today, in plain words. */
export function ringNudge(rings: Ring[], streakDays: number): string {
  const open = rings.filter((r) => !r.closed);
  if (!open.length) return "All three closed. That's a full day.";
  if (open.length === 3) return streakDays > 0 ? `Close one ring to keep your ${streakDays}-day streak.` : "Close one ring today to start a streak.";
  const nearest = [...open].sort((a, b) => b.value - a.value)[0]!;
  return `${open.length === 1 ? "Last ring" : "Closest"}: ${nearest.label}, ${nearest.detail}.`;
}
