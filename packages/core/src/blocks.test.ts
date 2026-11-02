import { describe, expect, it } from "vitest";
import { afterSet, blockAt, blockLabel, planSummary, setCircuit, setRounds, setTargets, distanceMetres, setVarySets, timedSeconds, updateSetTarget } from "./blocks";
import { INITIAL_WORKOUT } from "./data/workout";
import { initialSets } from "./session";
import { describeExerciseTotal, exerciseTotals } from "./summary";
import type { Workout, WorkoutItem } from "./types";

const item = (key: string, group: string, patch: Partial<WorkoutItem> = {}): WorkoutItem =>
  ({ key, group, exerciseId: 1, sets: 3, reps: "10", kg: 50, rpe: 8, restSeconds: 60, lastTime: "First time", ...patch });
const giant: Workout = { ...INITIAL_WORKOUT, items: [item("a", "A"), item("b1", "B1", { restSeconds: 0 }), item("b2", "B2", { restSeconds: 0 }), item("b3", "B3", { restSeconds: 0 }), item("b4", "B4", { restSeconds: 90 })] };

describe("block names", () => {
  it("names blocks by size", () => {
    expect(blockLabel(blockAt(giant.items, 0).items)).toBe("Straight sets");
    expect(blockLabel(blockAt(giant.items, 2).items)).toBe("Giant set");
    expect(blockLabel(blockAt(INITIAL_WORKOUT.items, 1).items)).toBe("Superset");
    expect(blockLabel([item("x1", "C1"), item("x2", "C2"), item("x3", "C3")])).toBe("Tri-set");
  });

  it("turns a block into a circuit with matching rounds and rest only after the last station", () => {
    const uneven = { ...giant, items: giant.items.map((i) => (i.key === "b3" ? { ...i, sets: 5 } : i)) };
    const c = setCircuit(uneven, "b2", true);
    const block = c.items.slice(1);
    expect(block.every((i) => i.blockStyle === "circuit" && i.sets === 5)).toBe(true);
    expect(block.map((i) => i.restSeconds)).toEqual([0, 0, 0, 90]);
    expect(blockLabel(block)).toBe("Circuit · 5 rounds");
    expect(c.items[0]?.blockStyle).toBeUndefined();
    expect(setRounds(c, "b1", 3).items.slice(1).every((i) => i.sets === 3)).toBe(true);
    expect(setCircuit(c, "b1", false).items.some((i) => i.blockStyle)).toBe(false);
  });
});

describe("per-set targets", () => {
  it("starts from the prescription, edits one set, and keeps the top set on the item", () => {
    const vary = setVarySets(item("a", "A"), true);
    expect(setTargets(vary)).toEqual([{ reps: "10", kg: 50 }, { reps: "10", kg: 50 }, { reps: "10", kg: 50 }]);
    const pyramid = updateSetTarget(updateSetTarget(vary, 1, { reps: "8", kg: 60 }), 2, { reps: "6", kg: 70 });
    expect(pyramid).toMatchObject({ reps: "6", kg: 70 });
    expect(planSummary(pyramid)).toBe("10 · 8 · 6 reps · 50 → 60 → 70 kg");
    expect(initialSets({ ...INITIAL_WORKOUT, items: [pyramid] }).a?.map((s) => s.kg)).toEqual(["50", "60", "70"]);
    expect(setVarySets(pyramid, false)).toMatchObject({ reps: "10", kg: 50 });
    expect(setVarySets(pyramid, false).setPlan).toBeUndefined();
  });

  it("follows the set count", () => {
    const vary = updateSetTarget(setVarySets(item("a", "A"), true), 2, { kg: 80 });
    expect(setTargets({ ...vary, sets: 5 }).map((s) => s.kg)).toEqual([50, 50, 80, 80, 80]);
  });
});

describe("the player's route through a block", () => {
  it("goes station to station, rests after the last, and wraps back to the first", () => {
    const sets = initialSets(giant);
    const done = (key: string, n: number) => { const s = sets[key]?.[n]; if (s) s.done = true; };
    done("b1", 0);
    expect(afterSet(giant, sets, 1)).toEqual({ next: 2, restSeconds: 0 });
    done("b2", 0); done("b3", 0); done("b4", 0);
    expect(afterSet(giant, sets, 4)).toEqual({ next: 1, restSeconds: 90 });
  });

  it("skips finished stations and stays on a straight set", () => {
    const sets = initialSets(giant);
    sets.b2?.forEach((s) => (s.done = true));
    sets.b1![0]!.done = true;
    expect(afterSet(giant, sets, 1).next).toBe(3);
    expect(afterSet(giant, sets, 0)).toEqual({ next: null, restSeconds: 60 });
  });

  it("reads timed targets", () => {
    expect(timedSeconds("40s")).toBe(40);
    expect(timedSeconds("10")).toBeNull();
  });
});

describe("distance stations", () => {
  it("reads metres and leaves reps and time alone", () => {
    expect(distanceMetres("1000m")).toBe(1000);
    expect(distanceMetres("20 m")).toBe(20);
    expect(distanceMetres("12")).toBeNull();
    expect(distanceMetres("40s")).toBeNull();
  });

  it("pre-fills the number and totals metres in the summary", () => {
    const w: Workout = { name: "Run", week: 1, ofWeeks: 1, minutes: 30, items: [{ key: "r", group: "A", exerciseId: 625, sets: 2, reps: "1000m", kg: 0, rpe: 7, restSeconds: 60, lastTime: "" }] };
    const sets = initialSets(w);
    expect(sets.r?.[0]?.reps).toBe("1000");
    const done = { r: (sets.r ?? []).map((s) => ({ ...s, done: true })) };
    const [t] = exerciseTotals(w, done);
    expect(t?.metres).toBe(2000);
    expect(t?.reps).toBe(0);
    expect(describeExerciseTotal(t!)).toBe("2 sets · 2,000 m");
  });
});
