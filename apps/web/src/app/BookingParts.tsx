import { BOOKING_KINDS, REPEAT_CHOICES, bookingEvent, googleCalendarUrl, toIcs, callLink, callOpen, callService, dayLabel, freeSlots, timeLabel, type Booking, type BookingKind, type BookingSettings, type Busy, type SessionPack } from "@apex/core";
import { Icons } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BOOKINGS_NEED_UPDATE, type BookingApi } from "../data/bookings";

export interface BookingData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  settings: BookingSettings | null;
  bookings: Booking[];
  busy: Busy[];
  /** Every training session, for credits and the register. */
  history: Booking[];
  packs: SessionPack[];
  sessionsReady: boolean;
  reload: () => Promise<void>;
}

/** Loads the calendar, and again when the window comes back into focus so new bookings show up. */
export function useBookings(api: BookingApi | null): BookingData {
  const [s, setS] = useState<Omit<BookingData, "reload">>({ status: "loading", settings: null, bookings: [], busy: [], history: [], packs: [], sessionsReady: false });
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
export function SlotPicker({ settings, busy, value, onChange, lengthMin }: { settings: BookingSettings; busy: Busy[]; value: string | null; onChange: (iso: string | null) => void; lengthMin?: number }) {
  const days = useMemo(() => freeSlots(settings, busy, new Date(), undefined, lengthMin ?? settings.slotMin), [settings, busy, lengthMin]);
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

/** "Join call" on a booked call: bright from 10 minutes before the start, a quiet link before that. */
export function JoinCall({ booking, settings, now = new Date() }: { booking: Booking; settings: BookingSettings | null; now?: Date }) {
  const link = callLink(booking, settings);
  if (!link) return null;
  const open = callOpen(booking, now);
  const service = callService(link);
  const label = `${open ? "Join" : "Open"} the ${service === "video call" ? "" : `${service} `}video call`;
  return open ? (
    <a className="btn sm act" style={{ textDecoration: "none", flex: "none" }} href={link} target="_blank" rel="noopener noreferrer" aria-label={label} title={link}>
      <Icons.video width={14} height={14} /> Join
    </a>
  ) : (
    <a className="iconbtn" style={{ textDecoration: "none", flex: "none", display: "inline-grid", placeItems: "center" }} href={link} target="_blank" rel="noopener noreferrer" aria-label={label} title={`${service === "video call" ? "Video call" : service} link · opens 10 minutes before`}>
      <Icons.video width={16} height={16} />
    </a>
  );
}

/** Puts the booking in the phone's calendar: an .ics file (Apple Calendar, Outlook) or Google Calendar. */
export function AddToCalendar({ booking, settings, withName }: { booking: Booking; settings: BookingSettings | null; withName: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const e = bookingEvent(booking, settings, withName);
  const ics = () => {
    const url = URL.createObjectURL(new Blob([toIcs(e)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `apex-${booking.kind}-${booking.startsAt.slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPos(null);
  };
  const toggle = (el: HTMLElement) => {
    if (pos) return setPos(null);
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };
  return (
    <>
      <button className="iconbtn" aria-label="Add to calendar" aria-expanded={!!pos} title="Add to calendar" onClick={(ev) => toggle(ev.currentTarget)} style={{ display: "inline-grid", placeItems: "center", flex: "none" }}>
        <Icons.calendar width={16} height={16} />
      </button>
      {pos && createPortal(
        <>
          <div className="cal-scrim" onClick={() => setPos(null)} />
          <span className="cal-menu" role="menu" style={{ top: pos.top, right: pos.right }}>
            <button role="menuitem" onClick={ics}>Apple or Outlook</button>
            <a role="menuitem" href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer" onClick={() => setPos(null)}>Google Calendar</a>
          </span>
        </>,
        document.body,
      )}
    </>
  );
}

/** "Just once", "4 weeks"…: the same time each week. */
export function RepeatChips({ weeks, onChange }: { weeks: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="tiny" style={{ marginBottom: 6 }}>Repeat weekly</div>
      <div className="chips" role="group" aria-label="Repeat weekly" style={{ flexWrap: "wrap" }}>{REPEAT_CHOICES.map((n) => <button key={n} type="button" className={`chip ${weeks === n ? "on" : ""}`} aria-pressed={weeks === n} onClick={() => onChange(n)}>{n === 1 ? "Just once" : `${n} weeks`}</button>)}</div>
    </div>
  );
}

/** Pick a new free time for a booking and move it there, instead of cancelling. */
export function MovePicker({ booking, settings, busy, onMove, onClose }: { booking: Booking; settings: BookingSettings; busy: Busy[]; onMove: (startsAt: string) => Promise<void>; onClose: () => void }) {
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const others = useMemo(() => busy.filter((b) => b.startsAt !== booking.startsAt), [busy, booking.startsAt]);
  return (
    <div className="stack" style={{ gap: 10, flexBasis: "100%", paddingTop: 6 }}>
      <div className="tiny">Pick a new time. It stays {Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60000)} minutes.</div>
      <SlotPicker settings={settings} busy={others} value={slot} onChange={setSlot} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost sm" onClick={onClose}>Keep the time</button>
        <button className="btn act sm" disabled={!slot || saving} onClick={async () => { if (!slot) return; setSaving(true); await onMove(slot); setSaving(false); }}>{slot ? `Move to ${new Date(slot).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${timeLabel(slot)}` : "Pick a time"}</button>
      </div>
    </div>
  );
}
