import {
  EXPIRY_CHOICES, LOG_MINUTES, PACK_CHOICES, logSessionProblem, loggedSession, sessionNudges, type Nudge, PAID_LABEL, chargeable, credits, creditsText, firstName, formatPrice, newPack, outcomeLabel, packProblem, packTitle, parsePrice, sessionMonth, timeLabel, toMark, whenLabel,
  type Booking, type PackPaidVia, type SessionPack,
} from "@apex/core";
import { Avatar, CreditBalance, Icons, Label, SessionMonthStats, SessionsHero, Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useBookings, type BookingData } from "../../app/BookingParts";
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
  const [logFor, setLogFor] = useState<string | null>(null);
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
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn act grow" onClick={() => setPackFor(id)}>Add a pack</button>
                      <button className="btn ghost grow" onClick={() => setLogFor(id)}>Log a session</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {packFor && <PackSheet first={firstName(name(packFor))} onClose={() => setPackFor(null)} onSave={async (p) => { await act(() => api.addPack({ ...p, clientId: packFor }), `${packTitle(p)} added for ${firstName(name(packFor))}`); setPackFor(null); }} />}
      {logFor && <LogSheet first={firstName(name(logFor))} left={credits(data.packs.filter((p) => p.clientId === logFor), data.history.filter((b) => b.clientId === logFor), now).left} onClose={() => setLogFor(null)} onSave={async (at, minutes, note) => { const ok = await logSession(api, loggedSession(logFor, at, minutes, note), say, firstName(name(logFor))); await data.reload(); if (ok) setLogFor(null); }} />}
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

export function PackRow({ p, onRemove }: { p: SessionPack; onRemove: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <div className="li" style={{ padding: "8px 0" }}>
      <div className="grow"><div className="small" style={{ fontWeight: 600, color: "var(--text)" }}>{packTitle(p)}</div><div className="tiny">{day(p.boughtAt)} · {PAID_LABEL[p.paidVia]}{p.expiresAt ? ` · expires ${day(p.expiresAt)}` : ""}{p.note ? ` · ${p.note}` : ""}</div></div>
      {sure ? <button className="btn ghost sm" style={{ color: "var(--crit)" }} onClick={onRemove}>Remove</button> : <button className="iconbtn" onClick={() => setSure(true)} aria-label="Remove this pack">Remove</button>}
    </div>
  );
}

export function SessionHistory({ list }: { list: Booking[] }) {
  const past = list.filter((b) => b.status === "cancelled" || b.attendance || Date.parse(b.endsAt) < Date.now()).sort((x, y) => Date.parse(y.startsAt) - Date.parse(x.startsAt)).slice(0, 6);
  if (!past.length) return null;
  return (
    <div>
      <div className="tiny" style={{ margin: "4px 0" }}>Recent sessions</div>
      {past.map((b) => <div key={b.id} className="row tiny" style={{ justifyContent: "space-between", padding: "3px 0" }}><span>{whenLabel(b.startsAt)}</span><span>{outcomeLabel(b)}</span></div>)}
    </div>
  );
}

