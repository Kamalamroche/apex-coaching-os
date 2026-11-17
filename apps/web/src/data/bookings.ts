import {
  BOOK_AHEAD_DAYS, DEFAULT_BOOKING_SETTINGS, freeSlots, fromGuestRow, guestBusy, fromServiceRow, sampleServices, serviceProblem, toServiceRow,
  type GuestBooking, type GuestBookingRow, type GuestStatus, type Service, type ServiceRow, DEMO_BOOKING_CLIENT, busyFrom, fromBookingRow, fromPackRow, fromSettingsRow, hoursProblem, sampleBookings, samplePacks, samplePastSessions, toBookingRow, toPackRow, toSettingsRow,
  type Attendance, type Booking, type BookingRow, type BookingSettings, type BookingSettingsRow, type Busy, type SessionPack, type SessionPackRow,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** The booking calendar for whoever is signed in. The coach sees all their bookings; a client sees their own, plus which slots are taken. */
export interface BookingApi {
  /** False in the demo. */
  live: boolean;
  /** Who is signed in: the client's id on the client side. */
  me: string;
  load(): Promise<BookingLoad>;
  /** Coach only. */
  saveSettings(s: BookingSettings): Promise<void>;
  book(b: Booking): Promise<void>;
  /** Several at once, e.g. a weekly slot. All or none. */
  bookMany(bs: Booking[]): Promise<void>;
  cancel(id: string): Promise<void>;
  /** To another free time, keeping its length. Clients only until the cancel window closes. */
  move(id: string, startsAt: string): Promise<void>;
  /* 1:1 sessions (coach only): packs and the register. */
  addPack(p: SessionPack): Promise<void>;
  removePack(id: string): Promise<void>;
  mark(id: string, attendance: Attendance): Promise<void>;
  waive(id: string, waived: boolean): Promise<void>;
  /* Service menu and booking link (services SQL). ready is false until it is run. */
  services(): Promise<{ list: Service[]; ready: boolean }>;
  /** Coach: saves every service in the list (new, edited or reordered). */
  saveServices(list: Service[]): Promise<void>;
  removeService(id: string): Promise<void>;
  /** Coach: bookings from people who aren't clients yet, booked on the public page. */
  guests(): Promise<GuestBooking[]>;
  answerGuest(id: string, status: GuestStatus): Promise<void>;
}

export const SERVICES_NEED_UPDATE = "The service menu needs the services SQL in Supabase first.";

export interface BookingLoad {
  settings: BookingSettings;
  /** From yesterday on: the calendar. */
  bookings: Booking[];
  busy: Busy[];
  /** Every training session, past ones too, for credits and the register. */
  history: Booking[];
  packs: SessionPack[];
  /** False until the sessions SQL is run: no packs, no register. */
  sessionsReady: boolean;
}

export const SESSIONS_NEED_UPDATE = "Session packs need the sessions SQL in Supabase first.";

const isMissingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205" || e?.code === "PGRST202";
export const BOOKINGS_NEED_UPDATE = "needs-update";
const TAKEN = "That slot was just taken. Pick another one.";

const err = (e: { code?: string; message: string }) => (isMissingTable(e) ? new Error(BOOKINGS_NEED_UPDATE) : e.code === "23505" ? new Error(TAKEN) : new Error(e.message));

export function liveBookings(db: SupabaseClient, who: { side: "coach" | "client"; coachId: string; me: string }): BookingApi {
  const { coachId } = who;
  return {
    live: true,
    me: who.me,
    async load() {
      const now = new Date();
      const since = new Date(now.getTime() - 86400000).toISOString();
      const until = new Date(now.getTime() + (BOOK_AHEAD_DAYS + 1) * 86400000).toISOString();
      const [s, b] = await Promise.all([
        db.from("coach_booking_settings").select("*").eq("coach_id", coachId).maybeSingle<BookingSettingsRow>(),
        db.from("bookings").select("*").eq("coach_id", coachId).gte("ends_at", since).order("starts_at").limit(200).returns<BookingRow[]>(),
      ]);
      const e = s.error ?? b.error;
      if (e) throw err(e);
      const bookings = (b.data ?? []).map(fromBookingRow);
      let busy = busyFrom(bookings);
      if (who.side === "coach") {
        // Times held by people booking from the public page (services SQL; skipped before it is run).
        const g = await db.from("guest_bookings").select("starts_at, ends_at, status").eq("coach_id", coachId).in("status", ["requested", "confirmed"]).gte("ends_at", since);
        if (!g.error) busy = [...busy, ...((g.data ?? []) as { starts_at: string; ends_at: string }[]).map((x) => ({ startsAt: new Date(x.starts_at).toISOString(), endsAt: new Date(x.ends_at).toISOString() }))];
      }
      if (who.side === "client") {
        const r = await db.rpc("booking_busy", { p_coach: coachId, p_from: now.toISOString(), p_to: until });
        if (r.error) throw err(r.error);
        busy = ((r.data ?? []) as { starts_at: string; ends_at: string }[]).map((x) => ({ startsAt: new Date(x.starts_at).toISOString(), endsAt: new Date(x.ends_at).toISOString() }));
      }
      const [h, p] = await Promise.all([
        db.from("bookings").select("*").eq("coach_id", coachId).eq("kind", "session").order("starts_at", { ascending: false }).limit(1000).returns<BookingRow[]>(),
        db.from("session_packs").select("*").eq("coach_id", coachId).order("bought_at").limit(1000).returns<SessionPackRow[]>(),
      ]);
      const sessionsReady = !p.error;
      return {
        settings: s.data ? fromSettingsRow(s.data) : DEFAULT_BOOKING_SETTINGS, bookings, busy,
        history: (h.data ?? []).map(fromBookingRow).reverse(), packs: (p.data ?? []).map(fromPackRow), sessionsReady,
      };
    },
    async saveSettings(settings) {
      const problem = hoursProblem(settings);
      if (problem) throw new Error(problem);
      const row = { ...toSettingsRow(settings, coachId), updated_at: new Date().toISOString() };
      let { error } = await db.from("coach_booking_settings").upsert(row);
      // Before the sessions SQL is run there's no policy: save the rest, unless the coach changed it.
      const policyChanged = row.cancel_hours !== 24 || row.require_credits;
      if (error?.code === "PGRST204" && !policyChanged) {
        const { cancel_hours: _c, require_credits: _r, ...rest } = row;
        ({ error } = await db.from("coach_booking_settings").upsert(rest));
        // Before the video-call SQL is run there's no video_link column: save the hours anyway, unless a link was typed.
        if (error?.code === "PGRST204" && !row.video_link) {
          const { video_link: _unused, ...older } = rest;
          ({ error } = await db.from("coach_booking_settings").upsert(older));
        }
      }
      if (error?.code === "PGRST204") throw new Error(policyChanged ? SESSIONS_NEED_UPDATE.replace("Session packs need", "The cancellation policy needs") : "Video links need the video-call SQL in Supabase first.");
      if (error) throw err(error);
    },
    async book(b) {
      const { error } = await db.from("bookings").insert(toBookingRow(b, coachId));
      if (error) throw err(error);
    },
    async bookMany(bs) {
      const { error } = await db.from("bookings").insert(bs.map((b) => toBookingRow(b, coachId)));
      if (error) throw err(error);
    },
    async cancel(id) {
      const { data, error } = await db.from("bookings").update({ status: "cancelled" }).eq("id", id).select("id");
      if (error) throw err(error);
      if (!data?.length) throw new Error("Couldn't cancel that booking. Reload and try again.");
    },
    async move(id, startsAt) {
      const { error } = await db.rpc("move_booking", { p_id: id, p_starts: startsAt });
      if (error) throw error.code === "PGRST202" ? new Error("Moving bookings needs the sessions SQL in Supabase first.") : error.code === "42501" ? new Error("It's too late to move this one. Cancel it, or message your coach.") : err(error);
    },
    async addPack(p) {
      const { error } = await db.from("session_packs").insert(toPackRow(p, coachId));
      if (error) throw isMissingTable(error) ? new Error(SESSIONS_NEED_UPDATE) : new Error(error.message);
    },
    async removePack(id) {
      const { error } = await db.from("session_packs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async mark(id, attendance) {
      const { error } = await db.from("bookings").update({ attendance, ...(attendance !== "no_show" ? { waived: false } : {}) }).eq("id", id);
      if (error) throw error.code === "PGRST204" ? new Error(SESSIONS_NEED_UPDATE.replace("Session packs need", "The register needs")) : new Error(error.message);
    },
    async waive(id, waived) {
      const { error } = await db.from("bookings").update({ waived }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async services() {
      const { data, error } = await db.from("coach_services").select("id, name, minutes, price_pence, kind, description, audience, active, position").eq("coach_id", coachId).order("position").returns<ServiceRow[]>();
      if (error && isMissingTable(error)) return { list: [], ready: false };
      if (error) throw new Error(error.message);
      return { list: (data ?? []).map(fromServiceRow), ready: true };
    },
    async saveServices(list) {
      for (const sv of list) { const p = serviceProblem(sv); if (p) throw new Error(`${sv.name || "A service"}: ${p}`); }
      const { error } = await db.from("coach_services").upsert(list.map((sv) => toServiceRow(sv, coachId)));
      if (error) throw isMissingTable(error) ? new Error(SERVICES_NEED_UPDATE) : new Error(error.message);
    },
    async removeService(id) {
      const { error } = await db.from("coach_services").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async guests() {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data, error } = await db.from("guest_bookings").select("*").eq("coach_id", coachId).gte("ends_at", since).order("starts_at").limit(200).returns<GuestBookingRow[]>();
      if (error && isMissingTable(error)) return [];
      if (error) throw new Error(error.message);
      return (data ?? []).map(fromGuestRow);
    },
    async answerGuest(id, status) {
      const { error } = await db.from("guest_bookings").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

const KEY = "apex-bookings-v2";

/** Demo: sample hours and bookings in localStorage, shared by the coach and client tabs. */
export function demoBookings(me = DEMO_BOOKING_CLIENT): BookingApi {
  type Demo = { settings: BookingSettings; bookings: Booking[]; packs?: SessionPack[]; services?: Service[]; guests?: GuestBooking[] };
  const read = (): Demo => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Demo;
    } catch { /* blocked storage: sample */ }
    const base = sampleBookings();
    const sample = { ...base, bookings: [...samplePastSessions(), ...base.bookings], packs: samplePacks() };
    write(sample);
    return sample;
  };
  const write = (v: Demo) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* kept for this visit only */ }
  };
  let mem: Demo | null = null;
  const get = () => (mem ??= read());
  const set = (v: Demo) => { mem = v; write(v); };
  const patch = (id: string, f: (b: Booking) => Booking) => { const v = get(); set({ ...v, bookings: v.bookings.map((x) => (x.id === id ? f(x) : x)) }); };
  return {
    live: false,
    me,
    async load() {
      mem = null;
      const v = get();
      const mine = v.bookings.filter((b) => me === "coach" || b.clientId === me);
      return {
        settings: v.settings, bookings: v.bookings, busy: [...busyFrom(v.bookings), ...guestBusy(readDemoGuests())],
        history: mine.filter((b) => b.kind === "session"), packs: (v.packs ?? (v.packs = samplePacks())).filter((p) => me === "coach" || p.clientId === me), sessionsReady: true,
      };
    },
    async saveSettings(settings) {
      const problem = hoursProblem(settings);
      if (problem) throw new Error(problem);
      set({ ...get(), settings });
    },
    async book(b) {
      const v = get();
      if (v.bookings.some((x) => x.status === "booked" && x.startsAt === b.startsAt)) throw new Error(TAKEN);
      set({ ...v, bookings: [...v.bookings, b] });
    },
    async bookMany(bs) {
      const v = get();
      if (bs.some((b) => v.bookings.some((x) => x.status === "booked" && x.startsAt === b.startsAt))) throw new Error(TAKEN);
      set({ ...v, bookings: [...v.bookings, ...bs] });
    },
    async cancel(id) {
      // The coach tab passes me = "coach"; anyone else is the client and may cancel late.
      const v = get();
      const policy = v.settings.cancelHours ?? 24;
      patch(id, (x) => ({
        ...x, status: "cancelled", cancelledBy: me === "coach" ? "coach" : "client",
        late: me !== "coach" && x.kind === "session" && policy > 0 && Date.parse(x.startsAt) - Date.now() < policy * 3600000,
      }));
    },
    async move(id, startsAt) {
      const v = get();
      if (v.bookings.some((x) => x.id !== id && x.status === "booked" && x.startsAt === startsAt)) throw new Error(TAKEN);
      patch(id, (x) => ({ ...x, startsAt, endsAt: new Date(Date.parse(startsAt) + (Date.parse(x.endsAt) - Date.parse(x.startsAt))).toISOString() }));
    },
    async addPack(p) { const v = get(); set({ ...v, packs: [...(v.packs ?? []), p] }); },
    async removePack(id) { const v = get(); set({ ...v, packs: (v.packs ?? []).filter((p) => p.id !== id) }); },
    async mark(id, attendance) { patch(id, (x) => ({ ...x, attendance, waived: attendance === "no_show" ? x.waived : false })); },
    async waive(id, waived) { patch(id, (x) => ({ ...x, waived })); },
    async services() { return { list: get().services ?? sampleServices(), ready: true }; },
    async saveServices(list) {
      for (const sv of list) { const p = serviceProblem(sv); if (p) throw new Error(`${sv.name || "A service"}: ${p}`); }
      const v = get();
      const byId = new Map((v.services ?? sampleServices()).map((x) => [x.id, x]));
      for (const sv of list) byId.set(sv.id, sv);
      set({ ...v, services: [...byId.values()].sort((a, b) => a.position - b.position) });
    },
    async removeService(id) { const v = get(); set({ ...v, services: (v.services ?? sampleServices()).filter((x) => x.id !== id) }); },
    async guests() { return readDemoGuests(); },
    async answerGuest(id, status) { writeDemoGuests(readDemoGuests().map((g) => (g.id === id ? { ...g, status } : g))); },
  };
}

const Ctx = createContext<BookingApi | null>(null);
export const BookingProvider = Ctx.Provider;
/** Null where there's no calendar, e.g. a client without a coach. */
export const useBookingApi = (): BookingApi | null => useContext(Ctx);

/* Demo guest bookings live under their own key so the public page (another tab, no sign-in) can add to them. */
const GUEST_KEY = "apex-guest-bookings-v1";
export function readDemoGuests(): GuestBooking[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) return JSON.parse(raw) as GuestBooking[];
  } catch { /* sample */ }
  return sampleGuests();
}
export function writeDemoGuests(list: GuestBooking[]) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(list)); } catch { /* this visit only */ }
}
/** The demo's services, as the coach last saved them. */
export function readDemoServices(): Service[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as { services?: Service[] }).services ?? sampleServices();
  } catch { /* sample */ }
  return sampleServices();
}
/** The demo's hours and bookings, for the public page. */
export async function demoBookingLoad(): Promise<BookingLoad> {
  return demoBookings("coach").load();
}

function sampleGuests(): GuestBooking[] {
  const { settings, bookings } = sampleBookings();
  const svc = sampleServices();
  const taken = busyFrom(bookings);
  const slots = freeSlots(settings, taken, new Date(), 10, 60).flatMap((d) => d.slots);
  if (slots.length < 8) return [];
  const make = (i: number, slot: string, s: Service, name: string, email: string, note: string, status: GuestStatus): GuestBooking => ({
    id: `demo-guest-${i}`, serviceId: s.id, serviceName: s.name, pricePence: s.pricePence, kind: s.kind, startsAt: slot,
    endsAt: new Date(Date.parse(slot) + s.minutes * 60000).toISOString(), name, email, phone: "", note, status, createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
  });
  return [
    make(1, slots[3]!, svc[0]!, "Aisha Khan", "aisha.k@example.com", "Thinking about my first 10k", "requested"),
    make(2, slots[7]!, svc[1]!, "Tom Okafor", "tom.okafor@example.com", "", "confirmed"),
  ];
}
