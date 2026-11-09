import { describe, expect, it } from "vitest";
import type { Booking } from "./booking";
import { canMove, addMonths, expiryText, cancelWarning, chargeable, credits, creditsText, fromPackRow, isLateCancel, newPack, outcomeLabel, packProblem, policyText, sessionMonth, toMark, toPackRow, usesCredit, weeklyStarts, DEFAULT_POLICY } from "./sessions";

const now = new Date("2026-11-10T12:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
let n = 0;
const bk = (h: number, extra: Partial<Booking> = {}): Booking => ({ id: `b${++n}`, clientId: "c", startsAt: at(h), endsAt: at(h + 1), kind: "session", note: "", status: "booked", createdAt: at(-500), ...extra });

describe("cancellation policy", () => {
  it("is late inside the window and free outside it", () => {
    expect(isLateCancel(at(10), now, DEFAULT_POLICY)).toBe(true);
    expect(isLateCancel(at(30), now, DEFAULT_POLICY)).toBe(false);
    expect(isLateCancel(at(1), now, { ...DEFAULT_POLICY, cancelHours: 0 })).toBe(false);
  });
  it("lets clients move a booking until the window closes", () => {
    expect(canMove(bk(30), now, DEFAULT_POLICY)).toBe(true);
    expect(canMove(bk(10), now, DEFAULT_POLICY)).toBe(false);
    expect(canMove(bk(10, { kind: "call" }), now, DEFAULT_POLICY)).toBe(true);
    expect(canMove(bk(2), now, { cancelHours: 3, requireCredits: false })).toBe(false);
    expect(canMove(bk(-2), now, { cancelHours: 0, requireCredits: false })).toBe(false);
  });
  it("warns only for late session cancels", () => {
    expect(cancelWarning({ kind: "session", startsAt: at(5) }, now, DEFAULT_POLICY)).toMatch(/less than 24 hours/);
    expect(cancelWarning({ kind: "call", startsAt: at(5) }, now, DEFAULT_POLICY)).toBeNull();
    expect(policyText({ cancelHours: 48, requireCredits: false })).toBe("Move or cancel for free up to 2 days before. Later cancels and no-shows use a session.");
    expect(policyText({ cancelHours: 0, requireCredits: false })).toBe("You can move or cancel any time for free.");
  });
});

describe("session credits", () => {
  it("counts sessions, late cancels and unwaived no-shows, never calls or coach cancels", () => {
    expect(usesCredit(bk(5))).toBe(true);
    expect(usesCredit(bk(5, { kind: "call" }))).toBe(false);
    expect(usesCredit(bk(5, { status: "cancelled", late: true }))).toBe(true);
    expect(usesCredit(bk(5, { status: "cancelled", late: true, waived: true }))).toBe(false);
    expect(usesCredit(bk(5, { status: "cancelled", cancelledBy: "coach" }))).toBe(false);
    expect(usesCredit(bk(-5, { attendance: "no_show" }))).toBe(true);
    expect(usesCredit(bk(-5, { attendance: "no_show", waived: true }))).toBe(false);
  });

  it("pays from the pack that expires first and shows what's left", () => {
    const longPack = { ...newPack("c", 10, 40000, "bank", 0, "", "purchase", new Date(at(-800))), id: "long" };
    const shortPack = { ...newPack("c", 2, 0, "free", 1, "", "referral", new Date(at(-100))), id: "short" };
    const bookings = [bk(-50), bk(-30), bk(-10), bk(20)];
    const c = credits([longPack, shortPack], bookings, now);
    expect(c.paidBy[bookings[0]!.id]).toBe("short");
    expect(c.paidBy[bookings[1]!.id]).toBe("short");
    expect(c.paidBy[bookings[2]!.id]).toBe("long");
    expect(c).toMatchObject({ left: 8, used: 4, owed: 0, lapsed: 0 });
    expect(creditsText(c)).toBe("8 sessions left");
  });

  it("lets unused sessions lapse and counts what's owed", () => {
    const old = { ...newPack("c", 3, 12000, "cash", 1, "", "purchase", new Date("2026-08-01T10:00:00Z")), id: "old" };
    expect(credits([old], [], now)).toMatchObject({ left: 0, lapsed: 3 });
    const c = credits([], [bk(-5), bk(5)], now);
    expect(c).toMatchObject({ left: 0, owed: 2 });
    expect(creditsText(c)).toBe("2 sessions owed");
  });

  it("names the next expiry", () => {
    const p = newPack("c", 5, 20000, "card", 3, "", "purchase", now);
    expect(creditsText(credits([p], [], now))).toBe(`5 sessions left · they expire ${new Date(addMonths(now.toISOString(), 3)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
  });

  it("says when sessions expire", () => {
    const p = newPack("c", 5, 20000, "card", 1, "", "purchase", new Date("2026-11-10T12:00:00Z"));
    expect(expiryText(credits([p], [bk(-2)], now))).toBe("They expire 10 Dec.");
    expect(expiryText(credits([p, newPack("c", 5, 0, "free", 0)], [], now))).toBe("5 expire 10 Dec.");
    expect(expiryText(credits([], [], now))).toBe("");
  });

  it("keeps month ends sensible and round-trips rows", () => {
    expect(addMonths("2026-01-31T10:00:00.000Z", 1)).toBe("2026-02-28T10:00:00.000Z");
    const p = newPack("c", 10, 40000, "bank", 3, " Paid Monday ", "purchase", now);
    expect(p.note).toBe("Paid Monday");
    expect(fromPackRow(toPackRow(p, "coach"))).toEqual(p);
    expect(newPack("c", 1, 0, "cash", 0).paidVia).toBe("free");
    expect(packProblem(0, 100)).toMatch(/at least 1/);
    expect(packProblem(5, null)).toMatch(/price/);
    expect(packProblem(5, 0)).toBeNull();
  });
});

describe("register", () => {
  it("lists past unmarked sessions and what can be waived", () => {
    const past = bk(-3), future = bk(3), marked = bk(-30, { attendance: "attended" }), late = bk(-20, { status: "cancelled", late: true });
    expect(toMark([future, past, marked, late], now).map((b) => b.id)).toEqual([past.id]);
    expect(chargeable([past, late, marked]).map((b) => b.id)).toEqual([late.id]);
    expect(outcomeLabel(late)).toBe("Late cancel");
    expect(outcomeLabel({ ...late, waived: true })).toBe("Late cancel · waived");
    expect(outcomeLabel(bk(1, { status: "cancelled", cancelledBy: "coach" }))).toBe("Cancelled by you");
  });

  it("sums the month", () => {
    const p = newPack("c", 10, 40000, "bank", 0, "", "purchase", now);
    const gift = newPack("c", 1, 0, "free", 0, "", "referral", now);
    const m = sessionMonth([p, gift], [bk(-3, { attendance: "attended" }), bk(-5, { attendance: "attended" }), bk(-7, { attendance: "no_show" }), bk(-9, { status: "cancelled", late: true }), bk(-11, { status: "cancelled" })], "2026-11");
    expect(m).toEqual({ incomePence: 40000, packs: 1, attended: 2, lateOrNoShow: 2, showRate: 50 });
  });
});

describe("weekly slot", () => {
  it("books the same time each week and skips taken weeks", () => {
    const r = weeklyStarts(at(24), 4, [{ startsAt: at(24 + 14 * 24) }]);
    expect(r.starts).toEqual([at(24), at(24 + 7 * 24), at(24 + 21 * 24)]);
    expect(r.skipped).toEqual([at(24 + 14 * 24)]);
  });
});
