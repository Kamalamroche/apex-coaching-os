import { describe, expect, it } from "vitest";
import { trainingWeek } from "./story";

const s = (at: string) => ({ at, workoutName: "A", sets: 10, volumeKg: 1000, minutes: 45, bests: [] });

describe("trainingWeek", () => {
  it("uses the real calendar week with today marked", () => {
    const w = trainingWeek({ today: "2026-11-16", sessions: [], plannedDays: [0, 2, 4] });
    expect(w.days.map((d) => d.date)).toEqual([16, 17, 18, 19, 20, 21, 22]);
    expect(w.days[0]!.today).toBe(true);
    expect(w.todayLabel).toBe("Monday 16 November");
    expect(w.planned).toBe(3);
    expect(w.days.filter((d) => d.planned).map((d) => d.label)).toEqual(["Mon", "Wed", "Fri"]);
  });

  it("counts only sessions finished this week, across a month end", () => {
    const w = trainingWeek({ today: "2026-12-02", sessions: [s("2026-11-30T09:00:00"), s("2026-12-01T18:00:00"), s("2026-11-28T09:00:00")], plannedDays: [0] });
    expect(w.days[0]!.day).toBe("2026-11-30");
    expect(w.done).toBe(2);
    expect(w.planned).toBe(2);
  });

  it("adds today when a session was just saved", () => {
    const w = trainingWeek({ today: "2026-11-21", sessions: [], plannedDays: [5], trainedToday: true });
    expect(w.days[5]!.trained).toBe(true);
    expect(w.todayLabel).toBe("Saturday 21 November");
  });
});

import { headlineLift } from "./story";
describe("headlineLift", () => {
  it("picks the lift with the most sessions and keeps the last 8", () => {
    expect(headlineLift(undefined)).toBeNull();
    expect(headlineLift({ 1: [50] })).toBeNull();
    const h = headlineLift({ 1: [50, 55], 2: [60, 62, 64, 66, 68, 70, 72, 74, 76], 999999: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(h?.exerciseId).toBe(2);
    expect(h?.points).toEqual([62, 64, 66, 68, 70, 72, 74, 76]);
  });
});
