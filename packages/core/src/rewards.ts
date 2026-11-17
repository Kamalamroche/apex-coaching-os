import { exerciseById } from "./library";
import type { SessionSets } from "./session";
import type { Workout } from "./types";

/* Fun rewards: "You lifted three cars" after a workout, and Laurel ranks for lifetime workouts. Worked out from what the
   client has already done, so nothing is stored. Pure, so it is unit tested. */

/** An average family car, in kg. */
export const CAR_KG = 1450;

const WORDS = ["no", "a", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export interface CarsLifted {
  /** Whole cars in today's total. */
  cars: number;
  /** "You lifted three cars", "You lifted a car", "You lifted 14 cars". */
  title: string;
  /** kg still to go for one more car. */
  toNext: number;
  /** "four" or "15": the next count, in words while short. */
  nextWord: string;
}

/** Today's total weight as cars. Null below one car, so the moment only shows when it is true. */
export function carsLifted(totalKg: number): CarsLifted | null {
  const kg = Math.max(0, Math.round(totalKg));
  const cars = Math.floor(kg / CAR_KG);
  if (cars < 1) return null;
  const word = (n: number) => WORDS[n] ?? String(n);
  return {
    cars,
    title: `You lifted ${word(cars)} car${cars === 1 ? "" : "s"}`,
    toNext: (cars + 1) * CAR_KG - kg,
    nextWord: (cars + 1 < WORDS.length ? WORDS[cars + 1]! : String(cars + 1)),
  };
}

export interface TopSet {
  exercise: string;
  kg: number;
  reps: number;
}

/** The heaviest completed set (most reps breaks a tie). Null when nothing was loaded. */
export function topSet(workout: Workout, sets: SessionSets): TopSet | null {
  let best: TopSet | null = null;
  for (const it of workout.items) {
    for (const s of sets[it.key] ?? []) {
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      if (!s.done || kg <= 0 || reps <= 0) continue;
      if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { exercise: exerciseById(it.exerciseId).name, kg, reps };
    }
  }
  return best;
}

/* ---------- Laurel ranks ---------- */

export type LaurelId = "bronze" | "silver" | "gold" | "marble" | "olympian";

export interface LaurelRank {
  id: LaurelId;
  name: string;
  /** Lifetime workouts needed. */
  at: number;
  numeral: string;
}

export const LAUREL_RANKS: LaurelRank[] = [
  { id: "bronze", name: "Bronze", at: 10, numeral: "I" },
  { id: "silver", name: "Silver", at: 25, numeral: "II" },
  { id: "gold", name: "Gold", at: 50, numeral: "III" },
  { id: "marble", name: "Marble", at: 100, numeral: "IV" },
  { id: "olympian", name: "Olympian", at: 200, numeral: "V" },
];

export interface LaurelState {
  workouts: number;
  /** The rank held now; null before Bronze. */
  rank: LaurelRank | null;
  /** The next rank; null at Olympian. */
  next: LaurelRank | null;
  /** Workouts still needed for the next rank. */
  toNext: number;
  /** 0–1 between the current rank (or zero) and the next. 1 at the top. */
  progress: number;
}

export function laurelState(workouts: number): LaurelState {
  const w = Math.max(0, Math.floor(workouts));
  const rank = [...LAUREL_RANKS].reverse().find((r) => w >= r.at) ?? null;
  const next = LAUREL_RANKS.find((r) => w < r.at) ?? null;
  if (!next) return { workouts: w, rank, next: null, toNext: 0, progress: 1 };
  const from = rank?.at ?? 0;
  return { workouts: w, rank, next, toNext: next.at - w, progress: (w - from) / (next.at - from) };
}

export interface LaurelBoardLine {
  name: string;
  workouts: number;
  isMe: boolean;
  /** 1-based; ties share a place. */
  place: number;
  rank: LaurelId | null;
}

/** The team by lifetime workouts, most first, each with the rank they hold. */
export function laurelBoard(lines: { name: string; workouts: number; isMe: boolean }[]): LaurelBoardLine[] {
  const sorted = [...lines].sort((a, b) => b.workouts - a.workouts || a.name.localeCompare(b.name));
  let place = 0;
  return sorted.map((l, i) => {
    if (i === 0 || sorted[i - 1]!.workouts !== l.workouts) place = i + 1;
    return { name: l.name, workouts: l.workouts, isMe: l.isMe, place, rank: laurelState(l.workouts).rank?.id ?? null };
  });
}

/** Lifetime workouts for the demo team (same people as the sample feed). "Priya S." is the demo client. */
export function sampleLaurelTeam(): { name: string; workouts: number; minutes: number; isMe: boolean }[] {
  return [
    { name: "Lena M.", workouts: 112, minutes: 6100, isMe: false },
    { name: "Sam O.", workouts: 87, minutes: 4700, isMe: false },
    { name: "Josh T.", workouts: 61, minutes: 3300, isMe: false },
    { name: "Priya S.", workouts: 44, minutes: 2350, isMe: true },
    { name: "Amira K.", workouts: 38, minutes: 2000, isMe: false },
    { name: "Dev R.", workouts: 19, minutes: 950, isMe: false },
    { name: "Aisha R.", workouts: 12, minutes: 640, isMe: false },
  ];
}
