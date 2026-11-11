/* Service menu and booking link: the coach lists what they offer (a free consultation, a 60-min PT session,
   a check-in call) with a length and a price. Clients pick a service when they book; services open to everyone
   also show on the coach's public page, where a new person books a time without an account.
   Payment is taken in person or by bank transfer for now (Stripe comes last). Live: coach_services and
   guest_bookings (supabase/migrations/20261124090000_services.sql). Pure, so it is unit tested. */

import { freeSlots, type BookingKind, type BookingSettings, type Busy, type DaySlots } from "./booking";
import { PHONE_PATTERN } from "./growth";
import { formatPrice } from "./onDemand";

export type ServiceAudience = "clients" | "everyone";

export interface Service {
  id: string;
  name: string;
  /** How long it lasts. */
  minutes: number;
  /** 0 = free. */
  pricePence: number;
  /** A call gets a video link; a session is in person. */
  kind: BookingKind;
  description: string;
  /** "everyone" also shows it on the public page, so new people can book it. */
  audience: ServiceAudience;
  active: boolean;
  position: number;
}

export const SERVICE_MINUTES = [15, 20, 30, 45, 60, 75, 90, 120];
export const SERVICE_NAME_MAX = 60;
export const SERVICE_DESCRIPTION_MAX = 300;
/** £10,000: anything above is a typo. */
export const SERVICE_PRICE_MAX = 1_000_000;

export function newService(position = 0): Service {
  return { id: crypto.randomUUID(), name: "", minutes: 60, pricePence: 0, kind: "session", description: "", audience: "everyone", active: true, position };
}

/** Why the service can't be saved, or null. */
export function serviceProblem(s: Pick<Service, "name" | "minutes" | "pricePence" | "description">): string | null {
  const n = s.name.trim();
  if (n.length < 2) return "Give the service a name.";
  if (n.length > SERVICE_NAME_MAX) return `Keep the name to ${SERVICE_NAME_MAX} characters.`;
  if (!SERVICE_MINUTES.includes(s.minutes)) return "Pick how long it lasts.";
  if (!Number.isInteger(s.pricePence) || s.pricePence < 0 || s.pricePence > SERVICE_PRICE_MAX) return "Check the price.";
  if (s.description.trim().length > SERVICE_DESCRIPTION_MAX) return `Keep the description to ${SERVICE_DESCRIPTION_MAX} characters.`;
  return null;
}

