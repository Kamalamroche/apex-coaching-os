import { describe, expect, it } from "vitest";
import { dayRings, fuelRing, moveRing, ringNudge, ringStreak, ringWeek, trainRing, type RingInput } from "./rings";
import type { Activity } from "./activity";

const today = "2026-11-05";
const at = (day: string, h = 12) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00`).toISOString();
const base = (): RingInput => ({ sessions: [], activities: [], habits: [], ticks: [], water: [], food: [], targets: null });
const session = (day: string, minutes = 50) => ({ at: at(day), workoutName: "Upper", sets: 18, volumeKg: 5000, minutes, bests: [] });
const run = (day: string, mins: number): Activity => ({ id: day + mins, sport: "run", name: "Run", startedAt: at(day, 8), metres: 5000, movingSeconds: mins * 60, elapsedSeconds: mins * 60, source: "manual" });

describe("rings", () => {
  it("closes Train with a finished workout, or 30 cardio minutes", () => {
    expect(trainRing({ ...base(), sessions: [session(today)] }, today).closed).toBe(true);
    const half = trainRing({ ...base(), activities: [run(today, 15)] }, today);
    expect(half.value).toBeCloseTo(0.5);
    expect(half.detail).toBe("15 of 30 min");
    expect(trainRing({ ...base(), activities: [run(today, 31)] }, today).closed).toBe(true);
  });

  it("uses movement habits for Move, else active minutes", () => {
    const habits = [
      { id: "s", kind: "steps" as const, title: "Walk 8,000 steps", days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-10-01" },
      { id: "m", kind: "mobility" as const, title: "Mobility", days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-10-01" },
      { id: "w", kind: "water" as const, title: "Drink 2 L", days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-10-01" },
    ];
    const r = moveRing({ ...base(), habits, ticks: [{ habitId: "s", day: today }] }, today);
    expect(r.value).toBeCloseTo(0.5);
    expect(r.detail).toBe("1 of 2 habits");
    expect(moveRing({ ...base(), sessions: [session(today, 45)] }, today).closed).toBe(true);
  });

  it("fills Fuel from water against the habit goal and the food log", () => {
    const habits = [{ id: "w", kind: "water" as const, title: "Drink 2 L of water", days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-10-01" }];
    const water = [{ id: "1", day: today, ml: 2000, at: at(today) }];
    expect(fuelRing({ ...base(), habits, water }, today).closed).toBe(true);
    expect(fuelRing({ ...base(), habits, water }, today).detail).toBe("2 of 2 L water");
    const food = [{ id: "f", day: today, meal: "lunch" as const, name: "Chicken", kcal: 500, proteinG: 40, carbsG: 50, fatG: 10 }];
    const withFood = fuelRing({ ...base(), habits, water, food, targets: { kcal: 2200, proteinG: 160, carbsG: 200, fatG: 70, note: "" } }, today);
    expect(withFood.value).toBeCloseTo((1 + 0.25) / 2);
  });

  it("counts the streak back from today; an open today doesn't break it", () => {
    const sessions = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) => session(d));
    const open = ringStreak({ ...base(), sessions }, today);
    expect(open).toEqual({ days: 4, best: 4, todayClosed: false });
    const closed = ringStreak({ ...base(), sessions: [...sessions, session(today)] }, today);
    expect(closed.days).toBe(5);
    const gap = ringStreak({ ...base(), sessions: [session("2026-10-20"), session("2026-10-21"), session("2026-10-22"), session(today)] }, today);
    expect(gap).toEqual({ days: 1, best: 3, todayClosed: true });
  });

  it("gives a week of closed counts and a plain nudge", () => {
    const week = ringWeek({ ...base(), sessions: [session(today)] }, today);
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toEqual({ day: today, closed: 2, which: [true, true, false] });
    const rings = dayRings(base(), today);
    expect(ringNudge(rings, 3)).toBe("Close one ring to keep your 3-day streak.");
    expect(ringNudge(rings.map((r) => ({ ...r, closed: true })), 3)).toBe("All three closed. That's a full day.");
  });
});

describe("ring nudge", () => {
  it("names the closest open ring", () => {
    const rings = dayRings({ ...base(), activities: [run(today, 20)] }, today).map((r) => (r.key === "move" ? { ...r, closed: true, value: 1 } : r));
    expect(ringNudge(rings, 2)).toBe("Closest: Train, 20 of 30 min.");
  });
});
