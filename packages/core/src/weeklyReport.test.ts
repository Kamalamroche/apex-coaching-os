import { describe, expect, it } from "vitest";
import type { HealthInput } from "./health";
import { weeklyReport } from "./weeklyReport";

const h = (sessions: string[], extra: Partial<HealthInput> = {}): HealthInput => ({
  startedAt: "2026-10-01T09:00:00", sessions, plannedPerWeek: 3, checkIns: [], habits: [], habitTicks: [], hasFoodTargets: false, foodDays: [], clientMessages: [], ...extra,
});
const now = new Date("2026-11-18T10:00:00"); // Wednesday: report is Mon 9 – Sun 15 Nov
const biz = { clients: [], leads: [], bookings: [], packs: [], sales: [], now };

describe("weeklyReport", () => {
  it("counts last full week only", () => {
    const r = weeklyReport({
      clients: [{ id: "a", name: "Sarah Mitchell" }, { id: "b", name: "Omar Tahir" }, { id: "c", name: "Lena Rossi" }],
      health: {
        a: h(["2026-11-09T08:00:00", "2026-11-11T08:00:00", "2026-11-14T08:00:00", "2026-11-17T08:00:00"], { checkIns: ["2026-11-15T19:00:00"] }),
        b: h(["2026-11-10T18:00:00"]),
        c: h(["2026-11-03T08:00:00"]),
      },
      biz: { ...biz, leads: [{ createdAt: "2026-11-12T10:00:00", stage: "new", source: "instagram" }, { createdAt: "2026-11-02T10:00:00", stage: "new", source: "instagram" }], packs: [{ boughtAt: "2026-11-13T10:00:00", pricePence: 25000 }], sales: [{ at: "2026-11-16T10:00:00", paidPence: 4900 }] },
      now,
    });
    expect(r.label).toBe("9 – 15 Nov");
    expect(r.sessions).toBe(4);
    expect(r).toMatchObject({ trained: 2, coached: 3, onPlan: 1, checkIns: 1, newLeads: 1, moneyInPence: 25000 });
    expect(r.quiet.map((c) => c.name)).toEqual(["Lena Rossi"]);
    expect(r.top).toEqual({ client: { id: "a", name: "Sarah Mitchell" }, sessions: 3 });
    expect(r.headline).toBe("2 of 3 trained. Lena went quiet: a quick message now keeps them.");
  });

  it("leaves out clients who started after the week and handles an empty roster", () => {
    const r = weeklyReport({ clients: [{ id: "n", name: "New Person" }], health: { n: h([], { startedAt: "2026-11-17T09:00:00" }) }, biz, now });
    expect(r.coached).toBe(0);
    expect(r.headline).toMatch(/No clients last week/);
  });

  it("celebrates a full week", () => {
    const r = weeklyReport({ clients: [{ id: "a", name: "A B" }], health: { a: h(["2026-11-10T08:00:00"]) }, biz, now });
    expect(r.headline).toBe("Everyone trained last week. 1 session in total.");
  });
});