/** "60 min · £45" or "30 min · Free". */
export const serviceLine = (s: Pick<Service, "minutes" | "pricePence">): string => `${durationLabel(s.minutes)} · ${formatPrice(s.pricePence)}`;
export const durationLabel = (m: number): string => (m >= 60 && m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/** Active services in the coach's order, for clients (all) or the public page (everyone only). */
export function menuFor(services: Service[], who: "client" | "public"): Service[] {
  return services.filter((s) => s.active && (who === "client" || s.audience === "everyone")).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** Free start times for a service: on the coach's usual steps, long enough for the whole service. */
export const serviceSlots = (settings: BookingSettings, service: Pick<Service, "minutes">, busy: Busy[], now: Date, days?: number): DaySlots[] =>
  freeSlots(settings, busy, now, days, service.minutes);

/** Moves a service up or down the menu. Returns the list renumbered. */
export function moveService(services: Service[], id: string, by: -1 | 1): Service[] {
  const list = [...services].sort((a, b) => a.position - b.position);
  const i = list.findIndex((s) => s.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return list.map((s, k) => ({ ...s, position: k }));
  [list[i], list[j]] = [list[j]!, list[i]!];
  return list.map((s, k) => ({ ...s, position: k }));
}

/* ---------- Booking link ---------- */

/** The link that opens the coach's page on the booking step: "https://…/c/kamal/?book=1". */
export function bookingLink(origin: string, slug: string, serviceId?: string): string {
  const q = new URLSearchParams({ book: serviceId ?? "1" });
  return `${origin.replace(/\/$/, "")}/c/${slug}/?${q.toString()}`;
}

/** What ?book= asks for: nothing, the menu ("1"), or one service by id. */
export function readBookLink(search: string): { open: boolean; serviceId: string | null } {
  const v = new URLSearchParams(search).get("book");
  if (!v) return { open: false, serviceId: null };
  return { open: true, serviceId: /^[0-9a-f-]{36}$/i.test(v) ? v : null };
}

/* ---------- Guest bookings: someone who isn't a client yet ---------- */

export type GuestStatus = "requested" | "confirmed" | "declined" | "cancelled";

export interface GuestBooking {
  id: string;
  serviceId: string | null;
  /** Kept as booked, so renaming or removing the service later doesn't change the booking. */
  serviceName: string;
  pricePence: number;
  kind: BookingKind;
  startsAt: string;
  endsAt: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  status: GuestStatus;
  createdAt: string;
}

export interface GuestDraft { name: string; email: string; phone: string; note: string }
export const GUEST_NOTE_MAX = 400;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why the booking can't be sent, or null. */
export function guestProblem(d: GuestDraft): string | null {
  if (d.name.trim().length < 2) return "Add your name.";
  if (d.name.trim().length > 60) return "Keep your name to 60 characters.";
  if (!EMAIL.test(d.email.trim())) return "Add an email so your coach can confirm.";
  if (d.phone.trim() && !PHONE_PATTERN.test(d.phone.trim())) return "Check the phone number.";
  if (d.note.trim().length > GUEST_NOTE_MAX) return `Keep your note to ${GUEST_NOTE_MAX} characters.`;
  return null;
}

/** Waiting on the coach first, then the soonest. Past and closed ones drop off. */
export function guestQueue(list: GuestBooking[], now: Date): GuestBooking[] {
  return list
    .filter((g) => (g.status === "requested" || g.status === "confirmed") && Date.parse(g.endsAt) > now.getTime())
    .sort((a, b) => (a.status === b.status ? a.startsAt.localeCompare(b.startsAt) : a.status === "requested" ? -1 : 1));
}

/** Times a guest booking holds, so nobody else books over it. */
export const guestBusy = (list: GuestBooking[]): Busy[] =>
  list.filter((g) => g.status === "requested" || g.status === "confirmed").map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = { requested: "To confirm", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" };

/** The email or message the coach sends to confirm, ready to copy. */
export function confirmText(g: Pick<GuestBooking, "name" | "serviceName" | "startsAt" | "pricePence">, coach: string): string {
  const first = g.name.trim().split(/\s+/)[0] || g.name;
  const when = new Date(g.startsAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const pay = g.pricePence ? ` It's ${formatPrice(g.pricePence)}, paid on the day.` : "";
  return `Hi ${first}, you're booked in for ${g.serviceName} on ${when}.${pay} See you then. ${coach}`;
}

/* ---------- Database rows ---------- */

export interface ServiceRow {
  id: string;
  coach_id: string;
  name: string;
  minutes: number;
  price_pence: number;
  kind: BookingKind;
  description: string;
  audience: ServiceAudience;
  active: boolean;
  position: number;
}

export const toServiceRow = (s: Service, coachId: string): ServiceRow => ({
  id: s.id, coach_id: coachId, name: s.name.trim(), minutes: s.minutes, price_pence: s.pricePence, kind: s.kind,
  description: s.description.trim(), audience: s.audience, active: s.active, position: s.position,
});

export const fromServiceRow = (r: Omit<ServiceRow, "coach_id"> & { coach_id?: string }): Service => ({
  id: r.id, name: r.name, minutes: Number(r.minutes), pricePence: Number(r.price_pence), kind: r.kind, description: r.description ?? "",
  audience: r.audience, active: r.active !== false, position: Number(r.position ?? 0),
});

export interface GuestBookingRow {
  id: string;
  service_id: string | null;
  service_name: string;
  price_pence: number;
  kind: BookingKind;
  starts_at: string;
  ends_at: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  status: GuestStatus;
  created_at: string;
}

export const fromGuestRow = (r: GuestBookingRow): GuestBooking => ({
  id: r.id, serviceId: r.service_id, serviceName: r.service_name, pricePence: Number(r.price_pence), kind: r.kind,
  startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(),
  name: r.name, email: r.email, phone: r.phone ?? "", note: r.note ?? "", status: r.status, createdAt: r.created_at,
});

/* ---------- Demo ---------- */

/** A starting menu for a new coach and the demo. */
export function sampleServices(): Service[] {
  const s = (id: string, name: string, minutes: number, pricePence: number, kind: BookingKind, description: string, audience: ServiceAudience, position: number): Service =>
    ({ id, name, minutes, pricePence, kind, description, audience, active: true, position });
  return [
    s("00000000-0000-4000-8000-0000000000a1", "Free consultation", 30, 0, "call", "A video call about your goals, training history and what would work for you. No obligation.", "everyone", 0),
    s("00000000-0000-4000-8000-0000000000a2", "Personal training session", 60, 4500, "session", "One-to-one in the gym: technique, a full session, and a plan for the week.", "everyone", 1),
    s("00000000-0000-4000-8000-0000000000a3", "Movement assessment", 75, 6000, "session", "Mobility, strength tests and posture, with a written summary and first programme.", "everyone", 2),
    s("00000000-0000-4000-8000-0000000000a4", "Check-in call", 20, 0, "call", "A quick catch-up on progress, for current clients.", "clients", 3),
  ];
}

/** What a menu card shows. */
export const serviceCard = (s: Service) => ({ id: s.id, name: s.name, line: serviceLine(s), description: s.description, kind: s.kind, free: s.pricePence === 0 });
