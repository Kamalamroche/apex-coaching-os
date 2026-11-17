import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { exerciseById } from "./library";
import { latestPlanUpdate, parsePlanUpdate, planChanges, planUpdateMessage } from "./planUpdate";
import type { Workout } from "./types";

const before = INITIAL_WORKOUT;
const n = (id: number) => exerciseById(id).name;

describe("plan update", () => {
  it("lists load, sets, reps, swaps, removals and additions", () => {
    const after: Workout = {
      ...before,
      items: [
        { ...before.items[0]!, kg: 72.5, sets: 5 },
        { ...before.items[1]!, exerciseId: 9 },
        { ...before.items[3]!, reps: "12", restSeconds: 60 },
        { key: "d", group: "D", exerciseId: 14, sets: 2, reps: "30s", kg: 0, rpe: 7, restSeconds: 60, lastTime: "" },
      ],
    };
    const c = planChanges(before, after);
    expect(c).toEqual([
      { kind: "changed", exercise: n(15), detail: "70 kg → 72.5 kg, 4 → 5 sets" },
      { kind: "swapped", exercise: n(2), detail: `swapped for ${n(9)}` },
      { kind: "removed", exercise: n(14), detail: "taken out" },
      { kind: "changed", exercise: n(9), detail: "10 → 12 reps, rest 75 → 60 s" },
      { kind: "added", exercise: n(14), detail: "added: 2 × 30s" },
    ]);
  });

  it("finds nothing when nothing changed", () => {
    expect(planChanges(before, { ...before, items: before.items.map((i) => ({ ...i })) })).toEqual([]);
  });

  it("round-trips through the chat message", () => {
    const changes = planChanges(before, { ...before, items: [{ ...before.items[0]!, kg: 72.5 }, ...before.items.slice(1)] });
    const text = planUpdateMessage("Lower A", changes, " Every rep was clean last week ");
    expect(text).toBe(`🔄 Plan update · Lower A\nWhy: Every rep was clean last week\n• ${n(15)}: 70 kg → 72.5 kg`);
    expect(parsePlanUpdate(text)).toEqual({ workoutName: "Lower A", why: "Every rep was clean last week", lines: [`${n(15)}: 70 kg → 72.5 kg`] });
    expect(parsePlanUpdate("Hi there")).toBeNull();
  });

  it("picks the newest update from the coach", () => {
    const msgs = [
      { from: "coach", text: "🔄 Plan update · Old\n• A: 1 → 2 sets" },
      { from: "client", text: "🔄 Plan update · Not from the coach" },
      { from: "coach", text: "🔄 Plan update · Lower A\nWhy: Deload week\n• B: 60 kg → 50 kg" },
      { from: "coach", text: "See you Tuesday" },
    ];
    const p = latestPlanUpdate(msgs);
    expect(p?.workoutName).toBe("Lower A");
    expect(p?.why).toBe("Deload week");
    expect(latestPlanUpdate([{ from: "coach", text: "Hello" }])).toBeNull();
  });
});

describe("plan update key", () => {
  it("stays the same wherever the message sits in the chat", async () => {
    const { textKey } = await import("./planUpdate");
    const m = { from: "coach", text: "🔄 Plan update · Lower A\n• B: 60 kg → 50 kg" };
    expect(latestPlanUpdate([m])?.key).toBe(latestPlanUpdate([{ from: "client", text: "hi" }, m])?.key);
    expect(textKey("a")).not.toBe(textKey("b"));
  });
});
