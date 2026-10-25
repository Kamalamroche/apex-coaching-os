/* Domain types shared by the coach and client apps.
   They mirror the Supabase schema in supabase/migrations: a workout item is a
   prescription, a logged set is what the client actually did. */

export type MovementPattern = "Squat" | "Hinge" | "Push" | "Pull" | "Isolation" | "Core";
export type BodyArea = "Legs" | "Chest" | "Back" | "Shoulders" | "Core";

export interface Exercise {
  id: number;
  name: string;
  aliases: string[];
  pattern: MovementPattern;
  category: BodyArea;
  equipment: string;
  muscles: string[];
  cues: string[];
  commonMistake: string;
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
}

export interface Workout {
  name: string;
  week: number;
  ofWeeks: number;
  minutes: number;
  items: WorkoutItem[];
}

export interface SessionLog {
  workoutName: string;
  sets: number;
  volumeKg: number;
  minutes: number;
  rpe: number;
  prs: number;
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
