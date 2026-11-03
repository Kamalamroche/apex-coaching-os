import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { programFromWorkout } from "./program";
import {
  applyTwinAdjust, draftMessage, draftWeek, fillPhrase, learnPhrase, painMention, readWeek, sampleTwinSignals, twinChanges, twinStats, twinTargetWeek, weekOf,
  type TwinDecision, type TwinSignals,
} from "./twin";

const now = new Date("2026-11-04T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const base = (over: Partial<TwinSignals> = {}): TwinSignals => ({
  clientId: "c", name: "Priya Sharma", startedAt: ago(60), plannedPerWeek: 3,
  sessions: [1, 3, 5, 8, 10, 12, 15, 17, 19].map((d) => ({ finishedAt: ago(d), rpe: 7.5, note: "" })),
  checkIns: [{ at: ago(2), energy: 4, mood: 4, stress: 2, sleepHours: 7.5, text: "" }], clientMessages: [], ...over,
});
const voice = { signOff: "Kamal", phrases: {} };

describe("reading the week", () => {
  it("progresses a client who did every session at a comfortable effort", () => {
    const d = readWeek(base(), now);
    expect(d.situation).toBe("progress");
    expect(d.adjust).toBe("progress");
    expect(d.attention).toBe(false);
    expect(d.flags.map((f) => f.text)).toContain("3 of 3 sessions last 7 days");
  });

  it("never drafts a reply when pain is mentioned, and puts it first", () => {
    const d = readWeek(base({ checkIns: [{ at: ago(2), energy: 3, mood: 3, stress: 3, sleepHours: 7, text: "Left knee hurts going downstairs." }] }), now);
    expect(d.situation).toBe("injury");
    expect(d.adjust).toBe("none");
    expect(d.attention).toBe(true);
    expect(draftMessage(d, voice)).toBeNull();
    expect(painMention(["No pain at all this week, felt great"])).toBeNull();
    expect(painMention(["Squats were fine. My back was painful after deadlifts. Otherwise good"])).toBe("My back was painful after deadlifts");
  });

  it("flags a client who has gone quiet as a churn risk", () => {
    const d = readWeek(base({ sessions: [14, 16, 18, 20, 23].map((x) => ({ finishedAt: ago(x), rpe: 7, note: "" })), checkIns: [], clientMessages: [] }), now);
    expect(d.situation).toBe("quiet");
    expect(d.adjust).toBe("lighter");
    expect(d.attention).toBe(true);
    expect(d.churnRisk).toBeGreaterThanOrEqual(50);
  });

  it("lightens the week after missed sessions and deloads when the check-in says they're low", () => {
    expect(readWeek(base({ sessions: [2, 8, 10, 12].map((x) => ({ finishedAt: ago(x), rpe: 7, note: "" })) }), now).situation).toBe("missed");
    const tired = readWeek(base({ checkIns: [{ at: ago(1), energy: 2, mood: 3, stress: 4, sleepHours: 5, text: "" }] }), now);
    expect(tired.situation).toBe("tired");
    expect(tired.adjust).toBe("deload");
  });

  it("holds new clients and those without a program", () => {
    expect(readWeek(base({ startedAt: ago(5), sessions: [{ finishedAt: ago(2), rpe: 7, note: "" }] }), now).situation).toBe("new");
    expect(readWeek(base({ plannedPerWeek: 0 }), now).situation).toBe("noprogram");
  });

  it("sorts the queue: attention first, injury before quiet", () => {
    const q = draftWeek(sampleTwinSignals(now), voice, now);
    expect(q[0]!.situation).toBe("injury");
    expect(q.findIndex((d) => !d.attention)).toBeGreaterThan(q.findIndex((d) => d.situation === "quiet"));
  });
});

describe("the coach's voice", () => {
  it("fills placeholders and signs off on its own line", () => {
    expect(fillPhrase("Hi {first}, {done} of {planned} done. {coach}", { first: "Priya", done: 3, planned: 3, coach: "Kamal" })).toBe("Hi Priya, 3 of 3 done.\nKamal");
    expect(fillPhrase("Hi {first}. {coach}", { first: "Priya", done: 0, planned: 0, coach: "" })).toBe("Hi Priya.");
  });

  it("learns the coach's wording from an edit", () => {
    const d = { name: "Priya Sharma", done: 2, planned: 3 };
    const learnt = learnPhrase("Priya! 2 of 3 is decent, let's nail all three next week.\nKamal", d, "Kamal");
    expect(learnt).toBe("{first}! {done} of {planned} is decent, let's nail all three next week. {coach}");
    const next = draftMessage({ ...readWeek(base({ name: "James Kowalski" }), now), situation: "missed", done: 1, planned: 4 }, { signOff: "Kamal", phrases: { missed: learnt } });
    expect(next).toBe("James! 1 of 4 is decent, let's nail all three next week.\nKamal");
  });
});

describe("changing the program", () => {
  const program = { ...programFromWorkout({ ...INITIAL_WORKOUT, week: 1, ofWeeks: 2 }, "d1", "Block"), weeks: 2 };
  const two = { ...program, days: [...program.days, ...program.days.map((d) => ({ ...d, key: "d2", week: 2 }))] };

  it("targets next week, or this one at the end of the block", () => {
    expect(twinTargetWeek(two, 1)).toBe(2);
    expect(twinTargetWeek(two, 2)).toBe(2);
  });

  it("lightens and deloads only the target week, and lists what changed", () => {
    const lighter = applyTwinAdjust(two, 2, "lighter");
    expect(lighter.days[0]).toEqual(two.days[0]);
    expect(lighter.days[1]!.items[0]!.sets).toBe(Math.max(1, two.days[1]!.items[0]!.sets - 1));
    const deload = applyTwinAdjust(two, 2, "deload");
    const loaded = two.days[1]!.items.find((i) => i.kg > 0)!;
    expect(deload.days[1]!.items.find((i) => i.key === loaded.key)!.kg).toBeLessThan(loaded.kg);
    expect(twinChanges(two, deload, 2).length).toBeGreaterThan(0);
    expect(applyTwinAdjust(two, 2, "hold")).toBe(two);
  });
});

describe("decisions", () => {
  it("counts approvals without edits", () => {
    const d = (status: TwinDecision["status"]): TwinDecision => ({ clientId: "c", weekOf: "2026-11-02", situation: "progress", adjust: "progress", status, drafted: "x", sent: "x", decidedAt: now.toISOString() });
    expect(twinStats([d("approved"), d("approved"), d("edited"), d("rejected")])).toEqual({ decided: 4, approved: 2, edited: 1, rejected: 1, asIsPct: 50 });
    expect(twinStats([]).asIsPct).toBeNull();
  });

  it("starts the week on Monday", () => {
    expect(weekOf(new Date(2026, 10, 4))).toBe("2026-11-02");
    expect(weekOf(new Date(2026, 10, 8))).toBe("2026-11-02");
    expect(weekOf(new Date(2026, 10, 9))).toBe("2026-11-09");
  });
});
