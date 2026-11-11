import {
  CANCEL_CHOICES, DEMO_BOOKING_NAMES, NOTICE_CHOICES, SLOT_CHOICES, hoursText, policyText, weeklyStarts, byLocalDay, callOpen, videoLinkProblem, dayLabel, firstName, hoursProblem, kindTitle, minutesLabel, newBooking, safeZone, timeLabel, upcomingBookings, whenLabel,
  guestQueue, type BookingKind, type BookingSettings, type GuestBooking, type HoursWindow,
} from "@apex/core";
import { Avatar, BackLink, Icons, Label } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { AddToCalendar, BookingStatus, JoinCall, KindChips, MovePicker, RepeatChips, SlotPicker, useBookings, type BookingData } from "../../app/BookingParts";
import { useBookingApi } from "../../data/bookings";
import { ServicesDesk } from "./Services";
import { SessionsDesk } from "./Sessions";
import type { LiveClient } from "../../data/coach";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = Array.from({ length: 37 }, (_, i) => 300 + i * 30); // 05:00 to 23:00
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Small entry card for the Brief: what's next in the calendar. */
export function CalendarCard({ clients, onOpen }: { clients?: LiveClient[] | null; onOpen: () => void }) {
  const api = useBookingApi();
  const data = useBookings(api);
  if (!api) return null;
  const names = nameMap(clients);
  const next = upcomingBookings(data.bookings, new Date());
  const today = next.filter((b) => new Date(b.startsAt).toDateString() === new Date().toDateString()).length;
  const first = next[0];
  return (
    <div className="card flat list full">
      <button className="li" onClick={onOpen}>
        <Icons.brief width={18} height={18} style={{ color: "var(--act)" }} />
        <div className="grow">
          <div className="h3">Calendar{next.length ? ` · ${next.length} booked` : ""}{today ? ` · ${today} today` : ""}</div>
          <div className="tiny">{data.status === "needs-update" ? "Needs the bookings SQL" : first ? `Next: ${firstName(names[first.clientId] ?? "Client")}, ${kindTitle(first.kind).toLowerCase()} ${whenLabel(first.startsAt)}` : data.settings?.windows.length ? "Nothing booked yet" : "Set your hours so clients can book calls and sessions"}</div>
        </div>
        <span className="tiny">›</span>
      </button>
      {first && callOpen(first, new Date()) && first.kind === "call" && (
        <div className="li"><Icons.video width={18} height={18} style={{ color: "var(--act)" }} /><div className="grow small">Your call with {firstName(names[first.clientId] ?? "your client")} is starting</div><JoinCall booking={first} settings={data.settings} /></div>
      )}
    </div>
  );
}

const nameMap = (clients?: LiveClient[] | null): Record<string, string> => (clients ? Object.fromEntries(clients.map((c) => [c.id, c.name])) : DEMO_BOOKING_NAMES);

