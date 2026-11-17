import { describe, expect, it } from "vitest";
import {
  campaignEndsText, campaignLive, campaignProblem, funnel, growthPlan, happinessBand, happinessDue, happinessProblem, happinessScore,
  happinessVerdict, latestAnswers, proofCaption, proofLines, sampleProof, spotsLeft, spotsProblem, spotsText, weekKey, type HappinessAnswer, type PlanInput,
} from "./marketing";

const now = new Date("2026-11-10T10:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const ans = (clientId: string, score: number, days: number, comment = ""): HappinessAnswer => ({ id: `${clientId}-${days}`, clientId, name: `${clientId} X.`, score, comment, at: ago(days) });

describe("happiness check", () => {
  it("bands the score like NPS", () => {
    expect([10, 9, 8, 7, 6, 0].map(happinessBand)).toEqual(["promoter", "promoter", "passive", "passive", "detractor", "detractor"]);
  });
  it("checks answers", () => {
    expect(happinessProblem(11, "")).toMatch(/0 to 10/);
    expect(happinessProblem(7.5, "")).toMatch(/0 to 10/);
    expect(happinessProblem(7, "x".repeat(401))).toMatch(/400/);
    expect(happinessProblem(0, "")).toBeNull();
  });
  it("asks three weeks in, then every 90 days, and respects a snooze", () => {
    expect(happinessDue({ daysWithCoach: 10, lastAnsweredAt: null, snoozedAt: null, now })).toBe(false);
    expect(happinessDue({ daysWithCoach: 25, lastAnsweredAt: null, snoozedAt: null, now })).toBe(true);
    expect(happinessDue({ daysWithCoach: 200, lastAnsweredAt: ago(40), snoozedAt: null, now })).toBe(false);
    expect(happinessDue({ daysWithCoach: 200, lastAnsweredAt: ago(91), snoozedAt: null, now })).toBe(true);
    expect(happinessDue({ daysWithCoach: 200, lastAnsweredAt: null, snoozedAt: ago(3), now })).toBe(false);
  });
  it("scores each client's latest answer only", () => {
    const list = [ans("a", 3, 100), ans("a", 10, 2), ans("b", 9, 5), ans("c", 7, 5), ans("d", 4, 1)];
    expect(latestAnswers(list).map((a) => a.clientId)).toEqual(["d", "a", "b", "c"]);
    expect(happinessScore(list)).toEqual({ score: 25, promoters: 2, passives: 1, detractors: 1, count: 4 });
    expect(happinessScore([])).toBeNull();
    expect(happinessVerdict({ score: 60, promoters: 4, passives: 1, detractors: 0, count: 5 })).toMatch(/Excellent/);
    expect(happinessVerdict({ score: 100, promoters: 1, passives: 0, detractors: 0, count: 1 })).toMatch(/Early days/);
  });
});

describe("places and offers", () => {
  it("counts places left honestly", () => {
    expect(spotsLeft(3, 1)).toBe(2);
    expect(spotsLeft(2, 5)).toBe(0);
    expect(spotsText(3, 1, now)).toBe("2 places left in November");
    expect(spotsText(2, 1, now)).toBe("1 place left in November");
    expect(spotsText(1, 1, now)).toMatch(/^Full for November/);
    expect(spotsText(null, 0, now)).toBeNull();
    expect(spotsProblem(51)).toMatch(/50/);
    expect(spotsProblem(4)).toBeNull();
  });
  it("checks an offer and shows it until its last day", () => {
    const c = { title: "New Year start", text: "First month half price for anyone starting in January.", ends: "2026-11-30" };
    expect(campaignProblem(c, "2026-11-10")).toBeNull();
    expect(campaignProblem({ ...c, ends: "2026-11-01" }, "2026-11-10")).toMatch(/passed/);
    expect(campaignProblem({ ...c, title: " " }, "2026-11-10")).toMatch(/name/);
    expect(campaignProblem({ ...c, text: "Cheap" }, "2026-11-10")).toMatch(/sentence/);
    expect(campaignLive(c, "2026-11-30")).toBe(true);
    expect(campaignLive(c, "2026-12-01")).toBe(false);
    expect(campaignLive(null, "2026-11-10")).toBe(false);
    expect(campaignEndsText("2026-11-10", "2026-11-10")).toBe("Ends today");
    expect(campaignEndsText("2026-11-11", "2026-11-10")).toBe("Ends tomorrow");
    expect(campaignEndsText("2026-11-16", "2026-11-10")).toBe("6 days left");
    expect(campaignEndsText("2027-01-31", "2026-11-10")).toBe("Ends 31 January");
  });
});

describe("funnel", () => {
  it("lines up visits, enquiries and clients by source over the window", () => {
    const f = funnel(
      [{ day: "2026-11-09", source: "instagram", visits: 40 }, { day: "2026-11-01", source: "page", visits: 10 }, { day: "2026-09-01", source: "instagram", visits: 999 }],
      [
        { createdAt: ago(2), stage: "client", source: "instagram" },
        { createdAt: ago(3), stage: "new", source: "instagram" },
        { createdAt: ago(5), stage: "new", source: "page" },
        { createdAt: ago(6), stage: "client", source: "gym" },
        { createdAt: ago(60), stage: "client", source: "instagram" },
      ],
      now,
    );
    expect(f.steps.map((s) => [s.value, s.rate])).toEqual([[50, null], [4, 8], [2, 50]]);
    expect(f.sources[0]).toMatchObject({ source: "instagram", visits: 40, enquiries: 2, clients: 1 });
    expect(f.sources.find((s) => s.source === "gym")).toMatchObject({ visits: 0, enquiries: 1, clients: 1 });
    expect(f.best?.source).toBe("instagram");
  });
  it("has no rates with nothing to divide by", () => {
    const f = funnel([], [], now);
    expect(f.steps.map((s) => s.rate)).toEqual([null, null, null]);
    expect(f.best).toBeNull();
  });
});

describe("proof in numbers", () => {
  it("leads with the biggest story and skips zeros", () => {
    expect(proofLines(sampleProof()).map((l) => `${l.value} ${l.unit}`)).toEqual(["61.8 tonnes", "19 personal bests", "74 workouts", "22 sessions"]);
    expect(proofLines({ days: 7, clients: 1, workouts: 1, kg: 640, bests: 0, sessions: 0 }).map((l) => l.unit)).toEqual(["kg", "workout"]);
    expect(proofLines({ days: 7, clients: 0, workouts: 0, kg: 0, bests: 0, sessions: 0 })).toEqual([]);
    expect(proofCaption(sampleProof(), "https://x/c/?k=kamal")).toMatch(/^The last 30 days with my clients: 61.8 tonnes lifted, 19 personal bests set, 74 workouts finished\./);
  });
});

describe("growth plan", () => {
  const base: PlanInput = {
    coach: "Kamal", now, leads: [], answers: [], reviewed: [], referred: [], ended: [], current: [], proof: null,
    published: true, googleReviewUrl: true, spotsSet: true, rewardLine: null, done: [],
  };
  it("answers waiting people first, then unhappy clients, then asks happy ones", () => {
    const plan = growthPlan({
      ...base,
      leads: [{ id: "l1", name: "Leo Martin", email: "leo@x.com", stage: "new", at: ago(2), followUp: null }],
      answers: [ans("a", 10, 3), ans("b", 9, 4), ans("c", 5, 2, "Too early in the morning")],
      current: ["a", "b", "c"],
      reviewed: ["b"],
    });
    expect(plan.actions.map((a) => a.kind)).toEqual(["reply", "unhappy", "review", "friend"]);
    expect(plan.actions[1]!.why).toContain("Too early in the morning");
    expect(plan.actions[2]!.to).toMatchObject({ kind: "client", id: "a" });
    expect(plan.actions[3]!.to).toMatchObject({ id: "b" });
    expect(plan.actions[2]!.message).toMatch(/More → Review/);
  });
  it("wins people back after a month, not straight away", () => {
    const plan = growthPlan({ ...base, ended: [{ id: "x", name: "Sam Okafor", endedAt: ago(10) }, { id: "y", name: "Grace Mensah", endedAt: ago(45) }, { id: "z", name: "Old", endedAt: ago(400) }] });
    expect(plan.actions.map((a) => a.title)).toEqual(["Invite Grace back"]);
  });
  it("re-opens cold leads, suggests a post, and fills setup gaps", () => {
    const plan = growthPlan({ ...base, published: true, googleReviewUrl: false, proof: sampleProof(), leads: [{ id: "l9", name: "Hana Ito", email: "h@x.com", stage: "lost", at: ago(40), followUp: null }] });
    expect(plan.actions.map((a) => a.kind)).toEqual(["cold", "post", "setup"]);
    expect(plan.actions[2]!.title).toMatch(/Google/);
  });
  it("keeps to five and counts what's done this week", () => {
    const answers = ["a", "b", "c", "d"].map((id) => ans(id, 2, 1));
    const leads = ["1", "2", "3"].map((id) => ({ id, name: `Lead ${id}`, email: "e@x.com", stage: "new", at: ago(3), followUp: "2026-11-09" }));
    const first = growthPlan({ ...base, answers, leads, current: ["a", "b", "c", "d"], proof: sampleProof() });
    expect(first.actions).toHaveLength(5);
    const again = growthPlan({ ...base, answers, leads, current: ["a", "b", "c", "d"], proof: sampleProof(), done: [first.actions[0]!.id] });
    expect(again.doneCount).toBe(1);
  });
  it("names the ISO week", () => {
    expect(weekKey(now)).toBe("2026-W46");
    expect(weekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });
});
