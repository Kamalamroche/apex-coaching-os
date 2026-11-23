import { describe, expect, it } from "vitest";
import { availableKeys, headlineIdeas, samplePublicStories, storyLines, storyProblem, successCaption } from "./stories";
import { ASSUMED_WIN_PCT, incomeGoalProblem, incomePlan, incomePlanSummary, weeklySteps } from "./incomeGoal";
import { sourceLabel } from "./leads";

const nums = { weeks: 14, workouts: 38, bests: 6, lift: { name: "Back squat", from: 50, to: 70 }, weight: { from: 72, to: 69.5 } };

describe("success stories", () => {
  it("only offers numbers the client has", () => {
    expect(availableKeys(nums)).toEqual(["lift", "bests", "workouts", "weeks", "weight"]);
    expect(availableKeys({ weeks: 3, workouts: 0 })).toEqual(["weeks"]);
  });
  it("writes each number plainly", () => {
    const lines = storyLines(nums, ["lift", "weight", "workouts"]);
    expect(lines.map((l) => l.value)).toEqual(["+20 kg", "38", "−2.5 kg"]);
    expect(lines[0]!.label).toBe("Back squat, 50 kg to 70 kg");
    expect(storyLines({ weeks: 1 }, ["weeks"])[0]!.label).toBe("week together");
  });
  it("suggests up to 3 headlines", () => {
    const ideas = headlineIdeas(nums, "Priya");
    expect(ideas[0]).toBe("Priya: Back squat up 20 kg");
    expect(ideas.length).toBeLessThanOrEqual(3);
    expect(ideas.every((s) => s.length <= 80)).toBe(true);
  });
  it("checks before asking", () => {
    expect(storyProblem("Big squat", ["lift"], nums)).toBeNull();
    expect(storyProblem("x", ["lift"], nums)).toMatch(/headline/);
    expect(storyProblem("Big squat", ["lift"], { weeks: 2 })).toMatch(/number/);
  });
  it("writes a caption that says it was shared with permission", () => {
    const s = samplePublicStories()[0]!;
    const c = successCaption(s, ["lift", "workouts"], "https://x.test/c/kamal/");
    expect(c).toContain("+20 kg Back squat");
    expect(c).toContain('"I never thought');
    expect(c).toContain("Shared with their permission");
    expect(c.endsWith("https://x.test/c/kamal/")).toBe(true);
  });
  it("names the starter plan lead source", () => {
    expect(sourceLabel("starter")).toBe("Free starter plan");
  });
});

describe("income goal", () => {
  const sum = { recurringPence: 240000, perClientPence: 12000, active: 20, churnPct: 5, conversionPct: 40 };
  it("checks the goal", () => {
    expect(incomeGoalProblem(null)).toBeNull();
    expect(incomeGoalProblem(5000)).toMatch(/at least/);
    expect(incomeGoalProblem(400000)).toBeNull();
  });
  it("works out clients and enquiries", () => {
    const p = incomePlan(400000, sum);
    expect(p.gapPence).toBe(160000);
    expect(p.clientsNeeded).toBe(14);
    expect(p.replacePerMonth).toBe(1);
    expect(p.progressPct).toBe(60);
    // 14/3 + 1 = 5.67 clients a month at 40% → 15 enquiries a month, 4 a week
    expect(p.leadsPerMonth).toBe(15);
    expect(p.leadsPerWeek).toBe(4);
    expect(incomePlanSummary(p)).toMatch(/about 14 more clients/);
    expect(weeklySteps(p)[0]!.text).toBe("Get 4 new enquiries a week");
  });
  it("says when the win rate is a guess", () => {
    const p = incomePlan(400000, { ...sum, conversionPct: null });
    expect(p.winAssumed).toBe(true);
    expect(p.winPct).toBe(ASSUMED_WIN_PCT);
    expect(weeklySteps(p)[0]!.why).toMatch(/starting guess/);
  });
  it("handles a goal already reached and no fees", () => {
    expect(incomePlan(200000, sum).reached).toBe(true);
    expect(weeklySteps(incomePlan(200000, sum))).toEqual([]);
    expect(incomePlanSummary(incomePlan(400000, { ...sum, perClientPence: 0 }))).toMatch(/Set a monthly fee/);
  });
});
