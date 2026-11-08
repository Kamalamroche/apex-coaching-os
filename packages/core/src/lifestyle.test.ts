import { describe, expect, it } from "vitest";
import {
  addDays, againstTarget, blankIntake, createDemoLifestyleStore, dayTotals, EVERY_DAY, fromFoodRow, fromHabitRow, fromTargetsRow, habitCompliance, habitDays,
  habitStreak, habitsOn, healthFlags, intakeProblem, kcalFromMacros, loggedAverage, toFoodRow, toggleTick, toHabitRow, toTargetsRow,
  formatMl, fromWaterRow, toWaterRow, waterGoalMl, waterHabitOn, waterLogOn, waterOn,
  type FoodEntry, type Habit, type HabitTick, type WaterEntry,
} from "./lifestyle";

// 2026-11-02 is a Monday.
const TODAY = "2026-11-02";
const daily: Habit = { id: "h1", kind: "water", title: "Water", days: EVERY_DAY, createdAt: "2026-10-20T08:00:00.000Z" };
const weekdays: Habit = { id: "h2", kind: "steps", title: "Steps", days: [0, 1, 2, 3, 4], createdAt: "2026-10-20T08:00:00.000Z" };
const ticks = (id: string, ...days: string[]): HabitTick[] => days.map((day) => ({ habitId: id, day }));

describe("dates", () => {
  it("adds days across a month end", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays(TODAY, -2)).toBe("2026-10-31");
  });
});

describe("habits", () => {
  it("applies only on its days and from when it was set", () => {
    expect(habitsOn([daily, weekdays], "2026-11-01").map((h) => h.id)).toEqual(["h1"]); // Sunday
    expect(habitsOn([daily, weekdays], TODAY).map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(habitsOn([daily], "2026-10-19")).toEqual([]);
  });

  it("toggles a tick on and off without doubling", () => {
    let t = toggleTick([], "h1", TODAY, true);
    t = toggleTick(t, "h1", TODAY, true);
    expect(t).toEqual([{ habitId: "h1", day: TODAY }]);
    expect(toggleTick(t, "h1", TODAY, false)).toEqual([]);
  });

  it("counts a streak back from today, not broken by today still to do", () => {
    const t = ticks("h1", "2026-11-01", "2026-10-31", "2026-10-30", "2026-10-28");
    expect(habitStreak(daily, t, TODAY)).toBe(3);
    expect(habitStreak(daily, [...t, { habitId: "h1", day: TODAY }], TODAY)).toBe(4);
  });

  it("skips days a habit doesn't apply when counting a streak", () => {
    // Friday 30 Oct and today Monday: the weekend in between doesn't break it.
    expect(habitStreak(weekdays, ticks("h2", "2026-10-30", "2026-10-29", TODAY), TODAY)).toBe(3);
  });

  it("works out due, done and compliance over a week", () => {
    const t = [...ticks("h1", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", TODAY), ...ticks("h2", "2026-10-27", TODAY)];
    const days = habitDays([daily, weekdays], t, TODAY);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: "2026-10-27", due: 2, done: 2 });
    expect(days[5]).toEqual({ day: "2026-11-01", due: 1, done: 1 });
    // 7 + 5 due, 7 + 2 done.
    expect(habitCompliance([daily, weekdays], t, TODAY)).toBe(75);
    expect(habitCompliance([], [], TODAY)).toBeNull();
  });
});

describe("nutrition", () => {
  const f = (id: string, day: string, kcal: number, p = 0, c = 0, fat = 0): FoodEntry => ({ id, day, meal: "lunch", name: id, kcal, proteinG: p, carbsG: c, fatG: fat });
  const food = [f("a", TODAY, 500, 30, 50, 10), f("b", TODAY, 300, 20, 10, 5), f("c", "2026-11-01", 2000, 100, 200, 60), f("old", "2026-10-01", 9999)];

  it("totals a day", () => {
    expect(dayTotals(food, TODAY)).toEqual({ kcal: 800, proteinG: 50, carbsG: 60, fatG: 15 });
  });

  it("averages only the days something was logged", () => {
    const { days, avg } = loggedAverage(food, TODAY);
    expect(days).toBe(2);
    expect(avg.kcal).toBe(1400);
  });

  it("checks macros add up and compares against target", () => {
    expect(kcalFromMacros({ proteinG: 120, carbsG: 210, fatG: 60 })).toBe(1860);
    expect(againstTarget(1800, 1900)).toBe("on");
    expect(againstTarget(1500, 1900)).toBe("under");
    expect(againstTarget(2200, 1900)).toBe("over");
  });
});

describe("questionnaire", () => {
  it("lists health answers that need a chat", () => {
    const a = blankIntake();
    expect(healthFlags(a)).toEqual([]);
    a.health.chest = true;
    expect(healthFlags(a)).toHaveLength(1);
  });

  it("needs a goal, detail for any yes, and the confirm box", () => {
    const a = blankIntake();
    expect(intakeProblem(a)).toMatch(/goal/);
    a.goal = "Lose 5 kg";
    a.health.joints = true;
    expect(intakeProblem(a)).toMatch(/health/);
    a.healthDetail = "Old knee injury";
    expect(intakeProblem(a)).toMatch(/confirm/);
    a.confirmed = true;
    expect(intakeProblem(a)).toBeNull();
  });
});

describe("rows", () => {
  it("round-trips habits, targets and food", () => {
    expect(fromHabitRow(toHabitRow(daily, "c1"))).toEqual(daily);
    const t = { kcal: 1900, proteinG: 120, carbsG: 210, fatG: 60, note: "" };
    expect(toTargetsRow(t, "c1").note).toBeNull();
    expect(fromTargetsRow(toTargetsRow(t, "c1"))).toEqual(t);
    const food: FoodEntry = { id: "x", day: TODAY, meal: "snack", name: "Banana", kcal: 105, proteinG: 1, carbsG: 27, fatG: 0 };
    expect(fromFoodRow({ ...toFoodRow(food, "c1"), protein_g: "1" as unknown as number })).toEqual(food);
  });
});

describe("demo store", () => {
  it("saves to storage and shares the change", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = createDemoLifestyleStore(storage, null, new Date(`${TODAY}T12:00:00`));
    expect(a.get().habits).toHaveLength(3);
    a.saveHabit({ ...daily, id: "new" });
    a.setHabitDone("new", TODAY, true);
    a.removeHabit("demo-habit-2");
    const b = createDemoLifestyleStore(storage, null, new Date(`${TODAY}T12:00:00`));
    expect(b.get().habits.map((h) => h.id)).toEqual(["demo-habit-1", "demo-habit-3", "new"]);
    expect(b.get().ticks.some((t) => t.habitId === "demo-habit-2")).toBe(false);
    expect(b.get().ticks).toContainEqual({ habitId: "new", day: TODAY });
  });
});

