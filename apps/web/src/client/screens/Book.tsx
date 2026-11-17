import { callLink, canBookSession, menuFor, serviceCard, type Service, canMove, cancelWarning, credits, expiryText, kindTitle, newBooking, policyOf, policyText, timeLabel, upcomingBookings, weeklyStarts, whenLabel, type BookingKind } from "@apex/core";
import { CreditBalance, Icons, ServiceMenu } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { AddToCalendar, BookingStatus, JoinCall, KindChips, MovePicker, RepeatChips, SlotPicker, useBookings, type BookingData } from "../../app/BookingParts";
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
  const [weeks, setWeeks] = useState(1);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [menu, setMenu] = useState<Service[]>([]);
  const [svcId, setSvcId] = useState<string | null>(null);
  useEffect(() => {
    if (!api) return;
    let on = true;
    api.services().then((r) => { if (on) setMenu(menuFor(r.list, "client")); }, () => undefined);
    return () => { on = false; };
  }, [api]);
  if (!api) return null;
  // With a service menu the service sets the kind and the length; without one, the client picks call or session.
  const service = menu.find((x) => x.id === svcId) ?? null;
  const pickService = (id: string) => { const sv = menu.find((x) => x.id === id); setSvcId(id); setSlot(null); if (sv) setKind(sv.kind); };
  const now = new Date();
  const mine = upcomingBookings(data.bookings.filter((b) => b.clientId === api.me), now);
  const settings = data.settings;
  const policy = policyOf(settings);
  const bal = credits(data.packs, data.history.filter((b) => b.clientId === api.me), now);
  const hasPacks = data.packs.length > 0;
  const blocked = kind === "session" && !canBookSession(policy, bal);

  const book = async () => {
    if (!slot || !settings) return;
    setBusy(true);
    setError(null);
    try {
      const { starts, skipped } = weeklyStarts(slot, kind === "session" ? weeks : 1, data.busy);
      const repeatId = starts.length > 1 ? crypto.randomUUID() : null;
      const all = starts.map((at) => ({ ...newBooking(api.me, at, service?.minutes ?? settings.slotMin, kind, note, new Date(), service?.id), repeatId }));
      const b = all[0]!;
      await (all.length > 1 ? api.bookMany(all) : api.book(b));
      const link = callLink(b, settings);
      const more = all.length > 1 ? `, then the same time weekly for ${all.length - 1} more week${all.length === 2 ? "" : "s"}` : "";
      store.sendMessage("client", `Booked ${service ? service.name : `a ${kindTitle(kind).toLowerCase()}`} for ${whenLabel(slot)}${more}${b.note ? `. ${b.note}` : ""}${link ? `. Video link: ${link}` : ""}`);
      setSlot(null);
      setNote("");
      setWeeks(1);
      say(`Booked · ${whenLabel(slot)}${more ? ` +${all.length - 1} weeks` : ""}${skipped.length ? ` · ${skipped.length} taken, skipped` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
    setBusy(false);
  };
  const cancel = async (id: string) => {
    const b = mine.find((x) => x.id === id);
    if (b && cancelWarning(b, new Date(), policy) && confirm !== id) return setConfirm(id);
    setConfirm(null);
    const late = !!b && !!cancelWarning(b, new Date(), policy);
    try {
      await api.cancel(id);
      if (b) store.sendMessage("client", `Cancelled my ${kindTitle(b.kind).toLowerCase()} on ${whenLabel(b.startsAt)}${late ? " (late cancel)" : ""}`);
      say(`Cancelled · ${coachName} has been told`);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  const move = async (id: string, startsAt: string) => {
    const b = mine.find((x) => x.id === id);
    try {
      await api.move(id, startsAt);
      if (b) store.sendMessage("client", `Moved my ${kindTitle(b.kind).toLowerCase()} from ${whenLabel(b.startsAt)} to ${whenLabel(startsAt)}`);
      setMoving(null);
      say(`Moved · ${coachName} has been told`);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await data.reload();
  };

  return (
    <>
      <div><div className="eyebrow">Book</div><h1 className="h1">Time with {coachName}</h1></div>
      <BookingStatus data={data} />
      {data.status === "ready" && (hasPacks || policy.requireCredits) && <CreditBalance credits={bal} caption={hasPacks ? `${bal.owed ? `Pay ${coachName} for ${bal.owed === 1 ? "it" : "them"} with your next pack.` : expiryText(bal)} Each training session uses one.`.trim() : `Ask ${coachName} for a pack of sessions.`} />}
      {mine.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Booked</h2></div>
          <div className="card flat list">
            {mine.map((b) => (
              <div key={b.id} className="li" style={{ flexWrap: "wrap" }}>
                <span className="hb-ico" aria-hidden>{b.kind === "call" ? <Icons.chat /> : <Icons.train />}</span>
                <div className="grow"><div className="h3">{whenLabel(b.startsAt)}</div><div className="tiny">{kindTitle(b.kind)} · until {timeLabel(b.endsAt)}{b.note ? ` · ${b.note}` : ""}</div></div>
                <div className="row" style={{ gap: 6, flex: "1 0 100%", justifyContent: "flex-end" }}>
                  <JoinCall booking={b} settings={settings} />
                  <AddToCalendar booking={b} settings={settings} withName={coachName} />
                  {settings && canMove(b, now, policy) && <button className="iconbtn" aria-expanded={moving === b.id} onClick={() => { setMoving(moving === b.id ? null : b.id); setConfirm(null); }}>Move</button>}
                  <button className="iconbtn" onClick={() => { setMoving(null); void cancel(b.id); }}>Cancel</button>
                </div>
                {moving === b.id && settings && <MovePicker booking={b} settings={settings} busy={data.busy} onMove={(at) => move(b.id, at)} onClose={() => setMoving(null)} />}
                {confirm === b.id && (
                  <div className="ss-warn stack" role="alert" style={{ gap: 8, flexBasis: "100%" }}>
                    <span>{cancelWarning(b, now, policy)}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn ghost sm" onClick={() => setConfirm(null)}>Keep it</button>
                      <button className="btn act sm" onClick={() => void cancel(b.id)}>Cancel anyway</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {data.status === "ready" && settings && (settings.windows.length === 0 ? (
        <div className="card small">{coachName} hasn't opened any times for booking yet. Send a message to arrange a time.</div>
      ) : (
        <BookForm data={data} kind={kind} setKind={setKind} slot={slot} setSlot={setSlot} menu={menu} service={service} onService={pickService}>
          {kind === "session" && <RepeatChips weeks={weeks} onChange={setWeeks} />}
          <input className="field" maxLength={500} placeholder={`What would you like to cover? (optional)`} value={note} onChange={(e) => setNote(e.target.value)} />
          {kind === "session" && <div className="ss-policy"><Icons.info width={14} height={14} /><span>{policyText(policy)}</span></div>}
          {blocked && <div className="ss-warn">You have no sessions left. Ask {coachName} for a new pack, then book.</div>}
          {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
          <button className="btn act block" disabled={!slot || busy || blocked || (menu.length > 0 && !service)} onClick={() => void book()}>{slot ? `Book ${whenLabel(slot)}${kind === "session" && weeks > 1 ? ` · ${weeks} weeks` : ""}` : "Pick a time"}</button>
        </BookForm>
      ))}
    </>
  );
}

function BookForm({ data, kind, setKind, slot, setSlot, menu, service, onService, children }: {
  data: BookingData; kind: BookingKind; setKind: (k: BookingKind) => void; slot: string | null; setSlot: (s: string | null) => void;
  menu: Service[]; service: Service | null; onService: (id: string) => void; children: React.ReactNode;
}) {
  if (!data.settings) return null;
  const withMenu = menu.length > 0;
  return (
    <section className="card stack">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{withMenu ? "What would you like?" : "Book a time"}</h3><span className="tiny">{withMenu ? (service ? `${service.minutes} minutes` : "Pick a service") : `${data.settings.slotMin} minutes`}</span></div>
      {withMenu ? <ServiceMenu services={menu.map(serviceCard)} value={service?.id ?? null} onChange={onService} /> : <KindChips value={kind} onChange={setKind} />}
      {kind === "call" && (!withMenu || service) && <div className="tiny"><Icons.video width={12} height={12} style={{ verticalAlign: -2 }} /> You'll get a video link to join from here when it's time.</div>}
      {(!withMenu || service) && <SlotPicker key={service?.id ?? "any"} settings={data.settings} busy={data.busy} value={slot} onChange={setSlot} lengthMin={service?.minutes} />}
      {children}
    </section>
  );
}
