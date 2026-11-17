import { describe, expect, it } from "vitest";
import type { CheckIn, Measurement } from "./checkins";
import { addDays } from "./lifestyle";
import { progressReport, reportLabel, reportMessage } from "./report";
import type { RecentSession } from "./types";

const s = (at: string, bests: RecentSession["bests"] = [], volumeKg = 3000): RecentSession => ({ at: `${at}T18:00:00Z`, workoutName: "Lower A", sets: 15, volumeKg, minutes: 45, bests });
const m = (id: string, at: string, v: Partial<Measurement>): Measurement => ({ id, measuredAt: `${at}T08:00:00Z`, checkInId: null, ...v });
const ci = (at: string, energy: number, mood: number): CheckIn => ({
  id: at, submittedAt: `${at}T09:00:00Z`, weightKg: null, sleepHours: 7, energy, mood, stress: null, hunger: null, training: null, nutrition: null,
  wins: "", struggles: "", note: "", coachReply: null, reviewedAt: null,
});

const today = "2026-11-08";
const base = { measurements: [], checkIns: [], habits: [], ticks: [], today };

describe("progress report", () => {
  it("covers the last 28 days and labels them", () => {
    const r = progressReport({ ...base, sessions: [] });
    expect(r.from).toBe("2026-10-12");
    expect(r.to).toBe(today);
    expect(r.label).toBe("12 Oct – 8 Nov");
    expect(reportLabel("2026-01-05", "2026-02-01")).toBe("5 Jan – 1 Feb");
  });

  it("counts sessions per week and against the month before", () => {
    const sessions = [s("2026-10-12"), s("2026-10-14"), s("2026-10-20"), s("2026-10-22"), s("2026-10-27"), s("2026-10-29"), s("2026-11-03"), s("2026-11-05"), s("2026-10-01"), s("2026-09-01")];
    const r = progressReport({ ...base, sessions });
    expect(r.sessions).toBe(8);
    expect(r.weeks).toEqual([2, 2, 2, 2]);
    expect(r.steadyWeeks).toBe(4);
    expect(r.previousSessions).toBe(1);
    expect(r.minutes).toBe(360);
    expect(r.highlights[0]).toMatch(/at least twice every week/);
  });

  it("keeps the best lift per exercise and the jump over the whole month", () => {
    const sessions = [
      s("2026-10-15", [{ exerciseId: 1, exercise: "Back squat", kg: 100, previousKg: 95 }]),
      s("2026-10-29", [{ exerciseId: 1, exercise: "Back squat", kg: 105, previousKg: 100 }, { exerciseId: 2, exercise: "Bench press", kg: 70, previousKg: 67.5 }]),
    ];
    const r = progressReport({ ...base, sessions });
    expect(r.bests).toEqual([
      { exercise: "Back squat", kg: 105, previousKg: 95, at: "2026-10-29T18:00:00Z" },
      { exercise: "Bench press", kg: 70, previousKg: 67.5, at: "2026-10-29T18:00:00Z" },
    ]);
    expect(r.highlights.join(" ")).toContain("Back squat, up 10 kg to 105 kg");
  });

  it("measures body change from the last reading before the month", () => {
    const measurements = [m("a", "2026-09-30", { weightKg: 80, waistCm: 90 }), m("b", "2026-10-20", { weightKg: 79 }), m("c", "2026-11-06", { weightKg: 78.4, waistCm: 87.5 })];
    const r = progressReport({ ...base, sessions: [s("2026-11-01")], measurements });
    expect(r.body.map((b) => [b.key, b.from, b.to, b.change])).toEqual([["weightKg", 80, 78.4, -1.6], ["waistCm", 90, 87.5, -2.5]]);
    expect(r.highlights).toContain("Waist down 2.5 cm.");
  });

  it("averages check-in ratings and habit ticks", () => {
    const habits = [{ id: "h", kind: "water" as const, title: "Water", days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-01-01T00:00:00Z" }];
    const ticks = Array.from({ length: 21 }, (_, i) => ({ habitId: "h", day: addDays("2026-10-12", i) }));
    const r = progressReport({ ...base, sessions: [s("2026-11-01")], checkIns: [ci("2026-10-19", 3, 4), ci("2026-11-02", 5, 4), ci("2026-10-05", 2, 2)], habits, ticks });
    expect(r.checkIns).toBe(2);
    expect(r.ratings[0]).toEqual({ key: "energy", label: "Energy", avg: 4, previousAvg: 2 });
    expect(r.habits).toBe(75);
  });

  it("suggests a restart when nothing was logged", () => {
    const r = progressReport({ ...base, sessions: [s("2026-09-20")] });
    expect(r.highlights).toEqual(["No sessions logged in the last 4 weeks. A short, easy restart session would be a good first step."]);
  });

  it("writes the message with the coach's note first", () => {
    const r = progressReport({ ...base, sessions: [s("2026-10-20", [{ exerciseId: 1, exercise: "Deadlift", kg: 140, previousKg: 130 }]), s("2026-09-30")] });
    const text = reportMessage(r, "Sarah", "  Brilliant month! ");
    expect(text.split("\n").slice(0, 3)).toEqual(["📊 Your month in review, Sarah (12 Oct – 8 Nov)", "", "Brilliant month!"]);
    expect(text).toContain("🏋️ 1 session · 45 min · 3,000 kg lifted");
    expect(text).toContain("📈 vs the month before: ±0 sessions");
    expect(text).toContain("🏆 Deadlift: 140 kg (was 130 kg)");
  });
});
