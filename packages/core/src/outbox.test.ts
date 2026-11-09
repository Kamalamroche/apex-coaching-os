import { describe, expect, it } from "vitest";
import { addJob, isNetworkError, outboxLabel, readOutbox, withSessionId, type OutboxJob } from "./outbox";

const msg = (id: string): OutboxJob => ({ kind: "message", id, at: "2026-11-09T10:00:00Z", body: "hi" });
describe("offline outbox", () => {
  it("knows a dropped connection from a refusal", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isNetworkError({ message: "new row violates row-level security policy" })).toBe(false);
    expect(isNetworkError(new Error("anything"), false)).toBe(true);
  });
  it("keeps jobs in order and caps them", () => {
    let list: OutboxJob[] = [];
    for (let i = 0; i < 5; i++) list = addJob(list, msg(String(i)), 3);
    expect(list.map((j) => j.id)).toEqual(["2", "3", "4"]);
  });
  it("survives bad storage", () => {
    expect(readOutbox("nope")).toEqual([]);
    expect(readOutbox(JSON.stringify([msg("a"), { kind: "x" }]))).toHaveLength(1);
  });
  it("fills in the session id and says what's waiting", () => {
    expect(withSessionId([{ reps: 5 }], "s1")).toEqual([{ reps: 5, session_id: "s1" }]);
    const s: OutboxJob = { kind: "session", id: "s", at: "", row: {}, summary: null, sets: [] };
    expect(outboxLabel([s, msg("a")])).toBe("1 session and 1 message waiting to send");
    expect(outboxLabel([])).toBe("");
  });
});
