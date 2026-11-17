import { describe, expect, it } from "vitest";
import { EXERCISES } from "./data/exercises";
import { CAR_KG, LAUREL_RANKS, bestMoment, carsLifted, laurelBoard, liftLadder, laurelState, sampleLaurelTeam, topSet } from "./rewards";
import type { Workout } from "./types";

describe("rewards", () => {
  it("turns today's total into cars, only once there is at least one", () => {
    expect(carsLifted(0)).toBeNull();
    expect(carsLifted(CAR_KG - 1)).toBeNull();
    expect(carsLifted(CAR_KG)).toEqual({ cars: 1, title: "You lifted a car", toNext: CAR_KG, nextWord: "two" });
    const three = carsLifted(4350)!;
    expect(three.title).toBe("You lifted three cars");
    expect(three.toNext).toBe(1450);
    expect(three.nextWord).toBe("four");
    expect(carsLifted(CAR_KG * 14 + 10)!.title).toBe("You lifted 14 cars");
    expect(carsLifted(CAR_KG * 12)!.nextWord).toBe("13");
  });

  it("finds the heaviest completed set", () => {
    const [a, b] = EXERCISES;
    const w: Workout = { name: "Lower A", week: 1, ofWeeks: 4, minutes: 50, items: [
      { key: "a", group: "A", exerciseId: a!.id, sets: 2, reps: "5", kg: 100, rpe: 8, restSeconds: 120, lastTime: "" },
      { key: "b", group: "B", exerciseId: b!.id, sets: 2, reps: "8", kg: 60, rpe: 8, restSeconds: 90, lastTime: "" },
    ] };
    expect(topSet(w, {
      a: [{ kg: "100", reps: "5", done: true }, { kg: "110", reps: "3", done: false }],
      b: [{ kg: "100", reps: "8", done: true }, { kg: "", reps: "8", done: true }],
    })).toEqual({ exercise: b!.name, kg: 100, reps: 8 });
    expect(topSet(w, { a: [{ kg: "", reps: "40", done: true }] })).toBeNull();
  });

  it("gives laurel ranks at 10, 25, 50, 100 and 200 workouts", () => {
    expect(LAUREL_RANKS.map((r) => r.at)).toEqual([10, 25, 50, 100, 200]);
    const none = laurelState(4);
    expect(none.rank).toBeNull();
    expect(none.next?.name).toBe("Bronze");
    expect(none.toNext).toBe(6);
    const mid = laurelState(44);
    expect(mid.rank?.name).toBe("Silver");
    expect(mid.next?.name).toBe("Gold");
    expect(mid.toNext).toBe(6);
    expect(mid.progress).toBeCloseTo(19 / 25);
    expect(laurelState(50).rank?.name).toBe("Gold");
    const top = laurelState(240);
    expect(top.rank?.name).toBe("Olympian");
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
  });
});

describe("laurel board", () => {
  it("orders the team by lifetime workouts with shared places and ranks", () => {
    const b = laurelBoard([{ name: "B", workouts: 30, isMe: false }, { name: "A", workouts: 30, isMe: true }, { name: "C", workouts: 120, isMe: false }, { name: "D", workouts: 3, isMe: false }]);
    expect(b.map((l) => [l.name, l.place, l.rank])).toEqual([["C", 1, "marble"], ["A", 2, "silver"], ["B", 2, "silver"], ["D", 4, null]]);
    expect(sampleLaurelTeam().filter((l) => l.isMe)).toHaveLength(1);
  });
});

describe("new best and lift ladder", () => {
  it("picks the biggest jump and what it outweighs", () => {
    expect(bestMoment([])).toBeNull();
    const m = bestMoment([{ exerciseId: 1, exercise: "Squat", kg: 100, previousKg: 97.5 }, { exerciseId: 2, exercise: "Deadlift", kg: 140, previousKg: 135 }])!;
    expect(m.exercise).toBe("Deadlift");
    expect(m.gainKg).toBe(5);
    expect(m.thing?.name).toBe("a small motorbike");
    expect(bestMoment([{ exerciseId: 3, exercise: "Curl", kg: 12, previousKg: 0 }])).toMatchObject({ gainKg: 0, thing: null });
  });

  it("climbs the ladder in tonnes", () => {
    const l = liftLadder(52_400);
    expect(l.tonnes).toBe(52.4);
    expect(l.next?.name).toBe("Jumbo jet");
    expect(l.line).toBe("More than a train carriage. Next up: a jumbo jet.");
    expect(l.rungs[0]!.name).toBe("Space rocket");
    expect(l.rungs.filter((r) => r.reached)).toHaveLength(5);
    expect(liftLadder(0).line).toBe("Next up: a grand piano.");
    expect(liftLadder(600_000).next).toBeNull();
  });
});
