import type { Message, TrainingHistory, Workout } from "../types";

/* Today's workout for the demo client (Priya). Both apps read and write this one program. */
export const INITIAL_WORKOUT: Workout = {
  name: "Lower A · Strength",
  week: 4,
  ofWeeks: 8,
  minutes: 48,
  items: [
    { key: "a", group: "A", exerciseId: 15, sets: 4, reps: "5", kg: 70, rpe: 8, restSeconds: 150, lastTime: "67.5 kg × 5 @ RPE 7" },
    { key: "b1", group: "B1", exerciseId: 2, sets: 3, reps: "8", kg: 50, rpe: 8, restSeconds: 0, lastTime: "50 kg × 8 @ RPE 8" },
    { key: "b2", group: "B2", exerciseId: 14, sets: 3, reps: "40s", kg: 0, rpe: 7, restSeconds: 90, lastTime: "35 s" },
    { key: "c", group: "C", exerciseId: 9, sets: 3, reps: "10", kg: 20, rpe: 7, restSeconds: 75, lastTime: "18 kg × 10 @ RPE 7" },
  ],
};

export const INITIAL_MESSAGES: Message[] = [
  { from: "coach", text: "Great work on Tuesday, Priya. Trap bar is up 2.5 kg today.", time: "08:02" },
  { from: "client", text: "Thanks! Hip felt fine on the RDLs.", time: "08:15" },
];

/** Best previous top-set load per exercise, used for PR detection in the player. */
export const PREVIOUS_BEST_KG: Record<number, number> = { 15: 67.5, 2: 50, 9: 18 };

/** Priya's last session and bests, so the demo can show a "vs last time" comparison. */
export const INITIAL_HISTORY: TrainingHistory = {
  bestKg: PREVIOUS_BEST_KG,
  previous: { workoutName: "Lower A · Strength", sets: 13, volumeKg: 2950, minutes: 46 },
  // Trap bar climbing; RDL stuck around 65 kg for three sessions, so the demo shows a plateau alert.
  trend: { 15: [77.5, 79, 80.5, 78.5], 2: [65, 64.5, 65, 63.5], 9: [22.5, 23.5, 24] },
  // Six recent sessions, so the demo readiness screen has a week to compare with.
  readiness: [
    { at: "2026-10-18T07:30:00.000Z", score: 75 },
    { at: "2026-10-19T07:30:00.000Z", score: 69 },
    { at: "2026-10-21T07:30:00.000Z", score: 81 },
    { at: "2026-10-22T07:30:00.000Z", score: 63 },
    { at: "2026-10-23T07:30:00.000Z", score: 88 },
    { at: "2026-10-24T07:30:00.000Z", score: 72 },
  ],
  // Three weeks of sessions, newest first, so the demo weekly story has a week to tell.
  sessions: [
    { at: "2026-10-24T08:20:00.000Z", workoutName: "Lower A · Strength", sets: 13, volumeKg: 2950, minutes: 46, bests: [{ exerciseId: 15, exercise: "Trap Bar Deadlift", kg: 70, previousKg: 67.5 }] },
    { at: "2026-10-23T18:10:00.000Z", workoutName: "Upper B · Volume", sets: 15, volumeKg: 2140, minutes: 50, bests: [] },
    { at: "2026-10-21T07:40:00.000Z", workoutName: "Lower B · Volume", sets: 14, volumeKg: 3120, minutes: 52, bests: [{ exerciseId: 9, exercise: "Bulgarian Split Squat", kg: 24, previousKg: 22.5 }] },
    { at: "2026-10-20T18:05:00.000Z", workoutName: "Upper A · Strength", sets: 12, volumeKg: 1880, minutes: 44, bests: [] },
    { at: "2026-10-17T07:35:00.000Z", workoutName: "Lower A · Strength", sets: 13, volumeKg: 2810, minutes: 47, bests: [] },
    { at: "2026-10-15T18:20:00.000Z", workoutName: "Upper B · Volume", sets: 15, volumeKg: 2060, minutes: 49, bests: [] },
    { at: "2026-10-13T07:30:00.000Z", workoutName: "Lower B · Volume", sets: 14, volumeKg: 2990, minutes: 51, bests: [] },
    { at: "2026-10-10T07:45:00.000Z", workoutName: "Lower A · Strength", sets: 13, volumeKg: 2700, minutes: 48, bests: [] },
    { at: "2026-10-07T18:00:00.000Z", workoutName: "Upper A · Strength", sets: 12, volumeKg: 1790, minutes: 45, bests: [] },
  ],
};
