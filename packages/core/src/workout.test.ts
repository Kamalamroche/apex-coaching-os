import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { exerciseById } from "./library";
import { ADJUSTMENTS, addExercise, diffWorkouts, nextGroupLetter, removeItem, swapExercise, updateItem } from "./workout";

const adjustment = (id: string) => {
  const a = ADJUSTMENTS.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
};

describe("builder edits", () => {
  it("adds an exercise as the next block with a pattern-based rest", () => {
    expect(nextGroupLetter(INITIAL_WORKOUT.items)).toBe("D");
    const w = addExercise(INITIAL_WORKOUT, exerciseById(7), "k1");
    const added = w.items.at(-1);
    expect(added).toMatchObject({ key: "k1", group: "D", exerciseId: 7, restSeconds: 60 });
    expect(addExercise(INITIAL_WORKOUT, exerciseById(1), "k2").items.at(-1)?.restSeconds).toBe(90);
  });

  it("never mutates the workout it was given", () => {
    const before = JSON.stringify(INITIAL_WORKOUT);
    updateItem(INITIAL_WORKOUT, "a", { sets: 9 });
    removeItem(INITIAL_WORKOUT, "a");
    swapExercise(INITIAL_WORKOUT, "a", 2);
    expect(JSON.stringify(INITIAL_WORKOUT)).toBe(before);
  });

  it("swapping resets last time, since the history belongs to the old exercise", () => {
    const item = swapExercise(INITIAL_WORKOUT, "a", 8).items[0];
    expect(item).toMatchObject({ exerciseId: 8, lastTime: "New exercise" });
  });
});

describe("AI adjustments", () => {
  it("30-minute version drops the finisher and trims rest", () => {
    const next = adjustment("short").apply(INITIAL_WORKOUT);
    expect(next.minutes).toBe(30);
    expect(next.items.map((i) => i.group)).toEqual(["A", "B1", "B2"]);
    expect(next.items[0]).toMatchObject({ sets: 3, restSeconds: 120 });
    expect(next.items[1]?.restSeconds).toBe(0);
  });

  it("diff marks removed, changed and unchanged items", () => {
    const next = adjustment("short").apply(INITIAL_WORKOUT);
    expect(diffWorkouts(INITIAL_WORKOUT, next).map((c) => c.kind)).toEqual(["changed", "same", "changed", "removed"]);
  });

  it("beginner version lowers every RPE target by one", () => {
    const next = adjustment("beginner").apply(INITIAL_WORKOUT);
    next.items.forEach((it, i) => expect(it.rpe).toBe((INITIAL_WORKOUT.items[i]?.rpe ?? 0) - 1));
    expect(next.items[0]?.exerciseId).toBe(9);
  });
});
