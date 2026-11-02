import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "./data/starterTemplates";
import { COPILOT_EXAMPLES, counterpart, parseCommand, runCommand } from "./copilot";
import { exerciseById } from "./library";
import { fromTemplate } from "./program";

const upperLower = () => {
  const p = fromTemplate(STARTER_TEMPLATES[1]!);
  // Give the program some loads to work with.
  return { ...p, days: p.days.map((d) => ({ ...d, items: d.items.map((it) => ({ ...it, kg: 60 })) })) };
};

describe("reading instructions", () => {
  it("understands every example shown to the coach", () => {
    for (const e of COPILOT_EXAMPLES) expect(parseCommand(e), e).not.toBeNull();
  });

  it("reads scope: weeks, ranges, from a week, a weekday", () => {
    expect(parseCommand("swap barbell for dumbbells in weeks 3 and 4")?.scope.weeks).toEqual([3, 4]);
    expect(parseCommand("deload weeks 2-4")?.scope.weeks).toEqual([2, 3, 4]);
    expect(parseCommand("deload week 4")?.scope.weeks).toEqual([4]);
    expect(parseCommand("add a set to squats from week 3")?.scope.fromWeek).toBe(3);
    expect(parseCommand("rest 2 min on Monday")?.scope.dayIndex).toBe(0);
  });

  it("names the exercises it will touch", () => {
    expect(parseCommand("add a set to squats", upperLower())?.target?.name).toBe("Barbell Back Squat");
    expect(parseCommand("replace bench press with push-ups", upperLower())?.summary).toBe("Replace Barbell Bench Press with Push-Up across the whole program");
    expect(parseCommand("increase deadlifts by 5 kg")?.action).toEqual({ kind: "load", kg: 5, percent: null });
  });

  it("returns null for anything it doesn't understand", () => {
    expect(parseCommand("make it more fun")).toBeNull();
    expect(parseCommand("add a set to zzqx")).toBeNull();
  });
});

describe("running instructions", () => {
  it("swaps barbell work for the closest dumbbell version only in the weeks named", () => {
    const p = upperLower();
    const r = runCommand(p, parseCommand("swap barbell for dumbbells in weeks 3 and 4")!);
    expect(r.changes.length).toBeGreaterThan(0);
    for (const c of r.changes) {
      expect(c.day).toMatch(/^Week [34]/);
      expect(exerciseById(c.before.exerciseId).equipment).toBe("Barbell");
      expect(exerciseById(c.after.exerciseId).equipment).toBe("Dumbbell");
      expect(c.after.kg).toBe(0);
    }
    expect(r.program.days.filter((d) => d.week === 1)).toEqual(p.days.filter((d) => d.week === 1));
  });

  it("finds sensible counterparts in the same body area", () => {
    expect(counterpart(exerciseById(120), "Dumbbell")?.name).toMatch(/Dumbbell.*Bench Press/);
    expect(counterpart(exerciseById(5), "Dumbbell")?.category).toBe("Shoulders");
  });

  it("deloads loaded work 10% to loadable weights", () => {
    const r = runCommand(upperLower(), parseCommand("deload week 4")!);
    expect(r.changes.every((c) => c.after.kg < c.before.kg && c.day.startsWith("Week 4"))).toBe(true);
    expect(r.changes[0]?.after.kg).toBeOneOf([54, 55]);
  });

  it("adds a set to one exercise everywhere", () => {
    const r = runCommand(upperLower(), parseCommand("add a set to squats", upperLower())!);
    expect(r.changes.length).toBe(8);
    expect(r.changes.every((c) => c.after.sets === c.before.sets + 1)).toBe(true);
  });

  it("changes rest and reps", () => {
    const p = upperLower();
    expect(runCommand(p, parseCommand("rest 90 s on everything")!).program.days.flatMap((d) => d.items).every((i) => i.restSeconds === 90)).toBe(true);
    const reps = runCommand(p, parseCommand("reps 8-10 on face pulls in week 2", p)!);
    expect(reps.changes.every((c) => c.after.reps === "8-10" && c.day.startsWith("Week 2"))).toBe(true);
  });
});
