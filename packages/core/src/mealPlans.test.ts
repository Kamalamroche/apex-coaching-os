import { describe, expect, it } from "vitest";
import { FOODS } from "./data/foods";
import { RECIPES, filterRecipes, fromMealPlanRow, mealLogged, planDayFor, planDayTotals, planItemFromFood, planItemFromRecipe, recipeById, recipeMacros, sampleMealPlan, shoppingList, toMealPlanRow, type MealPlan } from "./mealPlans";

describe("recipes", () => {
  it("every ingredient is in the food list and ids are unique", () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const r of RECIPES) for (const i of r.ingredients) expect(ids.has(i.foodId), `${r.name} ${i.foodId}`).toBe(true);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });
  it("adds macros up from ingredients", () => {
    // oats 188 + milk 120 + whey 120 + blueberries 45
    expect(recipeMacros(recipeById("r-protein-oats")!)).toEqual({ kcal: 473, proteinG: 41, carbsG: 58, fatG: 10 });
  });
  it("filters by tag and meal", () => {
    expect(filterRecipes(["Vegan"]).every((r) => r.tags.includes("Vegan"))).toBe(true);
    expect(filterRecipes([], "snack").every((r) => r.meal === "snack")).toBe(true);
    expect(filterRecipes([]).length).toBe(RECIPES.length);
  });
});

describe("plans", () => {
  const plan = sampleMealPlan(new Date("2026-11-09T09:00:00Z"));
  it("totals a day", () => {
    const t = planDayTotals(plan.days[0]!);
    expect(t.kcal).toBeGreaterThan(1500);
    expect(t.proteinG).toBeGreaterThan(100);
  });
  it("picks training or rest day", () => {
    expect(planDayFor(plan, true)?.name).toBe("Training day");
    expect(planDayFor(plan, false)?.name).toBe("Rest day");
    expect(planDayFor(plan, null)?.name).toBe("Training day");
    expect(planDayFor({ ...plan, days: [] }, true)).toBeUndefined();
  });
  it("knows when a meal is logged", () => {
    const items = plan.days[0]!.meals.breakfast;
    const entry = { id: "x", day: "2026-11-09", meal: "breakfast" as const, name: items[0]!.name, kcal: 1, proteinG: 0, carbsG: 0, fatG: 0 };
    expect(mealLogged([entry], "2026-11-09", "breakfast", items)).toBe(true);
    expect(mealLogged([entry], "2026-11-10", "breakfast", items)).toBe(false);
    expect(mealLogged([], "2026-11-09", "lunch", [])).toBe(false);
  });
  it("scales items", () => {
    const egg = FOODS.find((f) => f.id === 17)!;
    expect(planItemFromFood(egg, 2)).toMatchObject({ name: "Egg, large × 2", kcal: 156, foodId: 17 });
    expect(planItemFromRecipe(recipeById("r-pb-shake")!, 0.5).kcal).toBeLessThan(recipeMacros(recipeById("r-pb-shake")!).kcal);
  });
  it("round-trips through the database row", () => {
    const back = fromMealPlanRow(toMealPlanRow(plan, "c1"));
    expect(back.days).toEqual(plan.days);
    expect(back.note).toBe(plan.note);
    expect(fromMealPlanRow({ client_id: "c1", plan: {} as MealPlan, updated_at: "x" }).days).toEqual([]);
  });
});

describe("shoppingList", () => {
  it("breaks recipes into ingredients and adds up a week", () => {
    const plan = sampleMealPlan();
    const list = shoppingList(plan, 7);
    const oats = list.find((l) => l.name === "Porridge oats")!;
    // 7 breakfasts × 50 g
    expect(oats.amount).toBe("350 g");
    expect(list.find((l) => l.name === "Whey protein")).toBeTruthy();
    // Grouped: protein first, drinks/other last.
    expect(list[0]!.group).toBe("Protein");
  });
  it("counts whole items and typed lines", () => {
    const egg = FOODS.find((f) => f.id === 17)!;
    const plan: MealPlan = { note: "", updatedAt: "", days: [{ id: "d", name: "Day", meals: { breakfast: [planItemFromFood(egg, 2), { id: "q", name: "Granny's soup", factor: 1, kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 }], lunch: [], dinner: [], snack: [] } }] };
    const list = shoppingList(plan, 3);
    expect(list.find((l) => l.name === "Egg")?.amount).toBe("6");
    expect(list.find((l) => l.name === "Granny's soup")).toMatchObject({ amount: "3", group: "Other" });
  });
  it("is empty without days", () => {
    expect(shoppingList({ days: [], note: "", updatedAt: "" })).toEqual([]);
  });
});
