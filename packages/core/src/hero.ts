import { exerciseFor } from "./workout";
import type { Sport } from "./activity";
import type { Exercise, Workout } from "./types";

/** Original HELIX campaign stills in apps/web/public/hero (made with Higgsfield, our own athletes, each in a different real place).
 * Each has a cut-out of the athlete (`cut`) so a big poster word can sit behind them. */
export type HeroImage =
  | "squat" | "lower" | "hip-thrust" | "hinge" | "bench" | "upper" | "pull" | "dumbbell"
  | "calisthenics" | "rings" | "sled" | "wall-ball" | "ski" | "kettlebell" | "core" | "mobility"
  | "run" | "swim" | "ride" | "recovery" | "coach" | "meal";

/** Colour of the poster word: "light" (white) by default; "act" (orange) stays available. */
export type HeroInk = "light" | "act";

export interface HeroArt { src: string; cut?: string; alt: string; focus: string; word: string; ink: HeroInk }

const img = (file: string, alt: string, focus: string, word: string, ink: HeroInk, cut = true): HeroArt =>
  ({ src: `/hero/${file}.webp`, cut: cut ? `/hero/${file}-cut.webp` : undefined, alt, focus, word, ink });

export const HERO_IMAGES: Record<HeroImage, HeroArt> = {
  squat: img("squat", "HELIX athlete in a barbell back squat in a sunny garage gym", "center 50%", "Squat", "light"),
  lower: img("lower", "HELIX athlete doing a dumbbell split squat off a box in a city park", "center 60%", "Legs", "light"),
  "hip-thrust": img("hip-thrust", "HELIX athlete at the top of a barbell hip thrust in a bright boutique gym", "center 55%", "Glutes", "light"),
  hinge: img("hinge", "HELIX athlete setting up a barbell deadlift in a daylight concrete gym", "center 55%", "Hinge", "light"),
  bench: img("bench", "HELIX athlete pressing dumbbells on a bench in a high-rise gym", "center 55%", "Press", "light"),
  upper: img("upper", "HELIX athlete pressing dumbbells overhead on a city rooftop at sunrise", "center 30%", "Upper", "light"),
  pull: img("pull", "HELIX athlete doing a one-arm dumbbell row in a home garage gym", "center 55%", "Back", "light"),
  dumbbell: img("dumbbell", "HELIX athlete holding heavy dumbbells in a light grey studio", "center 45%", "Strong", "light"),
  calisthenics: img("calisthenics", "HELIX athlete at the top of a pull-up on a beach bar", "center 30%", "Pull", "light"),
  rings: img("rings", "HELIX athlete holding an L-sit on gymnastic rings in a bright gymnastics hall", "center 50%", "Rings", "light"),
  sled: img("sled", "HELIX athlete driving a push sled on an indoor turf lane", "center 60%", "Race", "light"),
  "wall-ball": img("wall-ball", "HELIX athlete throwing a medicine ball in a whitewashed brick gym", "center 35%", "Power", "light"),
  ski: img("ski", "HELIX athlete on a rowing machine by a window over a misty lake", "center 60%", "Engine", "light"),
  kettlebell: img("kettlebell", "HELIX athlete at the top of a kettlebell swing in a sunny garden", "center 45%", "Swing", "light"),
  core: img("core", "HELIX athlete holding a forearm plank on a forest deck", "center 60%", "Core", "light"),
  mobility: img("mobility", "HELIX athlete in a low lunge with a rotation stretch in a daylight studio", "center 50%", "Flow", "light"),
  run: img("run", "HELIX athlete running a coastal cliff trail", "center 45%", "Run", "light"),
  swim: img("swim", "HELIX swimmer taking a breath mid-stroke in an outdoor pool", "center 50%", "Swim", "light", false),
  ride: img("ride", "HELIX athlete riding a road bike on a mountain road", "center 60%", "Ride", "light"),
  recovery: img("recovery", "HELIX athlete foam rolling in a bright living room", "center 65%", "Rest", "light"),
  coach: img("coach", "Coach talking a HELIX athlete through her plan in a bright gym", "center 45%", "Coach", "light"),
  meal: img("meal", "A chicken, quinoa and avocado bowl on a light stone table", "center 65%", "Fuel", "light", false),
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
