import { describe, expect, it } from "vitest";
import { shareCaption, shareCardData, shareReward } from "./share";
import type { WorkoutSummary } from "./types";

const base: WorkoutSummary = { muscles: [], bests: [], vsLast: null, fun: "", totalKg: 7840 };
const session = { workoutName: "Push Day", volumeKg: 7840, sets: 22, minutes: 52 };

describe("share card", () => {
  it("rewards the biggest personal best first", () => {
    const r = shareReward({
      ...base,
      bests: [
        { exerciseId: 9, exercise: "Goblet Squat", kg: 20, previousKg: 18 },
        { exerciseId: 15, exercise: "Trap Bar Deadlift", kg: 72.5, previousKg: 67.5 },
      ],
    });
    expect(r).toEqual({ title: "The Lifter", rarity: "Rare", reason: "New best · Trap Bar Deadlift 72.5 kg +1 more", xp: 100 });
  });

  it("falls back to more volume, then to turning up", () => {
    expect(shareReward({ ...base, vsLast: { volumeKg: 640, sets: 1, minutes: 0 } }).title).toBe("Stronger Than Yesterday");
    expect(shareReward({ ...base, vsLast: { volumeKg: -10, sets: 0, minutes: 0 } })).toMatchObject({ title: "The Grinder", xp: 25 });
  });

  it("works out last time's kg and hides a blank coach", () => {
    const d = shareCardData({ ...base, vsLast: { volumeKg: 640, sets: 1, minutes: 2 } }, session, " ");
    expect(d).toMatchObject({ totalKg: 7840, vsLastKg: 640, lastKg: 7200, coach: null });
    expect(shareCardData(base, session, "Kamal")).toMatchObject({ vsLastKg: null, lastKg: null, coach: "Kamal" });
  });

  it("writes a caption with the coach and the link", () => {
    const d = shareCardData(base, session, "Kamal");
    expect(shareCaption(d, "https://apex.example")).toBe("Push Day done: 7,840 kg lifted in 52 min. Coached by Kamal on APEX. https://apex.example");
  });
});
