import { callLink, kindTitle, newBooking, timeLabel, upcomingBookings, whenLabel, type BookingKind } from "@apex/core";
import { Icons } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { BookingStatus, JoinCall, KindChips, SlotPicker, useBookings, type BookingData } from "../../app/BookingParts";
import { useBookingApi } from "../../data/bookings";
import { useStore } from "../../data/StoreContext";

/** Client: book a call or a session with the coach, and see or cancel what's booked. */
export function Book({ say }: { say: (m: string) => void }) {
  const api = useBookingApi();
  const data = useBookings(api);
  const { coachName } = useAppInfo();
  const store = useStore();
  const [kind, setKind] = useState<BookingKind>("call");
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!api) return null;
  const mine = upcomingBookings(data.bookings.filter((b) => b.clientId === api.me), new Date());
  const settings = data.settings;

  const book = async () => {
    if (!slot || !settings) return;
    setBusy(true);
    setError(null);
    try {
      const b = newBooking(api.me, slot, settings.slotMin, kind, note);
      await api.book(b);
      const link = callLink(b, settings);
      store.sendMessage("client", `Booked a ${kindTitle(kind).toLowerCase()} for ${whenLabel(slot)}${b.note ? `. ${b.note}` : ""}${link ? `. Video link: ${link}` : ""}`);
      setSlot(null);
      setNote("");
      say(`Booked · ${whenLabel(slot)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
    setBusy(false);
  };
  const cancel = async (id: string) => {
    const b = mine.find((x) => x.id === id);
    try {
      await api.cancel(id);
      if (b) store.sendMessage("client", `Cancelled my ${kindTitle(b.kind).toLowerCase()} on ${whenLabel(b.startsAt)}`);
      say(`Cancelled · ${coachName} has been told`);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  return (
    <>
      <div><div className="eyebrow">Book</div><h1 className="h1">Time with {coachName}</h1></div>
      <BookingStatus data={data} />
      {mine.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Booked</h2></div>
          <div className="card flat list">
            {mine.map((b) => (
              <div key={b.id} className="li">
                <span className="hb-ico" aria-hidden>{b.kind === "call" ? <Icons.chat /> : <Icons.train />}</span>
                <div className="grow"><div className="h3">{whenLabel(b.startsAt)}</div><div className="tiny">{kindTitle(b.kind)} · until {timeLabel(b.endsAt)}{b.note ? ` · ${b.note}` : ""}</div></div>
                <div className="row" style={{ gap: 6, flex: "none" }}>
                  <JoinCall booking={b} settings={settings} />
                  <button className="iconbtn" onClick={() => void cancel(b.id)}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.status === "ready" && settings && (settings.windows.length === 0 ? (
        <div className="card small">{coachName} hasn't opened any times for booking yet. Send a message to arrange a time.</div>
      ) : (
        <BookForm data={data} kind={kind} setKind={setKind} slot={slot} setSlot={setSlot}>
          <input className="field" maxLength={500} placeholder={`What would you like to cover? (optional)`} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
          <button className="btn act block" disabled={!slot || busy} onClick={() => void book()}>{slot ? `Book ${whenLabel(slot)}` : "Pick a time"}</button>
        </BookForm>
      ))}
    </>
  );
}

function BookForm({ data, kind, setKind, slot, setSlot, children }: { data: BookingData; kind: BookingKind; setKind: (k: BookingKind) => void; slot: string | null; setSlot: (s: string | null) => void; children: React.ReactNode }) {
  if (!data.settings) return null;
  return (
    <section className="card stack">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Book a time</h3><span className="tiny">{data.settings.slotMin} minutes</span></div>
      <KindChips value={kind} onChange={setKind} />
      {kind === "call" && <div className="tiny"><Icons.video width={12} height={12} style={{ verticalAlign: -2 }} /> You'll get a video link to join from here when it's time.</div>}
      <SlotPicker settings={data.settings} busy={data.busy} value={slot} onChange={setSlot} />
      {children}
    </section>
  );
}
