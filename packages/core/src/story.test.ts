import { describe, expect, it } from "vitest";
import { INITIAL_HISTORY } from "./data/workout";
import { INITIAL_PROGRESS } from "./data/progress";
import { beforeAfterPair, biggestChange, storySlides, storyWeek, weekLabel, mondayOf, weeklyStory } from "./story";
import { nextHistory } from "./summary";
import { INITIAL_WORKOUT } from "./data/workout";
import type { RecentSession } from "./types";

const s = (at: string, kg: number, bests: RecentSession["bests"] = []): RecentSession => ({ at, workoutName: "W", sets: 10, volumeKg: kg, minutes: 40, bests });

describe("weekly story", () => {
  it("finds Monday and labels the week", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(weekLabel("2026-10-20")).toBe("20 – 26 Oct");
    expect(weekLabel("2026-10-27")).toBe("27 Oct – 2 Nov");
  });

  it("tells the last week with training, or this week when that is all there is", () => {
    const list = [s("2026-11-04T08:00:00", 1000), s("2026-10-22T08:00:00", 900)];
    expect(storyWeek(list, "2026-11-05")).toBe("2026-10-19");
    expect(storyWeek([s("2026-11-04T08:00:00", 1000)], "2026-11-05")).toBe("2026-11-02");
    expect(storyWeek([], "2026-11-05")).toBeNull();
  });

  it("adds up the week, picks the biggest best and counts the streak", () => {
    const list = [
      s("2026-10-24T08:00:00", 3000, [{ exerciseId: 1, exercise: "Squat", kg: 100, previousKg: 95 }]),
      s("2026-10-21T08:00:00", 2000, [{ exerciseId: 2, exercise: "Bench", kg: 60, previousKg: 57.5 }]),
      s("2026-10-15T08:00:00", 4000),
      s("2026-10-08T08:00:00", 1000),
    ];
    const w = weeklyStory({ sessions: list, today: "2026-10-28", coach: "Kamal" })!;
    expect(w.label).toBe("19 – 25 Oct");
    expect(w.workouts).toBe(2);
    expect(w.kg).toBe(5000);
    expect(w.best?.exercise).toBe("Squat");
    expect(w.streakWeeks).toBe(3);
    expect(w.vsLastWeekKg).toBe(1000);
    const kinds = storySlides(w).map((x) => x.kind);
    expect(kinds).toEqual(["cover", "lifted", "best", "streak", "end"]);
  });

  it("works on the demo history", () => {
    const w = weeklyStory({ sessions: INITIAL_HISTORY.sessions ?? [], today: "2026-11-05" });
    expect(w?.workouts).toBe(4);
    expect(w?.best?.exercise).toBe("Trap Bar Deadlift");
  });

  it("keeps finished sessions in the history, newest first", () => {
    const h = nextHistory({ bestKg: {}, previous: null }, { workoutName: "Lower A", sets: 3, volumeKg: 500, minutes: 20, rpe: 7, prs: 0 }, INITIAL_WORKOUT, {});
    expect(h.sessions?.[0]?.workoutName).toBe("Lower A");
  });
});

describe("progress cards", () => {
  it("picks the measurement that moved most", () => {
    const c = biggestChange(INITIAL_PROGRESS.measurements);
    expect(c).not.toBeNull();
    expect(c!.delta).not.toBe(0);
  });

  it("pairs the first and latest photo of a pose", () => {
    const photos = [
      { id: "a", checkInId: null, pose: "front" as const, path: "", takenAt: "2026-09-01T08:00:00Z", url: "a" },
      { id: "b", checkInId: null, pose: "front" as const, path: "", takenAt: "2026-10-27T08:00:00Z", url: "b" },
    ];
    const p = beforeAfterPair(photos, "front")!;
    expect(p.before.id).toBe("a");
    expect(p.weeks).toBe(8);
    expect(beforeAfterPair(photos, "side")).toBeNull();
  });
});