/** Record a pack the client paid for (cash, bank transfer or card) or a gift. */
export function PackSheet({ first, onClose, onSave }: { first: string; onClose: () => void; onSave: (p: SessionPack) => Promise<void> }) {
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

type BookingApiOf = NonNullable<ReturnType<typeof useBookingApi>>;

/** Saves a session that already happened: booked, then marked as attended, so it uses one credit. */
async function logSession(api: BookingApiOf, b: Booking, say: (m: string) => void, first: string): Promise<boolean> {
  try {
    await api.book(b);
    await api.mark(b.id, "attended");
    say(`Session logged for ${first} · ${whenLabel(b.startsAt)}`);
    return true;
  } catch (e) {
    say(e instanceof Error ? e.message : String(e));
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Log a session that happened outside the app's calendar (arranged by text, paid in cash). It uses one session from the client's packs. */
export function LogSheet({ first, left, onClose, onSave }: { first: string; left: number; onClose: () => void; onSave: (startsAt: string, minutes: number, note: string) => Promise<void> }) {
  const now = new Date();
  const [dayValue, setDay] = useState(localDay(now));
  const [time, setTime] = useState(`${pad(now.getMinutes() >= 30 ? now.getHours() : Math.max(0, now.getHours() - 1))}:${now.getMinutes() >= 30 ? "00" : "30"}`);
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const at = new Date(`${dayValue}T${time || "00:00"}`);
  const startsAt = Number.isFinite(at.getTime()) ? at.toISOString() : "";
  const problem = logSessionProblem(startsAt, now);
  const save = async () => {
    if (problem) return;
    setBusy(true);
    await onSave(startsAt, minutes, note);
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label={`Log a session for ${first}`}>
      <div className="row" style={{ gap: 8 }}><Label kind="dec">Coach decision</Label><span className="tiny">For sessions you arranged outside the app</span></div>
      <h2 className="h2">Log a session for {first}</h2>
      <div className="row" style={{ gap: 8 }}>
        <label className="stack grow" style={{ gap: 6 }}><span className="tiny">Day</span><input className="field" type="date" max={localDay(now)} value={dayValue} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="stack grow" style={{ gap: 6 }}><span className="tiny">Start</span><input className="field" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <div>
        <div className="tiny" style={{ marginBottom: 6 }}>Length</div>
        <div className="chips">{LOG_MINUTES.map((m) => <button key={m} className={`chip ${minutes === m ? "on" : ""}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>)}</div>
      </div>
      <input className="field" maxLength={200} placeholder="Note (optional), e.g. park session, paid cash" value={note} onChange={(e) => setNote(e.target.value)} />
      {problem && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{problem}</div>}
      <button className="btn act block" disabled={!!problem || busy} onClick={() => void save()}>{busy ? "Saving…" : "Log it as attended"}</button>
      <p className="tiny" style={{ margin: 0 }}>{left > 0 ? `Uses 1 of ${first}'s ${left} session${left === 1 ? "" : "s"} left.` : `${first} has no sessions left, so this shows as owed until you add a pack.`} It counts in your register and this month's numbers.</p>
    </Sheet>
  );
}

/** One client's sessions on their profile: what's left, packs they paid for (in or outside the app), recent sessions, and the two jobs a 1:1 coach does most. */
export function ClientSessions({ clientId, name, say }: { clientId: string; name: string; say: (m: string) => void }) {
  const api = useBookingApi();
  const data = useBookings(api);
  const [sheet, setSheet] = useState<"pack" | "log" | null>(null);
  const first = firstName(name) || name;
  if (!api) return null;
  if (data.status === "loading") return <div className="card small">Loading…</div>;
  if (data.status !== "ready" || !data.sessionsReady) return <div className="card small">Session packs need a quick database update. Run the sessions SQL in Supabase, then reload.</div>;
  const now = new Date();
  const packs = data.packs.filter((p) => p.clientId === clientId);
  const hist = data.history.filter((b) => b.clientId === clientId);
  const c = credits(packs, hist, now);
  const act = async (fn: () => Promise<void>, done: string) => {
    try { await fn(); say(done); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await data.reload();
  };
  return (
    <section className="card stack" style={{ gap: 12 }} aria-label={`${first}'s sessions`}>
      <div className="sect"><h2 className="h3">Sessions</h2>{c.owed > 0 ? <span className="ss-tag warn">Owes {c.owed}</span> : !c.owed && c.left > 0 && c.left <= 2 ? <span className="ss-tag">Running low</span> : <Label kind="data">Data</Label>}</div>
      {packs.length ? <CreditBalance credits={c} caption={`${c.used} used so far${c.lapsed ? ` · ${c.lapsed} expired unused` : ""}`} /> : <p className="small" style={{ margin: 0 }}>No sessions recorded for {first} yet. Paid you by bank transfer or cash? Add the pack here and every session comes off it as you mark the register.</p>}
      {packs.slice().reverse().map((p) => <PackRow key={p.id} p={p} onRemove={() => void act(() => api.removePack(p.id), "Pack removed")} />)}
      <SessionHistory list={hist} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn act grow" onClick={() => setSheet("pack")}>Add a pack</button>
        <button className="btn ghost grow" onClick={() => setSheet("log")}>Log a session</button>
      </div>
      <p className="tiny" style={{ margin: 0 }}>{first} sees their sessions left in the app. Works for online and in-person clients.</p>
      {sheet === "pack" && <PackSheet first={first} onClose={() => setSheet(null)} onSave={async (p) => { await act(() => api.addPack({ ...p, clientId }), `${packTitle(p)} added for ${first}`); setSheet(null); }} />}
      {sheet === "log" && <LogSheet first={first} left={c.left} onClose={() => setSheet(null)} onSave={async (at, minutes, note) => { const ok = await logSession(api, loggedSession(clientId, at, minutes, note), say, first); await data.reload(); if (ok) setSheet(null); }} />}
    </section>
  );
}
