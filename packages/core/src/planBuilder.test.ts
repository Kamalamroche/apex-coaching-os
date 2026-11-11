import { describe, expect, it } from "vitest";
import { buildPlan, PLAN_EXAMPLES, readBrief } from "./planBuilder";
import { EXERCISES } from "./data/exercises";
import { fromTemplate } from "./program";

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

describe("readBrief", () => {
  it("reads goal, days, level, kit, time and injuries", () => {
    const b = readBrief("Sarah, beginner, wants to lose 6 kg. Three days a week at home with dumbbells, 45 minutes. Sore left knee.");
    expect(b).toMatchObject({ goal: "fatloss", days: 3, level: "beginner", setting: "dumbbells", minutes: 45, avoid: ["knee"] });
    expect(b.understood).toContain("Knee-friendly");
  });
  it("understands twice a week, an hour, and weeks", () => {
    expect(readBrief("Twice a week, no equipment").days).toBe(2);
    expect(readBrief("4x a week for an hour, 12 weeks").minutes).toBe(60);
    expect(readBrief("4 days a week for 12 weeks").weeks).toBe(12);
    expect(readBrief("4 days a week for 12 weeks").days).toBe(4);
  });
  it("falls back to safe defaults and does not claim to understand them", () => {
    const b = readBrief("Wants to feel better");
    expect(b).toMatchObject({ goal: "general", days: 3, level: "beginner", setting: "gym" });
    expect(b.understood).toEqual([]);
    expect(b.assumed).toEqual(["General fitness", "3 days a week", "Beginner", "Full gym", "55 min sessions", "6 weeks"]);
  });
  it("keeps days between 2 and 6", () => {
    expect(readBrief("7 days a week").days).toBe(6);
    expect(readBrief("1 day a week").days).toBe(2);
  });
});

describe("buildPlan", () => {
  const settings = ["in the gym", "with dumbbells", "with kettlebells", "no equipment"];
  const goals = ["get stronger", "build muscle", "lose fat", "get fitter", "general health"];
  const extras = ["", "bad knee", "lower back pain", "shoulder impingement", "knee and lower back pain"];
  const all = settings.flatMap((s) => goals.flatMap((g) => extras.flatMap((x) => [2, 3, 4, 5, 6].map((d) => `${g}, ${d} days a week ${s}, ${x}`))));

  it("only uses exercises from the library, never twice in a day", () => {
    for (const text of all) {
      for (const day of buildPlan(text).template.days) {
        const ids = day.items.map((i) => i.exerciseId);
        for (const id of ids) expect(byId.has(id), `${text}: ${id}`).toBe(true);
        expect(new Set(ids).size, `${text}: ${day.name}`).toBe(ids.length);
      }
    }
  });

  it("gives as many days as asked, on separate weekdays", () => {
    for (const d of [2, 3, 4, 5, 6]) {
      const days = buildPlan(`${d} days a week`).template.days;
      expect(days).toHaveLength(d);
      expect(new Set(days.map((x) => x.dayIndex)).size).toBe(d);
    }
  });

  it("keeps a no-equipment plan to bodyweight and bands, even with injury swaps", () => {
    for (const x of extras) {
      for (const day of buildPlan(`get fitter, 3 days a week, no equipment, ${x}`).template.days) {
        for (const it of day.items) {
          const e = byId.get(it.exerciseId)!;
          if (it.group.startsWith("W")) continue;
          expect(["Bodyweight", "Resistance band", "Dumbbell"], e.name).toContain(e.equipment);
        }
      }
    }
  });

  it("swaps the riskier lifts for a sore knee and says so", () => {
    const plan = buildPlan("build muscle, 4 days a week in the gym, knee pain");
    const ids = plan.template.days.flatMap((d) => d.items.map((i) => i.exerciseId));
    expect(ids).not.toContain(1); // back squat
    expect(plan.template.days.some((d) => d.items.some((i) => i.note === "knee-friendly choice"))).toBe(true);
    expect(plan.why.join(" ")).toMatch(/Knee-friendly/);
  });

  it("doses by goal: heavy fives for strength, a circuit for fat loss", () => {
    const s = buildPlan("get stronger, 3 days, intermediate, gym").template.days[0]!.items.find((i) => i.group === "A")!;
    expect(s.reps).toBe("5");
    const f = buildPlan("lose weight, 3 days, gym").template.days[0]!.items;
    expect(f.some((i) => i.blockStyle === "circuit")).toBe(true);
  });

  it("starts every day with an easy warm-up and has no lone superset labels", () => {
    for (const day of buildPlan(PLAN_EXAMPLES[1]!).template.days) {
      expect(day.items[0]!.group).toBe("W1");
      const groups = day.items.map((i) => i.group).filter((g) => /\d$/.test(g) && !g.startsWith("W"));
      for (const g of groups) expect(groups.filter((o) => o.slice(0, -1) === g.slice(0, -1)).length).toBeGreaterThan(1);
    }
  });

  it("is the same plan for the same words, and turns into a programme", () => {
    expect(buildPlan(PLAN_EXAMPLES[0]!)).toEqual(buildPlan(PLAN_EXAMPLES[0]!));
    for (const ex of PLAN_EXAMPLES) {
      const program = fromTemplate(buildPlan(ex).template);
      expect(program.days.length).toBeGreaterThan(0);
      expect(program.days[0]!.items.length).toBeGreaterThan(4);
    }
  });
});
