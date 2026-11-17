import {
  EXPIRY_CHOICES, PACK_CHOICES, sessionNudges, type Nudge, PAID_LABEL, chargeable, credits, creditsText, firstName, formatPrice, newPack, outcomeLabel, packProblem, packTitle, parsePrice, sessionMonth, timeLabel, toMark, whenLabel,
  type Booking, type PackPaidVia, type SessionPack,
} from "@apex/core";
import { Avatar, CreditBalance, Icons, Label, SessionMonthStats, SessionsHero, Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import type { BookingData } from "../../app/BookingParts";
import { useBookingApi } from "../../data/bookings";
import { useGrowApi } from "../../data/grow";
import { useAppInfo } from "../../app/AppContext";
import type { CoachLiveProps } from "../CoachApp";
import { useSendToClient } from "../sendToClient";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Coach: the 1:1 desk. This month's money and attendance, sessions to mark, late cancels to waive, and each client's packs. */
export function SessionsDesk({ data, names, live, say }: { data: BookingData; names: Record<string, string>; live?: CoachLiveProps; say: (m: string) => void }) {
  const api = useBookingApi();
  const grow = useGrowApi();
  const send = useSendToClient(live);
  const { coachName } = useAppInfo();
  const [intro, setIntro] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  useEffect(() => { grow?.offer().then((o) => setIntro(o.introOffer), () => setIntro(false)); }, [grow]);
  const [packFor, setPackFor] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const now = new Date();
  const month = useMemo(() => sessionMonth(data.packs, data.history, now.toISOString().slice(0, 7)), [data.packs, data.history]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!api) return null;
  if (!data.sessionsReady) return <div className="card small full">Session packs and the register need a quick database update. Run the sessions SQL in Supabase, then reload.</div>;
  const name = (id: string) => names[id] ?? "Client";
  const marks = toMark(data.history, now);
  const charges = chargeable(data.history).slice(0, 12);
  const ids = [...new Set([...Object.keys(names), ...data.packs.map((p) => p.clientId)])];
  const act = async (fn: () => Promise<void>, done: string) => {
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await data.reload();
  };
  const nudges = sessionNudges(ids.map((id) => {
    const packs = data.packs.filter((p) => p.clientId === id);
    const hist = data.history.filter((b) => b.clientId === id);
    return { id, name: name(id), credits: credits(packs, hist, now), bookings: hist, hasPacks: packs.length > 0 };
  }), firstName(coachName) || coachName, now).filter((n) => !sent[n.clientId]);

  return (
    <>
      <div className="full"><SessionsHero title="Sessions" caption={`${now.toLocaleDateString("en-GB", { month: "long" })} · packs and register`} /></div>
      <section className="full stack"><SessionMonthStats month={month} /></section>

      {marks.length > 0 && (
        <section className="full card">
          <div className="sect"><h2 className="h3">Did they come?</h2><span className="tiny">{marks.length} to mark</span></div>
          {marks.map((b, i) => (
            <div key={b.id} className="ss-row" style={{ ["--i" as string]: i }}>
              <span className="ss-when">{day(b.startsAt)}<br />{timeLabel(b.startsAt)}</span>
              <div className="grow"><div className="h3">{name(b.clientId)}</div></div>
              <div className="ss-acts">
                <button className="btn act sm" onClick={() => void act(() => api.mark(b.id, "attended"), `${firstName(name(b.clientId))} · attended`)}>Came</button>
                <button className="btn ghost sm" onClick={() => void act(() => api.mark(b.id, "no_show"), `${firstName(name(b.clientId))} · no-show, uses a session`)}>No-show</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {charges.length > 0 && (
        <section className="full card">
          <div className="sect"><h2 className="h3">Late cancels and no-shows</h2><Label kind="dec">Coach decision</Label></div>
          <p className="tiny" style={{ margin: "0 0 4px" }}>Each one uses a session. Waive it to give the session back.</p>
          {charges.map((b, i) => (
            <div key={b.id} className="ss-row" style={{ ["--i" as string]: i }}>
              <span className="ss-when">{day(b.startsAt)}<br />{timeLabel(b.startsAt)}</span>
              <div className="grow"><div className="h3">{name(b.clientId)}</div><span className="ss-tag warn">{outcomeLabel(b)}</span></div>
              <button className="btn ghost sm" onClick={() => void act(() => api.waive(b.id, true), "Waived · session given back")}>Waive</button>
            </div>
          ))}
        </section>
      )}

      {nudges.length > 0 && (
        <section className="full card" aria-label="Keep them training">
          <div className="sect"><h2 className="h3">Keep them training</h2><Label kind="insight">Insight</Label></div>
          {nudges.map((n, i) => <NudgeRow key={n.clientId} n={n} i={i} send={async (body) => { await send(n.clientId, body); setSent((s) => ({ ...s, [n.clientId]: true })); say(`Sent to ${firstName(n.name)}`); }} />)}
        </section>
      )}

      <section className="full card">
        <div className="sect"><h2 className="h3">Clients and their sessions</h2><span className="tiny">Tap for packs</span></div>
        {ids.length === 0 && <div className="small">No clients yet.</div>}
        {ids.map((id, i) => {
          const packs = data.packs.filter((p) => p.clientId === id);
          const hist = data.history.filter((b) => b.clientId === id);
          const c = credits(packs, hist, now);
          const isOpen = open === id;
          return (
            <div key={id} style={{ ["--i" as string]: i }} className="ss-row" role="group" aria-label={name(id)}>
              <div className="grow stack" style={{ gap: 8 }}>
                <button className="row" style={{ gap: 10, background: "none", border: 0, padding: 0, color: "inherit", textAlign: "left", width: "100%" }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
                  <Avatar initials={initials(name(id))} size={34} />
                  <span className="grow"><span className="h3" style={{ display: "block" }}>{name(id)}</span><span className="tiny">{packs.length ? creditsText(c) : "No packs yet"}</span></span>
                  {c.owed > 0 && <span className="ss-tag warn">Owes {c.owed}</span>}
                  {!c.owed && c.left > 0 && c.left <= 2 && <span className="ss-tag">Running low</span>}
                </button>
                {isOpen && (
                  <div className="stack" style={{ gap: 8 }}>
                    <CreditBalance credits={c} caption={`${c.used} used so far${c.lapsed ? ` · ${c.lapsed} expired unused` : ""}`} />
                    {packs.slice().reverse().map((p) => <PackRow key={p.id} p={p} onRemove={() => void act(() => api.removePack(p.id), "Pack removed")} />)}
                    <SessionHistory list={hist} />
                    {intro && !packs.some((p) => p.source === "intro") && !hist.some((b) => b.attendance === "attended") && (
                      <button className="btn ghost block" onClick={() => void act(() => api.addPack(newPack(id, 1, 0, "free", 0, "First session free", "intro")), `${firstName(name(id))} has their free first session`)}><Icons.gift width={15} height={15} /> Give the free first session</button>
                    )}
                    <button className="btn act block" onClick={() => setPackFor(id)}>Add a pack for {firstName(name(id))}</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {packFor && <PackSheet first={firstName(name(packFor))} onClose={() => setPackFor(null)} onSave={async (p) => { await act(() => api.addPack({ ...p, clientId: packFor }), `${packTitle(p)} added for ${firstName(name(packFor))}`); setPackFor(null); }} />}
    </>
  );
}

const NUDGE_TAG: Record<Nudge["kind"], string> = { owed: "To pay", renew: "Renew", book: "Not booked" };

/** A ready-to-edit message for a client whose pack is running out, who owes sessions, or who has stopped booking. */
function NudgeRow({ n, i, send }: { n: Nudge; i: number; send: (body: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(n.message);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await send(body.trim()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <div className="ss-row" style={{ ["--i" as string]: i, flexWrap: "wrap" }}>
      <Avatar initials={initials(n.name)} size={32} tone={n.kind === "owed" ? "var(--crit)" : n.kind === "renew" ? "var(--warn)" : undefined} />
      <div className="grow"><div className="h3">{n.name}</div><div className="tiny">{n.why}</div></div>
      <span className={`ss-tag${n.kind === "book" ? "" : " warn"}`}>{NUDGE_TAG[n.kind]}</span>
      <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Message"}</button>
      {open && (
        <div className="stack" style={{ gap: 8, width: "100%" }}>
          <div className="row" style={{ gap: 8 }}><Label kind="ai">AI suggestion</Label><span className="tiny">A rule-based draft. Edit it, then send.</span></div>
          <textarea className="field" rows={3} maxLength={4000} aria-label={`Message to ${firstName(n.name)}`} value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
          <button className="btn act sm" disabled={busy || !body.trim()} onClick={() => void go()}>{busy ? "Sending…" : `Send to ${firstName(n.name)}`}</button>
        </div>
      )}
    </div>
  );
}

function PackRow({ p, onRemove }: { p: SessionPack; onRemove: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <div className="li" style={{ padding: "8px 0" }}>
      <div className="grow"><div className="small" style={{ fontWeight: 600, color: "var(--text)" }}>{packTitle(p)}</div><div className="tiny">{day(p.boughtAt)} · {PAID_LABEL[p.paidVia]}{p.expiresAt ? ` · expires ${day(p.expiresAt)}` : ""}{p.note ? ` · ${p.note}` : ""}</div></div>
      {sure ? <button className="btn ghost sm" style={{ color: "var(--crit)" }} onClick={onRemove}>Remove</button> : <button className="iconbtn" onClick={() => setSure(true)} aria-label="Remove this pack">Remove</button>}
    </div>
  );
}

function SessionHistory({ list }: { list: Booking[] }) {
  const past = list.filter((b) => b.status === "cancelled" || b.attendance || Date.parse(b.endsAt) < Date.now()).slice(-6).reverse();
  if (!past.length) return null;
  return (
    <div>
      <div className="tiny" style={{ margin: "4px 0" }}>Recent sessions</div>
      {past.map((b) => <div key={b.id} className="row tiny" style={{ justifyContent: "space-between", padding: "3px 0" }}><span>{whenLabel(b.startsAt)}</span><span>{outcomeLabel(b)}</span></div>)}
    </div>
  );
}

/** Record a pack the client paid for (cash, bank transfer or card) or a gift. */
function PackSheet({ first, onClose, onSave }: { first: string; onClose: () => void; onSave: (p: SessionPack) => Promise<void> }) {
  const [sessions, setSessions] = useState(10);
  const [price, setPrice] = useState("");
  const [via, setVia] = useState<PackPaidVia>("bank");
  const [months, setMonths] = useState(3);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pence = parsePrice(price);
  const problem = packProblem(sessions, pence);
  const save = async () => {
    if (problem || pence === null) return;
    setBusy(true);
    await onSave(newPack("", sessions, pence, via, months, note));
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label={`Add a pack for ${first}`}>
      <div className="row" style={{ gap: 8 }}><Label kind="dec">Coach decision</Label><span className="tiny">{first} sees their sessions left in the app</span></div>
      <h2 className="h2">Add a pack for {first}</h2>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Sessions</div>
        <div className="chips">{PACK_CHOICES.map((n) => <button key={n} className={`chip ${sessions === n ? "on" : ""}`} aria-pressed={sessions === n} onClick={() => setSessions(n)}>{n}</button>)}
          <input className="field num" style={{ width: 80 }} type="number" min={1} max={100} inputMode="numeric" aria-label="Other number of sessions" value={sessions} onChange={(e) => setSessions(Number(e.target.value))} /></div>
      </div>
      <label className="stack" style={{ gap: 6 }}>
        <span className="tiny">Price paid</span>
        <input className="field num" inputMode="decimal" placeholder="e.g. 400 (empty = free)" value={price} onChange={(e) => setPrice(e.target.value)} />
        {pence ? <span className="tiny">{formatPrice(Math.round(pence / sessions))} a session</span> : null}
      </label>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Paid by</div>
        <div className="chips">{(["bank", "cash", "card"] as const).map((v) => <button key={v} className={`chip ${via === v ? "on" : ""}`} aria-pressed={via === v} onClick={() => setVia(v)}>{PAID_LABEL[v]}</button>)}</div>
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Unused sessions expire</div>
        <div className="chips">{EXPIRY_CHOICES.map((m) => <button key={m} className={`chip ${months === m ? "on" : ""}`} aria-pressed={months === m} onClick={() => setMonths(m)}>{m ? `${m} month${m === 1 ? "" : "s"}` : "Never"}</button>)}</div>
      </div>
      <input className="field" maxLength={200} placeholder="Note (optional), e.g. paid on 4 Nov" value={note} onChange={(e) => setNote(e.target.value)} />
      {problem && price.trim() !== "" && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{problem}</div>}
      <button className="btn act block" disabled={!!problem || busy} onClick={() => void save()}>{busy ? "Saving…" : `Add ${sessions} session${sessions === 1 ? "" : "s"}${pence ? ` · ${formatPrice(pence)}` : ""}`}</button>
      <p className="tiny" style={{ margin: 0 }}>Card payments through the app arrive with Stripe. Until then, record what {first} paid you here.</p>
    </Sheet>
  );
}
