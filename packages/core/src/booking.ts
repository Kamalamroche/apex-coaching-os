/* Booking calendar: the coach sets weekly hours, the client books a call or a training session in a free slot.
   Hours are kept in the coach's time zone, so a slot is the same moment for everyone; each person sees it in
   their own local time. Live: coach_booking_settings and bookings
   (supabase/migrations/20261103180000_bookings.sql). Pure, so it is unit tested. */

import { addDays } from "./lifestyle";

export type BookingKind = "call" | "session";

export const BOOKING_KINDS: { kind: BookingKind; title: string; hint: string }[] = [
  { kind: "call", title: "Call", hint: "Video or phone call" },
  { kind: "session", title: "Training session", hint: "In person" },
];

/** One block of bookable time on a weekday (0 = Monday), in minutes after midnight in the coach's time zone. */
export interface HoursWindow {
  weekday: number;
  startMin: number;
  endMin: number;
}

export interface BookingSettings {
  /** Length of each slot. */
  slotMin: number;
  /** How far ahead a client must book. */
  noticeHours: number;
  /** IANA time zone the hours are in. */
  timezone: string;
  windows: HoursWindow[];
}

export interface Booking {
  id: string;
  clientId: string;
  startsAt: string;
  endsAt: string;
  kind: BookingKind;
  note: string;
  status: "booked" | "cancelled";
  createdAt: string;
}

/** A taken slot. Clients see only these for other people's bookings, never who booked. */
export interface Busy {
  startsAt: string;
  endsAt: string;
}

export const SLOT_CHOICES = [15, 30, 45, 60];
export const NOTICE_CHOICES = [2, 12, 24, 48];
/** How many days ahead clients can book. */
export const BOOK_AHEAD_DAYS = 14;

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = { slotMin: 30, noticeHours: 12, timezone: "Europe/London", windows: [] };

/* ---------- Time zones ---------- */

