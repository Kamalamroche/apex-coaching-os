import { describe, expect, it } from "vitest";
import { EATING_OUT } from "./data/eatingOut";
import { RECIPES } from "./data/recipes";
import { BUDGET_PENCE, formatPence, isBudget, planCost, recipeCost } from "./budget";
import { newCoachRecipe, sampleMealPlan } from "./mealPlans";

describe("budget", () => {
  it("prices every APEX recipe at a sensible cost a serving", () => {
    for (const r of RECIPES) {
      const c = recipeCost(r);
      expect(c, r.name).not.toBeNull();
      expect(c!, r.name).toBeGreaterThan(20);
      expect(c!, r.name).toBeLessThan(700);
    }
  });
  it("has plenty of budget recipes for every meal", () => {
    for (const m of ["breakfast", "lunch", "dinner", "snack"] as const) expect(RECIPES.filter((r) => r.meal === m && isBudget(r)).length, m).toBeGreaterThanOrEqual(4);
    expect(BUDGET_PENCE).toBe(200);
  });
  it("gives no price when a food has none", () => {
    expect(recipeCost({ ...newCoachRecipe(), ingredients: [{ foodId: 999999, factor: 1 }] })).toBeNull();
  });
  it("formats pence and pounds", () => {
    expect(formatPence(85)).toBe("85p");
    expect(formatPence(120)).toBe("£1.20");
  });
  it("estimates a week of the sample plan", () => {
    const c = planCost(sampleMealPlan(), 7);
    expect(c.pence).toBeGreaterThan(1500);
    expect(c.pence).toBeLessThan(8000);
  });
});

describe("eating out guide", () => {
  it("has full, unique entries", () => {
    expect(new Set(EATING_OUT.map((g) => g.id)).size).toBe(EATING_OUT.length);
    for (const g of EATING_OUT) { expect(g.picks.length).toBeGreaterThanOrEqual(3); expect(g.watch.length).toBeGreaterThanOrEqual(3); expect(g.tip).toBeTruthy(); }
  });
});
