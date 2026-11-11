import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKING_SETTINGS, type BookingSettings } from "./booking";
import {
  bookingLink, confirmText, durationLabel, guestBusy, guestProblem, guestQueue, menuFor, moveService, readBookLink, sampleServices, serviceLine, serviceProblem, serviceSlots,
  fromServiceRow, toServiceRow, type GuestBooking,
} from "./services";

const settings: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS, noticeHours: 0, timezone: "Europe/London", windows: [{ weekday: 0, startMin: 9 * 60, endMin: 11 * 60 }] };
// Monday 3 Nov 2025, 07:00 London.
const now = new Date("2025-11-03T07:00:00Z");

describe("services", () => {
  it("checks a service before saving", () => {
    expect(serviceProblem({ name: "PT", minutes: 60, pricePence: 4500, description: "" })).toBeNull();
    expect(serviceProblem({ name: "P", minutes: 60, pricePence: 0, description: "" })).toMatch(/name/);
    expect(serviceProblem({ name: "PT", minutes: 50, pricePence: 0, description: "" })).toMatch(/long/);
    expect(serviceProblem({ name: "PT", minutes: 60, pricePence: -1, description: "" })).toMatch(/price/);
    expect(serviceProblem({ name: "PT", minutes: 60, pricePence: 12.5, description: "" })).toMatch(/price/);
  });

  it("words the length and price", () => {
    expect(serviceLine({ minutes: 60, pricePence: 4500 })).toBe("1 hour · £45");
    expect(serviceLine({ minutes: 30, pricePence: 0 })).toBe("30 min · Free");
    expect(durationLabel(90)).toBe("1 h 30 min");
    expect(durationLabel(120)).toBe("2 hours");
  });

  it("shows clients every active service, the public only those open to everyone", () => {
    const list = sampleServices();
    list[1] = { ...list[1]!, active: false };
    expect(menuFor(list, "client").map((s) => s.name)).toEqual(["Free consultation", "Movement assessment", "Check-in call"]);
    expect(menuFor(list, "public").map((s) => s.name)).toEqual(["Free consultation", "Movement assessment"]);
  });

  it("offers start times that fit the whole service", () => {
    const hour = serviceSlots(settings, { minutes: 60 }, [], now, 1)[0]!.slots;
    expect(hour.map((s) => s.slice(11, 16))).toEqual(["09:00", "09:30", "10:00"]);
    const busy = [{ startsAt: "2025-11-03T09:30:00Z", endsAt: "2025-11-03T10:00:00Z" }];
    expect(serviceSlots(settings, { minutes: 60 }, busy, now, 1)[0]!.slots.map((s) => s.slice(11, 16))).toEqual(["10:00"]);
  });

  it("reorders the menu", () => {
    const list = sampleServices();
    const moved = moveService(list, list[2]!.id, -1);
    expect(moved.map((s) => s.name).slice(0, 3)).toEqual(["Free consultation", "Movement assessment", "Personal training session"]);
    expect(moved.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    expect(moveService(list, list[0]!.id, -1).map((s) => s.id)).toEqual(list.map((s) => s.id));
  });

  it("round-trips through a database row", () => {
    const s = sampleServices()[1]!;
    expect(fromServiceRow(toServiceRow(s, "coach"))).toEqual(s);
  });
});

describe("booking link", () => {
  it("opens the menu or one service", () => {
    expect(bookingLink("https://apex.app/", "kamal")).toBe("https://apex.app/c/kamal/?book=1");
    const id = sampleServices()[0]!.id;
    expect(readBookLink(new URL(bookingLink("https://apex.app", "kamal", id)).search)).toEqual({ open: true, serviceId: id });
    expect(readBookLink("?book=1")).toEqual({ open: true, serviceId: null });
    expect(readBookLink("?form=1")).toEqual({ open: false, serviceId: null });
  });
});

describe("guest bookings", () => {
  const g = (over: Partial<GuestBooking>): GuestBooking => ({
    id: "g", serviceId: null, serviceName: "Free consultation", pricePence: 0, kind: "call", startsAt: "2025-11-04T09:00:00Z", endsAt: "2025-11-04T09:30:00Z",
    name: "Aisha Khan", email: "aisha@example.com", phone: "", note: "", status: "requested", createdAt: "2025-11-03T07:00:00Z", ...over,
  });

  it("checks the guest's details", () => {
    expect(guestProblem({ name: "Aisha", email: "aisha@example.com", phone: "", note: "" })).toBeNull();
    expect(guestProblem({ name: "A", email: "aisha@example.com", phone: "", note: "" })).toMatch(/name/);
    expect(guestProblem({ name: "Aisha", email: "nope", phone: "", note: "" })).toMatch(/email/);
    expect(guestProblem({ name: "Aisha", email: "a@b.co", phone: "abc", note: "" })).toMatch(/phone/);
  });

  it("puts ones to confirm first and drops past or closed ones", () => {
    const q = guestQueue([
      g({ id: "1", status: "confirmed", startsAt: "2025-11-04T08:00:00Z" }),
      g({ id: "2", status: "requested", startsAt: "2025-11-05T09:00:00Z", endsAt: "2025-11-05T09:30:00Z" }),
      g({ id: "3", status: "declined" }),
      g({ id: "4", status: "requested", startsAt: "2025-11-01T09:00:00Z", endsAt: "2025-11-01T09:30:00Z" }),
    ], now);
    expect(q.map((x) => x.id)).toEqual(["2", "1"]);
  });

  it("holds the time while it waits and once confirmed", () => {
    expect(guestBusy([g({ status: "requested" }), g({ status: "declined" }), g({ status: "confirmed" })])).toHaveLength(2);
  });

  it("drafts the confirmation", () => {
    expect(confirmText(g({ pricePence: 4500, serviceName: "Personal training session" }), "Kamal")).toMatch(/^Hi Aisha, you're booked in for Personal training session on .+ It's £45, paid on the day\. See you then\. Kamal$/);
  });
});
