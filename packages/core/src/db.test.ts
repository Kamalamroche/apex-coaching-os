import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { formatLastTime, latestSetByExercise, toItemRows, toLoggedSetRows, toMessages, toSessionLog, toWorkout, type WorkoutRow } from "./db";
import { initialSets } from "./session";

const row: WorkoutRow = { id: "w1", name: "Lower A · Strength", week: 4, est_minutes: 48 };

describe("workout rows", () => {
  it("round-trips a workout through database rows", () => {
    const rows = toItemRows(INITIAL_WORKOUT, "w1");
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3]);
    expect(rows[2]).toMatchObject({ group_label: "B2", reps: "40s", load_kg: null });
    const back = toWorkout(row, [...rows].reverse(), 8);
    expect(back.items.map(({ lastTime: _l, ...rest }) => rest)).toEqual(INITIAL_WORKOUT.items.map(({ lastTime: _l, ...rest }) => rest));
    expect(back.items[0]?.lastTime).toBe("First time");
  });

  it("fills last time from the most recent logged set", () => {
    const latest = latestSetByExercise([
      { exercise_id: 15, load_kg: 70, reps: 5, seconds: null, rpe: 8 },
      { exercise_id: 15, load_kg: 67.5, reps: 5, seconds: null, rpe: 7 },
      { exercise_id: 14, load_kg: null, reps: null, seconds: 35, rpe: null },
    ]);
    const w = toWorkout(row, toItemRows(INITIAL_WORKOUT, "w1"), 8, latest);
    expect(w.items[0]?.lastTime).toBe("70 kg × 5 @ RPE 8");
    expect(w.items[2]?.lastTime).toBe("35 s");
  });
});

describe("formatLastTime", () => {
  it("handles bodyweight reps and missing history", () => {
    expect(formatLastTime(undefined)).toBe("First time");
    expect(formatLastTime({ load_kg: null, reps: 8, seconds: null, rpe: null })).toBe("8 reps");
  });
});

describe("logged sets", () => {
  it("saves only completed sets and stores holds as seconds", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    sets.a = sets.a!.map((s, i) => ({ ...s, done: i < 2 }));
    sets.b2 = sets.b2!.map((s, i) => ({ ...s, done: i === 0 }));
    const rows = toLoggedSetRows(sets, INITIAL_WORKOUT, "s1");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ exercise_id: 15, set_index: 0, load_kg: 70, reps: 5, seconds: null });
    expect(rows[2]).toMatchObject({ exercise_id: 14, reps: null, seconds: 40, load_kg: null });
  });
});

describe("sessions and messages", () => {
  it("only a finished session becomes a log", () => {
    const base = { id: "s", started_at: "2026-10-25T09:00:00Z", session_rpe: 8, sets_completed: 12, volume_kg: 3200, prs: 1 };
    expect(toSessionLog({ ...base, finished_at: null }, "Lower A")).toBeNull();
    expect(toSessionLog({ ...base, finished_at: "2026-10-25T09:47:00Z" }, "Lower A")).toEqual({ workoutName: "Lower A", sets: 12, volumeKg: 3200, minutes: 47, rpe: 8, prs: 1 });
  });

  it("labels messages by sender", () => {
    const m = toMessages([{ sender_id: "c", body: "Hi", created_at: "2026-10-25T08:02:00Z" }, { sender_id: "x", body: "Hey", created_at: "2026-10-25T08:15:00Z" }], "c");
    expect(m.map((x) => x.from)).toEqual(["coach", "client"]);
  });
});
