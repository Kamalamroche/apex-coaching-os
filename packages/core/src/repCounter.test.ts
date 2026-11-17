import { describe, expect, it } from "vitest";
import { cameraMoveFor, jointAngle, repResultText, startReps, stepReps, type CameraMove, type BodyPoint, type RepState } from "./repCounter";

/** A body with the main joint bent to `deg`, and (for push-ups) the body line at `line` degrees. Left side only. */
function body(move: CameraMove, deg: number, line = 180): BodyPoint[] {
  const pts: BodyPoint[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  const r = (deg * Math.PI) / 180;
  const b = { x: 0.5, y: 0.5, visibility: 0.9 };
  const a = { x: 0.3, y: 0.5, visibility: 0.9 };
  const c = { x: 0.5 + 0.2 * Math.cos(Math.PI - r), y: 0.5 - 0.2 * Math.sin(Math.PI - r), visibility: 0.9 };
  if (move === "pushup") {
    pts[11] = a; pts[13] = b; pts[15] = c;
    const lr = (line * Math.PI) / 180;
    pts[23] = { x: 0.6, y: 0.5, visibility: 0.9 };
    pts[27] = { x: 0.6 + 0.3 * Math.cos(Math.PI - lr), y: 0.5 - 0.3 * Math.sin(Math.PI - lr), visibility: 0.9 };
    // shoulder at a (0.3), hip at 0.6: the line angle is at the hip between shoulder and ankle
    pts[11] = { x: 0.3, y: 0.5, visibility: 0.9 };
  } else {
    pts[23] = a; pts[25] = b; pts[27] = c;
  }
  return pts;
}
const run = (move: CameraMove, angles: number[], line?: number[]): RepState =>
  angles.reduce((s, a, i) => stepReps(s, body(move, a, line?.[i] ?? 180)), startReps(move));

describe("jointAngle", () => {
  it("measures straight and right angles", () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
    expect(jointAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(90);
  });
  it("matches the test body", () => {
    const p = body("squat", 120);
    expect(jointAngle(p[23]!, p[25]!, p[27]!)).toBeCloseTo(120);
  });
});

describe("stepReps", () => {
  it("counts full squats", () => {
    const s = run("squat", [175, 140, 95, 90, 120, 165, 170, 98, 170]);
    expect(s.reps).toBe(2);
    expect(s.partials).toBe(0);
  });
  it("flags a half rep and doesn't count it", () => {
    const s = run("squat", [175, 125, 120, 170]);
    expect(s.reps).toBe(0);
    expect(s.partials).toBe(1);
    expect(s.cue).toBe("shallow");
  });
  it("ignores small wobbles at the top", () => {
    expect(run("squat", [175, 150, 170, 145, 172]).partials).toBe(0);
  });
  it("counts push-ups and notes sagging hips", () => {
    const s = run("pushup", [170, 90, 170, 88, 170], [178, 175, 178, 140, 176]);
    expect(s.reps).toBe(2);
    expect(s.hips).toBe(1);
    expect(s.cue).toBe("hips");
  });
  it("waits when the body isn't in view", () => {
    const s = stepReps(startReps("squat"), null);
    expect(s.seen).toBe(false);
    const hidden = body("squat", 90).map((p) => ({ ...p, visibility: 0.1 }));
    expect(stepReps(s, hidden).seen).toBe(false);
  });
});

describe("cameraMoveFor and repResultText", () => {
  it("reads the challenge unit", () => {
    expect(cameraMoveFor("push-ups")).toBe("pushup");
    expect(cameraMoveFor("Press-ups")).toBe("pushup");
    expect(cameraMoveFor("squats")).toBe("squat");
    expect(cameraMoveFor("km")).toBeNull();
  });
  it("writes a line for the coach", () => {
    expect(repResultText({ move: "pushup", reps: 23, partials: 3, hips: 1, seconds: 60 }, "Push-up week")).toBe("Push-up week: 23 push-ups in 60 s, counted by camera. 3 reps not deep enough (not counted). 1 rep with hips out of line.");
    expect(repResultText({ move: "squat", reps: 30, partials: 0, hips: 0, seconds: 60 }, "Squat it")).toContain("Clean reps throughout.");
  });
});
