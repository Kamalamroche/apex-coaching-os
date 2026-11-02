import { describe, expect, it } from "vitest";
import { EXERCISES } from "./data/exercises";
import { muscleHighlights, regionsForMuscle } from "./muscleMap";

describe("muscleHighlights", () => {
  it("marks the first muscle primary and the rest supporting", () => {
    expect(muscleHighlights(["Chest", "Triceps"])).toEqual({ chest: "primary", triceps: "supporting" });
  });

  it("never downgrades a primary region", () => {
    expect(muscleHighlights(["Delts", "Rear delts"])).toEqual({ delts: "primary", rearDelts: "primary" });
  });

  it("knows every muscle used in the library", () => {
    const unknown = [...new Set(EXERCISES.flatMap((e) => e.muscles))].filter((m) => regionsForMuscle(m).length === 0);
    expect(unknown).toEqual([]);
  });
});
