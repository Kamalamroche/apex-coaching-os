import { describe, expect, it } from "vitest";
import { buildIntervals, endLive, liveClock, liveView, pauseLive, planSeconds, readLiveState, resumeLive, skipLive, startLive } from "./liveSession";

const plan = buildIntervals({ title: "HIIT", work: 40, rest: 20, rounds: 3, moves: ["Squats", "Push-ups"] });

describe("buildIntervals", () => {
  it("starts with get ready, rotates moves, no rest after the last round", () => {
    expect(plan.blocks.map((b) => b.name)).toEqual(["Get ready", "Squats", "Rest", "Push-ups", "Rest", "Squats"]);
    expect(planSeconds(plan)).toBe(10 + 40 * 3 + 20 * 2);
    expect(buildIntervals({ title: "EMOM", work: 60, rest: 0, rounds: 2, moves: [] }).blocks.map((b) => b.name)).toEqual(["Get ready", "Work", "Work"]);
  });
});

describe("live timer", () => {
  const t0 = 1_000_000;
  const s = startLive(plan, "Kamal", t0);
  it("walks forward on each phone without new messages", () => {
    expect(liveView(s, t0)).toMatchObject({ status: "live", index: 0, left: 10 });
    const v = liveView(s, t0 + 25_000);
    expect(v).toMatchObject({ index: 1, left: 25, round: "Round 1 of 3" });
    expect(v.block?.name).toBe("Squats");
    expect(v.next?.name).toBe("Rest");
    expect(liveView(s, t0 + 55_000)).toMatchObject({ index: 2, round: "Next: round 2 of 3" });
    expect(liveView(s, t0 + 300_000).status).toBe("done");
  });
  it("corrects for a phone whose clock runs 3 seconds behind", () => {
    expect(liveView(s, t0 + 22_000, 3_000).left).toBe(25);
  });
  it("pauses, resumes and skips", () => {
    const p = pauseLive(s, t0 + 30_000);
    expect(p.status).toBe("paused");
    expect(liveView(p, t0 + 90_000)).toMatchObject({ index: 1, left: 20, status: "paused" });
    const r = resumeLive(p, t0 + 100_000);
    expect(liveView(r, t0 + 105_000)).toMatchObject({ index: 1, left: 15 });
    const k = skipLive(r, t0 + 105_000);
    expect(liveView(k, t0 + 105_000)).toMatchObject({ index: 2, left: 20 });
    expect(liveView(skipLive(k, t0 + 106_000, -1), t0 + 106_000)).toMatchObject({ index: 1, left: 40 });
    expect(endLive(k, t0).status).toBe("ended");
    expect(liveView(endLive(k, t0), t0).status).toBe("ended");
  });
  it("only trusts messages shaped like a live state", () => {
    expect(readLiveState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(readLiveState({ ...s, status: "hacked" })).toBeNull();
    expect(readLiveState({ ...s, plan: { title: "x", blocks: [{ name: "a", seconds: -1, kind: "work" }] } })).toBeNull();
    expect(readLiveState(null)).toBeNull();
  });
  it("formats the clock", () => {
    expect(liveClock(40)).toBe("0:40");
    expect(liveClock(720)).toBe("12:00");
  });
});
