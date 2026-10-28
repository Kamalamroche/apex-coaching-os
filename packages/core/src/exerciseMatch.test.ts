import { describe, expect, it } from "vitest";
import { matchExercise, normaliseName } from "./exerciseMatch";

const best = (name: string) => matchExercise(name).best?.exercise.name;

describe("normaliseName", () => {
  it("expands gym shorthand and drops plurals", () => {
    expect(normaliseName("DB Bench Press")).toBe("dumbbell bench press");
    expect(normaliseName("RDLs")).toBe("romanian deadlift");
    expect(normaliseName("Press-ups")).toBe("push up");
    expect(normaliseName("Farmer's walks")).toBe("farmer walk");
  });
});

describe("matchExercise", () => {
  it("is confident about names written the usual ways", () => {
    for (const [written, name] of [["Back squats", "Barbell Back Squat"], ["RDL", "Romanian Deadlift"], ["Pull ups", "Pull-Up"], ["Press-ups", "Push-Up"], ["Lat pulldown", "Lat Pulldown"], ["Incline DB press", "Incline Dumbbell Press"], ["Bench press", "Barbell Bench Press"]]) {
      const r = matchExercise(written!);
      expect(r.best?.exercise.name, written).toBe(name);
      expect(r.confident, written).toBe(true);
    }
  });

  it("asks the coach when two exercises fit equally well", () => {
    const r = matchExercise("Squat");
    expect(r.confident).toBe(false);
    expect(r.candidates.map((c) => c.exercise.name)).toEqual(expect.arrayContaining(["Bodyweight Squat", "Barbell Back Squat"]));
  });

  it("offers nothing for something that isn't in the library", () => {
    expect(best("Zumba class")).toBeUndefined();
    expect(matchExercise("").candidates).toEqual([]);
  });
});

describe("synonyms", () => {
  it("reads a shoulder press as an overhead press", () => {
    expect(best("DB shoulder press")).toMatch(/Overhead Press/);
  });
});
