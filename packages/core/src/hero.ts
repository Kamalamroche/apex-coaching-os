import { exerciseFor } from "./workout";
import type { Sport } from "./activity";
import type { Exercise, Workout } from "./types";

/** Original HELIX campaign stills in apps/web/public/hero (made with Higgsfield, our own athletes in studio sets).
 * Each has a cut-out of the athlete (`cut`) so a big poster word can sit behind them. */
export type HeroImage =
  | "squat" | "lower" | "hip-thrust" | "hinge" | "bench" | "upper" | "pull" | "dumbbell"
  | "calisthenics" | "rings" | "sled" | "wall-ball" | "ski" | "kettlebell" | "core" | "mobility"
  | "run" | "swim" | "ride" | "recovery" | "coach" | "meal";

/** Colour of the poster word: "light" (white) on the orange, sky, sand and pool sets, "act" (orange) on graphite and grey. */
export type HeroInk = "light" | "act";

export interface HeroArt { src: string; cut?: string; alt: string; focus: string; word: string; ink: HeroInk }

const img = (file: string, alt: string, focus: string, word: string, ink: HeroInk, cut = true): HeroArt =>
  ({ src: `/hero/${file}.webp`, cut: cut ? `/hero/${file}-cut.webp` : undefined, alt, focus, word, ink });

export const HERO_IMAGES: Record<HeroImage, HeroArt> = {
  squat: img("squat", "HELIX athlete back squatting in an orange studio", "center 62%", "Squat", "light"),
  lower: img("lower", "HELIX athlete doing a dumbbell split squat in an orange studio", "center 62%", "Legs", "light"),
  "hip-thrust": img("hip-thrust", "HELIX athlete at the top of a barbell hip thrust", "center 62%", "Glutes", "light"),
  hinge: img("hinge", "HELIX athlete setting up a deadlift in an orange studio", "center 62%", "Hinge", "light"),
  bench: img("bench", "HELIX athlete pressing dumbbells on a bench in a dark studio", "center 66%", "Press", "act"),
  upper: img("upper", "HELIX athlete pressing dumbbells overhead in a dark studio", "center 40%", "Upper", "act"),
  pull: img("pull", "HELIX athlete doing a one-arm dumbbell row in a dark studio", "center 62%", "Back", "act"),
  dumbbell: img("dumbbell", "HELIX athlete holding dumbbells in a dark studio", "center 45%", "Strong", "act"),
  calisthenics: img("calisthenics", "HELIX athlete at the top of a pull-up against a sky-blue wall", "center 30%", "Pull", "light"),
  rings: img("rings", "HELIX athlete holding gymnastic rings against a sky-blue wall", "center 40%", "Rings", "light"),
  sled: img("sled", "HELIX athlete driving a push sled in hard sunlight", "center 55%", "Race", "light"),
  "wall-ball": img("wall-ball", "HELIX athlete throwing a wall ball in hard sunlight", "center 40%", "Power", "light"),
  ski: img("ski", "HELIX athlete on a ski machine in hard sunlight", "center 50%", "Engine", "light"),
  kettlebell: img("kettlebell", "HELIX athlete at the top of a kettlebell swing", "center 45%", "Swing", "light"),
  core: img("core", "HELIX athlete holding a plank in a grey studio", "center 80%", "Core", "act"),
  mobility: img("mobility", "HELIX athlete in a deep lunge stretch in a grey studio", "center 70%", "Flow", "act"),
  run: img("run", "HELIX athlete sprinting against a sky-blue wall", "center 45%", "Run", "light"),
  swim: img("swim", "HELIX swimmer in cap and goggles under pool light", "center 35%", "Swim", "light"),
  ride: img("ride", "HELIX athlete riding a road bike in hard sunlight", "center 55%", "Ride", "light"),
  recovery: img("recovery", "HELIX athlete foam rolling in warm light", "center 70%", "Rest", "act"),
  coach: img("coach", "Coach talking a HELIX athlete through her plan", "center 55%", "Coach", "act"),
  meal: img("meal", "A chicken, quinoa and avocado bowl on an orange table", "center 55%", "Fuel", "light", false),
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
