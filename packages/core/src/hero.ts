import { exerciseFor } from "./workout";
import type { Exercise, Workout } from "./types";

/** Original HELIX terrace stills shipped in apps/web/public/hero (made with Higgsfield, our own athletes). */
export type HeroImage = "squat" | "bench" | "hip-thrust" | "hinge" | "pull" | "dumbbell" | "run" | "meal";

export const HERO_IMAGES: Record<HeroImage, { src: string; alt: string; focus: string }> = {
  squat: { src: "/hero/squat.webp", alt: "HELIX athlete back squatting on the terrace", focus: "center 38%" },
  bench: { src: "/hero/bench.webp", alt: "HELIX athlete pressing dumbbells on a bench", focus: "center 42%" },
  "hip-thrust": { src: "/hero/hip-thrust.webp", alt: "HELIX athlete at the top of a barbell hip thrust", focus: "center 48%" },
  hinge: { src: "/hero/hinge.webp", alt: "HELIX athlete doing a Romanian deadlift", focus: "center 40%" },
  pull: { src: "/hero/pull.webp", alt: "HELIX athlete doing a one-arm dumbbell row", focus: "center 40%" },
  dumbbell: { src: "/hero/dumbbell.webp", alt: "HELIX athlete holding dumbbells on the terrace", focus: "center 22%" },
  run: { src: "/hero/run.webp", alt: "HELIX athlete running on a coastal path", focus: "center 34%" },
  meal: { src: "/hero/meal.webp", alt: "A chicken, quinoa and avocado bowl on the terrace", focus: "center 62%" },
};

/** Picks the photo that best matches one movement. */
export function heroForExercise(ex: Pick<Exercise, "pattern" | "category" | "name">): HeroImage {
  const name = ex.name.toLowerCase();
  if (/hip thrust|glute bridge/.test(name)) return "hip-thrust";
  if (ex.pattern === "Squat" || /squat|lunge|leg press/.test(name)) return "squat";
  if (ex.pattern === "Push" || ex.category === "Chest") return "bench";
  if (ex.pattern === "Hinge" || /deadlift|good morning/.test(name)) return "hinge";
  if (ex.pattern === "Pull" || /row|pulldown|pull-up|chin-up/.test(name)) return "pull";
  // Core, carries, isolation and the rest get the neutral standing shot, so the photo never shows a different lift.
  return "dumbbell";
}

/** Picks the photo for a session from its first main lift, so the hero card shows what the day is about. */
export function heroForWorkout(w: Pick<Workout, "items">): HeroImage {
  const first = w.items[0];
  return first ? heroForExercise(exerciseFor(first)) : "dumbbell";
}
