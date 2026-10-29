/* Domain types shared by the coach and client apps.
   They mirror the Supabase schema in supabase/migrations: a workout item is a
   prescription, a logged set is what the client actually did. */

import type { Readiness } from "./readiness";

export type MovementPattern = "Squat" | "Hinge" | "Push" | "Pull" | "Isolation" | "Core" | "Carry" | "Power" | "Mobility";
export type BodyArea = "Legs" | "Chest" | "Back" | "Shoulders" | "Arms" | "Core" | "Full body";
/** The section of the APEX Movement Library sheet a movement comes from. */
export type TrainingType = "Strength" | "Accessory" | "Power" | "Plyometric" | "Isometric" | "Balance" | "Core" | "Mobility" | "Stretching" | "Yoga";

export interface Exercise {
  id: number;
  name: string;
  aliases: string[];
  pattern: MovementPattern;
  category: BodyArea;
  equipment: string;
  muscles: string[];
  /** Step-by-step instructions. Code only for now: not yet a database column. */
  steps?: string[];
  /** Coaching tips. */
  cues: string[];
  /** Empty until a coach writes one. */
  commonMistake: string;
  type: TrainingType;
  /** "Primary Focus" from the sheet, e.g. "Lateral Core (Obliques)". */
  focus: string;
  /** Short HELIX demo clip. Code only for now: not yet a database column. */
  video?: DemoVideo;
}

export interface DemoVideo {
  src: string;
  /** Which HELIX avatar performs it. */
  avatar: "male" | "female";
}

export type Risk = "high" | "medium" | "low";
export type TrainingMode = "Online" | "Hybrid" | "In person";

export interface Client {
  id: number;
  name: string;
  initials: string;
  plan: string;
  goal: string;
  mode: TrainingMode;
  adherence: number;
  streak: number;
  lastSeen: string;
  monthlyRevenue: number;
  weightKg: number;
  bodyFatPct: number;
  risk: Risk;
}

/** One prescribed exercise in a workout. `group` is "A" for a straight set, "B1"/"B2" for a superset. */
export interface WorkoutItem {
  key: string;
  group: string;
  exerciseId: number;
  sets: number;
  /** Reps as written by the coach: "5", "8-10" or a hold such as "40s". */
  reps: string;
  kg: number;
  rpe: number;
  restSeconds: number;
  /** Summary of the client's previous performance, shown on every set. */
  lastTime: string;
  /** Different reps and kg per set (a pyramid, top set + back-offs). One entry per set; absent = every set the same. */
  setPlan?: SetTarget[];
  /** "circuit": the block runs round by round with timed stations. Absent = a straight set, superset, tri-set or giant set. */
  blockStyle?: BlockStyle;
}

export interface SetTarget {
  reps: string;
  kg: number;
}

export type BlockStyle = "circuit";

export interface Workout {
  name: string;
  week: number;
  ofWeeks: number;
  minutes: number;
  items: WorkoutItem[];
}

/** One training day of a program. Its key is the database id of the workout. */
export interface ProgramDay extends Workout {
  key: string;
  /** 0 = Monday … 6 = Sunday. */
  dayIndex: number;
}

/** A client's program: weeks × training days. */
export interface Program {
  name: string;
  weeks: number;
  days: ProgramDay[];
}

/** A program saved for reuse. Items carry no keys or history: each client gets a fresh copy. */
export interface ProgramTemplate {
  id: string;
  name: string;
  /** One line for the library, e.g. "3 days a week, full body". */
  note?: string;
  weeks: number;
  days: TemplateDay[];
  /** Built into APEX, so it can't be deleted. */
  starter?: boolean;
}

export interface TemplateDay {
  week: number;
  dayIndex: number;
  name: string;
  minutes: number;
  items: Omit<WorkoutItem, "key" | "lastTime">[];
}

export interface SessionLog {
  workoutName: string;
  sets: number;
  volumeKg: number;
  minutes: number;
  rpe: number;
  prs: number;
  /** The client's note to the coach. */
  note?: string;
  /** What the client saw at the end and the coach receives. Missing on older sessions. */
  summary?: WorkoutSummary;
}

/** The client's training so far, used for personal bests and the "vs last time" comparison. */
export interface TrainingHistory {
  /** Heaviest completed set per exercise id. */
  bestKg: Record<number, number>;
  previous: PreviousSession | null;
  /** Best estimated 1RM per session for each exercise id, oldest first, for plateau alerts. Missing on older saved state. */
  trend?: Record<number, number[]>;
  /** Readiness scores from recent sessions, oldest first. Missing on older saved state. */
  readiness?: ReadinessPoint[];
}

export interface ReadinessPoint {
  /** ISO date-time the session started. */
  at: string;
  score: number;
}

export interface PreviousSession {
  workoutName: string;
  sets: number;
  volumeKg: number;
  minutes: number;
}

export interface MuscleWork {
  muscle: string;
  sets: number;
}

export interface PersonalBest {
  exerciseId: number;
  exercise: string;
  kg: number;
  previousKg: number;
}

/** What the client did on one exercise: completed sets added up. */
export interface ExerciseTotal {
  exerciseId: number;
  exercise: string;
  sets: number;
  /** Total reps over completed sets. 0 for holds. */
  reps: number;
  /** Total seconds for holds such as a plank. 0 otherwise. */
  seconds: number;
  /** Total metres for distance stations such as a run or a sled push. Missing on older summaries. */
  metres?: number;
  /** Heaviest completed set, 0 for bodyweight. */
  topKg: number;
  /** kg × reps over completed sets: the total weight lifted on this exercise. */
  volumeKg?: number;
}

export interface WorkoutSummary {
  /** Per exercise, in workout order. Missing on summaries saved before it was added. */
  exercises?: ExerciseTotal[];
  /** Reps over the whole workout, holds excluded. */
  totalReps?: number;
  /** kg × reps over the whole workout. */
  totalKg?: number;
  muscles: MuscleWork[];
  bests: PersonalBest[];
  /** Change against the previous session. Null on the first session. */
  vsLast: { volumeKg: number; sets: number; minutes: number } | null;
  /** A light-hearted way to picture the volume, e.g. "about 2 grand pianos". */
  fun: string;
  /** The pre-session check, when the client did it. */
  readiness?: Readiness;
}

export interface Message {
  from: "coach" | "client";
  text: string;
  time: string;
}

export interface Food {
  id: number;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** A set as the client fills it in during a session. */
export interface SetEntry {
  kg: string;
  reps: string;
  done: boolean;
}
