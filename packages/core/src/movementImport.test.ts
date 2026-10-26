import { describe, expect, it } from "vitest";
import { aliasesFor, bodyAreaFor, equipmentFor, importSheet, musclesFor, patternFor, type SheetRow } from "./movementImport";

const row = (name: string, category: string, equipment = "Bodyweight"): SheetRow => ({ no: 1, name, category, equipment, focus: "" });

describe("equipmentFor", () => {
  it("fixes loaded lifts the sheet lists as bodyweight", () => {
    expect(equipmentFor(row("Trap Bar Deadlift", "Major Compound"))).toBe("Trap bar");
    expect(equipmentFor(row("Hammer Curl", "Minor / Accessory"))).toBe("Dumbbell");
  });

  it("tidies the sheet's equipment names and keeps real bodyweight moves", () => {
    expect(equipmentFor(row("Cobra Stretch", "Stretching", "Bodyweight / Mat"))).toBe("Bodyweight");
    expect(equipmentFor(row("Russian Twist", "Core - Rotational / Twisting"))).toBe("Bodyweight");
    expect(equipmentFor(row("TRX Fallout", "Core - Front", "TRX / Suspension Trainer"))).toBe("Suspension trainer");
  });
});

describe("patternFor", () => {
  it.each([
    ["Conventional Deadlift", "Major Compound", "Hinge"],
    ["Bulgarian Split Squat", "Major Compound", "Squat"],
    ["Split Jerk", "Major Compound", "Push"],
    ["Pendlay Row", "Major Compound", "Pull"],
    ["Box Jump", "Plyometric", "Power"],
    ["Clap Push-Up", "Plyometric", "Push"],
    ["Suitcase Carry", "Stability & Balance", "Carry"],
    ["Isometric Calf Raise Hold", "Isometric Strength", "Isolation"],
    ["Half-Kneeling Pallof Press", "Stability & Balance", "Core"],
    ["Pigeon Pose Yoga", "Yoga", "Mobility"],
    ["Barbell Curl", "Minor / Accessory", "Isolation"],
  ])("%s → %s", (name, category, pattern) => {
    expect(patternFor(row(name, category))).toBe(pattern);
  });
});

describe("bodyAreaFor and musclesFor", () => {
  it("puts curls on the arms but leg curls on the legs", () => {
    expect(bodyAreaFor(row("Preacher Curl", "Minor / Accessory"))).toBe("Arms");
    expect(bodyAreaFor(row("Lying Leg Curl", "Minor / Accessory"))).toBe("Legs");
    expect(musclesFor(row("Lying Leg Curl", "Minor / Accessory"))).toEqual(["Hamstrings"]);
  });

  it("does not read 'rdl' inside other words or 'row' inside 'crow'", () => {
    expect(musclesFor(row("Hurdle Hop", "Plyometric"))).toEqual(["Quads", "Glutes", "Calves"]);
    expect(bodyAreaFor(row("Crow Pose", "Yoga"))).not.toBe("Back");
  });

  it("uses the core section for core muscles", () => {
    expect(bodyAreaFor(row("Russian Twist", "Core - Rotational / Twisting"))).toBe("Core");
    expect(musclesFor(row("Side Plank", "Core - Lateral"))).toEqual(["Obliques"]);
  });
});

describe("aliasesFor", () => {
  it("adds gym shorthand and UK names", () => {
    expect(aliasesFor("Single-Leg Romanian Deadlift")).toEqual(expect.arrayContaining(["rdl", "sl"]));
    expect(aliasesFor("Diamond Push-Up")).toEqual(expect.arrayContaining(["press-up"]));
    expect(aliasesFor("Dumbbell Fly")).toContain("db fly");
  });
});

describe("importSheet", () => {
  it("skips movements already in the starter set and numbers the rest in order", () => {
    const out = importSheet([row("Plank", "Core - Front"), row("Side Plank", "Core - Lateral"), row("Bird Dog", "Stability & Balance")], 16);
    expect(out.map((e) => [e.id, e.name])).toEqual([[16, "Side Plank"], [17, "Bird Dog"]]);
    expect(out[0]).toMatchObject({ cues: [], commonMistake: "", type: "Core" });
  });

  it("rejects an unknown sheet section", () => {
    expect(() => importSheet([row("Mystery", "Cardio")], 16)).toThrow(/Cardio/);
  });
});
