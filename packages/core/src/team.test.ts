import { describe, expect, it } from "vitest";
import { agoText, distanceDraft, draftProblem, fromTeamFeedRow, milestoneDraft, rankEffort, sampleTeam, teamName, toggleFive, workoutDraft } from "./team";

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
});
