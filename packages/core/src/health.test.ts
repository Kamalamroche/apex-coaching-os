import { describe, expect, it } from "vitest";
import { byNeed, clientHealth, healthTrend, type HealthInput } from "./health";

const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const day = (n: number) => daysAgo(n).slice(0, 10);
const base = (over: Partial<HealthInput> = {}): HealthInput => ({
  startedAt: "2026-09-01T00:00:00Z", sessions: [], plannedPerWeek: 3, checkIns: [], habits: [], habitTicks: [], hasFoodTargets: false, foodDays: [], clientMessages: [], ...over,
});

describe("client health", () => {
  it("gives no score in the first week", () => {
    const h = clientHealth(base({ startedAt: daysAgo(3) }), NOW);
    expect(h.score).toBeNull();
    expect(h.band).toBe("new");
  });

  it("scores a client doing everything as on track", () => {
    const h = clientHealth(base({
      sessions: [1, 3, 5, 8, 10, 12].map(daysAgo),
      checkIns: [daysAgo(2)],
      habits: [{ days: [0, 1, 2, 3, 4, 5, 6], createdAt: "2026-10-01T00:00:00Z" }],
      habitTicks: [0, 1, 2, 3, 4, 5, 6].map(day),
      hasFoodTargets: true,
      foodDays: [0, 1, 2, 3, 4].map(day),
      clientMessages: [daysAgo(1)],
    }), NOW);
    expect(h.score).toBe(100);
    expect(h.band).toBe("good");
    expect(h.reasons).toEqual(["Doing everything asked"]);
  });

  it("flags a client who stopped training and checking in", () => {
    const h = clientHealth(base({ sessions: [daysAgo(20)], checkIns: [daysAgo(25)], clientMessages: [daysAgo(30)] }), NOW);
    expect(h.score).toBeLessThan(50);
    expect(h.band).toBe("low");
    expect(h.reasons[0]).toMatch(/0 of 6 planned sessions in 14 days, last one 20 days ago/);
    expect(h.reasons[1]).toBe("Last check-in 25 days ago");
  });

  it("leaves out habits and food when none are set", () => {
    const h = clientHealth(base({ sessions: [1, 4, 8, 11, 13].map(daysAgo) }), NOW);
    expect(h.parts.map((p) => p.key)).toEqual(["training", "checkins", "contact"]);
  });

  it("only counts habits on the days they're due", () => {
    // Due Mondays only; 20 Nov 2026 is a Friday, so one Monday (16 Nov) in the last 7 days.
    const h = clientHealth(base({ habits: [{ days: [0], createdAt: "2026-10-01T00:00:00Z" }], habitTicks: ["2026-11-16"] }), NOW);
    expect(h.parts.find((p) => p.key === "habits")).toMatchObject({ score: 1, note: "1 of 1 habits ticked this week" });
  });

  it("uses the client's plan for the training bar", () => {
    const two = clientHealth(base({ plannedPerWeek: 2, sessions: [2, 6, 9, 13].map(daysAgo) }), NOW);
    const five = clientHealth(base({ plannedPerWeek: 5, sessions: [2, 6, 9, 13].map(daysAgo) }), NOW);
    expect(two.parts[0]!.score).toBe(1);
    expect(five.parts[0]!.score).toBeCloseTo(0.4);
  });

  it("shows the trend over a week", () => {
    const input = base({ sessions: [8, 10, 12, 15, 17, 19].map(daysAgo), checkIns: [daysAgo(9)] });
    expect(healthTrend(input, NOW)).toBeLessThan(0);
  });

  it("sorts the clients who need the coach first, new clients last", () => {
    const row = (id: string, score: number | null, trend: number | null = 0) => ({ client: id, health: { score, band: "watch" as const, parts: [], reasons: [] }, trend });
    expect(byNeed([row("new", null), row("ok", 80), row("low", 30), row("dropping", 80, -20)]).map((r) => r.client)).toEqual(["low", "dropping", "ok", "new"]);
  });
});
