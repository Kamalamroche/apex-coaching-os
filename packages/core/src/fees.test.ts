import { describe, expect, it } from "vitest";
import { feeMonth, feeReminder, fromFeeRow, monthKey, newFeePayment, toFeeRow, type FeeClient } from "./fees";
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
