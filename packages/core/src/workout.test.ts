import { describe, expect, it } from "vitest";
import { INITIAL_WORKOUT } from "./data/workout";
import { exerciseById } from "./library";
import { ADJUSTMENTS, addExercise, appendItems, diffWorkouts, insertExercise, moveItem, nextGroupLetter, relabelGroups, removeItem, swapExercise, toggleSuperset, updateItem } from "./workout";

const adjustment = (id: string) => {
  const a = ADJUSTMENTS.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
};

describe("builder edits", () => {
  it("adds an exercise as the next block with a pattern-based rest", () => {
    expect(nextGroupLetter(INITIAL_WORKOUT.items)).toBe("D");
    const w = addExercise(INITIAL_WORKOUT, exerciseById(7), "k1");
    const added = w.items.at(-1);
    expect(added).toMatchObject({ key: "k1", group: "D", exerciseId: 7, restSeconds: 60 });
    expect(addExercise(INITIAL_WORKOUT, exerciseById(1), "k2").items.at(-1)?.restSeconds).toBe(90);
  });

  it("never mutates the workout it was given", () => {
    const before = JSON.stringify(INITIAL_WORKOUT);
    updateItem(INITIAL_WORKOUT, "a", { sets: 9 });
    removeItem(INITIAL_WORKOUT, "a");
    swapExercise(INITIAL_WORKOUT, "a", 2);
    expect(JSON.stringify(INITIAL_WORKOUT)).toBe(before);
  });

  it("swapping resets last time, since the history belongs to the old exercise", () => {
    const item = swapExercise(INITIAL_WORKOUT, "a", 8).items[0];
    expect(item).toMatchObject({ exerciseId: 8, lastTime: "New exercise" });
  });
});

describe("AI adjustments", () => {
  it("30-minute version drops the finisher and trims rest", () => {
    const next = adjustment("short").apply(INITIAL_WORKOUT);
    expect(next.minutes).toBe(30);
    expect(next.items.map((i) => i.group)).toEqual(["A", "B1", "B2"]);
    expect(next.items[0]).toMatchObject({ sets: 3, restSeconds: 120 });
    expect(next.items[1]?.restSeconds).toBe(0);
  });

  it("diff marks removed, changed and unchanged items", () => {
    const next = adjustment("short").apply(INITIAL_WORKOUT);
    expect(diffWorkouts(INITIAL_WORKOUT, next).map((c) => c.kind)).toEqual(["changed", "same", "changed", "removed"]);
  });

  it("beginner version lowers every RPE target by one", () => {
    const next = adjustment("beginner").apply(INITIAL_WORKOUT);
    next.items.forEach((it, i) => expect(it.rpe).toBe((INITIAL_WORKOUT.items[i]?.rpe ?? 0) - 1));
    expect(next.items[0]?.exerciseId).toBe(9);
  });
});

describe("drag and drop", () => {
  const groups = (w: { items: { group: string }[] }) => w.items.map((i) => i.group).join(" ");

  it("drops a library exercise at the pointer and re-letters the blocks", () => {
    expect(groups(INITIAL_WORKOUT)).toBe("A B1 B2 C");
    const w = insertExercise(INITIAL_WORKOUT, exerciseById(7), 1, "k1");
    expect(w.items[1]).toMatchObject({ key: "k1", exerciseId: 7, group: "B", restSeconds: 60 });
    expect(groups(w)).toBe("A B C1 C2 D");
  });

  it("clamps the drop position to the ends of the list", () => {
    expect(insertExercise(INITIAL_WORKOUT, exerciseById(7), 99, "end").items.at(-1)?.key).toBe("end");
    expect(insertExercise(INITIAL_WORKOUT, exerciseById(7), -3, "top").items[0]).toMatchObject({ key: "top", group: "A" });
  });

  it("moves an item before the one at the drop position", () => {
    const keys = (w: { items: { key: string }[] }) => w.items.map((i) => i.key);
    const [a, b1, b2, c] = keys(INITIAL_WORKOUT);
    expect(keys(moveItem(INITIAL_WORKOUT, c as string, 0))).toEqual([c, a, b1, b2]);
    expect(keys(moveItem(INITIAL_WORKOUT, a as string, 4))).toEqual([b1, b2, c, a]);
    expect(groups(moveItem(INITIAL_WORKOUT, c as string, 0))).toBe("A B C1 C2");
  });

  it("leaves the workout alone for a no-op or unknown move", () => {
    const first = INITIAL_WORKOUT.items[0]?.key as string;
    expect(moveItem(INITIAL_WORKOUT, first, 0)).toBe(INITIAL_WORKOUT);
    expect(moveItem(INITIAL_WORKOUT, first, 1)).toBe(INITIAL_WORKOUT);
    expect(moveItem(INITIAL_WORKOUT, "nope", 2)).toBe(INITIAL_WORKOUT);
  });

  it("keeps superset numbering when re-lettering", () => {
    const items = INITIAL_WORKOUT.items.map((i, n) => ({ ...i, group: ["C", "A1", "A2", "B"][n] as string }));
    expect(relabelGroups(items).map((i) => i.group)).toEqual(["A", "B1", "B2", "C"]);
  });
});

describe("importing drafted items", () => {
  const draft = (exerciseId: number, group: string) => ({ exerciseId, group, sets: 4, reps: "6-8", kg: 80, rpe: null, restSeconds: null });

  it("appends after the current blocks, keeping the source's supersets", () => {
    const w = appendItems(INITIAL_WORKOUT, [draft(1, "A"), draft(7, "B1"), draft(8, "B2")], ["x", "y", "z"]);
    expect(w.items.slice(-3).map((i) => [i.key, i.group])).toEqual([["x", "D"], ["y", "E1"], ["z", "E2"]]);
  });

  it("fills gaps with sensible defaults", () => {
    const [item] = appendItems({ ...INITIAL_WORKOUT, items: [] }, [{ ...draft(7, "A"), sets: 0, reps: "" }], ["k"]).items;
    expect(item).toMatchObject({ group: "A", sets: 3, reps: "10", kg: 80, rpe: 7, restSeconds: 60, lastTime: "New exercise" });
  });
});

describe("supersets", () => {
  const groups = (w: { items: { group: string }[] }) => w.items.map((i) => i.group).join(" ");

  it("links an item to the block above, and splits it back out", () => {
    const linked = toggleSuperset(INITIAL_WORKOUT, "c");
    expect(groups(linked)).toBe("A B1 B2 B3");
    expect(groups(toggleSuperset(linked, "c"))).toBe("A B1 B2 C");
  });

  it("splitting the middle of a superset keeps the items below together", () => {
    const three = toggleSuperset(INITIAL_WORKOUT, "c");
    expect(groups(toggleSuperset(three, "b2"))).toBe("A B C D");
    expect(groups(toggleSuperset(INITIAL_WORKOUT, "a"))).toBe("A B1 B2 C");
  });

  it("moving one half of a superset away leaves a single block", () => {
    expect(groups(moveItem(INITIAL_WORKOUT, "b2", 4))).toBe("A B C D");
  });
});
