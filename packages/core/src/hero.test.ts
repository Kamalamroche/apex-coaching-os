import { describe, expect, it } from "vitest";
import { HERO_IMAGES, heroForExercise, heroForWorkout } from "./hero";

describe("hero images", () => {
  it("matches squats, hinges, pushes and the rest", () => {
    expect(heroForExercise({ name: "Back squat", pattern: "Squat", category: "Legs" })).toBe("squat");
    expect(heroForExercise({ name: "Walking lunge", pattern: "Isolation", category: "Legs" })).toBe("squat");
    expect(heroForExercise({ name: "Barbell hip thrust", pattern: "Hinge", category: "Legs" })).toBe("hip-thrust");
    expect(heroForExercise({ name: "Romanian deadlift", pattern: "Hinge", category: "Legs" })).toBe("hinge");
    expect(heroForExercise({ name: "Dumbbell bench press", pattern: "Push", category: "Chest" })).toBe("bench");
    expect(heroForExercise({ name: "Seated row", pattern: "Pull", category: "Back" })).toBe("pull");
    expect(heroForExercise({ name: "Pallof press", pattern: "Core", category: "Core" })).toBe("dumbbell");
  });
  it("falls back for an empty session and every image has a file", () => {
    expect(heroForWorkout({ items: [] })).toBe("dumbbell");
    for (const h of Object.values(HERO_IMAGES)) expect(h.src).toMatch(/^\/hero\/.+\.webp$/);
  });
});
