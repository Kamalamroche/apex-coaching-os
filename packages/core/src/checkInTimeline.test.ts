import { describe, expect, it } from "vitest";
import type { CheckIn } from "./checkins";
import { checkInTimeline } from "./checkInTimeline";
import { INITIAL_PROGRESS } from "./data/progress";

const base: Omit<CheckIn, "id" | "submittedAt"> = { weightKg: null, sleepHours: null, energy: null, mood: null, stress: null, hunger: null, training: null, nutrition: null, wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null };
const ci = (i: number, p: Partial<CheckIn>): CheckIn => ({ ...base, id: `c${i}`, submittedAt: new Date(Date.UTC(2026, 9, 1 + i * 7, 9)).toISOString(), ...p });

describe("checkInTimeline", () => {
  it("puts weeks oldest first and keeps only the last six", () => {
    const list = Array.from({ length: 8 }, (_, i) => ci(i, { weightKg: 70 - i * 0.2 })).reverse();
    const t = checkInTimeline(list);
    expect(t.weeks.map((w) => w.id)).toEqual(["c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(t.weeks[0]!.label).toBe("15 Oct");
    expect(t.rows[0]!.label).toBe("Weight (kg)");
    expect(t.rows[0]!.cells.every((c) => c.tone === null)).toBe(true);
    expect(t.rows[0]!.streak).toBe("Weight down 5 check-ins running");
  });
  it("colours ratings by which way is better, and flags a three-week slide", () => {
    const t = checkInTimeline([ci(0, { energy: 5, stress: 2 }), ci(1, { energy: 4, stress: 3 }), ci(2, { energy: 3, stress: 3 }), ci(3, { energy: 2, stress: 2 })]);
    const energy = t.rows.find((r) => r.label === "Energy")!;
    expect(energy.cells.map((c) => c.tone)).toEqual([null, "bad", "bad", "bad"]);
    expect(energy.streak).toBe("Energy down 3 check-ins running");
    const stress = t.rows.find((r) => r.label === "Stress")!;
    expect(stress.cells.map((c) => c.tone)).toEqual([null, "bad", null, "good"]);
    expect(t.rows.find((r) => r.label === "Mood")).toBeUndefined();
  });
  it("lines up the coach's own questions by id and notes repeated No", () => {
    const q = (v: boolean | string | number, id = "q1", kind: "yesno" | "text" | "scale" = "yesno") => ({ id, question: id === "q1" ? "Steps most days?" : "Anything to change?", kind, value: v });
    const t = checkInTimeline([ci(0, { answers: [q(true)] }), ci(1, { answers: [q(false), q("Less cardio", "q2", "text")] }), ci(2, { answers: [q(false)], wins: "PB on squat" })]);
    const steps = t.rows.find((r) => r.label === "Steps most days?")!;
    expect(steps.cells.map((c) => c.text)).toEqual(["Yes", "No", "No"]);
    expect(steps.cells[1]!.tone).toBe("bad");
    expect(steps.streak).toBe('"No" 2 check-ins running');
    expect(t.rows.find((r) => r.label === "Anything to change?")!.cells.map((c) => c.text)).toEqual(["", "Less cardio", ""]);
    expect(t.rows[t.rows.length - 1]!.label).toBe("Wins");
  });
  it("works on the demo data", () => {
    const t = checkInTimeline(INITIAL_PROGRESS.checkIns);
    expect(t.weeks.length).toBe(5);
    expect(t.rows.some((r) => r.label === "How confident do you feel about next week?")).toBe(true);
  });
});
