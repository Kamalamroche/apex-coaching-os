import { BOOKING_KINDS, dayLabel, freeSlots, timeLabel, type Booking, type BookingKind, type BookingSettings, type Busy } from "@apex/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOOKINGS_NEED_UPDATE, type BookingApi } from "../data/bookings";

export interface BookingData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  settings: BookingSettings | null;
  bookings: Booking[];
  busy: Busy[];
  reload: () => Promise<void>;
}

/** Loads the calendar, and again when the window comes back into focus so new bookings show up. */
export function useBookings(api: BookingApi | null): BookingData {
  const [s, setS] = useState<Omit<BookingData, "reload">>({ status: "loading", settings: null, bookings: [], busy: [] });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const r = await api.load();
      setS({ status: "ready", ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === BOOKINGS_NEED_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  return { ...s, reload };
}

export function BookingStatus({ data }: { data: BookingData }) {
  if (data.status === "loading") return <div className="card small">Loading…</div>;
  if (data.status === "needs-update") return <div className="card small">The calendar needs a quick database update before it can work. Run the bookings SQL in Supabase, then reload.</div>;
  if (data.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load the calendar: {data.error}</div>;
  return null;
}

export function KindChips({ value, onChange }: { value: BookingKind; onChange: (k: BookingKind) => void }) {
  return (
    <div className="chips" role="group" aria-label="Kind of booking">
      {BOOKING_KINDS.map((k) => <button key={k.kind} type="button" className={`chip ${value === k.kind ? "on" : ""}`} aria-pressed={value === k.kind} onClick={() => onChange(k.kind)}>{k.title}</button>)}
    </div>
  );
}

/** Pick a day, then a free time. */
export function SlotPicker({ settings, busy, value, onChange }: { settings: BookingSettings; busy: Busy[]; value: string | null; onChange: (iso: string | null) => void }) {
  const days = useMemo(() => freeSlots(settings, busy, new Date()), [settings, busy]);
  const [day, setDay] = useState<string | null>(null);
  const open = days.find((d) => d.day === day) ?? days[0];
  if (!days.length) return <div className="small">No free times in the next two weeks.</div>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="chips bk-days" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button key={d.day} role="tab" aria-selected={open?.day === d.day} className={`bk-day ${open?.day === d.day ? "on" : ""}`} onClick={() => { setDay(d.day); onChange(null); }}>
            <span className="tiny">{dayLabel(d.day).split(" ")[0]}</span>
            <b className="num">{dayLabel(d.day).split(" ")[1]}</b>
            <span className="tiny">{dayLabel(d.day).split(" ")[2]}</span>
          </button>
        ))}
      </div>
      <div className="bk-slots" role="group" aria-label="Time">
        {open?.slots.map((iso) => <button key={iso} className={`chip num ${value === iso ? "on" : ""}`} aria-pressed={value === iso} onClick={() => onChange(value === iso ? null : iso)}>{timeLabel(iso)}</button>)}
      </div>
    </div>
  );
}