describe("water", () => {
  it("reads the daily goal from the habit's wording", () => {
    expect(waterGoalMl("Drink 2.5 L of water")).toBe(2500);
    expect(waterGoalMl("3 litres a day")).toBe(3000);
    expect(waterGoalMl("Drink 2,000 ml")).toBe(2000);
    expect(waterGoalMl("1,5 l water")).toBe(1500);
    expect(waterGoalMl("8 glasses of water")).toBe(2000);
    expect(waterGoalMl("Stay hydrated")).toBe(2500);
    expect(waterGoalMl("50 L")).toBe(8000);
  });

  it("adds up a day and lists it newest first", () => {
    const e: WaterEntry[] = [
      { id: "a", day: TODAY, ml: 250, at: "2026-11-02T08:00:00.000Z" },
      { id: "b", day: TODAY, ml: 500, at: "2026-11-02T12:00:00.000Z" },
      { id: "c", day: "2026-11-01", ml: 750, at: "2026-11-01T12:00:00.000Z" },
    ];
    expect(waterOn(e, TODAY)).toBe(750);
    expect(waterLogOn(e, TODAY).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("formats ml and litres", () => {
    expect(formatMl(750)).toBe("750 ml");
    expect(formatMl(1650)).toBe("1.65 L");
    expect(formatMl(2000)).toBe("2 L");
    expect(formatMl(2500)).toBe("2.5 L");
  });

  it("round-trips a database row", () => {
    const e: WaterEntry = { id: "w1", day: TODAY, ml: 250, at: "2026-11-02T08:00:00.000Z" };
    expect(fromWaterRow(toWaterRow(e, "c1"))).toEqual(e);
  });

  it("finds the water habit due today", () => {
    expect(waterHabitOn([weekdays, daily], TODAY)?.id).toBe("h1");
    expect(waterHabitOn([weekdays], TODAY)).toBeUndefined();
  });

  it("keeps drinks in the demo store", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = createDemoLifestyleStore(storage, null, new Date("2026-11-02T12:00:00"));
    const before = waterOn(s.get().water, TODAY);
    s.addWater({ id: "x", day: TODAY, ml: 250, at: "2026-11-02T12:00:00.000Z" });
    expect(waterOn(s.get().water, TODAY)).toBe(before + 250);
    s.removeWater("x");
    expect(waterOn(createDemoLifestyleStore(storage, null, new Date("2026-11-02T12:00:00")).get().water, TODAY)).toBe(before);
  });
});

describe("steps and bedtime goals", () => {
  it("reads the step goal", async () => {
    const { stepsGoal } = await import("./lifestyle");
    expect(stepsGoal("Walk 8,000 steps")).toBe(8000);
    expect(stepsGoal("10k steps a day")).toBe(10000);
    expect(stepsGoal("Walk 12000 steps")).toBe(12000);
    expect(stepsGoal("Go for a walk")).toBe(8000);
  });
  it("reads the bedtime goal and compares clock times across midnight", async () => {
    const { bedtimeGoal } = await import("./lifestyle");
    const { clockLabel, clockMinutes } = await import("./recoveryTrends");
    expect(bedtimeGoal("In bed by 10:30 pm")).toBe(270);
    expect(bedtimeGoal("Bed by 23:00")).toBe(300);
    expect(bedtimeGoal("in bed by 11pm")).toBe(300);
    expect(bedtimeGoal("Bed by 10.30")).toBe(270);
    expect(bedtimeGoal("Early night")).toBe(270);
    expect(bedtimeGoal("Bed by 12:30 am")).toBe(390);
    expect(clockLabel(bedtimeGoal("In bed by 10:30 pm"))).toBe("22:30");
    const d = new Date(); d.setHours(0, 15, 0, 0);
    expect(clockMinutes(d.toISOString())).toBeGreaterThan(bedtimeGoal("In bed by 10:30 pm"));
  });
});
