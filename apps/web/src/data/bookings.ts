import {
  BOOK_AHEAD_DAYS, DEFAULT_BOOKING_SETTINGS, DEMO_BOOKING_CLIENT, busyFrom, fromBookingRow, fromSettingsRow, hoursProblem, sampleBookings, toBookingRow, toSettingsRow,
  type Booking, type BookingRow, type BookingSettings, type BookingSettingsRow, type Busy,
} from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

/** The booking calendar for whoever is signed in. The coach sees all their bookings; a client sees their own, plus which slots are taken. */
export interface BookingApi {
  /** False in the demo. */
  live: boolean;
  /** Who is signed in: the client's id on the client side. */
  me: string;
  load(): Promise<{ settings: BookingSettings; bookings: Booking[]; busy: Busy[] }>;
  /** Coach only. */
  saveSettings(s: BookingSettings): Promise<void>;
  book(b: Booking): Promise<void>;
  cancel(id: string): Promise<void>;
}

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
      if (who.side === "client") {
        const r = await db.rpc("booking_busy", { p_coach: coachId, p_from: now.toISOString(), p_to: until });
        if (r.error) throw err(r.error);
        busy = ((r.data ?? []) as { starts_at: string; ends_at: string }[]).map((x) => ({ startsAt: new Date(x.starts_at).toISOString(), endsAt: new Date(x.ends_at).toISOString() }));
      }
      return { settings: s.data ? fromSettingsRow(s.data) : DEFAULT_BOOKING_SETTINGS, bookings, busy };
    },
    async saveSettings(settings) {
      const problem = hoursProblem(settings);
      if (problem) throw new Error(problem);
      const row = { ...toSettingsRow(settings, coachId), updated_at: new Date().toISOString() };
      let { error } = await db.from("coach_booking_settings").upsert(row);
      // Before the video-call SQL is run there's no video_link column: save the hours anyway, unless a link was typed.
      if (error?.code === "PGRST204" && !row.video_link) {
        const { video_link: _unused, ...rest } = row;
        ({ error } = await db.from("coach_booking_settings").upsert(rest));
      }
      if (error?.code === "PGRST204") throw new Error("Video links need the video-call SQL in Supabase first.");
      if (error) throw err(error);
    },
    async book(b) {
      const { error } = await db.from("bookings").insert(toBookingRow(b, coachId));
      if (error) throw err(error);
    },
    async cancel(id) {
      const { data, error } = await db.from("bookings").update({ status: "cancelled" }).eq("id", id).select("id");
      if (error) throw err(error);
      if (!data?.length) throw new Error("Couldn't cancel that booking. Reload and try again.");
    },
  };
}

const KEY = "apex-bookings-v1";

/** Demo: sample hours and bookings in localStorage, shared by the coach and client tabs. */
export function demoBookings(me = DEMO_BOOKING_CLIENT): BookingApi {
  const read = (): { settings: BookingSettings; bookings: Booking[] } => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as { settings: BookingSettings; bookings: Booking[] };
    } catch { /* blocked storage: sample */ }
    const sample = sampleBookings();
    write(sample);
    return sample;
  };
  const write = (v: { settings: BookingSettings; bookings: Booking[] }) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* kept for this visit only */ }
  };
  let mem: { settings: BookingSettings; bookings: Booking[] } | null = null;
  const get = () => (mem ??= read());
  const set = (v: { settings: BookingSettings; bookings: Booking[] }) => { mem = v; write(v); };
  return {
    live: false,
    me,
    async load() {
      mem = null;
      const v = get();
      return { ...v, busy: busyFrom(v.bookings) };
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
    async cancel(id) {
      const v = get();
      set({ ...v, bookings: v.bookings.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)) });
    },
  };
}

const Ctx = createContext<BookingApi | null>(null);
export const BookingProvider = Ctx.Provider;
/** Null where there's no calendar, e.g. a client without a coach. */
export const useBookingApi = (): BookingApi | null => useContext(Ctx);
