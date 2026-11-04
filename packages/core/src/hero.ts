import { exerciseFor } from "./workout";
import type { Sport } from "./activity";
import type { Exercise, Workout } from "./types";

/** Original HELIX stills shipped in apps/web/public/hero (made with Higgsfield, our own athletes and villa). */
export type HeroImage =
  | "squat" | "lower" | "hip-thrust" | "hinge" | "bench" | "upper" | "pull" | "dumbbell"
  | "calisthenics" | "rings" | "sled" | "wall-ball" | "ski" | "kettlebell" | "core" | "mobility"
  | "run" | "swim" | "ride" | "recovery" | "coach" | "meal";

const img = (file: string, alt: string, focus: string) => ({ src: `/hero/${file}.webp`, alt, focus });

export const HERO_IMAGES: Record<HeroImage, { src: string; alt: string; focus: string }> = {
  squat: img("squat", "HELIX athlete back squatting on the terrace", "center 38%"),
  lower: img("lower", "HELIX athlete doing a dumbbell split squat", "center 45%"),
  "hip-thrust": img("hip-thrust", "HELIX athlete at the top of a barbell hip thrust", "center 48%"),
  hinge: img("hinge", "HELIX athlete doing a Romanian deadlift", "center 40%"),
  bench: img("bench", "HELIX athlete pressing dumbbells on a bench", "center 42%"),
  upper: img("upper", "HELIX athlete pressing dumbbells overhead", "center 30%"),
  pull: img("pull", "HELIX athlete doing a one-arm dumbbell row", "center 40%"),
  dumbbell: img("dumbbell", "HELIX athlete holding dumbbells on the terrace", "center 22%"),
  calisthenics: img("calisthenics", "HELIX athlete at the top of a pull-up", "center 30%"),
  rings: img("rings", "HELIX athlete holding an L-sit on gymnastic rings", "center 45%"),
  sled: img("sled", "HELIX athlete driving a push sled on turf", "center 50%"),
  "wall-ball": img("wall-ball", "HELIX athlete throwing a wall ball", "center 35%"),
  ski: img("ski", "HELIX athlete on a ski machine", "center 40%"),
  kettlebell: img("kettlebell", "HELIX athlete doing a kettlebell swing", "center 45%"),
  core: img("core", "HELIX athlete holding a plank", "center 55%"),
  mobility: img("mobility", "HELIX athlete stretching on a mat", "center 50%"),
  run: img("run", "HELIX athlete running on a coastal path", "center 34%"),
  swim: img("swim", "Swimmer doing front crawl in the infinity pool", "center 50%"),
  ride: img("ride", "HELIX athlete cycling on a coast road", "center 45%"),
  recovery: img("recovery", "HELIX athlete foam rolling at sunset", "center 50%"),
  coach: img("coach", "Coach guiding a HELIX athlete on the terrace", "center 35%"),
  meal: img("meal", "A chicken, quinoa and avocado bowl on the terrace", "center 62%"),
};

type HeroExercise = Pick<Exercise, "pattern" | "category" | "name"> & Partial<Pick<Exercise, "equipment" | "type">>;

/** Picks the photo that best matches one movement. It never shows a different kind of lift. */
export function heroForExercise(ex: HeroExercise): HeroImage {
  const name = ex.name.toLowerCase();
  if (/hip thrust|glute bridge/.test(name)) return "hip-thrust";
  if (/sled/.test(name)) return "sled";
  if (/wall ball|thruster/.test(name)) return "wall-ball";
  if (/ski erg|rowing machine|air bike/.test(name)) return "ski";
  if (/^run$|running/.test(name)) return "run";
  if (/kettlebell swing|kb swing/.test(name)) return "kettlebell";
  if (/\bring|l-sit|muscle-up/.test(name)) return "rings";
  if (/pull-up|chin-up|pullup|\bdip/.test(name)) return "calisthenics";
  if (/split squat|lunge|step-up/.test(name)) return "lower";
  if (ex.pattern === "Squat" || /squat|leg press/.test(name)) return "squat";
  if (ex.pattern === "Push" && ex.category === "Shoulders") return "upper";
  if (ex.pattern === "Push" || ex.category === "Chest") return "bench";
  if (ex.pattern === "Hinge" || /deadlift|good morning/.test(name)) return "hinge";
  if (ex.pattern === "Pull" || /row|pulldown/.test(name)) return "pull";
  if (ex.pattern === "Mobility" || ex.type === "Mobility" || ex.type === "Stretching" || ex.type === "Yoga") return "mobility";
  if (ex.pattern === "Core" || ex.category === "Core") return "core";
  if (ex.category === "Shoulders" || ex.category === "Arms") return "upper";
  if (ex.category === "Legs") return "lower";
  return "dumbbell";
}

/** Session types a coach names a day after. Checked before the first lift, because "Race circuit" says more than its first run. */
const BY_NAME: [RegExp, HeroImage][] = [
  [/hyrox|race|station|hybrid/, "sled"],
  [/calisthenic|bodyweight|gymnastic|street workout/, "calisthenics"],
  [/mobility|yoga|stretch|flexib|recovery/, "mobility"],
  [/circuit|conditioning|metcon|hiit|interval|engine|cardio/, "kettlebell"],
  [/\bcore\b|\babs\b/, "core"],
  [/\brun\b|running|tempo|5 ?k|10 ?k/, "run"],
];

/** Picks the photo for a session: its type when the name says it, otherwise its first main lift. */
export function heroForWorkout(w: Pick<Workout, "items"> & { name?: string }): HeroImage {
  const name = (w.name ?? "").toLowerCase();
  const named = BY_NAME.find(([re]) => re.test(name));
  if (named) return named[1];
  const exercises = w.items.map(exerciseFor);
  if (exercises.length >= 3 && exercises.every((e) => e.equipment === "Bodyweight")) return "calisthenics";
  const first = exercises[0];
  if (!first) return "dumbbell";
  const hero = heroForExercise(first);
  if (hero !== "dumbbell") return hero;
  if (/upper|push|pull|chest|back|arms|shoulder/.test(name)) return "upper";
  if (/lower|legs?\b|glute/.test(name)) return "lower";
  return hero;
}

/** Picks the photo for a cardio sport. */
export function heroForSport(sport: Sport | undefined): HeroImage {
  switch (sport) {
    case "swim": return "swim";
    case "ride": return "ride";
    case "row": return "ski";
    default: return "run";
  }
}
