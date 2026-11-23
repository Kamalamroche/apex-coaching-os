import { describe, expect, it } from "vitest";
import { addMonthKey, coverPayments, feeMonth, feeReminder, fromFeeRow, monthKey, newFeePayment, paidUntil, paidUntilText, toFeeRow, type FeeClient } from "./fees";
import { credits, newPack, packsToPay, packUnpaid, sessionMonth, fromPackRow, toPackRow } from "./sessions";
import { businessSummary } from "./business";

const clients: FeeClient[] = [
  { id: "a", name: "Ann", feePence: 15000, status: "active" },
  { id: "b", name: "Ben", feePence: 22000, status: "active" },
  { id: "c", name: "Cat", feePence: 12000, status: "paused" },
  { id: "d", name: "Dev", feePence: 0, status: "active" },
];

describe("monthly fees paid outside the app", () => {
  it("splits this month into paid and still to collect, skipping paused and fee-less clients", () => {
    const m = feeMonth(clients, [newFeePayment("a", "2026-11", 15000, "bank"), newFeePayment("b", "2026-10", 22000, "cash")], "2026-11");
    expect(m.due.map((c) => c.id)).toEqual(["a", "b"]);
    expect(m.paid.map((x) => x.client.id)).toEqual(["a"]);
    expect(m.toCollect.map((c) => c.id)).toEqual(["b"]);
    expect(m.paidPence).toBe(15000);
    expect(m.toCollectPence).toBe(22000);
  });
  it("keys months in local time and round-trips rows", () => {
    expect(monthKey(new Date(2026, 10, 30, 23, 0))).toBe("2026-11");
    const p = newFeePayment("a", "2026-11", 15000, "bank", new Date("2026-11-03T10:00:00Z"), " thanks ");
    const row = toFeeRow(p, "coach");
    expect(row.month).toBe("2026-11-01");
    expect(fromFeeRow(row)).toEqual(p);
  });
  it("writes a reminder with the month and amount", () => {
    expect(feeReminder("Ben", "Kamal", "2026-11", "£220")).toMatch(/November coaching fee of £220/);
  });
});

describe("packs to pay later", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("is paid by default; to-pay packs still give sessions but aren't income yet", () => {
    const paid = newPack("a", 5, 20000, "cash", 0, "", "purchase", now);
    const later = newPack("a", 10, 40000, "bank", 0, "", "purchase", now, false);
    expect(packUnpaid(paid)).toBe(false);
    expect(packUnpaid(later)).toBe(true);
    expect(packsToPay([paid, later]).totalPence).toBe(40000);
    expect(credits([paid, later], [], now).left).toBe(15);
    expect(sessionMonth([paid, later], [], "2026-11").incomePence).toBe(20000);
  });
  it("a free pack is never owed", () => {
    expect(packUnpaid(newPack("a", 1, 0, "free", 0, "", "intro", now, false))).toBe(false);
  });
  it("counts in Business income in the month it's paid", () => {
    const base = { clients: [], leads: [], bookings: [], sales: [], now };
    const sum = businessSummary({ ...base, packs: [{ boughtAt: "2026-10-20T10:00:00Z", pricePence: 40000, paidAt: "2026-11-02T10:00:00Z" }, { boughtAt: "2026-11-05T10:00:00Z", pricePence: 9900, paidAt: null }] });
    expect(sum.thisMonth.packsPence).toBe(40000);
  });
  it("only sends paid_at when the pack is still to pay, and old rows read as paid", () => {
    const later = newPack("a", 10, 40000, "bank", 0, "", "purchase", now, false);
    expect(toPackRow(later, "c")).toHaveProperty("paid_at", null);
    expect(toPackRow(newPack("a", 5, 100, "cash", 0, "", "purchase", now), "c")).not.toHaveProperty("paid_at");
    const old = fromPackRow({ ...toPackRow(newPack("a", 5, 100, "cash", 0, "", "purchase", now), "c") });
    expect(old.paidAt).toBe(now.toISOString());
  });
});

describe("memberships paid up front", () => {
  it("adds months across a year end", () => {
    expect(addMonthKey("2026-11", 3)).toBe("2027-02");
    expect(addMonthKey("2026-01", 11)).toBe("2026-12");
  });
  it("splits a 3-month payment into one row a month, odd pennies on the first", () => {
    const rows = coverPayments("a", "2026-11", 3, 40000, "bank");
    expect(rows.map((r) => r.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(rows.map((r) => r.amountPence)).toEqual([13334, 13333, 13333]);
    expect(rows[0]!.note).toBe("3-month membership");
  });
  it("skips months already paid", () => {
    expect(coverPayments("a", "2026-11", 2, 30000, "cash", ["2026-11"]).map((r) => [r.month, r.amountPence])).toEqual([["2026-12", 30000]]);
    expect(coverPayments("a", "2026-11", 1, 100, "cash", ["2026-11"])).toEqual([]);
  });
  it("knows how far ahead a client has paid", () => {
    const rows = coverPayments("a", "2026-11", 12, 120000, "bank");
    const until = paidUntil(rows, "a", "2026-11");
    expect(until).toBe("2027-10");
    expect(paidUntilText(until!, "2026-11")).toBe("Paid until the end of October 2027");
    expect(paidUntil(rows, "b", "2026-11")).toBeNull();
    expect(paidUntilText("2026-11", "2026-11")).toBe("Paid for November");
    const m = feeMonth([{ id: "a", name: "Ann", feePence: 10000, status: "active" }], rows, "2027-03");
    expect(m.toCollect).toEqual([]);
  });
});
