import { describe, expect, it } from "vitest";
import {
  boardName, challengeDays, challengeFromPreset, challengePhase, challengeProblem, formatTotal, fromChallengeRow, myTotal, phaseText, rankBoard, sampleChallenges, toChallengeRow, type Challenge,
} from "./challenges";

const TODAY = "2026-11-03";
const c: Challenge = { id: "c", title: "Steps", description: "", metric: "logged", unit: "steps", goal: null, startsOn: "2026-11-01", endsOn: "2026-11-07", createdAt: "2026-10-31T09:00:00.000Z" };

describe("challenge dates", () => {
  it("knows whether it's on, and how long is left", () => {
    expect(challengePhase(c, TODAY)).toBe("live");
    expect(phaseText(c, TODAY)).toBe("5 days left");
    expect(phaseText(c, "2026-11-07")).toBe("Last day");
    expect(phaseText(c, "2026-10-31")).toBe("Starts tomorrow");
    expect(phaseText(c, "2026-10-28")).toBe("Starts in 4 days");
    expect(phaseText(c, "2026-11-08")).toBe("Ended");
    expect(challengeDays(c)).toBe(7);
  });

  it("starts presets today", () => {
    const p = challengeFromPreset(0, TODAY);
    expect(p.startsOn).toBe(TODAY);
    expect(challengeDays(p)).toBe(28);
    expect(p.metric).toBe("sessions");
  });
});

describe("leaderboard", () => {
  it("ranks highest first and lets ties share a place", () => {
    const r = rankBoard([{ name: "B", total: 5, isMe: false }, { name: "A", total: 9, isMe: false }, { name: "C", total: 5, isMe: true }, { name: "D", total: 1, isMe: false }]);
    expect(r.map((x) => `${x.rank}${x.name}`)).toEqual(["1A", "2B", "2C", "4D"]);
  });

  it("shows first names and an initial only", () => {
    expect(boardName("Priya Sharma")).toBe("Priya S.");
    expect(boardName("  Omar  Ali Tahir ")).toBe("Omar T.");
    expect(boardName("Cher")).toBe("Cher");
    expect(formatTotal(38420)).toBe("38,420");
    expect(formatTotal(12.25)).toBe("12.3");
  });

  it("adds up a person's logs", () => {
    expect(myTotal([{ challengeId: "c", day: TODAY, value: 8000 }, { challengeId: "c", day: "2026-11-02", value: 9500 }, { challengeId: "x", day: TODAY, value: 1 }], "c")).toBe(17500);
  });
});

describe("checks and rows", () => {
  it("won't save a challenge that makes no sense", () => {
    expect(challengeProblem(c)).toBeNull();
    expect(challengeProblem({ ...c, title: " " })).toMatch(/name/);
    expect(challengeProblem({ ...c, unit: "" })).toMatch(/log/);
    expect(challengeProblem({ ...c, endsOn: "2026-10-01" })).toMatch(/before/);
    expect(challengeProblem({ ...c, endsOn: "2027-03-01" })).toMatch(/three months/);
    expect(challengeProblem({ ...c, goal: 0 })).toMatch(/goal/);
  });

  it("round-trips the row, with sessions always counted in sessions", () => {
    expect(fromChallengeRow({ ...toChallengeRow(c, "coach"), created_at: c.createdAt })).toEqual(c);
    expect(toChallengeRow({ ...c, metric: "sessions", unit: "x" }, "coach").unit).toBe("sessions");
  });

  it("gives the demo a live challenge with a board", () => {
    const s = sampleChallenges(TODAY);
    expect(s.challenges.every((x) => challengePhase(x, TODAY) === "live")).toBe(true);
    expect(s.boards["demo-challenge-1"]?.some((l) => l.isMe)).toBe(true);
  });
});
