import { describe, expect, it } from "vitest";
import { agoText, distanceDraft, draftProblem, fromTeamFeedRow, milestoneDraft, rankEffort, sampleTeam, teamName, heroForPost, postFigure, feedDay, toggleFive, workoutDraft } from "./team";

describe("team", () => {
  it("drafts posts without weights or body numbers", () => {
    const d = workoutDraft({ workoutName: "Lower A", sets: 18, minutes: 52, prs: 2 });
    expect(d).toEqual({ kind: "workout", title: "Finished Lower A", detail: "18 sets · 52 min · 2 personal bests" });
    expect(milestoneDraft({ title: "100 km run", sub: "Every kilometre logged in APEX." }).title).toBe("Reached 100 km run");
    const km = distanceDraft([{ sport: "run", label: "Run", metres: 21400, sessions: 3, minutes: 120, lastWeekMetres: 0 }, { sport: "swim", label: "Swim", metres: 1800, sessions: 1, minutes: 40, lastWeekMetres: 0 }], "27 Oct – 2 Nov");
    expect(km).toEqual({ kind: "distance", title: "21.4 km run this week", detail: "27 Oct – 2 Nov · swim 1,800 m" });
    expect(distanceDraft([], "x")).toBeNull();
  });

  it("checks a draft", () => {
    expect(draftProblem({ kind: "note", title: "  ", detail: null })).toBe("Write something first.");
    expect(draftProblem({ kind: "note", title: "x".repeat(81), detail: null })).toMatch(/under 80/);
    expect(draftProblem({ kind: "note", title: "Good session", detail: null })).toBeNull();
  });

  it("ranks effort with shared places", () => {
    const r = rankEffort([{ name: "B", workouts: 3, minutes: 100, isMe: false }, { name: "A", workouts: 4, minutes: 90, isMe: true }, { name: "C", workouts: 3, minutes: 100, isMe: false }]);
    expect(r.map((l) => [l.name, l.place])).toEqual([["A", 1], ["B", 2], ["C", 2]]);
  });

  it("toggles a high five and reads feed rows", () => {
    const { posts } = sampleTeam(new Date("2026-11-05T12:00:00Z"));
    const t = toggleFive(posts, "t1");
    expect(t[0]).toMatchObject({ iFived: true, fives: 5 });
    expect(toggleFive(t, "t1")[0]).toMatchObject({ iFived: false, fives: 4 });
    const p = fromTeamFeedRow({ id: "x", kind: "note", title: "Hi", detail: null, created_at: "2026-11-05T10:00:00Z", author: "Kamal", is_coach: true, is_me: false, fives: 2, i_fived: false });
    expect(p).toMatchObject({ author: "Kamal", isCoach: true, fives: 2, at: "2026-11-05T10:00:00Z" });
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(agoText("2026-11-05T11:59:30Z", now)).toBe("Just now");
    expect(agoText("2026-11-05T11:48:00Z", now)).toBe("12 min");
    expect(agoText("2026-11-05T09:00:00Z", now)).toBe("3 h");
    expect(agoText("2026-11-04T09:00:00Z", now)).toBe("Yesterday");
    expect(agoText("2026-11-01T09:00:00Z", now)).toBe("1 Nov");
  });

  it("shortens names like the database does", () => {
    expect(teamName("Priya Sharma")).toBe("Priya S.");
    expect(teamName("  Anna  de la cruz ")).toBe("Anna C.");
    expect(teamName("Kamal")).toBe("Kamal");
    expect(teamName("")).toBe("Someone");
  });

  it("picks a photo or a big number for each post", () => {
    expect(heroForPost({ kind: "workout", title: "Finished Lower A" })).toBe("lower");
    expect(heroForPost({ kind: "workout", title: "Finished Upper B" })).toBe("upper");
    expect(heroForPost({ kind: "distance", title: "1,800 m swim this week" })).toBe("swim");
    expect(heroForPost({ kind: "distance", title: "21.4 km run this week" })).toBe("run");
    expect(heroForPost({ kind: "note", title: "Hi" })).toBeNull();
    expect(postFigure({ kind: "milestone", title: "Reached 25 workouts" })).toEqual({ value: "25", unit: "workouts" });
    expect(postFigure({ kind: "milestone", title: "Reached 100 tonnes lifted" })).toEqual({ value: "100", unit: "tonnes lifted" });
    expect(postFigure({ kind: "distance", title: "21.4 km run this week" })).toEqual({ value: "21.4", unit: "km run" });
    expect(postFigure({ kind: "level", title: "Up to level 4: Committed" })).toEqual({ value: "4", unit: "Committed" });
    expect(postFigure({ kind: "workout", title: "Finished Lower A" })).toBeNull();
  });

  it("groups the feed by day", () => {
    const now = new Date(2026, 10, 5, 12);
    expect(feedDay(new Date(2026, 10, 5, 8).toISOString(), now)).toBe("Today");
    expect(feedDay(new Date(2026, 10, 4, 23).toISOString(), now)).toBe("Yesterday");
    expect(feedDay(new Date(2026, 10, 1, 9).toISOString(), now)).toBe("This week");
    expect(feedDay(new Date(2026, 9, 20, 9).toISOString(), now)).toBe("Earlier");
  });
});
