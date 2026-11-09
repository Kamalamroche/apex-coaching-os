import { describe, expect, it } from "vitest";
import { FOODS } from "./data/foods";
import { RECIPES, dietMisses, dietWarning, filterRecipes, notesClash, recipeHasTag, fromCoachRecipeRow, fromMealPlanRow, newCoachRecipe, recipePhoto, recipeProblem, toCoachRecipeRow, mealLogged, planDayFor, planDayTotals, planItemFromFood, planItemFromRecipe, recipeById, recipeMacros, sampleMealPlan, shoppingList, toMealPlanRow, type MealPlan } from "./mealPlans";

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

describe("recipe library", () => {
  it("has 15 recipes for each meal, each a sensible serving", () => {
    for (const meal of ["breakfast", "lunch", "dinner", "snack"] as const) expect(filterRecipes([], meal).length, meal).toBe(15);
    for (const r of RECIPES) {
      const m = recipeMacros(r);
      expect(m.kcal, r.name).toBeGreaterThan(90);
      expect(m.kcal, r.name).toBeLessThan(900);
      expect(r.steps.length, r.name).toBeGreaterThan(0);
    }
  });
  it("vegan recipes have no meat, fish, eggs or dairy", () => {
    const animal = new Set([...Array.from({ length: 18 }, (_, i) => i + 1), 26, 28, ...Array.from({ length: 15 }, (_, i) => i + 29).filter((id) => id !== 36 && id !== 37)]);
    for (const r of filterRecipes(["Vegan"])) for (const i of r.ingredients) expect(animal.has(i.foodId), `${r.name} ${i.foodId}`).toBe(false);
  });
  it("gives every built-in recipe a photo path", () => {
    expect(recipePhoto(RECIPES[0]!)).toBe(`/recipes/${RECIPES[0]!.id}.webp`);
    expect(recipePhoto(RECIPES[0]!, true)).toBe(`/recipes/${RECIPES[0]!.id}-480.webp`);
  });
});

describe("coach recipes", () => {
  const mine = { ...newCoachRecipe("lunch"), id: "6f1c1b7e-0000-4000-8000-000000000001", name: "Coach's chicken wrap", ingredients: [{ foodId: 1, factor: 1 }, { foodId: 51, factor: 1 }], steps: ["Fill the wrap.", " "] };
  it("checks what the coach wrote", () => {
    expect(recipeProblem(newCoachRecipe())).toMatch(/name/);
    expect(recipeProblem({ ...mine, ingredients: [] })).toMatch(/ingredient/);
    expect(recipeProblem({ ...mine, steps: [" "] })).toMatch(/step/);
    expect(recipeProblem({ ...mine, photo: "javascript:alert(1)" })).toMatch(/photo/);
    expect(recipeProblem(mine)).toBeNull();
  });
  it("round-trips through the database row and drops empty steps", () => {
    const back = fromCoachRecipeRow(toCoachRecipeRow(mine, "coach-1"));
    expect(back).toEqual({ ...mine, steps: ["Fill the wrap."] });
    expect(recipePhoto(back)).toBeNull();
  });
  it("lists the coach's first and uses them in the shopping list", () => {
    expect(filterRecipes([], "lunch", [mine])[0]?.id).toBe(mine.id);
    expect(recipeById(mine.id, [mine])?.name).toBe(mine.name);
    const plan: MealPlan = { note: "", updatedAt: "", days: [{ id: "d", name: "Day", meals: { breakfast: [], lunch: [planItemFromRecipe(mine)], dinner: [], snack: [] } }] };
    const list = shoppingList(plan, 2, [mine]);
    expect(list.find((l) => l.name.startsWith("Chicken breast"))?.amount).toBe("200 g");
    expect(list.some((l) => l.group === "Other")).toBe(false);
  });
});

describe("diet matching", () => {
  const vegan = RECIPES.find((r) => r.tags.includes("Vegan"))!;
  const meat = RECIPES.find((r) => !r.tags.includes("Vegetarian") && !r.tags.includes("Vegan"))!;
  it("counts vegan recipes as vegetarian and dairy free", () => {
    expect(recipeHasTag(vegan, "Vegetarian")).toBe(true);
    expect(recipeHasTag(vegan, "Dairy free")).toBe(true);
    expect(filterRecipes(["Vegetarian"])).toContain(vegan);
  });
  it("names what a recipe misses for the client's diet", () => {
    expect(dietMisses(vegan, ["Vegetarian"])).toEqual([]);
    expect(dietWarning(vegan, ["Vegetarian"])).toBeNull();
    expect(dietWarning(meat, ["Vegetarian"])).toBe("Not vegetarian");
    expect(dietWarning(meat, [])).toBeNull();
  });
  it("has vegetarian and gluten free options for every meal", () => {
    for (const m of ["breakfast", "lunch", "dinner", "snack"] as const) {
      expect(filterRecipes(["Vegetarian"], m).length).toBeGreaterThanOrEqual(3);
      expect(filterRecipes(["Gluten free"], m).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("allergy notes", () => {
  const shake = RECIPES.find((r) => r.name.toLowerCase().includes("peanut"))!;
  it("flags a recipe with a food the client named", () => {
    expect(notesClash(shake, "Peanut allergy. Not keen on mushrooms.")).toEqual(["peanut"]);
    expect(notesClash(shake, "Nut allergy")).toEqual(["nut"]);
  });
  it("leaves recipes alone when nothing matches", () => {
    expect(notesClash(shake, "")).toEqual([]);
    expect(notesClash(shake, "I don't like fish")).toEqual([]);
  });
  it("understands plurals and groups", () => {
    const salmon = RECIPES.find((r) => r.name.toLowerCase().includes("salmon"))!;
    expect(notesClash(salmon, "no fish please")).toEqual(["fish"]);
    const eggs = RECIPES.find((r) => r.id === "r-eggs-sourdough")!;
    expect(notesClash(eggs, "Eggs make me ill")).toContain("egg");
    expect(notesClash(eggs, "gluten intolerant")).toEqual(["gluten"]);
  });
});
