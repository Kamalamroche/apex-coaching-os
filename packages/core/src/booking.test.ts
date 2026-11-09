import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKING_SETTINGS, byLocalDay, dayIn, freeSlots, fromBookingRow, fromSettingsRow, hoursProblem, minutesLabel, newBooking, sampleBookings, toBookingRow, toSettingsRow,
  upcomingBookings, zoneOffsetMin, zonedTime, type BookingSettings, callLink, callOpen, callService, videoLinkProblem,
} from "./booking";

// Monday 2 Nov 2026, 06:00 UTC (06:00 in London: winter time).
const NOW = new Date("2026-11-02T06:00:00Z");
const hours: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS, noticeHours: 2, windows: [{ weekday: 0, startMin: 9 * 60, endMin: 10 * 60 }, { weekday: 2, startMin: 18 * 60, endMin: 19 * 60 }] };

describe("time zones", () => {
  it("knows London's offset in winter and summer", () => {
    expect(zoneOffsetMin(new Date("2026-01-15T12:00:00Z"), "Europe/London")).toBe(0);
    expect(zoneOffsetMin(new Date("2026-07-15T12:00:00Z"), "Europe/London")).toBe(60);
  });

  it("turns a local time into the right moment", () => {
    expect(zonedTime("2026-07-15", 9 * 60, "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(zonedTime("2026-11-02", 9 * 60, "Europe/London").toISOString()).toBe("2026-11-02T09:00:00.000Z");
    expect(zonedTime("2026-11-02", 9 * 60, "America/New_York").toISOString()).toBe("2026-11-02T14:00:00.000Z");
    // The morning the clocks go forward (29 March 2026): 09:00 is already summer time.
    expect(zonedTime("2026-03-29", 9 * 60, "Europe/London").toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("finds the local date", () => {
    expect(dayIn(new Date("2026-11-02T23:30:00Z"), "Asia/Dubai")).toBe("2026-11-03");
  });
});

describe("free slots", () => {
  it("cuts the coach's hours into slots", () => {
    const days = freeSlots(hours, [], NOW, 7);
    expect(days.map((d) => d.day)).toEqual(["2026-11-02", "2026-11-04"]);
    expect(days[0]?.slots).toEqual(["2026-11-02T09:00:00.000Z", "2026-11-02T09:30:00.000Z"]);
  });

  it("leaves out taken slots and anything inside the notice period", () => {
    const busy = [{ startsAt: "2026-11-02T09:30:00.000Z", endsAt: "2026-11-02T10:00:00.000Z" }];
    expect(freeSlots(hours, busy, NOW, 1)[0]?.slots).toEqual(["2026-11-02T09:00:00.000Z"]);
    expect(freeSlots({ ...hours, noticeHours: 12 }, [], NOW, 1)).toEqual([]);
  });

  it("checks the hours make sense", () => {
    expect(hoursProblem(hours)).toBeNull();
    expect(hoursProblem({ ...hours, slotMin: 20 })).toMatch(/slot/);
    expect(hoursProblem({ ...hours, windows: [{ weekday: 0, startMin: 600, endMin: 610 }] })).toMatch(/room/);
    expect(minutesLabel(7 * 60 + 30)).toBe("07:30");
  });
});

describe("bookings", () => {
  it("lists what's still to come, soonest first", () => {
    const a = newBooking("c", "2026-11-03T09:00:00.000Z", 30, "call", " hi ", NOW);
    const b = { ...newBooking("c", "2026-11-02T09:00:00.000Z", 30, "session", "", NOW), id: "b" };
    const gone = { ...newBooking("c", "2026-11-01T09:00:00.000Z", 30, "call", "", NOW), id: "g" };
    const off = { ...a, id: "x", status: "cancelled" as const };
    expect(a.endsAt).toBe("2026-11-03T09:30:00.000Z");
    expect(a.note).toBe("hi");
    expect(upcomingBookings([a, b, gone, off], NOW).map((x) => x.id)).toEqual(["b", a.id]);
    expect(byLocalDay(upcomingBookings([a, b], NOW))).toHaveLength(2);
  });

  it("round-trips rows", () => {
    expect(fromSettingsRow(toSettingsRow(hours, "coach"))).toEqual({ ...hours, videoLink: "" });
    expect(fromSettingsRow(toSettingsRow({ ...hours, videoLink: " https://zoom.us/j/123 " }, "coach")).videoLink).toBe("https://zoom.us/j/123");
    const a = newBooking("c", "2026-11-03T09:00:00.000Z", 30, "call", "", NOW);
    expect(fromBookingRow({ ...toBookingRow(a, "coach"), starts_at: "2026-11-03 09:00:00+00", created_at: a.createdAt })).toEqual(a);
  });

  it("gives the demo a few bookings in free slots", () => {
    const { settings, bookings } = sampleBookings(NOW);
    expect(bookings).toHaveLength(3);
    expect(freeSlots(settings, bookings, NOW).flatMap((d) => d.slots)).not.toContain(bookings[0]?.startsAt);
  });
});

describe("video calls", () => {
  const b = { id: "3f2a9c1e-77d0-4b8e-9a51-0c6e2d4f8b17", kind: "call" as const, startsAt: "2026-11-10T09:00:00.000Z", endsAt: "2026-11-10T09:30:00.000Z" };
  it("gives every call its own private room unless the coach has one", () => {
    expect(callLink(b, null)).toBe("https://meet.jit.si/APEX-3f2a9c1e77d04b8e9a510c6e2d4f8b17");
    expect(callLink(b, { videoLink: "https://meet.google.com/abc-defg-hij" })).toBe("https://meet.google.com/abc-defg-hij");
    expect(callLink({ ...b, kind: "session" }, null)).toBeNull();
  });
  it("names the service", () => {
    expect(callService("https://us02web.zoom.us/j/123")).toBe("Zoom");
    expect(callService("https://meet.google.com/abc")).toBe("Google Meet");
    expect(callService("https://meet.jit.si/APEX-1")).toBe("Jitsi");
    expect(callService("https://example.com/room")).toBe("video call");
  });
  it("opens 10 minutes before", () => {
    expect(callOpen(b, new Date("2026-11-10T08:45:00Z"))).toBe(false);
    expect(callOpen(b, new Date("2026-11-10T08:51:00Z"))).toBe(true);
    expect(callOpen(b, new Date("2026-11-10T09:31:00Z"))).toBe(false);
  });
  it("checks the coach's link", () => {
    expect(videoLinkProblem("")).toBeNull();
    expect(videoLinkProblem("zoom.us/j/1")).toMatch(/https/);
    expect(videoLinkProblem("http://zoom.us/j/1")).toMatch(/https/);
    expect(videoLinkProblem("https://zoom.us/j/1")).toBeNull();
    expect(hoursProblem({ ...DEFAULT_BOOKING_SETTINGS, videoLink: "nope" })).toMatch(/https/);
  });
});
