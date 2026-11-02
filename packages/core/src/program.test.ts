import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "./data/starterTemplates";
import { INITIAL_WORKOUT } from "./data/workout";
import { exerciseById } from "./library";
import { addDay, copyWeek, daysInWeek, deleteWeek, freeDayIndex, fromTemplate, nextDayKey, programFromWorkout, removeDay, templateSummary, toTemplate } from "./program";
import { createDemoStore, initialState } from "./store";

const W1 = { ...INITIAL_WORKOUT, week: 1 };
const base = () => programFromWorkout(W1, "d1", "Block");

describe("program days", () => {
  it("adds empty days or copies, with fresh item keys, and grows the weeks", () => {
    const { program, day } = addDay(base(), 1, 2, INITIAL_WORKOUT, "d2");
    expect(daysInWeek(program, 1).map((d) => d.key)).toEqual(["d1", "d2"]);
    expect(day.items.map((i) => i.exerciseId)).toEqual(INITIAL_WORKOUT.items.map((i) => i.exerciseId));
    expect(day.items.some((i) => INITIAL_WORKOUT.items.some((o) => o.key === i.key))).toBe(false);
    expect(addDay(base(), 12, 0).program.weeks).toBe(12);
    expect(addDay(base(), 1, 3).day).toMatchObject({ name: "Thu session", items: [] });
  });

  it("finds the next free weekday and removes days", () => {
    const p = addDay(base(), 1, 1, undefined, "d2").program;
    expect(freeDayIndex(p, 1)).toBe(2);
    expect(freeDayIndex(p, 1, 5)).toBe(6);
    expect(removeDay(p, "d2").days).toHaveLength(1);
  });

  it("copies a week onto the same weekdays, skipping ones already planned", () => {
    let p = addDay(base(), 1, 3, INITIAL_WORKOUT, "thu").program;
    p = addDay(p, 2, 3, undefined, "taken").program;
    const { program, added } = copyWeek(p, 1, 2);
    expect(added.map((d) => d.dayIndex)).toEqual([0]);
    expect(daysInWeek(program, 2).map((d) => d.key)).toContain("taken");
  });

  it("copying with progression puts next week's loads on the copy only", () => {
    const { program, added } = copyWeek(base(), 1, 2, { progress: true });
    const kg = (week: number) => daysInWeek(program, week)[0]?.items[0]?.kg;
    expect(kg(1)).toBe(70);
    expect(kg(2)).toBe(72.5);
    expect(added[0]?.week).toBe(2);
  });

  it("deleting a week closes the gap", () => {
    let p = copyWeek(base(), 1, 2).program;
    p = copyWeek(p, 2, 3).program;
    const after = deleteWeek(p, 2);
    expect(after.weeks).toBe(Math.max(1, p.weeks - 1));
    expect(after.days.map((d) => d.week).sort()).toEqual([1, 2]);
  });
});

describe("which day the client trains", () => {
  const p = addDay(addDay(base(), 1, 2, INITIAL_WORKOUT, "wed").program, 2, 0, INITIAL_WORKOUT, "w2").program;
  it("is the first unfinished day, week by week", () => {
    expect(nextDayKey(p, new Set())).toBe("d1");
    expect(nextDayKey(p, new Set(["d1"]))).toBe("wed");
    expect(nextDayKey(p, new Set(["d1", "wed"]))).toBe("w2");
  });
  it("stays on today's day after finishing it, and on the last day when all are done", () => {
    expect(nextDayKey(p, new Set(["d1"]), "d1")).toBe("d1");
    expect(nextDayKey(p, new Set(["d1", "wed", "w2"]))).toBe("w2");
  });
});

describe("templates", () => {
  it("round-trips a program without keys or history", () => {
    const t = toTemplate(addDay(base(), 1, 3, INITIAL_WORKOUT).program, "Mine", "t1");
    expect(JSON.stringify(t)).not.toContain("lastTime");
    const back = fromTemplate(t);
    // Only week 1 was planned, so it repeats for all 8 weeks.
    expect(back.days).toHaveLength(2 * 8);
    expect(back.days[0]?.items[0]).toMatchObject({ exerciseId: 15, kg: 70, lastTime: "New exercise" });
  });

  it("a week-1-only template fills every week; each copy has its own keys", () => {
    const t = STARTER_TEMPLATES[1];
    if (!t) throw new Error("missing starter");
    const a = fromTemplate(t);
    expect(a.days).toHaveLength(4 * t.weeks);
    const b = fromTemplate(t);
    expect(a.days[0]?.key).not.toBe(b.days[0]?.key);
    expect(templateSummary(t)).toMatch(/^4 days a week · 8 weeks · \d+ exercises$/);
  });

  it("starter templates only use real library movements", () => {
    for (const t of STARTER_TEMPLATES) for (const d of t.days) for (const it of d.items) expect(() => exerciseById(it.exerciseId)).not.toThrow();
  });
});

describe("demo store with days", () => {
  it("keeps the open workout and the program in step", () => {
    const store = createDemoStore(null, null);
    const { program } = addDay(store.get().program, 1, 2, undefined, "wed");
    store.saveProgram(program, "wed");
    expect(store.get().workout.items).toEqual([]);
    store.saveWorkout({ ...store.get().workout, name: "Wednesday" });
    store.selectDay("day-1");
    expect(store.get().workout.name).toBe(INITIAL_WORKOUT.name);
    expect(store.get().program.days.find((d) => d.key === "wed")?.name).toBe("Wednesday");
  });

  it("reads saved state from before programs had days", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const { program: _p, activeDay: _a, ...old } = initialState();
    storage.setItem("apex-demo-v1", JSON.stringify({ ...old, workout: { ...old.workout, name: "Old save" } }));
    const s = createDemoStore(storage, null).get();
    expect(s.program.days[0]?.name).toBe("Old save");
    expect(s.workout.name).toBe("Old save");
  });
});
