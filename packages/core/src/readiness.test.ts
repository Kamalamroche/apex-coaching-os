import { describe, expect, it } from "vitest";
import { INITIAL_HISTORY, INITIAL_WORKOUT } from "./data/workout";
import { trendFromSets } from "./plateau";
import { addReadinessPoint, describeLighter, lighterSession, vsUsual, readinessBand, readinessOf, readinessReason, readinessScore, weakSpots } from "./readiness";
import { initialSets } from "./session";
import { buildSummary, nextHistory, summaryMessage } from "./summary";
import type { SessionLog } from "./types";

describe("readiness score", () => {
  it("runs from 0 (all 1s) to 100 (all 5s)", () => {
    expect(readinessScore({ sleep: 1, energy: 1, soreness: 1, stress: 1 })).toBe(0);
    expect(readinessScore({ sleep: 5, energy: 5, soreness: 5, stress: 5 })).toBe(100);
    expect(readinessScore({ sleep: 3, energy: 3, soreness: 3, stress: 3 })).toBe(50);
  });

  it("clamps out-of-range answers", () => {
    expect(readinessScore({ sleep: 9, energy: 0, soreness: 5, stress: 1 })).toBe(50);
  });

  it("bands at 70 and 45", () => {
    expect(readinessBand(70)).toBe("ready");
    expect(readinessBand(69)).toBe("steady");
    expect(readinessBand(45)).toBe("steady");
    expect(readinessBand(44)).toBe("low");
  });

  it("names what's low, worst first", () => {
    const a = { sleep: 2, energy: 4, soreness: 1, stress: 3 };
    expect(weakSpots(a)).toEqual(["soreness", "sleep"]);
    expect(readinessReason(readinessOf(a))).toBe("Readiness 38/100: soreness and sleep are low today.");
    expect(readinessReason(readinessOf({ sleep: 5, energy: 4, soreness: 4, stress: 5 }))).toBe("Readiness 88/100: good to go.");
  });
});

describe("lighter session", () => {
  const w = INITIAL_WORKOUT;

  it("leaves a ready day alone", () => {
    expect(lighterSession(w, "ready")).toBe(w);
  });

  it("steady: 5% lighter, loadable, RPE one lower, same sets", () => {
    const l = lighterSession(w, "steady");
    w.items.forEach((it, i) => {
      const li = l.items[i]!;
      expect(li.exerciseId).toBe(it.exerciseId);
      expect(li.sets).toBe(it.sets);
      expect(li.rpe).toBe(Math.max(5, it.rpe - 1));
      if (it.kg) expect(li.kg).toBeLessThan(it.kg);
      expect(li.kg % 0.5).toBe(0);
    });
  });

  it("low: 10% lighter and one set fewer on 3+ sets, per-set plans trimmed", () => {
    const base = { ...w, items: [{ ...w.items[0]!, sets: 3, kg: 100, setPlan: [{ reps: "5", kg: 100 }, { reps: "5", kg: 100 }, { reps: "8", kg: 80 }] }, { ...w.items[1]!, sets: 2 }] };
    const l = lighterSession(base, "low");
    expect(l.items[0]).toMatchObject({ sets: 2, kg: 90, setPlan: [{ reps: "5", kg: 90 }, { reps: "5", kg: 90 }] });
    expect(l.items[1]!.sets).toBe(2);
  });

  it("describes the rules in plain words", () => {
    expect(describeLighter("low")).toBe("10% less weight, one set fewer on exercises with 3 or more, target RPE 1 lower");
  });
});

describe("readiness in the summary and history", () => {
  const w = INITIAL_WORKOUT;
  const sets = initialSets(w);
  for (const k of Object.keys(sets)) sets[k] = sets[k]!.map((s) => ({ ...s, done: true }));
  const log = (adjusted: boolean): SessionLog => ({
    workoutName: w.name, sets: 10, volumeKg: 1000, minutes: 40, rpe: 8, prs: 0,
    summary: { ...buildSummary(w, sets, 40, INITIAL_HISTORY), readiness: readinessOf({ sleep: 2, energy: 2, soreness: 3, stress: 3 }, adjusted) },
  });

  it("tells the coach the score and the choice", () => {
    expect(summaryMessage(log(true))).toContain("🔋 Readiness 38/100: sleep and energy are low today. Chose the lighter session.");
    expect(summaryMessage(log(false))).not.toContain("Chose the lighter");
  });

  it("a lighter day doesn't count towards a plateau", () => {
    expect(nextHistory(INITIAL_HISTORY, log(true), w, sets).trend).toEqual(INITIAL_HISTORY.trend);
    expect(nextHistory(INITIAL_HISTORY, log(false), w, sets).trend).not.toEqual(INITIAL_HISTORY.trend);
  });

  it("trendFromSets skips lighter sessions", () => {
    const rows = [
      { session_id: "b", exercise_id: 1, load_kg: 80, reps: 5, rpe: null },
      { session_id: "a", exercise_id: 1, load_kg: 100, reps: 5, rpe: null },
    ];
    expect(trendFromSets(rows)[1]).toHaveLength(2);
    expect(trendFromSets(rows, new Set(["b"]))[1]).toHaveLength(1);
  });
});

describe("readiness trend", () => {
  const pts = (scores: number[]) => scores.map((score, i) => ({ at: `2026-10-${10 + i}T07:00:00.000Z`, score }));

  it("compares today with the average of the last 7, once there are 3", () => {
    expect(vsUsual(pts([70, 80]), 50)).toBeNull();
    expect(vsUsual(pts([70, 80, 90]), 50)).toEqual({ usual: 80, diff: -30 });
    expect(vsUsual(pts([0, 0, 60, 60, 60, 60, 60, 60, 60]), 70)).toEqual({ usual: 60, diff: 10 });
  });

  it("keeps the last 14 points", () => {
    expect(addReadinessPoint(pts(Array(14).fill(50)), { at: "x", score: 99 })).toHaveLength(14);
    expect(addReadinessPoint(undefined, { at: "x", score: 99 }).at(-1)?.score).toBe(99);
  });
});
