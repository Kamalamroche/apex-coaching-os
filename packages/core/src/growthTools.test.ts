import { describe, expect, it } from "vitest";
import type { Booking } from "./booking";
import { pendingRewards, reviewDue, reviewProblem, reviewScore, reviewUrlProblem, rewardMessage, rewardText, sessionNudges, shortName } from "./growthTools";
import { credits, newPack } from "./sessions";

const now = new Date("2026-11-20T12:00:00Z");
const day = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
let n = 0;
const bk = (d: number, extra: Partial<Booking> = {}): Booking => ({ id: `b${++n}`, clientId: "c", startsAt: day(d), endsAt: day(d + 0.04), kind: "session", note: "", status: "booked", createdAt: day(-60), ...extra });

describe("offers", () => {
  it("checks the Google link", () => {
    expect(reviewUrlProblem("")).toBeNull();
    expect(reviewUrlProblem("https://g.page/r/abc/review")).toBeNull();
    expect(reviewUrlProblem("https://www.google.com/maps/place/x")).toBeNull();
    expect(reviewUrlProblem("http://g.page/r/abc")).toMatch(/https/);
    expect(reviewUrlProblem("https://example.com")).toMatch(/Google/);
  });
  it("tells clients what a friend brings them", () => {
    expect(rewardText({ referralReward: 1, introOffer: true }, "Kamal")).toBe("Bring a friend to Kamal: you get a free session when they join, and their first session is free.");
    expect(rewardText({ referralReward: 2, introOffer: false }, "Kamal")).toBe("Bring a friend to Kamal: you get 2 free sessions when they join.");
    expect(rewardText({ referralReward: 0, introOffer: false }, "Kamal")).toBeNull();
  });
});

describe("referral rewards", () => {
  it("lists joined friends not yet rewarded", () => {
    const list = [
      { id: "1", friend: "Tom Reed", referrerId: "p", joined: true, rewarded: false },
      { id: "2", friend: "Ana Silva", referrerId: "p", joined: true, rewarded: true },
      { id: "3", friend: "Lee Wong", referrerId: "p", joined: false, rewarded: false },
    ];
    expect(pendingRewards(list).map((r) => r.id)).toEqual(["1"]);
    expect(rewardMessage("Priya", "Tom Reed", 1)).toBe("Thanks for bringing Tom, Priya. I've added a free session to your account. See you soon.");
  });
});

describe("reviews", () => {
  it("asks once, a few weeks in", () => {
    const base = { daysWithCoach: 30, workoutsDone: 10, sessionsAttended: 0, hasReview: false, dismissed: false };
    expect(reviewDue(base)).toBe(true);
    expect(reviewDue({ ...base, daysWithCoach: 10 })).toBe(false);
    expect(reviewDue({ ...base, workoutsDone: 3 })).toBe(false);
    expect(reviewDue({ ...base, workoutsDone: 3, sessionsAttended: 6 })).toBe(true);
    expect(reviewDue({ ...base, hasReview: true })).toBe(false);
    expect(reviewDue({ ...base, dismissed: true })).toBe(false);
  });
  it("checks, names and scores reviews", () => {
    expect(reviewProblem(0, "x".repeat(30))).toMatch(/stars/);
    expect(reviewProblem(5, "Great")).toMatch(/at least/);
    expect(reviewProblem(5, "Brilliant coach, I feel stronger.")).toBeNull();
    expect(shortName("Priya Sharma")).toBe("Priya S.");
    expect(shortName("Cher")).toBe("Cher");
    expect(reviewScore([{ stars: 5, approved: true }, { stars: 4, approved: true }, { stars: 1, approved: false }])).toEqual({ average: 4.5, count: 2 });
    expect(reviewScore([])).toBeNull();
  });
});

describe("session nudges", () => {
  it("finds owed, renewals and quiet clients, most urgent first", () => {
    const pack = (s: number) => newPack("c", s, 20000, "bank", 0, "", "purchase", new Date(day(-90)));
    const mk = (id: string, packs: ReturnType<typeof pack>[], bookings: Booking[]) => ({ id, name: `${id} Smith`, credits: credits(packs, bookings, now), bookings, hasPacks: packs.length > 0 });
    const quiet = mk("Quiet", [pack(10)], [bk(-20), bk(-30)]);
    const low = mk("Low", [pack(5)], [bk(-1), bk(-8), bk(-15), bk(-22)]);
    const owes = mk("Owes", [pack(1)], [bk(-3), bk(-10)]);
    const busy = mk("Busy", [pack(10)], [bk(-20), bk(3)]);
    const none = mk("None", [], [bk(-40)]);
    const out = sessionNudges([quiet, low, owes, busy, none], "Kamal", now);
    expect(out.map((x) => [x.clientId, x.kind])).toEqual([["Owes", "owed"], ["Low", "renew"], ["Quiet", "book"]]);
    expect(out[1]!.message).toBe("Hi Low, you've got one session left. Great work so far. Want me to set up the next one so we keep the momentum? Kamal");
    expect(out[2]!.why).toBe("8 sessions left · none booked for 20 days");
  });
});
