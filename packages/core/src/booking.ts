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
  /** The coach's own meeting room (Zoom, Google Meet, Teams…). Empty: each call gets its own free Jitsi room. */
  videoLink?: string;
  /** Free cancels until this many hours before a training session (sessions SQL). Default 24. */
  cancelHours?: number;
  /** Clients need a session left in a pack to book a training session. */
  requireCredits?: boolean;
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
  /* 1:1 session fields (20261119090000_sessions.sql); absent before it is run. */
  /** Set by the coach after a training session. */
  attendance?: "attended" | "no_show" | null;
  cancelledBy?: "client" | "coach" | null;
  /** The client cancelled inside the coach's cancellation window. */
  late?: boolean;
  /** The coach let a late cancel or no-show off: it doesn't use a session. */
  waived?: boolean;
  /** Bookings made together as a weekly slot share this. */
  repeatId?: string | null;
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
  const video = videoLinkProblem(s.videoLink ?? "");
  if (video) return video;
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
  /** Added by 20261116090000_video_calls.sql; absent before it is run. */
  video_link?: string | null;
  /** Added by 20261119090000_sessions.sql. */
  cancel_hours?: number | null;
  require_credits?: boolean | null;
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
  attendance?: "attended" | "no_show" | null;
  cancelled_by?: "client" | "coach" | null;
  late?: boolean | null;
  waived?: boolean | null;
  repeat_id?: string | null;
}

export const toSettingsRow = (s: BookingSettings, coachId: string): BookingSettingsRow => ({
  coach_id: coachId, slot_min: s.slotMin, notice_hours: s.noticeHours, timezone: s.timezone,
  windows: s.windows.map((w) => ({ weekday: w.weekday, start_min: w.startMin, end_min: w.endMin })),
  video_link: s.videoLink?.trim() || null,
  cancel_hours: s.cancelHours ?? 24, require_credits: !!s.requireCredits,
});

export const fromSettingsRow = (r: BookingSettingsRow): BookingSettings => ({
  slotMin: Number(r.slot_min), noticeHours: Number(r.notice_hours), timezone: r.timezone,
  windows: (r.windows ?? []).map((w) => ({ weekday: Number(w.weekday), startMin: Number(w.start_min), endMin: Number(w.end_min) })),
  videoLink: r.video_link ?? "",
  cancelHours: r.cancel_hours ?? 24, requireCredits: !!r.require_credits,
});

/* ---------- Video calls ---------- */

/** Free video rooms, no account needed to join. Room names come from the booking's random id, so they can't be guessed. */
export const JITSI_BASE = "https://meet.jit.si/";

/** The link for a booked call: the coach's own room if they set one, otherwise a private Jitsi room for this booking. In-person sessions have none. */
export function callLink(b: Pick<Booking, "id" | "kind">, s: Pick<BookingSettings, "videoLink"> | null): string | null {
  if (b.kind !== "call") return null;
  const own = s?.videoLink?.trim();
  if (own) return own;
  const room = b.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  return `${JITSI_BASE}APEX-${room}`;
}

/** Where the link goes, for the button: "Zoom", "Google Meet", "Teams" or "Jitsi". */
export function callService(link: string): string {
  const host = (() => { try { return new URL(link).hostname; } catch { return ""; } })();
  if (/zoom\.us$/.test(host)) return "Zoom";
  if (host === "meet.google.com") return "Google Meet";
  if (/teams\.(microsoft|live)\.com$/.test(host)) return "Teams";
  if (/jit\.si$|jitsi/.test(host)) return "Jitsi";
  if (/whereby\.com$/.test(host)) return "Whereby";
  return "video call";
}

/** The call can be joined from 10 minutes before it starts until it ends. */
export const callOpen = (b: Pick<Booking, "startsAt" | "endsAt">, now: Date) =>
  now.getTime() >= new Date(b.startsAt).getTime() - 10 * 60000 && now.getTime() <= new Date(b.endsAt).getTime();

/** What the coach typed as their meeting link, or why it can't be saved. */
export function videoLinkProblem(link: string): string | null {
  const v = link.trim();
  if (!v) return null;
  if (v.length > 300) return "That link is too long.";
  let u: URL;
  try { u = new URL(v); } catch { return "Paste the full link, starting with https://"; }
  if (u.protocol !== "https:") return "The link should start with https://";
  return null;
}

export const toBookingRow = (b: Booking, coachId: string): Omit<BookingRow, "created_at"> => ({
  id: b.id, coach_id: coachId, client_id: b.clientId, starts_at: b.startsAt, ends_at: b.endsAt, kind: b.kind, note: b.note || null, status: b.status,
  ...(b.repeatId ? { repeat_id: b.repeatId } : {}),
});

export const fromBookingRow = (r: BookingRow): Booking => ({
  id: r.id, clientId: r.client_id, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), kind: r.kind, note: r.note ?? "", status: r.status, createdAt: r.created_at,
  attendance: r.attendance ?? null, cancelledBy: r.cancelled_by ?? null, late: !!r.late, waived: !!r.waived, repeatId: r.repeat_id ?? null,
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

/* ---------- Add to calendar ---------- */

export interface CalendarEvent { uid: string; startsAt: string; endsAt: string; title: string; details: string; location: string }

/** The booking as a calendar entry: "Call with Kamal", with the video link as its place. */
export function bookingEvent(b: Booking, s: Pick<BookingSettings, "videoLink"> | null, withName: string): CalendarEvent {
  const link = callLink(b, s);
  const what = b.kind === "call" ? "Call" : "Training session";
  return {
    uid: `${b.id}@apex-coaching`,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    title: `${what} with ${withName}`.trim(),
    details: [b.note, link ? `Join the call: ${link}` : "", "Booked in APEX."].filter(Boolean).join("\n"),
    location: link ?? "",
  };
}

const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Commas, semicolons, backslashes and new lines must be escaped in calendar text. */
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Lines over 75 bytes are folded onto the next line with a leading space. */
const fold = (line: string) => line.match(/.{1,73}/g)?.join("\r\n ") ?? line;

/** An .ics file that Apple Calendar, Outlook and Google Calendar all open. Reminds 30 minutes before. */
export function toIcs(e: CalendarEvent, now = new Date()): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//APEX Coaching//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`, `DTSTAMP:${icsTime(now.toISOString())}`, `DTSTART:${icsTime(e.startsAt)}`, `DTEND:${icsTime(e.endsAt)}`,
    `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(e.details)}`, ...(e.location ? [`LOCATION:${icsText(e.location)}`, `URL:${e.location}`] : []),
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(fold).join("\r\n");
}

/** Opens Google Calendar's "new event" page filled in. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${icsTime(e.startsAt)}/${icsTime(e.endsAt)}`, details: e.details });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