/** Coach: upcoming bookings, booking for a client, and the weekly hours clients can book. */
export function Calendar({ clients, onBack, say }: { clients?: LiveClient[] | null; onBack: () => void; say: (m: string) => void }) {
  const api = useBookingApi();
  const data = useBookings(api);
  const [mode, setMode] = useState<"list" | "sessions" | "services" | "hours">("list");
  const [moving, setMoving] = useState<string | null>(null);
  const names = nameMap(clients);
  const [guests, setGuests] = useState<GuestBooking[]>([]);
  useEffect(() => { api?.guests().then(setGuests, () => undefined); }, [api, mode]);
  if (!api) return null;
  const next = upcomingBookings(data.bookings, new Date());
  const fromLink = guestQueue(guests, new Date());
  const toConfirm = fromLink.filter((g) => g.status === "requested").length;

  const cancel = async (id: string) => {
    try {
      await api.cancel(id);
      say("Booking cancelled");
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  const move = async (id: string, at: string) => {
    try {
      await api.move(id, at);
      setMoving(null);
      say(`Moved to ${whenLabel(at)}`);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  return (
    <>
      <div className="full"><BackLink onClick={onBack}>Brief</BackLink></div>
      <div className="full"><div className="eyebrow">Calendar</div><h1 className="h1">Bookings</h1></div>
      <div className="chips full" role="tablist">
        <button role="tab" aria-selected={mode === "list"} className={`chip ${mode === "list" ? "on" : ""}`} onClick={() => setMode("list")}>Upcoming</button>
        <button role="tab" aria-selected={mode === "sessions"} className={`chip ${mode === "sessions" ? "on" : ""}`} onClick={() => setMode("sessions")}>Sessions and packs</button>
        <button role="tab" aria-selected={mode === "services"} className={`chip ${mode === "services" ? "on" : ""}`} onClick={() => setMode("services")}>Services and link</button>
        <button role="tab" aria-selected={mode === "hours"} className={`chip ${mode === "hours" ? "on" : ""}`} onClick={() => setMode("hours")}>Your hours</button>
      </div>
      <div className="full"><BookingStatus data={data} /></div>
      {data.status === "ready" && data.settings && mode === "list" && (
        <>
          <section className="full stack">
            {fromLink.length > 0 && (
              <button className="card li" style={{ width: "100%", textAlign: "left" }} onClick={() => setMode("services")}>
                <Icons.link width={18} height={18} style={{ color: "var(--act)" }} />
                <div className="grow"><div className="h3">{fromLink.length} booked from your link</div><div className="tiny">{toConfirm ? `${toConfirm} waiting for you to confirm` : "All confirmed"} · next {fromLink.map((g) => g.startsAt).sort()[0] ? whenLabel(fromLink.map((g) => g.startsAt).sort()[0]!) : ""}</div></div>
                <span className="tiny">›</span>
              </button>
            )}
            {next.length === 0 && <div className="card small">{data.settings.windows.length ? "Nothing booked yet. Clients book from More in their app." : "Set your hours first, then clients can book calls and sessions from their app."}</div>}
            {byLocalDay(next).map((g) => (
              <div key={g.day}>
                <div className="sect"><h2 className="h3">{dayLabel(g.day)}</h2><span className="tiny">{g.items.length} booked</span></div>
                <div className="card flat list">
                  {g.items.map((b) => {
                    const name = names[b.clientId] ?? "Client";
                    return (
                      <div key={b.id} className="li" style={{ flexWrap: "wrap" }}>
                        <span className="num small" style={{ width: 46, fontWeight: 700, color: "var(--text)" }}>{timeLabel(b.startsAt)}</span>
                        <Avatar initials={initials(name)} size={32} />
                        <div className="grow"><div className="h3">{name}</div><div className="tiny">{kindTitle(b.kind)} · until {timeLabel(b.endsAt)}{b.note ? ` · ${b.note}` : ""}</div></div>
                        <div className="row" style={{ gap: 6, flex: "1 0 100%", justifyContent: "flex-end" }}>
                        <JoinCall booking={b} settings={data.settings} />
                        <AddToCalendar booking={b} settings={data.settings} withName={name} />
                        <button className="iconbtn" aria-expanded={moving === b.id} onClick={() => setMoving(moving === b.id ? null : b.id)} aria-label={`Move ${name}'s booking`}>Move</button>
                        <button className="iconbtn" onClick={() => void cancel(b.id)} aria-label={`Cancel ${name}'s booking`}>Cancel</button>
                        </div>
                        {moving === b.id && data.settings && <MovePicker booking={b} settings={data.settings} busy={data.busy} onMove={(at) => move(b.id, at)} onClose={() => setMoving(null)} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
          {data.settings.windows.length > 0 && <BookFor data={data} names={names} say={say} />}
        </>
      )}
      {data.status === "ready" && mode === "sessions" && <SessionsDesk data={data} names={names} say={say} />}
      {data.status === "ready" && mode === "services" && <ServicesDesk data={data} say={say} onHours={() => setMode("hours")} />}
      {data.status === "ready" && data.settings && mode === "hours" && <Hours initial={data.settings} onSaved={async () => { await data.reload(); say("Saved · clients can book these hours"); setMode("list"); }} />}
    </>
  );
}

function BookFor({ data, names, say }: { data: BookingData; names: Record<string, string>; say: (m: string) => void }) {
  const api = useBookingApi();
  const ids = Object.keys(names);
  const [clientId, setClientId] = useState(ids[0] ?? "");
  const [kind, setKind] = useState<BookingKind>("session");
  const [slot, setSlot] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(1);
  const [error, setError] = useState<string | null>(null);
  if (!api || !data.settings || !ids.length) return null;
  const book = async () => {
    if (!slot || !data.settings) return;
    setError(null);
    try {
      const { starts, skipped } = weeklyStarts(slot, kind === "session" ? weeks : 1, data.busy);
      const repeatId = starts.length > 1 ? crypto.randomUUID() : null;
      await api.bookMany(starts.map((at) => ({ ...newBooking(clientId, at, data.settings!.slotMin, kind, ""), repeatId })));
      setSlot(null);
      say(`Booked ${firstName(names[clientId] ?? "")} · ${whenLabel(slot)}${starts.length > 1 ? ` and ${starts.length - 1} more week${starts.length === 2 ? "" : "s"}` : ""}${skipped.length ? ` · ${skipped.length} taken, skipped` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };
  return (
    <section className="card stack full">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Book for a client</h3><Label kind="dec">Coach decision</Label></div>
      <select className="field" aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {ids.map((id) => <option key={id} value={id}>{names[id]}</option>)}
      </select>
      <KindChips value={kind} onChange={setKind} />
      <SlotPicker settings={data.settings} busy={data.busy} value={slot} onChange={setSlot} />
      {kind === "session" && <RepeatChips weeks={weeks} onChange={setWeeks} />}
      {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
      <button className="btn act block" disabled={!slot || !clientId} onClick={() => void book()}>{slot ? `Book ${firstName(names[clientId] ?? "")} · ${whenLabel(slot)}` : "Pick a time"}</button>
    </section>
  );
}

function Hours({ initial, onSaved }: { initial: BookingSettings; onSaved: () => Promise<void> }) {
  const api = useBookingApi();
  const zone = useMemo(() => safeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || initial.timezone), [initial.timezone]);
  const [s, setS] = useState<BookingSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(initial), [initial]);
  const setWin = (i: number, w: HoursWindow | null) => setS((x) => ({ ...x, windows: w ? x.windows.map((y, j) => (j === i ? w : y)) : x.windows.filter((_, j) => j !== i) }));
  const add = (weekday: number) => setS((x) => {
    const last = x.windows.filter((w) => w.weekday === weekday).at(-1);
    const startMin = last ? Math.min(last.endMin + 60, 21 * 60) : 9 * 60;
    return { ...x, windows: [...x.windows, { weekday, startMin, endMin: Math.min(startMin + 120, 23 * 60) }] };
  });
  const copyMon = () => setS((x) => {
    const mon = x.windows.filter((w) => w.weekday === 0);
    return { ...x, windows: [...mon, ...[1, 2, 3, 4].flatMap((weekday) => mon.map((w) => ({ ...w, weekday })))].concat(x.windows.filter((w) => w.weekday >= 5)) };
  });
  const save = async () => {
    if (!api) return;
    const next = { ...s, timezone: zone };
    const problem = hoursProblem(next);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await api.saveSettings(next);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <section className="card stack full">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">When clients can book</h3><span className="tiny">Times in {zone.replace("_", " ")}</span></div>
      <div className="bk-hours">
        {DAYS.map((d, weekday) => {
          const mine = s.windows.map((w, i) => ({ w, i })).filter(({ w }) => w.weekday === weekday);
          return [
            <div key={`${d}-l`} className="h3" style={{ paddingTop: 7 }}>{d}</div>,
            <div key={`${d}-w`} className="stack" style={{ gap: 6 }}>
              {mine.length === 0 && <div className="tiny" style={{ paddingTop: 9 }}>Not bookable</div>}
              {mine.map(({ w, i }) => (
                <div key={i} className="bk-win">
                  <select className="field num" aria-label={`${d} from`} value={w.startMin} onChange={(e) => setWin(i, { ...w, startMin: Number(e.target.value) })}>{TIMES.map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}</select>
                  <span className="tiny">to</span>
                  <select className="field num" aria-label={`${d} until`} value={w.endMin} onChange={(e) => setWin(i, { ...w, endMin: Number(e.target.value) })}>{TIMES.filter((t) => t > w.startMin).map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}</select>
                  <button className="iconbtn" aria-label={`Remove ${d} ${minutesLabel(w.startMin)}`} onClick={() => setWin(i, null)}><Icons.close width={14} height={14} /></button>
                </div>
              ))}
              <div><button className="chip" onClick={() => add(weekday)}><Icons.plus width={12} height={12} /> Add hours</button>{weekday === 0 && mine.length > 0 && <button className="chip" style={{ marginLeft: 6 }} onClick={copyMon}>Same Tue to Fri</button>}</div>
            </div>,
          ];
        })}
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Each booking lasts</div>
        <div className="chips">{SLOT_CHOICES.map((m) => <button key={m} className={`chip ${s.slotMin === m ? "on" : ""}`} aria-pressed={s.slotMin === m} onClick={() => setS({ ...s, slotMin: m })}>{m} min</button>)}</div>
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Clients book at least</div>
        <div className="chips">{NOTICE_CHOICES.map((h) => <button key={h} className={`chip ${s.noticeHours === h ? "on" : ""}`} aria-pressed={s.noticeHours === h} onClick={() => setS({ ...s, noticeHours: h })}>{h} hours ahead</button>)}</div>
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Video calls</div>
        <input className="field" type="url" inputMode="url" maxLength={300} aria-label="Your video call link" placeholder="Your Zoom, Google Meet or Teams link (optional)" value={s.videoLink ?? ""} onChange={(e) => setS({ ...s, videoLink: e.target.value })} />
        <div className="tiny" style={{ marginTop: 6 }}>{videoLinkProblem(s.videoLink ?? "") ?? (s.videoLink?.trim() ? "Every call uses this link." : "Leave it empty and APEX gives each call its own private room on Jitsi, free. Whoever joins first may be asked to sign in to open the room.")}</div>
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Training sessions: free cancels until</div>
        <div className="chips" style={{ flexWrap: "wrap" }}>{CANCEL_CHOICES.map((h) => <button key={h} className={`chip ${(s.cancelHours ?? 24) === h ? "on" : ""}`} aria-pressed={(s.cancelHours ?? 24) === h} onClick={() => setS({ ...s, cancelHours: h })}>{h ? `${hoursText(h)} before` : "Any time"}</button>)}</div>
        <label className="row" style={{ gap: 10, marginTop: 10, alignItems: "flex-start" }}>
          <input type="checkbox" checked={!!s.requireCredits} onChange={(e) => setS({ ...s, requireCredits: e.target.checked })} style={{ marginTop: 3 }} />
          <span className="small">Clients need a session left in a pack to book a training session</span>
        </label>
        <div className="tiny" style={{ marginTop: 6 }}>Clients see: “{policyText({ cancelHours: s.cancelHours ?? 24, requireCredits: !!s.requireCredits })}”</div>
      </div>
      {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
      <button className="btn act block" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save hours and policy"}</button>
    </section>
  );
}

