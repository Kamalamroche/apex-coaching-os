import type { Exercise } from "../types";

/* Coach-written details for movements from the sheet, which arrived without muscles, steps or tips.
   Keyed by exercise id; merged over the generated library. */
export const EXERCISE_DETAILS: Record<number, Partial<Pick<Exercise, "muscles" | "steps" | "cues" | "commonMistake">>> = {
  534: {
    muscles: ["Hamstrings", "Calves", "Shoulders", "Back"],
    steps: ["Start on all fours with wrists under shoulders and knees under hips.", "Tuck your toes and lift your hips up and back.", "Press the mat away and let your head relax between your arms.", "Lengthen your spine and let your heels reach towards the mat.", "Hold and breathe slowly through your nose."],
    cues: ["Hips high", "Long spine before straight legs", "Spread your fingers wide"],
    commonMistake: "Rounding the back to force the heels down",
  },
};
