import { describe, expect, it } from "vitest";
import { endingSoon, nextBlock, programmeRunway, weeksLeft } from "./runway";
import type { Program, WorkoutItem } from "./types";

const now = new Date("2026-11-19T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5).toISOString();

describe("programme runway", () => {
  it("counts the days left", () => {
    expect(programmeRunway({ createdAt: daysAgo(52), weeks: 8 }, now)).toEqual({ daysLeft: 4, status: "ending", label: "Ends in 4 days" });
    expect(programmeRunway({ createdAt: daysAgo(10), weeks: 8 }, now).status).toBe("ok");
    expect(programmeRunway({ createdAt: daysAgo(30), weeks: 4 }, now)).toEqual({ daysLeft: -2, status: "ended", label: "Ended 2 days ago" });
  });

  it("lists the ones ending first", () => {
    const list = [{ id: "a", createdAt: daysAgo(10), weeks: 8 }, { id: "b", createdAt: daysAgo(30), weeks: 4 }, { id: "c", createdAt: daysAgo(52), weeks: 8 }];
    expect(endingSoon(list, now).map((x) => x.id)).toEqual(["b", "c"]);
  });
});

const item = (p: Partial<WorkoutItem> = {}): WorkoutItem => ({ key: "i", group: "A", exerciseId: 1, sets: 3, reps: "5", kg: 100, rpe: 8, restSeconds: 120, lastTime: "", ...p });
const prog: Program = { name: "Block", weeks: 2, days: [
  { key: "a", week: 1, dayIndex: 0, name: "Lower", ofWeeks: 2, minutes: 45, items: [item()] },
  { key: "b", week: 2, dayIndex: 0, name: "Lower", ofWeeks: 2, minutes: 45, items: [item({ kg: 102.5 })] },
  { key: "c", week: 2, dayIndex: 3, name: "Upper", ofWeeks: 2, minutes: 45, items: [item({ exerciseId: 2, kg: 60 })] },
] };

describe("next block", () => {
  it("adds weeks after the last one, copied from it", () => {
    const r = nextBlock(prog, 3);
    expect(r.firstWeek).toBe(3);
    expect(r.added).toBe(6);
    expect(r.program.weeks).toBe(5);
    expect(r.program.days.filter((d) => d.week === 5).map((d) => d.name)).toEqual(["Lower", "Upper"]);
    // The original weeks are untouched.
    expect(r.program.days.filter((d) => d.week <= 2)).toEqual(prog.days);
  });

  it("says how many weeks are left", () => {
    expect(weeksLeft(prog, 2)).toBe(0);
    expect(weeksLeft(prog, 1)).toBe(1);
    // Empty planned weeks don't count.
    expect(weeksLeft({ ...prog, weeks: 8 }, 2)).toBe(0);
  });
});
