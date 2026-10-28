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
