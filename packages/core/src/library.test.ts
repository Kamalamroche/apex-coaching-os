import { describe, expect, it } from "vitest";
import { alternativesFor, exerciseById, searchExercises } from "./library";

describe("searchExercises", () => {
  it("finds an exercise by alias and reports which alias matched", () => {
    const [hit] = searchExercises("rdl");
    expect(hit?.exercise.name).toBe("Romanian Deadlift");
    expect(hit?.matchedAlias).toBe("rdl");
  });

  it("matches a movement pattern exactly", () => {
    const names = searchExercises("hinge").map((h) => h.exercise.name);
    expect(names).toEqual(expect.arrayContaining(["Romanian Deadlift", "Hip Thrust", "Trap Bar Deadlift"]));
  });

  it("matches equipment", () => {
    expect(searchExercises("cable").map((h) => h.exercise.name)).toEqual(["Lat Pulldown", "Face Pull"]);
  });

  it("returns nothing for a blank query and respects the limit", () => {
    expect(searchExercises("  ")).toEqual([]);
    expect(searchExercises("a", 2)).toHaveLength(2);
  });
});

describe("alternativesFor", () => {
  it("offers same-pattern exercises and never the exercise itself", () => {
    const trapBar = exerciseById(15);
    const alts = alternativesFor(trapBar);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a.pattern === "Hinge" && a.id !== 15)).toBe(true);
  });
});

describe("exerciseById", () => {
  it("throws on an unknown id instead of returning undefined", () => {
    expect(() => exerciseById(999)).toThrow();
  });
});
