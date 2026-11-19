import { describe, expect, it } from "vitest";
import { programChanges, sameProgramme } from "./programSync";
import type { Program, WorkoutItem } from "./types";

const item = (exerciseId: number, p: Partial<WorkoutItem> = {}): WorkoutItem => ({ key: `k${exerciseId}`, group: "A", exerciseId, sets: 4, reps: "5", kg: 100, rpe: 8, restSeconds: 150, lastTime: "", ...p });
const prog = (days: { week: number; dayIndex: number; name: string; items: WorkoutItem[] }[], name = "Strength Block"): Program =>
  ({ name, weeks: 2, days: days.map((d, i) => ({ ...d, key: `d${i}`, ofWeeks: 2, minutes: 45 })) });

describe("programme changes", () => {
  const base = prog([{ week: 1, dayIndex: 0, name: "Lower A", items: [item(1), item(2, { sets: 3, reps: "8", kg: 50 })] }]);

  it("finds nothing when they match", () => {
    expect(programChanges(base, base)).toEqual([]);
  });

  it("names a changed load, an added and a removed exercise", () => {
    const next = prog([{ week: 1, dayIndex: 0, name: "Lower A", items: [item(1, { sets: 5 }), item(3, { sets: 3, reps: "10", kg: 0, rpe: 0 })] }]);
    const c = programChanges(base, next);
    expect(c.map((x) => x.kind)).toEqual(["changed", "added", "removed"]);
    expect(c[0]?.text).toMatch(/^W1 Mon · .+: 4×5 at 100 kg, RPE 8 → 5×5 at 100 kg, RPE 8$/);
    expect(c[1]?.text).toMatch(/added \(3×10\)$/);
  });

  it("spots new and removed days and renames", () => {
    const next = prog([{ week: 1, dayIndex: 0, name: "Lower A+", items: base.days[0]!.items }, { week: 1, dayIndex: 3, name: "Upper A", items: [] }], "Strength Block v2");
    expect(programChanges(base, next).map((x) => x.text)).toEqual(["Name: Strength Block → Strength Block v2", "W1 Mon: “Lower A” → “Lower A+”", "W1 Thu: new day “Upper A”"]);
    expect(programChanges(next, base).map((x) => x.kind)).toContain("day-removed");
  });

  it("notices a note-only change", () => {
    const next = prog([{ week: 1, dayIndex: 0, name: "Lower A", items: [item(1, { note: "pause" }), base.days[0]!.items[1]!] }]);
    expect(programChanges(base, next)[0]?.text).toMatch(/rest, notes or set targets changed/);
  });

  it("groups clients on the same programme, ignoring case and spaces", () => {
    const list = [{ id: "a", programName: "Strength Block" }, { id: "b", programName: " strength block " }, { id: "c", programName: "Fat Loss" }, { id: "d", programName: null }];
    expect(sameProgramme(list, "Strength Block").map((c) => c.id)).toEqual(["a", "b"]);
  });
});
