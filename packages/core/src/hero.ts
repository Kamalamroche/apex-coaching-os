import { exerciseFor } from "./workout";
import type { Exercise, Workout } from "./types";

/** Original HELIX terrace stills shipped in apps/web/public/hero. */
export type HeroImage = "squat" | "bench" | "hip-thrust" | "dumbbell";

export const HERO_IMAGES: Record<HeroImage, { src: string; alt: string; focus: string }> = {
  squat: { src: "/hero/squat.webp", alt: "HELIX athlete squatting on the terrace", focus: "center 28%" },
  bench: { src: "/hero/bench.webp", alt: "HELIX athlete pressing dumbbells on a bench", focus: "center 32%" },
  "hip-thrust": { src: "/hero/hip-thrust.webp", alt: "HELIX athlete doing a barbell hip thrust", focus: "center 30%" },
  dumbbell: { src: "/hero/dumbbell.webp", alt: "HELIX athlete holding dumbbells on the terrace", focus: "center 22%" },
};

/** Picks the photo that best matches one movement. */
export function heroForExercise(ex: Pick<Exercise, "pattern" | "category" | "name">): HeroImage {
  const name = ex.name.toLowerCase();
  if (/hip thrust|glute bridge/.test(name)) return "hip-thrust";
  if (ex.pattern === "Squat" || /squat|lunge|leg press/.test(name)) return "squat";
  if (ex.pattern === "Push" || ex.category === "Chest") return "bench";
  // Hinges, pulls and the rest get the neutral standing shot, so the photo never shows a different lift.
  return "dumbbell";
}

/** Picks the photo for a session from its first main lift, so the hero card shows what the day is about. */
export function heroForWorkout(w: Pick<Workout, "items">): HeroImage {
  const first = w.items[0];
  return first ? heroForExercise(exerciseFor(first)) : "dumbbell";
}
