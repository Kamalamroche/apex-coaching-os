import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { initialSets, type SessionSets } from "./session";
import { stravaStrengthPost } from "./strava";

const finishAll = (sets: SessionSets): SessionSets =>
  Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.map((s) => ({ ...s, done: true }))]));

describe("stravaStrengthPost", () => {
  it("turns a finished session into a Strava strength activity with the coach's credit", () => {
    const end = new Date(2026, 10, 17, 19, 0, 0);
    const p = stravaStrengthPost(INITIAL_WORKOUT, finishAll(initialSets(INITIAL_WORKOUT)), 42, "Kamal Amroche", end);
    expect(p.sport_type).toBe("WeightTraining");
    expect(p.name).toBe(INITIAL_WORKOUT.name);
    expect(p.elapsed_time).toBe(2520);
    expect(p.start_date_local).toBe("2026-11-17T18:18:00");
    const lines = p.description.split("\n");
    expect(lines[0]).toMatch(/^Trap Bar Deadlift: 4 sets/);
    expect(p.description).toContain("Worked: glutes");
    expect(lines[lines.length - 1]).toBe("Programme by Kamal Amroche, coached on APEX");
    expect(p.description).not.toContain("\n\n\n");
  });
  it("leaves out unfinished exercises and works without a coach name", () => {
    const sets = initialSets(INITIAL_WORKOUT);
    sets.a = sets.a!.map((s) => ({ ...s, done: true }));
    const p = stravaStrengthPost(INITIAL_WORKOUT, sets, 0.2, null);
    expect(p.description.split("\n").filter((l) => /: \d+ sets?/.test(l))).toHaveLength(1);
    expect(p.elapsed_time).toBe(60);
    expect(p.description.endsWith("Logged on APEX")).toBe(true);
  });
});
