import { describe, expect, it } from "vitest";
import { businessGlance, businessSummary, lastMonths, parsePounds, pounds, type BizClient, type BizInput } from "./business";
import { sampleBusiness } from "./data/business";

const NOW = new Date("2026-11-20T12:00:00Z");
const client = (over: Partial<BizClient>): BizClient => ({ id: "x", name: "X", startedAt: "2026-06-01T00:00:00Z", endedAt: null, status: "active", feePence: 15000, ...over });
const input = (over: Partial<BizInput>): BizInput => ({ clients: [], leads: [], bookings: [], packs: [], sales: [], now: NOW, ...over });

describe("business summary", () => {
  it("is all zeros and nulls with no data", () => {
    const s = businessSummary(input({}));
    expect(s.active).toBe(0);
    expect(s.recurringPence).toBe(0);
    expect(s.churnPct).toBeNull();
    expect(s.retained90Pct).toBeNull();
    expect(s.avgMonths).toBeNull();
    expect(s.lifetimePence).toBeNull();
    expect(s.conversionPct).toBeNull();
    expect(s.sessions30.noShowPct).toBeNull();
    expect(s.months).toHaveLength(6);
  });

  it("adds up monthly recurring from active and paused clients only", () => {
    const s = businessSummary(input({ clients: [
      client({ id: "a", feePence: 15000 }),
      client({ id: "b", status: "paused", feePence: 10000 }),
      client({ id: "c", feePence: 0 }),
      client({ id: "d", status: "ended", endedAt: "2026-11-01T00:00:00Z", feePence: 20000 }),
      client({ id: "e", status: "invited", feePence: 9900 }),
    ] }));
    expect(s.active).toBe(2);
    expect(s.paused).toBe(1);
    expect(s.recurringPence).toBe(25000);
    expect(s.noFee).toBe(1);
    expect(s.perClientPence).toBe(12500);
  });

  it("counts new and lost clients per month and works out churn and retention", () => {
    const s = businessSummary(input({ clients: [
      client({ id: "a", startedAt: "2026-11-03T00:00:00Z" }),
      client({ id: "b", startedAt: "2026-07-01T00:00:00Z" }),
      client({ id: "c", startedAt: "2026-07-01T00:00:00Z", status: "ended", endedAt: "2026-11-10T00:00:00Z" }),
      client({ id: "d", startedAt: "2026-07-01T00:00:00Z", status: "ended", endedAt: "2026-09-10T00:00:00Z" }),
    ] }));
    expect(s.newThisMonth).toBe(1);
    expect(s.lostThisMonth).toBe(1);
    // 30 days ago b and c were coached; c left since.
    expect(s.churnPct).toBe(50);
    // 90 days ago (22 Aug) b, c and d were coached; only b is still here.
    expect(s.retained90Pct).toBe(33);
    expect(s.months.find((m) => m.key === "2026-09")!.lostClients).toBe(1);
    expect(s.lifetimePence).not.toBeNull();
  });

  it("counts fees in the months a client was coached, plus packs and programme sales", () => {
    const s = businessSummary(input({
      clients: [client({ id: "a", startedAt: "2026-10-15T00:00:00Z", feePence: 10000 }), client({ id: "b", startedAt: "2026-06-01T00:00:00Z", status: "ended", endedAt: "2026-10-05T00:00:00Z", feePence: 5000 })],
      packs: [{ boughtAt: "2026-11-02T10:00:00Z", pricePence: 30000 }, { boughtAt: "2026-01-02T10:00:00Z", pricePence: 99900 }],
      sales: [{ at: "2026-11-05T10:00:00Z", paidPence: 2500 }],
    }));
    const oct = s.months.find((m) => m.key === "2026-10")!;
    const nov = s.thisMonth;
    expect(oct.feesPence).toBe(15000);
    expect(nov.feesPence).toBe(10000);
    expect(nov.packsPence).toBe(30000);
    expect(nov.salesPence).toBe(2500);
    expect(nov.totalPence).toBe(42500);
  });

  it("leaves clients who ended before end dates were recorded out of month totals", () => {
    const s = businessSummary(input({ clients: [client({ status: "ended", endedAt: null })] }));
    expect(s.months.every((m) => m.feesPence === 0)).toBe(true);
    expect(s.avgMonths).toBeNull();
  });

  it("works out lead conversion by source over 90 days", () => {
    const s = businessSummary(input({ leads: [
      { createdAt: "2026-11-01T00:00:00Z", stage: "client", source: "instagram" },
      { createdAt: "2026-11-02T00:00:00Z", stage: "new", source: "instagram" },
      { createdAt: "2026-10-01T00:00:00Z", stage: "client", source: "referral" },
      { createdAt: "2026-10-03T00:00:00Z", stage: "lost", source: "page" },
      { createdAt: "2026-01-01T00:00:00Z", stage: "client", source: "page" },
    ] }));
    expect(s.leads90).toBe(4);
    expect(s.won90).toBe(2);
    expect(s.conversionPct).toBe(50);
    expect(s.sources[0]).toMatchObject({ source: "instagram", leads: 2, clients: 1, label: "Instagram" });
    expect(s.sources.map((x) => x.source)).toEqual(["instagram", "referral", "page"]);
  });

  it("counts sessions delivered, no-shows and late cancellations in the last 30 days", () => {
    const b = (startsAt: string, over = {}) => ({ startsAt, kind: "session" as const, status: "booked" as const, attendance: "attended" as const, late: false, ...over });
    const s = businessSummary(input({ bookings: [
      b("2026-11-10T09:00:00Z"),
      b("2026-11-11T09:00:00Z"),
      b("2026-11-12T09:00:00Z", { attendance: "no_show" }),
      b("2026-11-13T09:00:00Z", { status: "cancelled", attendance: null, late: true }),
      b("2026-11-14T09:00:00Z", { kind: "call" }),
      b("2026-11-25T09:00:00Z", { attendance: null }),
      b("2026-09-01T09:00:00Z"),
    ] }));
    expect(s.sessions30).toEqual({ delivered: 2, noShows: 1, lateCancels: 1, noShowPct: 33 });
  });
});

