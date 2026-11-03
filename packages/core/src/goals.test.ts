import { describe, expect, it } from "vitest";
import { EVERY_DAY, type Habit } from "./lifestyle";
import {
  badges, createDemoGoalStore, daysToGo, fromGoalRow, goalProblem, goalProgress, goalTitle, longestHabitRun, newGoal, sortGoals, toGoalRow, type Goal, type GoalInputs,
} from "./goals";

const TODAY = "2026-11-02";
const base: Goal = { id: "g", kind: "lift", title: "", exerciseId: 15, target: 80, unit: "kg", startValue: 60, currentValue: null, dueOn: null, createdAt: "2026-10-01T09:00:00.000Z" };
const inputs: GoalInputs = {
  bestKg: { 15: 70 },
  weights: [{ at: "2026-09-01T09:00:00.000Z", value: 66 }, { at: "2026-10-05T09:00:00.000Z", value: 64 }, { at: "2026-10-20T09:00:00.000Z", value: 63 }],
};

describe("goal progress", () => {
  it("fills a lift goal from the best logged weight", () => {
    expect(goalProgress(base, inputs)).toEqual({ current: 70, pct: 50, achieved: false, direction: "up", left: 10 });
    expect(goalProgress({ ...base, target: 70 }, inputs).achieved).toBe(true);
    expect(goalProgress({ ...base, exerciseId: 99 }, inputs).current).toBe(60);
  });

  it("works downwards for weight loss, counting only weigh-ins since the goal was set", () => {
    const g: Goal = { ...base, kind: "bodyweight", exerciseId: null, target: 62, startValue: 65 };
    expect(goalProgress(g, inputs)).toEqual({ current: 63, pct: 67, achieved: false, direction: "down", left: 1 });
    expect(goalProgress({ ...g, createdAt: "2026-11-01T00:00:00.000Z" }, inputs).current).toBe(65);
    expect(goalProgress({ ...g, target: 63 }, inputs).pct).toBe(100);
  });

  it("uses the typed number for custom goals and never shows 100% before it's reached", () => {
    const g: Goal = { ...base, kind: "custom", title: "Pull-ups", exerciseId: null, target: 10, unit: "reps", startValue: 0, currentValue: 9.99 };
    expect(goalProgress(g, inputs).pct).toBe(99);
    expect(goalProgress({ ...g, currentValue: null, startValue: null }, inputs)).toMatchObject({ current: null, pct: 0, achieved: false });
  });

  it("counts days to go", () => {
    expect(daysToGo({ ...base, dueOn: "2026-11-09" }, TODAY)).toBe(7);
    expect(daysToGo({ ...base, dueOn: "2026-10-31" }, TODAY)).toBe(-2);
    expect(daysToGo(base, TODAY)).toBeNull();
  });
});

describe("goal set-up", () => {
  it("starts a body weight goal from the latest weigh-in", () => {
    expect(newGoal("bodyweight", inputs).startValue).toBe(63);
    expect(newGoal("custom", inputs).unit).toBe("reps");
  });

  it("names goals that have no title", () => {
    expect(goalTitle(base, "Trap Bar Deadlift")).toBe("Trap Bar Deadlift 80 kg");
    expect(goalTitle({ ...base, kind: "bodyweight" }, undefined, "down")).toBe("Get down to 80 kg");
    expect(goalTitle({ ...base, title: " Big pull " })).toBe("Big pull");
  });

  it("won't save a goal that makes no sense", () => {
    expect(goalProblem({ ...base, exerciseId: null })).toMatch(/exercise/);
    expect(goalProblem({ ...base, target: 0 })).toMatch(/target/);
    expect(goalProblem({ ...base, kind: "custom", exerciseId: null })).toMatch(/what the goal is/);
    expect(goalProblem(base)).toBeNull();
  });

  it("puts open goals first, soonest date first", () => {
    const a = { ...base, id: "a", target: 70 };
    const b = { ...base, id: "b", dueOn: "2026-12-01" };
    const c = { ...base, id: "c", dueOn: "2026-11-20" };
    expect(sortGoals([a, b, c], inputs).map((g) => g.id)).toEqual(["c", "b", "a"]);
  });

  it("round-trips the row", () => {
    expect(fromGoalRow({ ...toGoalRow(base, "c1"), target: "80" as unknown as number })).toEqual(base);
    expect(toGoalRow({ ...base, currentValue: 5 }, "c1").current_value).toBeNull();
  });
});

describe("badges", () => {
  it("earns badges from what's been done, with progress towards the rest", () => {
    const b = badges({ checkIns: 2, bestHabitRun: 9, goalsReached: 0, formChecks: 1, liftsLogged: 12 });
    const by = Object.fromEntries(b.map((x) => [x.key, x]));
    expect(by["first-checkin"]?.earned).toBe(true);
    expect(by["four-checkins"]).toMatchObject({ earned: false, have: 2, need: 4 });
    expect(by["habit-7"]?.earned).toBe(true);
    expect(by["habit-30"]?.have).toBe(9);
    expect(by["ten-lifts"]).toMatchObject({ earned: true, have: 10 });
  });

  it("keeps the longest habit run even after a miss", () => {
    const h: Habit = { id: "h", kind: "water", title: "Water", days: EVERY_DAY, createdAt: "2026-10-01T08:00:00.000Z" };
    const t = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-06", TODAY].map((day) => ({ habitId: "h", day }));
    expect(longestHabitRun(h, t, TODAY)).toBe(4);
    expect(longestHabitRun(h, [], TODAY)).toBe(0);
  });
});

describe("demo store", () => {
  it("saves to storage and checks the goal first", async () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = createDemoGoalStore(storage, null, new Date(`${TODAY}T12:00:00`));
    expect(a.get().goals).toHaveLength(3);
    await a.save({ ...base, id: "new" });
    await a.remove("demo-goal-2");
    await expect(a.save({ ...base, target: -1 })).rejects.toThrow(/target/);
    expect(createDemoGoalStore(storage).get().goals.map((g) => g.id)).toEqual(["demo-goal-1", "demo-goal-3", "new"]);
  });
});
