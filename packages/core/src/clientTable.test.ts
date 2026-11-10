import { describe, expect, it } from "vitest";
import { clientTableRows, lastSessionLabel, matchesClientSearch, sortClientTable, tableSummary, type ClientTableRow } from "./clientTable";
import { byNeed, clientHealth, healthTrend, type HealthInput } from "./health";

const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString();
const base = (over: Partial<HealthInput> = {}): HealthInput => ({
  startedAt: "2026-09-01T00:00:00Z", sessions: [], plannedPerWeek: 3, checkIns: [], habits: [], habitTicks: [], hasFoodTargets: false, foodDays: [], clientMessages: [], ...over,
});

const clients = [
  { id: "a", name: "Amara Okafor", mode: "Online", last: daysAgo(1), fee: 15000, input: base({ sessions: [1, 3, 5, 8, 10, 12].map(daysAgo), checkIns: [daysAgo(2)], clientMessages: [daysAgo(1)] }) },
  { id: "b", name: "Ben Hughes", mode: "Hybrid", last: daysAgo(20), fee: 22000, input: base({ sessions: [daysAgo(20)], checkIns: [daysAgo(25)] }) },
  { id: "c", name: "Chen Wei", mode: "In person", last: null, fee: null, input: base({ startedAt: daysAgo(3) }) },
  { id: "d", name: "Dara Patel", mode: "Online", last: daysAgo(4), fee: 12000, input: base({ sessions: [4, 9].map(daysAgo), checkIns: [daysAgo(9)], clientMessages: [daysAgo(10)] }) },
];

const roster = byNeed(clients.map((c) => ({ client: c, health: clientHealth(c.input, NOW), trend: healthTrend(c.input, NOW) })));
const rows = clientTableRows(roster, { lastSession: (c) => c.last, feePence: (c) => c.fee }, NOW);
const names = (r: ClientTableRow[]) => r.map((x) => x.id).join("");

describe("client table", () => {
  it("builds one row per client with each part as 0-100 and blanks for unscored parts", () => {
    const a = rows.find((r) => r.id === "a")!;
    expect(a.parts.training).toBe(100);
    expect(a.parts.habits).toBeNull();
    expect(a.parts.food).toBeNull();
    expect(a.daysSinceSession).toBe(1);
    expect(a.feePence).toBe(15000);
    const c = rows.find((r) => r.id === "c")!;
    expect(c.score).toBeNull();
    expect(c.why).toBe("In their first week");
    expect(c.daysSinceSession).toBeNull();
  });

  it("keeps the roster's need order and can reverse it", () => {
    expect(names(sortClientTable(rows, "need"))).toBe(names(rows));
    expect(rows[0]!.id).toBe("b");
    expect(rows.at(-1)!.id).toBe("c");
    expect(names(sortClientTable(rows, "need", "desc"))).toBe(names([...rows].reverse()));
  });

  it("sorts by score lowest first with new clients last either way", () => {
    expect(names(sortClientTable(rows, "score"))).toBe("bdac");
    expect(names(sortClientTable(rows, "score", "desc"))).toBe("adbc");
  });

  it("sorts by last session longest gap first, never-trained last", () => {
    expect(names(sortClientTable(rows, "last"))).toBe("bdac");
    expect(names(sortClientTable(rows, "last", "asc"))).toBe("adbc");
  });

  it("sorts by name and fee", () => {
    expect(names(sortClientTable(rows, "name"))).toBe("abcd");
    expect(names(sortClientTable(rows, "fee"))).toBe("badc");
  });

  it("sums the roster", () => {
    const s = tableSummary(rows);
    expect(s.feesPence).toBe(49000);
    expect(s.needYou).toBe(rows.filter((r) => r.band === "low").length);
    expect(s.average).not.toBeNull();
  });

  it("labels the last session and searches by any word", () => {
    expect(lastSessionLabel(0)).toBe("Today");
    expect(lastSessionLabel(1)).toBe("Yesterday");
    expect(lastSessionLabel(6)).toBe("6 days ago");
    expect(lastSessionLabel(null)).toBe("Not yet");
    expect(matchesClientSearch({ name: "Ben Hughes", mode: "Hybrid", plan: "Strength Block" }, "ben strength")).toBe(true);
    expect(matchesClientSearch({ name: "Ben Hughes", mode: "Hybrid", plan: null }, "online")).toBe(false);
  });
});
