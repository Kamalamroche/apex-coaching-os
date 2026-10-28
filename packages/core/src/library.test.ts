import { describe, expect, it } from "vitest";
import { EXERCISES } from "./data/exercises";
import { alternativesFor, exerciseById, filterLibrary, searchExercises } from "./library";

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
    expect(searchExercises("cable", 2).map((h) => h.exercise.name)).toEqual(["Lat Pulldown", "Face Pull"]);
    expect(searchExercises("cable", 50).every((h) => h.exercise.equipment === "Cable" || h.exercise.name.toLowerCase().includes("cable"))).toBe(true);
  });

  it("matches a training type exactly", () => {
    const hits = searchExercises("yoga", 50);
    expect(hits.length).toBeGreaterThan(10);
    expect(hits.every((h) => h.exercise.type === "Yoga")).toBe(true);
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

describe("filterLibrary", () => {
  it("returns the whole library with no filters", () => {
    expect(filterLibrary({})).toHaveLength(EXERCISES.length);
  });

  it("combines body area, type and a muscle search", () => {
    const list = filterLibrary({ area: "Legs", type: "Accessory", query: "calves" });
    expect(list.length).toBeGreaterThan(3);
    expect(list.every((e) => e.category === "Legs" && e.type === "Accessory" && e.muscles.includes("Calves"))).toBe(true);
  });
});

describe("the movement library", () => {
  it("has the 15 starter movements under their original ids, then the sheet", () => {
    expect(EXERCISES).toHaveLength(634);
    expect(exerciseById(1).name).toBe("Barbell Back Squat");
    expect(exerciseById(15).name).toBe("Trap Bar Deadlift");
    expect(EXERCISES.map((e) => e.id)).toEqual(EXERCISES.map((_, i) => i + 1));
  });

  it("has unique names", () => {
    const names = EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("exerciseById", () => {
  it("throws on an unknown id instead of returning undefined", () => {
    expect(() => exerciseById(999)).toThrow();
  });
});

describe("library data", () => {
  it("has unique, stable ids with later additions after the sheet", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(exerciseById(623).name).toBe("Bodyweight Squat");
    expect(exerciseById(624).name).toBe("Push-Up");
    expect(exerciseById(625).name).toBe("Run");
    expect(exerciseById(630).name).toBe("Burpee Broad Jump");
    expect(exerciseById(634).name).toBe("Sled Drag");
  });

  it("lists the run and all eight hybrid-race stations under one search", () => {
    const names = filterLibrary({ query: "race station" }).map((e) => e.name).sort();
    expect(names).toEqual(["Burpee Broad Jump", "Farmer's Carry", "Rowing Machine", "Run", "Sandbag Walking Lunge", "Ski Erg", "Sled Pull", "Sled Push", "Wall Ball"]);
    expect(searchExercises("hyrox sled")[0]?.exercise.name).toMatch(/Sled P/);
  });

  it("merges coach-written details and demo clips over sheet rows", () => {
    const dog = exerciseById(534);
    expect(dog.name).toBe("Downward Dog");
    expect(dog.muscles[0]).toBe("Hamstrings");
    expect(dog.steps?.length).toBeGreaterThan(0);
    expect(dog.video?.avatar).toBe("female");
  });

  it("gives every clip full details", () => {
    for (const e of EXERCISES.filter((x) => x.video)) {
      expect(e.muscles.length, e.name).toBeGreaterThan(0);
      expect(e.steps?.length, e.name).toBeGreaterThan(0);
      expect(e.cues.length, e.name).toBeGreaterThan(0);
    }
  });
});
