import { describe, expect, it } from "vitest";
import { HERO_IMAGES, heroForExercise, heroForSport, heroForWorkout } from "./hero";

const ex = (name: string, pattern: string, category: string, extra: object = {}) => ({ name, pattern, category, ...extra }) as Parameters<typeof heroForExercise>[0];

describe("hero images", () => {
  it("matches each movement to a photo of that kind of lift", () => {
    expect(heroForExercise(ex("Back squat", "Squat", "Legs"))).toBe("squat");
    expect(heroForExercise(ex("Bulgarian split squat", "Squat", "Legs"))).toBe("lower");
    expect(heroForExercise(ex("Barbell hip thrust", "Hinge", "Legs"))).toBe("hip-thrust");
    expect(heroForExercise(ex("Romanian deadlift", "Hinge", "Legs"))).toBe("hinge");
    expect(heroForExercise(ex("Dumbbell bench press", "Push", "Chest"))).toBe("bench");
    expect(heroForExercise(ex("Dumbbell shoulder press", "Push", "Shoulders"))).toBe("upper");
    expect(heroForExercise(ex("Seated row", "Pull", "Back"))).toBe("pull");
    expect(heroForExercise(ex("Pull-Up", "Pull", "Back"))).toBe("calisthenics");
    expect(heroForExercise(ex("Ring L-sit", "Core", "Core"))).toBe("rings");
    expect(heroForExercise(ex("Sled Push", "Power", "Full body"))).toBe("sled");
    expect(heroForExercise(ex("Wall Ball", "Squat", "Full body"))).toBe("wall-ball");
    expect(heroForExercise(ex("Ski Erg", "Pull", "Full body"))).toBe("ski");
    expect(heroForExercise(ex("Kettlebell Swing", "Hinge", "Full body"))).toBe("kettlebell");
    expect(heroForExercise(ex("Plank", "Core", "Core"))).toBe("core");
    expect(heroForExercise(ex("Couch stretch", "Mobility", "Legs"))).toBe("mobility");
    expect(heroForExercise(ex("Farmer's Carry", "Carry", "Full body"))).toBe("dumbbell");
  });
  it("uses the session type when the name says it", () => {
    expect(heroForWorkout({ name: "Race circuit A", items: [] })).toBe("sled");
    expect(heroForWorkout({ name: "Calisthenics · skills", items: [] })).toBe("calisthenics");
    expect(heroForWorkout({ name: "Mobility flow", items: [] })).toBe("mobility");
    expect(heroForWorkout({ name: "Circuit A · 40 on / 20 off", items: [] })).toBe("kettlebell");
    expect(heroForWorkout({ items: [] })).toBe("dumbbell");
  });
  it("picks a photo for each cardio sport and every image has a file", () => {
    expect(heroForSport("swim")).toBe("swim");
    expect(heroForSport("ride")).toBe("ride");
    expect(heroForSport("row")).toBe("ski");
    expect(heroForSport(undefined)).toBe("run");
    for (const h of Object.values(HERO_IMAGES)) {
      expect(h.src).toMatch(/^\/hero\/[a-z-]+\.webp$/);
      if (h.cut) expect(h.cut).toBe(h.src.replace(".webp", "-cut.webp"));
      expect(h.word.length).toBeLessThanOrEqual(6);
    }
  });
});
