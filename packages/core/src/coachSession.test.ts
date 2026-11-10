import { describe, expect, it } from "vitest";
import { coachSessionLog, coachSessionMessage, noteTimeline, sampleSessionNotes, sessionLine, sessionNoteProblem, type SessionNote } from "./coachSession";
import { INITIAL_WORKOUT } from "./data/workout";
import { initialSets } from "./session";

const NOW = new Date("2026-11-11T12:00:00Z"); // a Wednesday

describe("a session the coach runs", () => {
  const sets = initialSets(INITIAL_WORKOUT);
  const first = INITIAL_WORKOUT.items[0]!;
  sets[first.key] = (sets[first.key] ?? []).map((s) => ({ ...s, done: true }));

  it("logs it the way the client would have", () => {
    const log = coachSessionLog(INITIAL_WORKOUT, sets, 50, { bestKg: {}, previous: null }, 8);
    expect(log.workoutName).toBe(INITIAL_WORKOUT.name);
    expect(log.sets).toBe(first.sets);
    expect(log.minutes).toBe(50);
    expect(log.rpe).toBe(8);
    expect(log.summary?.exercises?.length).toBe(1);
  });

  it("sends the client a short summary with the shared note", () => {
    const log = { workoutName: "Lower A", sets: 14, volumeKg: 3120.4, minutes: 55, rpe: 8, prs: 1, summary: { exercises: [], totalReps: 0, totalKg: 3120, muscles: [], bests: [{ exercise: "Back Squat", kg: 102.5, previousKg: 100 }], vsLast: null } };
    const msg = coachSessionMessage(log as never, "Priya", "Great depth today.");
    expect(msg).toContain("Great session today, Priya. Lower A · 14 sets · 3,120 kg · 1 PB.");
    expect(msg).toContain("New best: Back Squat 102.5 kg (was 100 kg).");
    expect(msg).toContain("Great depth today.");
    expect(coachSessionMessage(log as never, "Priya", null)).not.toContain("undefined");
  });

  it("describes a session in one line", () => {
    expect(sessionLine({ workoutName: "Upper", sets: 1, volumeKg: 0, prs: 0 })).toBe("Upper · 1 set");
  });
});

describe("session notes", () => {
  it("checks the length", () => {
    expect(sessionNoteProblem(" ")).toMatch(/few words/);
    expect(sessionNoteProblem("x".repeat(1001))).toMatch(/under 1000/);
    expect(sessionNoteProblem("Good session")).toBeNull();
  });

  it("groups the timeline by this week, last week and month, newest first", () => {
    const n = (id: string, at: string): SessionNote => ({ id, clientId: "c", body: id, shared: false, createdAt: at, session: null });
    const groups = noteTimeline([n("old", "2026-10-02T10:00:00Z"), n("mon", "2026-11-09T10:00:00Z"), n("lastwk", "2026-11-05T10:00:00Z"), n("today", "2026-11-11T09:00:00Z")], NOW);
    expect(groups.map((g) => g.label)).toEqual(["This week", "Last week", "October 2026"]);
    expect(groups[0]!.notes.map((x) => x.id)).toEqual(["today", "mon"]);
  });

  it("has sample notes, some shared and some private", () => {
    const s = sampleSessionNotes("5", NOW);
    expect(s.some((x) => x.shared)).toBe(true);
    expect(s.some((x) => !x.shared)).toBe(true);
  });
});
