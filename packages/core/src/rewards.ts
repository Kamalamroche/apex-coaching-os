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

/* ---------- New best: what a single lift weighs as much as ---------- */

export type LiftThingIcon = "luggage" | "dog" | "washer" | "paw" | "motorbike" | "piano";

/** Everyday things to picture one lift against, lightest first. Approximate weights in kg. */
export const LIFT_THINGS: { kg: number; name: string; icon: LiftThingIcon }[] = [
  { kg: 23, name: "a full suitcase", icon: "luggage" },
  { kg: 30, name: "a golden retriever", icon: "dog" },
  { kg: 70, name: "a washing machine", icon: "washer" },
  { kg: 100, name: "a giant panda", icon: "paw" },
  { kg: 130, name: "a small motorbike", icon: "motorbike" },
  { kg: 230, name: "an upright piano", icon: "piano" },
  { kg: 270, name: "a grizzly bear", icon: "paw" },
];

export interface BestMoment {
  exerciseId: number;
  exercise: string;
  kg: number;
  /** kg more than the last best; 0 for a first ever best. */
  gainKg: number;
  /** The heaviest thing this lift beats, or null under the lightest. */
  thing: { kg: number; name: string; icon: LiftThingIcon } | null;
}

/** The best to celebrate from today's personal bests: the biggest jump, then the heaviest. Null when there are none. */
export function bestMoment(bests: { exerciseId: number; exercise: string; kg: number; previousKg: number }[]): BestMoment | null {
  const real = bests.filter((b) => b.kg > 0);
  if (!real.length) return null;
  const gain = (b: (typeof real)[number]) => (b.previousKg > 0 ? b.kg - b.previousKg : 0);
  const b = [...real].sort((x, y) => gain(y) - gain(x) || y.kg - x.kg)[0]!;
  const thing = [...LIFT_THINGS].reverse().find((t) => b.kg >= t.kg) ?? null;
  return { exerciseId: b.exerciseId, exercise: b.exercise, kg: b.kg, gainKg: Math.max(0, gain(b)), thing };
}

/* ---------- Lift ladder: everything lifted, as ever-bigger things ---------- */

export type LadderIcon = "piano" | "car" | "tractor" | "bus" | "train" | "plane" | "rocket";

/** Rungs in tonnes, lightest first. Approximate. */
export const LIFT_LADDER: { tonnes: number; name: string; icon: LadderIcon }[] = [
  { tonnes: 0.5, name: "Grand piano", icon: "piano" },
  { tonnes: 1.5, name: "Car", icon: "car" },
  { tonnes: 5, name: "Tractor", icon: "tractor" },
  { tonnes: 12, name: "Double-decker bus", icon: "bus" },
  { tonnes: 40, name: "Train carriage", icon: "train" },
  { tonnes: 180, name: "Jumbo jet", icon: "plane" },
  { tonnes: 550, name: "Space rocket", icon: "rocket" },
];

export interface LadderRung { tonnes: number; name: string; icon: LadderIcon; reached: boolean; next: boolean }

export interface LadderState {
  tonnes: number;
  /** Heaviest first, as the screen lists them. */
  rungs: LadderRung[];
  next: LadderRung | null;
  /** "More than a train carriage. Next up: a jumbo jet." */
  line: string;
}

const lower = (n: string) => `${/^[aeiou]/i.test(n) ? "an" : "a"} ${n.charAt(0).toLowerCase()}${n.slice(1)}`;

/** Lifetime volume (sum of finished sessions) as the ladder. */
export function liftLadder(totalKg: number): LadderState {
  const tonnes = Math.max(0, Math.round(totalKg / 100) / 10);
  const nextIdx = LIFT_LADDER.findIndex((r) => tonnes < r.tonnes);
  const rungs = LIFT_LADDER.map((r, i) => ({ ...r, reached: tonnes >= r.tonnes, next: i === nextIdx }));
  const top = [...rungs].reverse().find((r) => r.reached);
  const next = nextIdx >= 0 ? rungs[nextIdx]! : null;
  const line = !top
    ? `Next up: ${lower(next!.name)}.`
    : next ? `More than ${lower(top.name)}. Next up: ${lower(next.name)}.` : `More than ${lower(top.name)}. Top of the ladder.`;
  return { tonnes, rungs: [...rungs].reverse(), next, line };
}
