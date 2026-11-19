import { describe, expect, it } from "vitest";
import { sessionPrep } from "./sessionPrep";

describe("before-session card", () => {
  it("puts health flags, injuries, pinned notes and low readiness first", () => {
    const p = sessionPrep({
      name: "Priya Sharma",
      workout: { name: "Lower A", week: 4, ofWeeks: 8, minutes: 48, items: [{ key: "a", group: "A", exerciseId: 1, sets: 4, reps: "5", kg: 70, rpe: 8, restSeconds: 150, lastTime: "", note: "pause at the bottom" }] },
      previous: { workoutName: "Upper A", sets: 16, volumeKg: 5234.4, minutes: 52 },
      intake: { health: { joints: true, heart: false }, healthDetail: "", injuries: "Left knee, old ACL", goal: "Run a half marathon" },
      pinned: ["Prefers cues on hips, not knees"],
      healthReasons: [],
      readiness: 42,
    });
    expect(p.watch).toEqual(["Bone, joint or muscle problem", "Injuries: Left knee, old ACL", "Prefers cues on hips, not knees", "Low readiness last time (42/100): ask how they slept"]);
    expect(p.lastTime).toBe("Upper A: 16 sets, 5,234 kg moved in 52 min");
    expect(p.plan?.title).toBe("Lower A · about 48 min");
    expect(p.plan?.lines[0]).toMatch(/^A · .+ · 4×5 at 70 kg · pause at the bottom$/);
    expect(p.goal).toBe("Run a half marathon");
  });

  it("copes with a client APEX knows little about", () => {
    expect(sessionPrep({ name: "New", workout: null, previous: null, intake: null, pinned: [], healthReasons: [] })).toEqual({ watch: [], lastTime: null, plan: null, goal: null });
  });
});