describe("months and money", () => {
  it("lists the last six calendar months ending this one", () => {
    expect(lastMonths(NOW).map((m) => m.label)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(lastMonths(new Date("2026-02-10T12:00:00Z"), 3).map((m) => m.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  it("formats pounds", () => {
    expect(pounds(150000)).toBe("£1,500");
    expect(pounds(1250)).toBe("£12.50");
    expect(pounds(0)).toBe("£0");
  });
  it("reads what a coach types as a fee", () => {
    expect(parsePounds("150")).toBe(15000);
    expect(parsePounds("£149.99")).toBe(14999);
    expect(parsePounds("1,200")).toBe(120000);
    expect(parsePounds("")).toBe(0);
    expect(parsePounds("abc")).toBeNull();
    expect(parsePounds("12.345")).toBeNull();
    expect(parsePounds("-5")).toBeNull();
  });
});

describe("business glance", () => {
  it("gives four plain tiles from the summary", () => {
    const sum = businessSummary(sampleBusiness(NOW));
    const g = businessGlance(sum);
    expect(g.map((t) => t.key)).toEqual(["recurring", "month", "sessions", "leads"]);
    expect(g[0]!.value).toBe(pounds(sum.recurringPence));
    expect(g[2]!.value).toBe(String(sum.sessions30.delivered));
  });

  it("notes clients without a fee and stays quiet when there's nothing to add", () => {
    const input: BizInput = { now: NOW, clients: [client({ id: "a", feePence: 0, startedAt: "2026-06-01T00:00:00Z" })], leads: [], bookings: [], packs: [], sales: [] };
    const g = businessGlance(businessSummary(input));
    expect(g[0]!.note).toBe("1 without a fee set");
    expect(g[2]!.note).toBeNull();
    expect(g[3]!.note).toBeNull();
  });
});
