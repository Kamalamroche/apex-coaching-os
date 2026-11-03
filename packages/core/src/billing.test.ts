import { describe, expect, it } from "vitest";
import { currentMembership, formatPlanPrice, formatPounds, membershipLabel, monthlyRecurring, parsePounds, revenueByMonth, type Membership } from "./billing";

const m = (over: Partial<Membership>): Membership => ({
  id: "sub_1", clientId: "c1", planId: "p1", status: "active", amountPence: 15000, interval: "month", currentPeriodEnd: "2026-12-02T10:00:00Z", cancelAtPeriodEnd: false, ...over,
});

describe("prices", () => {
  it("formats whole and part pounds", () => {
    expect(formatPounds(15000)).toBe("£150");
    expect(formatPounds(4950)).toBe("£49.50");
    expect(formatPounds(120000)).toBe("£1,200");
    expect(formatPlanPrice(3500, "week")).toBe("£35 a week");
  });
  it("reads what a coach types", () => {
    expect(parsePounds("150")).toBe(15000);
    expect(parsePounds("£49.50")).toBe(4950);
    expect(parsePounds(" 1,200 ")).toBe(120000);
    expect(parsePounds("0.50")).toBeNull();
    expect(parsePounds("abc")).toBeNull();
    expect(parsePounds("12.345")).toBeNull();
    expect(parsePounds("20000")).toBeNull();
  });
});

describe("monthly recurring", () => {
  it("counts paying memberships and turns weekly into monthly", () => {
    const list = [m({}), m({ id: "s2", amountPence: 3000, interval: "week" }), m({ id: "s3", status: "canceled" }), m({ id: "s4", cancelAtPeriodEnd: true }), m({ id: "s5", status: "past_due" })];
    expect(monthlyRecurring(list)).toBe(15000 + 13000 + 15000);
  });
});

describe("current membership", () => {
  it("prefers a live one over an ended one", () => {
    expect(currentMembership([m({ id: "old", status: "canceled" }), m({ id: "new" })])?.id).toBe("new");
    expect(currentMembership([m({ id: "old", status: "canceled" })])?.id).toBe("old");
    expect(currentMembership([])).toBeNull();
  });
});

describe("revenue by month", () => {
  it("adds paid invoices into their month and skips failed ones", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const rows = revenueByMonth([
      { id: "i1", clientId: "c1", amountPence: 15000, status: "paid", paidAt: "2026-11-02T09:00:00Z" },
      { id: "i2", clientId: "c2", amountPence: 22000, status: "paid", paidAt: "2026-11-03T09:00:00Z" },
      { id: "i3", clientId: "c1", amountPence: 15000, status: "paid", paidAt: "2026-10-02T09:00:00Z" },
      { id: "i4", clientId: "c3", amountPence: 9900, status: "failed", paidAt: "2026-11-04T09:00:00Z" },
      { id: "i5", clientId: "c3", amountPence: 9900, status: "paid", paidAt: "2025-11-04T09:00:00Z" },
    ], 3, now);
    expect(rows).toEqual([{ label: "Sep", pence: 0 }, { label: "Oct", pence: 15000 }, { label: "Nov", pence: 37000 }]);
  });
  it("crosses the new year", () => {
    expect(revenueByMonth([], 3, new Date("2027-01-10T00:00:00Z")).map((r) => r.label)).toEqual(["Nov", "Dec", "Jan"]);
  });
});

describe("membership label", () => {
  it("says what is going on in plain words", () => {
    expect(membershipLabel(null)).toEqual({ text: "Not paying yet", tone: "muted" });
    expect(membershipLabel(m({}))).toEqual({ text: "Renews 2 December", tone: "good" });
    expect(membershipLabel(m({ cancelAtPeriodEnd: true }))).toEqual({ text: "Ends 2 December", tone: "warn" });
    expect(membershipLabel(m({ status: "past_due" })).tone).toBe("crit");
    expect(membershipLabel(m({ status: "canceled" })).text).toBe("Ended");
  });
});
