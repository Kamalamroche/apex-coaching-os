import type { Exercise } from "../types";
import { MOVEMENT_LIBRARY } from "./movementLibrary";
import { STARTER_EXERCISES } from "./starterExercises";

/* The shared APEX library: the 15 hand-written starter movements, then the movement sheet. */
export const EXERCISES: Exercise[] = [...STARTER_EXERCISES, ...MOVEMENT_LIBRARY];
