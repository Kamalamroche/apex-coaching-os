import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { formatLastTime } from "./db";
import { exerciseById } from "./library";
import { estimatedOneRepMax, kgFromPercent, parseLastTime, progressWorkout, roundLoad } from "./progression";
import type { WorkoutItem } from "./types";

const item = (patch: Partial<WorkoutItem>): WorkoutItem => ({ key: "k", group: "A", exerciseId: 1, sets: 3, reps: "5", kg: 100, rpe: 8, restSeconds: 120, lastTime: "First time", ...patch });
const progress = (it: WorkoutItem) => {
  const p = progressWorkout({ ...INITIAL_WORKOUT, items: [it] });
  return { item: p.workout.items[0] as WorkoutItem, why: p.reasons[it.key] };
};

describe("reading last time back", () => {
  it("is the inverse of formatLastTime", () => {
    expect(parseLastTime(formatLastTime({ load_kg: 67.5, reps: 5, seconds: null, rpe: 7 }))).toEqual({ kg: 67.5, reps: 5, seconds: 0, rpe: 7 });
    expect(parseLastTime(formatLastTime({ load_kg: null, reps: 8, seconds: null, rpe: null }))).toEqual({ kg: 0, reps: 8, seconds: 0, rpe: null });
    expect(parseLastTime(formatLastTime({ load_kg: null, reps: null, seconds: 35, rpe: null }))).toEqual({ kg: 0, reps: 0, seconds: 35, rpe: null });
    expect(parseLastTime("First time")).toBeNull();
    expect(parseLastTime("New exercise")).toBeNull();
  });
});

describe("estimated 1RM and percentages", () => {
  it("counts reps in reserve from RPE", () => {
    expect(estimatedOneRepMax({ kg: 100, reps: 5, seconds: 0, rpe: 10 })).toBe(116.5);
    expect(estimatedOneRepMax({ kg: 70, reps: 5, seconds: 0, rpe: 8 })).toBe(86.5);
    expect(estimatedOneRepMax({ kg: 0, reps: 10, seconds: 0, rpe: 8 })).toBeNull();
  });

  it("rounds to loadable weights", () => {
    expect(roundLoad(81.3, exerciseById(1))).toBe(82.5);
    expect(roundLoad(21.3, exerciseById(9))).toBe(22);
  });

  it("turns a percentage into kg from the last logged set", () => {
    expect(kgFromPercent(item({ lastTime: "100 kg × 5 @ RPE 10" }), 75)).toBe(87.5);
    expect(kgFromPercent(item({ lastTime: "First time" }), 75)).toBeNull();
  });
});

describe("progress next week", () => {
  it("adds load when every rep was hit at or under the target RPE", () => {
    const { item: next, why } = progress(item({ kg: 100, lastTime: "100 kg × 5 @ RPE 8" }));
    expect(next.kg).toBe(105);
    expect(why).toContain("+5 kg");
    // Already set above last time: progress from what was lifted, never below the coach's number.
    expect(progress(item({ kg: 70, lastTime: "67.5 kg × 5 @ RPE 7" })).item.kg).toBe(72.5);
    expect(progress(item({ kg: 80, lastTime: "67.5 kg × 5 @ RPE 7" })).item.kg).toBe(80);
  });

  it("uses smaller jumps for light and isolation work", () => {
    expect(progress(item({ kg: 40, lastTime: "40 kg × 5 @ RPE 7" })).item.kg).toBe(42.5);
    expect(progress(item({ exerciseId: 9, kg: 20, reps: "10", lastTime: "20 kg × 10 @ RPE 7" })).item.kg).toBe(22);
  });

  it("keeps the load and chases reps inside a range", () => {
    const { item: next, why } = progress(item({ reps: "8-10", kg: 60, lastTime: "60 kg × 8 @ RPE 8" }));
    expect(next.kg).toBe(60);
    expect(why).toContain("aim for 9");
  });

  it("backs off 5% after a grind", () => {
    expect(progress(item({ kg: 100, lastTime: "100 kg × 3 @ RPE 10" })).item.kg).toBe(95);
  });

  it("progresses holds and bodyweight reps, and leaves first sessions alone", () => {
    expect(progress(item({ reps: "40s", kg: 0, lastTime: "40 s" })).item.reps).toBe("45s");
    expect(progress(item({ exerciseId: 4, reps: "8", kg: 0, lastTime: "8 reps @ RPE 7" })).item.reps).toBe("9");
    const first = item({ lastTime: "First time" });
    expect(progress(first).item).toBe(first);
  });

  it("gives every item a reason and never mutates the workout", () => {
    const before = JSON.stringify(INITIAL_WORKOUT);
    const p = progressWorkout(INITIAL_WORKOUT);
    expect(Object.keys(p.reasons)).toHaveLength(INITIAL_WORKOUT.items.length);
    expect(JSON.stringify(INITIAL_WORKOUT)).toBe(before);
  });
});