function parts(at: Date, tz: string): Record<string, number> {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return Object.fromEntries(f.formatToParts(at).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** Minutes the zone is ahead of UTC at that moment (60 for London in summer). */
export function zoneOffsetMin(at: Date, tz: string): number {
  const p = parts(at, tz);
  return Math.round((Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The moment it is `minutes` after midnight on `day` (YYYY-MM-DD) in the zone. */
export function zonedTime(day: string, minutes: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const first = naive - zoneOffsetMin(new Date(naive), tz) * 60000;
  // Across a clock change the offset at the answer can differ from the guess; one correction settles it.
  return new Date(naive - zoneOffsetMin(new Date(first), tz) * 60000);
}

/** The date (YYYY-MM-DD) it is in the zone at that moment. */
export function dayIn(at: Date, tz: string): string {
  const p = parts(at, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const weekdayOf = (day: string): number => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

export function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/London";
  }
}

/* ---------- Slots ---------- */

const overlaps = (aStart: number, aEnd: number, b: Busy) => aStart < Date.parse(b.endsAt) && Date.parse(b.startsAt) < aEnd;

export interface DaySlots {
  /** YYYY-MM-DD in the coach's zone. */
  day: string;
  /** ISO start times. */
  slots: string[];
}

/** Free slots over the next `days` days: inside the coach's hours, after the notice period, not already taken. */
export function freeSlots(s: BookingSettings, busy: Busy[], now: Date, days = BOOK_AHEAD_DAYS): DaySlots[] {
  const tz = safeZone(s.timezone);
  const earliest = now.getTime() + s.noticeHours * 3600000;
  const today = dayIn(now, tz);
  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const wd = weekdayOf(day);
    const slots: string[] = [];
    for (const w of [...s.windows].filter((x) => x.weekday === wd).sort((a, b) => a.startMin - b.startMin)) {
      for (let m = w.startMin; m + s.slotMin <= w.endMin; m += s.slotMin) {
        const start = zonedTime(day, m, tz).getTime();
        const end = start + s.slotMin * 60000;
        if (start < earliest || busy.some((b) => overlaps(start, end, b))) continue;
        const iso = new Date(start).toISOString();
        if (!slots.includes(iso)) slots.push(iso);
      }
    }
    if (slots.length) out.push({ day, slots });
  }
  return out;
}

/** Booked (not cancelled) and not yet over, soonest first. */
export const upcomingBookings = (bookings: Booking[], now: Date): Booking[] =>
  bookings.filter((b) => b.status === "booked" && Date.parse(b.endsAt) > now.getTime()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

export const busyFrom = (bookings: Booking[]): Busy[] => bookings.filter((b) => b.status === "booked").map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));

/** Bookings grouped by the viewer's local day, in order. */
export function byLocalDay(bookings: Booking[]): { day: string; items: Booking[] }[] {
  const groups: { day: string; items: Booking[] }[] = [];
  for (const b of bookings) {
    const d = new Date(b.startsAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const g = groups.at(-1);
    if (g?.day === day) g.items.push(b);
    else groups.push({ day, items: [b] });
  }
  return groups;
}

/* ---------- Words ---------- */

export const timeLabel = (iso: string): string => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const dayLabel = (day: string): string => new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const whenLabel = (iso: string): string => `${new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${timeLabel(iso)}`;
export const minutesLabel = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const kindTitle = (k: BookingKind): string => BOOKING_KINDS.find((x) => x.kind === k)?.title ?? "Booking";

/** What stops the hours from saving, or null. */
export function hoursProblem(s: BookingSettings): string | null {
  if (!SLOT_CHOICES.includes(s.slotMin)) return "Pick a slot length.";
  if (s.noticeHours < 0 || s.noticeHours > 168) return "Pick a notice period.";
  for (const w of s.windows) {
    if (w.weekday < 0 || w.weekday > 6) return "Pick a proper day.";
    if (w.startMin < 0 || w.endMin > 24 * 60 || w.endMin - w.startMin < s.slotMin) return "Each block of hours needs room for at least one slot.";
  }
  return null;
}

/** A new booking for this slot. */
export function newBooking(clientId: string, startsAt: string, slotMin: number, kind: BookingKind, note: string, now = new Date()): Booking {
  return {
    id: crypto.randomUUID(), clientId, startsAt, endsAt: new Date(Date.parse(startsAt) + slotMin * 60000).toISOString(), kind, note: note.trim().slice(0, 500), status: "booked", createdAt: now.toISOString(),
  };
}

/* ---------- Database rows ---------- */

export interface BookingSettingsRow {
  coach_id: string;
  slot_min: number;
  notice_hours: number;
  timezone: string;
  windows: { weekday: number; start_min: number; end_min: number }[];
}

export interface BookingRow {
  id: string;
  coach_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  kind: BookingKind;
  note: string | null;
  status: "booked" | "cancelled";
  created_at: string;
}

export const toSettingsRow = (s: BookingSettings, coachId: string): BookingSettingsRow => ({
  coach_id: coachId, slot_min: s.slotMin, notice_hours: s.noticeHours, timezone: s.timezone,
  windows: s.windows.map((w) => ({ weekday: w.weekday, start_min: w.startMin, end_min: w.endMin })),
});

export const fromSettingsRow = (r: BookingSettingsRow): BookingSettings => ({
  slotMin: Number(r.slot_min), noticeHours: Number(r.notice_hours), timezone: r.timezone,
  windows: (r.windows ?? []).map((w) => ({ weekday: Number(w.weekday), startMin: Number(w.start_min), endMin: Number(w.end_min) })),
});

export const toBookingRow = (b: Booking, coachId: string): Omit<BookingRow, "created_at"> => ({
  id: b.id, coach_id: coachId, client_id: b.clientId, starts_at: b.startsAt, ends_at: b.endsAt, kind: b.kind, note: b.note || null, status: b.status,
});

export const fromBookingRow = (r: BookingRow): Booking => ({
  id: r.id, clientId: r.client_id, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), kind: r.kind, note: r.note ?? "", status: r.status, createdAt: r.created_at,
});

/* ---------- Demo ---------- */

export const DEMO_BOOKING_CLIENT = "demo-priya";

const DEMO_HOURS: HoursWindow[] = [0, 1, 2, 3, 4].flatMap((weekday) => [
  { weekday, startMin: 7 * 60, endMin: 9 * 60 },
  { weekday, startMin: 12 * 60, endMin: 14 * 60 },
  ...(weekday === 1 || weekday === 3 ? [{ weekday, startMin: 18 * 60, endMin: 20 * 60 }] : []),
]);

/** Sample hours and a few bookings around `now`, so the demo calendar has something in it. */
export function sampleBookings(now = new Date()): { settings: BookingSettings; bookings: Booking[] } {
  const settings: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS, windows: DEMO_HOURS };
  const free = freeSlots(settings, [], now, 10).flatMap((d) => d.slots);
  const pick = (i: number) => free[Math.min(i, free.length - 1)]!;
  const make = (id: string, clientId: string, at: string, kind: BookingKind, note: string): Booking => ({ ...newBooking(clientId, at, 30, kind, note, now), id });
  const bookings = free.length ? [
    make("demo-booking-1", DEMO_BOOKING_CLIENT, pick(2), "call", "Talk through the next block"),
    make("demo-booking-2", "demo-james", pick(5), "session", ""),
    make("demo-booking-3", "demo-sarah", pick(14), "call", "Getting back on track"),
  ] : [];
  return { settings, bookings };
}

export const DEMO_BOOKING_NAMES: Record<string, string> = { [DEMO_BOOKING_CLIENT]: "Priya Sharma", "demo-james": "James Kowalski", "demo-sarah": "Sarah Mitchell" };
