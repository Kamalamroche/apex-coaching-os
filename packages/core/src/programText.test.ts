import { describe, expect, it } from "vitest";
import { parseProgramText } from "./programText";

const PDF = `Strength Block - Phase 1
Week 1
Day 1 - Lower
A) Back Squat 4 x 6-8 @ 80kg RPE 8, rest 2 min
B1. Romanian deadlifts – 3 sets of 10 @ 135 lbs
B2. Plank 3x40s
Page 1 of 3
Thursday
• 4x8 Bench press 60kg rest 90s
• Lat pulldown 3 x 12
Drink plenty of water
Week 2
Day 1
Back squat 5x5 @100kg`;

describe("parseProgramText", () => {
  const p = parseProgramText(PDF);

  it("finds the program name, weeks and days", () => {
    expect(p.name).toBe("Strength Block - Phase 1");
    expect(p.days.map((d) => [d.title, d.week, d.dayIndex])).toEqual([["Day 1 - Lower", 1, 0], ["Thursday", 1, 3], ["Day 1", 2, 0]]);
  });

  it("reads sets, reps, load, RPE, rest and superset labels", () => {
    const [squat, rdl, plank] = p.days[0]!.items;
    expect(squat).toMatchObject({ name: "Back Squat", group: "A", sets: 4, reps: "6-8", kg: 80, rpe: 8, restSeconds: 120, confident: true });
    expect(squat?.match?.exercise.name).toBe("Barbell Back Squat");
    expect(rdl).toMatchObject({ group: "B1", sets: 3, reps: "10", kg: 61 });
    expect(rdl?.match?.exercise.name).toBe("Romanian Deadlift");
    expect(plank).toMatchObject({ group: "B2", sets: 3, reps: "40s", kg: 0, rpe: null });
  });

  it("reads the name after the numbers and fills in group letters", () => {
    const [bench, pulldown] = p.days[1]!.items;
    expect(bench).toMatchObject({ name: "Bench press", sets: 4, reps: "8", kg: 60, restSeconds: 90, group: "A" });
    expect(pulldown).toMatchObject({ sets: 3, reps: "12", group: "B" });
  });

  it("lists lines it didn't understand and ignores page numbers", () => {
    expect(p.skipped).toEqual([{ line: 11, text: "Drink plenty of water" }]);
  });

  it("reads a table row copied out of a PDF", () => {
    const t = parseProgramText("Exercise Sets Reps Load\nLeg Press 3 12 140kg");
    expect(t.days[0]?.items[0]).toMatchObject({ name: "Leg Press", sets: 3, reps: "12", kg: 140 });
  });

  it("puts everything in one day when there are no headings", () => {
    const t = parseProgramText("Hip thrust 3x10\nFace pulls 3 x 15");
    expect(t.days).toHaveLength(1);
    expect(t.days[0]).toMatchObject({ title: "Day 1", week: 1, dayIndex: 0 });
  });
});

describe("tables and whole programmes from other apps", () => {
  const TABLE = `Hypertrophy Block - Phase 1
Week 1
Day 1 - Upper
Exercise  Sets  Reps  Load  Rest
Barbell Bench Press  4  8  70.0kg  120s
Seated Cable Row  3  10-12  55.0kg  90s
Day 2 - Lower
Exercise  Sets  Reps  Load  Rest
Deadlift  4  5  120kg  3 min
Walking Lunges  3  12  16kg  90s
Farmer's walk 3 x 40m
Week 2
Day 1 - Upper
Barbell Bench Press  4  8  72.5kg  120s`;
  const p = parseProgramText(TABLE);

  it("reads the rest column, skips the header row and keeps distances", () => {
    expect(p.skipped).toEqual([]);
    const [upper, lower] = p.days;
    expect(upper!.items.map((i) => i.restSeconds)).toEqual([120, 90]);
    expect(lower!.items[0]!.restSeconds).toBe(180);
    expect(lower!.items[2]!.reps).toBe("40m");
  });

  it("matches everyday names to the right movement", () => {
    const names = p.days.flatMap((d) => d.items.map((i) => i.match?.exercise.name));
    expect(names).toContain("Seated Cable Row");
    expect(names).toContain("Conventional Deadlift");
    expect(names).toContain("Walking Lunge");
  });
});

describe("notes written with an exercise", () => {
  const items = parseProgramText(`Day 1 - Lower
A1) Back Squat 4 x 6-8 @ 80kg RPE 8, rest 2 min
Bulgarian split squat 3x10 each side, tempo 3-1-1
Coach: keep the hips square
Walking lunge 3 x 12 per leg (60s rest)
4x8 Back squat
Back Squat   4   6-8  100kg  150s
Note: pause at the bottom`).days[0]!.items;

  it("keeps words after the numbers as the note, not loads, RPE or rest", () => {
    expect(items[0]!.note).toBeUndefined();
    expect(items[0]!.restSeconds).toBe(120);
    expect(items[2]!.note).toBe("per leg");
    expect(items[2]!.restSeconds).toBe(60);
  });

  it("adds a Coach: or Note: line to the exercise above it", () => {
    expect(items[1]!.note).toBe("each side, tempo 3-1-1 · keep the hips square");
    expect(items[4]!.note).toBe("pause at the bottom");
    expect(items[4]!.restSeconds).toBe(150);
  });

  it("doesn't take the name as a note when the numbers come first", () => {
    expect(items[3]!.name).toBe("Back squat");
    expect(items[3]!.note).toBeUndefined();
  });
});

describe("plan-wide notes", () => {
  it("leaves a Notes: line at the end of the plan off the last exercise", () => {
    const p = parseProgramText(`Friday
C) Bike erg 5 x 60s, 60s rest

Notes: drink water and sleep 8 hours.`);
    expect(p.days[0]!.items[0]!.note).toBeUndefined();
    expect(p.skipped.map((s) => s.text)).toContain("Notes: drink water and sleep 8 hours.");
  });
});
