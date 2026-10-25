import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT, PREVIOUS_BEST_KG } from "./data/workout";
import { completedSets, countPersonalBests, initialSets, sessionVolume, totalSets } from "./session";

const finishAll = (sets: ReturnType<typeof initialSets>) =>
  Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.map((s) => ({ ...s, done: true }))]));

describe("session maths", () => {
  it("pre-fills sets from the prescription", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    expect(totalSets(sets)).toBe(13);
    expect(sets.a?.[0]).toEqual({ kg: "70", reps: "5", done: false });
    expect(sets.b2?.[0]).toEqual({ kg: "", reps: "40", done: false });
  });

  it("counts volume only from completed, loaded sets", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    expect(sessionVolume(sets)).toBe(0);
    const done = finishAll(sets);
    expect(completedSets(done)).toBe(13);
    // 4×5×70 + 3×8×50 + plank 0 + 3×10×20
    expect(sessionVolume(done)).toBe(1400 + 1200 + 600);
  });

  it("flags a personal best only when a completed set beats the previous best", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    expect(countPersonalBests(INITIAL_WORKOUT, sets, PREVIOUS_BEST_KG)).toBe(0);
    // Trap bar 70 > 67.5 and goblet 20 > 18; RDL 50 only equals its best.
    expect(countPersonalBests(INITIAL_WORKOUT, finishAll(sets), PREVIOUS_BEST_KG)).toBe(2);
  });
});
