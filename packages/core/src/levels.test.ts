import { describe, expect, it } from "vitest";
import { LEVELS, POINTS, freshMilestone, levelFor, levelState, milestones, nextMilestones, type LevelInput } from "./levels";

const today = "2026-11-05";
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();
const session = (day: string, volumeKg = 5000, bests = 0) => ({
  at: at(day), workoutName: "Full body", sets: 18, volumeKg, minutes: 50,
  bests: Array.from({ length: bests }, (_, i) => ({ exerciseId: i, exercise: "Squat", kg: 100, previousKg: 95 })),
});
const base = (): LevelInput => ({ sessions: [], activities: [], habits: [], ticks: [], water: [], food: [], targets: null, checkIns: [], formChecks: 0, goalsReached: 0, today, lookback: 30 });

describe("levels", () => {
  it("starts at level 1 with nothing done", () => {
    const s = levelState(base());
    expect(s.points).toBe(0);
    expect(s).toMatchObject({ level: 1, name: LEVELS[0]!.name, next: LEVELS[1]!.from, progress: 0 });
  });

  it("scores workouts, bests, rings and check-ins, and counts this week", () => {
    const s = levelState({ ...base(), sessions: [session("2026-11-04", 5000, 2), session("2026-10-01")], checkIns: [at("2026-11-03")] });
    // Each workout day closes Train and (50 min) Move: 2 rings, but 2026-10-01 is outside the 30-day window.
    const expected = 2 * POINTS.workout + 2 * POINTS.best + POINTS.checkIn + 2 * POINTS.ring;
    expect(s.points).toBe(expected);
    expect(s.thisWeek).toBe(POINTS.workout + 2 * POINTS.best + POINTS.checkIn + 2 * POINTS.ring);
    expect(s.lines.find((l) => l.key === "workout")).toMatchObject({ count: 2, points: 200 });
  });

  it("maps points to the ladder and tops out", () => {
    expect(levelFor(LEVELS[2]!.from)).toMatchObject({ level: 3, name: LEVELS[2]!.name, progress: 0 });
    expect(levelFor(LEVELS[2]!.from - 1).level).toBe(2);
    const top = levelFor(1e9);
    expect(top).toMatchObject({ level: LEVELS.length, next: null, progress: 1 });
  });
});

describe("milestones", () => {
  it("marks the day each one was reached", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(`2026-10-${String(20 + i).padStart(2, "0")}`, 6000, i === 9 ? 1 : 0));
    const list = milestones({ ...base(), sessions });
    expect(list.find((m) => m.id === "workouts-1")).toMatchObject({ earned: true, at: "2026-10-20" });
    expect(list.find((m) => m.id === "workouts-10")).toMatchObject({ earned: true, at: "2026-10-29" });
    expect(list.find((m) => m.id === "kg-50000")).toMatchObject({ earned: true, at: "2026-10-28" });
    expect(list.find((m) => m.id === "bests-1")).toMatchObject({ earned: true, at: "2026-10-29" });
    expect(list.find((m) => m.id === "streak-7")).toMatchObject({ earned: true, at: "2026-10-26" });
    expect(list.find((m) => m.id === "workouts-25")).toMatchObject({ earned: false, have: 10 });
  });

  it("finds the next ones and a fresh one not seen yet", () => {
    const sessions = Array.from({ length: 9 }, (_, i) => session(`2026-10-1${i}`, 1000));
    const list = milestones({ ...base(), sessions: [...sessions, session("2026-11-04", 1000)] });
    expect(nextMilestones(list).length).toBe(3);
    const fresh = freshMilestone(list, today, []);
    expect(fresh?.at).toBe("2026-11-04");
    expect(freshMilestone(list, today, [fresh!.id])?.id).not.toBe(fresh!.id);
  });
});

describe("distance milestones", () => {
  it("counts km per sport and only suggests sports the client does", () => {
    const run = (day: string, km: number) => ({ id: day, sport: "run" as const, name: "Run", startedAt: new Date(`${day}T08:00:00`).toISOString(), metres: km * 1000, movingSeconds: km * 300, elapsedSeconds: km * 300, source: "manual" as const });
    const list = milestones({ ...base(), activities: [run("2026-10-01", 6), run("2026-10-08", 5), run("2026-10-15", 8)] });
    expect(list.find((m) => m.id === "run-10")).toMatchObject({ earned: true, at: "2026-10-08", title: "10 km run" });
    expect(list.find((m) => m.id === "run-50")).toMatchObject({ earned: false, have: 19 });
    const next = nextMilestones(list, 10).map((m) => m.kind);
    expect(next).toContain("run");
    expect(next).not.toContain("swim");
  });
});
