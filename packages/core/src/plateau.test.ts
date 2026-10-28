import { describe, expect, it } from "vitest";
import { INITIAL_HISTORY, INITIAL_WORKOUT } from "./data/workout";
import { addSessionToTrend, applyPlateauFix, findPlateaus, isStalled, programPlateaus, trendFromSets } from "./plateau";
import { programFromWorkout } from "./program";
import { nextHistory } from "./summary";

describe("plateau detection", () => {
  it("needs three sessions and no new best in the last three", () => {
    expect(isStalled([60, 60])).toBeNull();
    expect(isStalled([60, 59, 60])).toEqual({ bestKg: 60, recentKg: [59, 60] });
    expect(isStalled([60, 59, 62])).toBeNull();
    expect(isStalled([65, 64.5, 65, 63.5])).toEqual({ bestKg: 65, recentKg: [64.5, 65, 63.5] });
    expect(isStalled([77.5, 79, 80.5, 78.5])).toBeNull();
  });

  it("ignores rounding noise under half a percent", () => {
    expect(isStalled([100, 100.4, 99, 100])).not.toBeNull();
  });

  it("flags the demo RDL and leaves the climbing trap bar alone", () => {
    const found = findPlateaus(INITIAL_WORKOUT, INITIAL_HISTORY.trend);
    expect(found.map((p) => p.exercise.id)).toEqual([2]);
    expect(found[0]?.deload.kg).toBe(45);
    expect(found[0]?.swaps.length).toBeGreaterThan(0);
    expect(found[0]?.reason).toContain("best of 65 kg");
  });
});

describe("trend", () => {
  it("keeps each session's best estimated 1RM, oldest first", () => {
    const trend = trendFromSets([
      { session_id: "s2", exercise_id: 1, load_kg: 100, reps: 5, rpe: null },
      { session_id: "s2", exercise_id: 1, load_kg: 90, reps: 5, rpe: null },
      { session_id: "s1", exercise_id: 1, load_kg: 95, reps: 5, rpe: null },
      { session_id: "s1", exercise_id: 14, load_kg: null, reps: null, rpe: null },
    ]);
    expect(trend).toEqual({ 1: [111, 116.5] });
  });

  it("grows when a session is finished", () => {
    expect(addSessionToTrend({ 1: [100] }, { 1: 102, 2: 50 })).toEqual({ 1: [100, 102], 2: [50] });
    const w = INITIAL_WORKOUT;
    const sets = { a: [{ kg: "70", reps: "5", done: true }] };
    const h = nextHistory(INITIAL_HISTORY, { workoutName: w.name, sets: 1, volumeKg: 350, minutes: 40, rpe: 8, prs: 1 }, w, sets);
    expect(h.trend?.[15]?.at(-1)).toBe(81.5);
  });
});

describe("fixes", () => {
  const program = programFromWorkout({ ...INITIAL_WORKOUT, week: 1 });
  const next = { ...program, days: [...program.days, { ...program.days[0]!, key: "w2", week: 2 }] };

  it("deloads this week only, 10% lighter and loadable", () => {
    const p = applyPlateauFix(next, 1, 2, { kind: "deload" });
    expect(p.days[0]?.items.find((i) => i.exerciseId === 2)?.kg).toBe(45);
    expect(p.days[1]?.items.find((i) => i.exerciseId === 2)?.kg).toBe(50);
  });

  it("swaps from this week on and keeps the prescription", () => {
    const p = applyPlateauFix(next, 1, 2, { kind: "swap", to: 112 });
    for (const d of p.days) {
      const it = d.items.find((i) => i.key === "b1");
      expect(it?.exerciseId).toBe(112);
      expect(it?.sets).toBe(3);
      expect(it?.lastTime).toBe("New exercise");
    }
  });

  it("looks across every day of the week", () => {
    expect(programPlateaus(next, 1, INITIAL_HISTORY.trend).map((p) => p.exercise.id)).toEqual([2]);
  });
});
