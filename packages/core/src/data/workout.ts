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
};
