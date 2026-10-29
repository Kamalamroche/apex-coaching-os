import type { Exercise } from "../types";
import { DEMO_VIDEOS } from "./demoVideos";
import { EXERCISE_DETAILS } from "./exerciseDetails";
import { EXTRA_EXERCISES } from "./extraExercises";
import { MOVEMENT_LIBRARY } from "./movementLibrary";
import { STARTER_EXERCISES } from "./starterExercises";

const withDetails = (e: Exercise): Exercise => {
  const video = DEMO_VIDEOS[e.id];
  return { ...e, ...EXERCISE_DETAILS[e.id], ...(video && { video }) };
};

/* The shared APEX library: the 15 hand-written starter movements, the movement sheet, then later additions,
   with coach-written details and demo clips merged in. */
export const EXERCISES: Exercise[] = [...STARTER_EXERCISES, ...MOVEMENT_LIBRARY, ...EXTRA_EXERCISES].map(withDetails);
