import { describe, expect, it } from "vitest";
import { addDays, type FoodEntry, type NutritionTargets } from "./lifestyle";
import { estimateExpenditure, guessSmartGoal, smartSuggestion, weighInsFrom, type Expenditure } from "./smartTargets";

const today = "2026-11-17";
const foodDays = (n: number, kcal: number): FoodEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `f${i}`, day: addDays(today, -(i + 1)), meal: "lunch" as const, name: "Day", kcal, proteinG: 0, carbsG: 0, fatG: 0 }));
const targets: NutritionTargets = { kcal: 1900, proteinG: 120, carbsG: 210, fatG: 60, note: "" };

describe("estimateExpenditure", () => {
  it("equals intake when weight holds still", () => {
    const w = [0, 7, 14, 21].map((d) => ({ day: addDays(today, -d - 1), kg: 70 }));
    const r = estimateExpenditure(foodDays(24, 2200), w, today);
    expect(r).toMatchObject({ status: "ready" });
    if (r.status === "ready") { expect(r.est.kcal).toBe(2200); expect(r.est.confidence).toBe("good"); }
  });
  it("adds the deficit when weight falls 0.5 kg a week", () => {
    const w = [21, 14, 7, 0].map((d, i) => ({ day: addDays(today, -d - 1), kg: 80 - i * 0.5 }));
    const r = estimateExpenditure(foodDays(20, 2000), w, today);
    if (r.status !== "ready") throw new Error("not ready");
    expect(r.est.trendKgPerWeek).toBeCloseTo(-0.5, 2);
    expect(r.est.kcal).toBe(2550);
    expect(r.est.confidence).toBe("fair");
  });
  it("leaves out half-logged days and today", () => {
    const food = [...foodDays(16, 2000), { ...foodDays(1, 400)[0]!, id: "x", day: addDays(today, -20) }, { ...foodDays(1, 3000)[0]!, id: "t", day: today }];
    const w = [0, 7, 15].map((d) => ({ day: addDays(today, -d), kg: 70 }));
    const r = estimateExpenditure(food, w, today);
    if (r.status !== "ready") throw new Error("not ready");
    expect(r.est.loggedDays).toBe(16);
    expect(r.est.avgIntake).toBe(2000);
  });
  it("says what's missing", () => {
    const r = estimateExpenditure(foodDays(10, 2000), [{ day: addDays(today, -2), kg: 70 }], today);
    expect(r).toMatchObject({ status: "waiting", loggedDays: 10, weighIns: 1 });
    if (r.status === "waiting") expect(r.reason).toBe("Needs 4 more fully logged days and 2 more weigh-ins in the last four weeks.");
  });
});

describe("weighInsFrom", () => {
  it("merges lists, one per day, sorted, skipping blanks", () => {
    const w = weighInsFrom([{ at: "2026-11-10T09:00:00Z", kg: 70 }, { at: null, kg: 1 }], [{ at: "2026-11-10T10:00:00Z", kg: 69.8 }, { at: "2026-11-03", kg: 70.4 }, { at: "2026-11-04", kg: null }]);
    expect(w).toEqual([{ day: "2026-11-03", kg: 70.4 }, { day: "2026-11-10", kg: 69.8 }]);
  });
});

describe("smartSuggestion", () => {
  const est: Expenditure = { kcal: 2080, avgIntake: 2050, loggedDays: 20, weighIns: 4, trendKgPerWeek: -0.03, weightKg: 62.3, confidence: "fair" };
  it("suggests a deficit for fat loss, carbs take the change", () => {
    const s = smartSuggestion(est, targets, "lose", "Priya");
    expect(s.kcal).toBe(1740);
    expect(s.delta).toBe(-160);
    expect(s.keep).toBe(false);
    expect(s.proteinG).toBe(120);
    expect(s.fatG).toBe(60);
    expect(s.carbsG).toBe(180);
    expect(s.why).toContain("holding steady");
  });
  it("keeps targets when within 100 kcal", () => {
    const s = smartSuggestion({ ...est, kcal: 2240 }, targets, "lose", "Priya");
    expect(s.keep).toBe(true);
    expect(s.why).toContain("should already lose about");
  });
  it("moves rest days by the same amount", () => {
    const s = smartSuggestion(est, { ...targets, restDay: { kcal: 1700, proteinG: 120, carbsG: 160, fatG: 60 } }, "maintain", "Priya");
    expect(s.kcal).toBe(2080);
    expect(s.restDay?.kcal).toBe(1880);
  });
});

describe("guessSmartGoal", () => {
  it("reads the intake goal first, then the current targets", () => {
    expect(guessSmartGoal("Lose 5 kg for summer", null, null)).toBe("lose");
    expect(guessSmartGoal("Build muscle", null, null)).toBe("gain");
    const est = { kcal: 2200 } as Expenditure;
    expect(guessSmartGoal("", 1900, est)).toBe("lose");
    expect(guessSmartGoal("", 2200, est)).toBe("maintain");
  });
});
