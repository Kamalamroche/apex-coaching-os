import {
  COVER_CHOICES, FEE_PAID_LABEL, addMonthKey, coverPayments, feeMonth, feeReminder, firstName, formatPrice, monthKey, monthName, packTitle, packsToPay, paidUntil, paidUntilText, parsePounds, pounds,
  type BizClient, type FeePaidVia, type FeePayment,
} from "@apex/core";
import { Avatar, Label } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useBookings } from "../../app/BookingParts";
import { useBookingApi } from "../../data/bookings";
import { demoFees, liveFees } from "../../data/fees";
import type { CoachLiveProps } from "../CoachApp";
import { clientNames, useSendToClient } from "../sendToClient";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const VIAS: FeePaidVia[] = ["bank", "cash", "card"];

/**
 * Business: money paid outside the app that the coach still has to collect. This month's fees (tick each client off
 * once they've paid) and session packs agreed but not paid yet. Nothing here moves money: it's the coach's own record.
 */
export function MoneyOwed({ clients, live, say }: { clients: BizClient[]; live?: CoachLiveProps; say: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const api = useMemo(() => (live ? liveFees(live.db, live.coachId) : demoFees()), [live?.db, live?.coachId]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookingApi = useBookingApi();
  const bookings = useBookings(bookingApi);
  const send = useSendToClient(live);
  const month = monthKey(new Date());
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [ready, setReady] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [reminded, setReminded] = useState<Record<string, boolean>>({});
  const reload = useCallback(async () => {
    try { const r = await api.load(month); setPayments(r.list); setReady(r.ready); } catch (e) { console.error("Couldn't load fee payments", e); }
  }, [api, month]);
  useEffect(() => { void reload(); }, [reload]);

  const m = feeMonth(clients.map((c) => ({ id: c.id, name: c.name, feePence: c.feePence, status: c.status })), payments, month);
  const owedPacks = bookings.status === "ready" ? packsToPay(bookings.packs) : { packs: [], totalPence: 0 };
  const names = clientNames(live);
  const coachFirst = firstName(coachName) || coachName;
  if (!m.due.length && !owedPacks.packs.length) return null;

  const markPaid = async (c: { id: string; name: string }, months: number, totalPence: number, via: FeePaidVia) => {
    const rows = coverPayments(c.id, month, months, totalPence, via, payments.filter((p) => p.clientId === c.id).map((p) => p.month));
    try { await api.markPaid(rows); say(`${firstName(c.name)} · ${months > 1 ? `${months} months paid` : `${monthName(month)} paid`}`); setOpen(null); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await reload();
  };
  // Undo takes back the whole payment: every month it covered.
  const undo = async (p: FeePayment, name: string) => {
    const same = payments.filter((x) => x.clientId === p.clientId && x.paidAt === p.paidAt);
    try { for (const x of same) await api.unmark(x.id); say(`${firstName(name)} · back to still to pay`); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await reload();
  };
  const remind = async (id: string, name: string, text: string) => {
    try { await send(id, text); setReminded((r) => ({ ...r, [id]: true })); say(`Reminder sent to ${firstName(name)}`); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };
  const packPaid = async (id: string, name: string) => {
    if (!bookingApi) return;
    try { await bookingApi.markPackPaid(id); say(`${firstName(name)} · pack paid`); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    await bookings.reload();
  };
  const totalOwed = m.toCollectPence + owedPacks.totalPence;

  return (
    <section className="card full" aria-label="Money to collect">
      <div className="sect"><h3 className="h3">Money to collect</h3><Label kind="dec">Coach decision</Label></div>
      <p className="tiny" style={{ margin: "0 0 6px" }}>
        {totalOwed ? `${pounds(totalOwed)} still to come in. ` : "Everyone has paid. "}
        For money paid outside the app: bank transfer, direct debit, cash or a card machine. Tick it off when it lands, or record a membership paid for several months.
      </p>
      {!ready && <div className="small" style={{ color: "var(--warn)", marginBottom: 6 }}>Run the money SQL in Supabase to tick off monthly fees.</div>}

      {m.due.length > 0 && ready && (
        <>
          <div className="row" style={{ justifyContent: "space-between", margin: "8px 0 2px" }}>
            <b className="small" style={{ color: "var(--text)" }}>{monthName(month)} fees</b>
            <span className="tiny">{m.paid.length} of {m.due.length} paid · {pounds(m.paidPence)}</span>
          </div>
          {m.toCollect.map((c) => (
            <div key={c.id} className="ss-row" style={{ flexWrap: "wrap" }}>
              <Avatar initials={initials(c.name)} size={32} />
              <div className="grow"><div className="h3">{c.name}</div><div className="tiny">{pounds(c.feePence)} due</div></div>
              <button className="btn ghost sm" disabled={reminded[c.id]} onClick={() => void remind(c.id, c.name, feeReminder(firstName(c.name), coachFirst, month, pounds(c.feePence)))}>{reminded[c.id] ? "Reminded" : "Remind"}</button>
              <button className="btn act sm" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>Paid</button>
              {open === c.id && <PayPanel first={firstName(c.name)} feePence={c.feePence} month={month} onSave={(months, total, via) => markPaid(c, months, total, via)} />}
            </div>
          ))}
          {m.paid.map(({ client, payment }) => (
            <div key={client.id} className="ss-row">
              <Avatar initials={initials(client.name)} size={32} />
              <div className="grow"><div className="h3">{client.name}</div><div className="tiny">{paidUntilText(paidUntil(payments, client.id, month) ?? month, month)} · {FEE_PAID_LABEL[payment.paidVia]}{payment.note ? ` · ${payment.note}` : ""}</div></div>
              <span className="ss-tag good">Paid</span>
              <button className="iconbtn" onClick={() => void undo(payment, client.name)} aria-label={`Undo ${client.name}'s payment`}>Undo</button>
            </div>
          ))}
        </>
      )}

      {owedPacks.packs.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: "space-between", margin: "12px 0 2px" }}>
            <b className="small" style={{ color: "var(--text)" }}>Session packs to pay</b>
            <span className="tiny">{formatPrice(owedPacks.totalPence)}</span>
          </div>
          {owedPacks.packs.map((p) => {
            const name = names[p.clientId] ?? "Client";
            return (
              <div key={p.id} className="ss-row">
                <Avatar initials={initials(name)} size={32} />
                <div className="grow"><div className="h3">{name}</div><div className="tiny">{packTitle(p)} · agreed {new Date(p.boughtAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div></div>
                <button className="btn act sm" onClick={() => void packPaid(p.id, name)}>Mark paid</button>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

/** Record a payment: this month only, or a membership paid up front for several months. */
function PayPanel({ first, feePence, month, onSave }: { first: string; feePence: number; month: string; onSave: (months: number, totalPence: number, via: FeePaidVia) => Promise<void> }) {
  const [months, setMonths] = useState(1);
  const [via, setVia] = useState<FeePaidVia>("bank");
  const [amount, setAmount] = useState((feePence / 100).toFixed(feePence % 100 ? 2 : 0));
  const [busy, setBusy] = useState(false);
  const pence = parsePounds(amount);
  const pick = (n: number) => { setMonths(n); setAmount(((feePence * n) / 100).toFixed((feePence * n) % 100 ? 2 : 0)); };
  const save = async () => { if (pence === null) return; setBusy(true); await onSave(months, pence, via); setBusy(false); };
  return (
    <div className="stack" style={{ gap: 8, width: "100%", paddingTop: 6 }}>
      <div><div className="tiny" style={{ marginBottom: 6 }}>Covers</div>
        <div className="chips">{COVER_CHOICES.map((n) => <button key={n} className={`chip ${months === n ? "on" : ""}`} aria-pressed={months === n} onClick={() => pick(n)}>{n === 12 ? "1 year" : `${n} month${n === 1 ? "" : "s"}`}</button>)}</div>
      </div>
      <div><div className="tiny" style={{ marginBottom: 6 }}>Paid by</div>
        <div className="chips">{VIAS.map((v) => <button key={v} className={`chip ${via === v ? "on" : ""}`} aria-pressed={via === v} onClick={() => setVia(v)}>{FEE_PAID_LABEL[v]}</button>)}</div>
      </div>
      <label className="row" style={{ gap: 8 }}><span className="tiny">Amount £</span><input className="field num" style={{ maxWidth: 120 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Amount ${first} paid`} /></label>
      {pence === null && <div className="small" role="alert" style={{ color: "var(--crit)" }}>Type an amount such as 150 or 400.</div>}
      <button className="btn act block" disabled={busy || pence === null} onClick={() => void save()}>
        {busy ? "Saving…" : months === 1 ? `${monthName(month)} paid · ${pounds(pence ?? 0)}` : `${months} months paid · ${pounds(pence ?? 0)}`}
      </button>
      {months > 1 && <div className="tiny">Ticks off {monthName(month)} to {monthName(addMonthKey(month, months - 1))}. {first} won't show as owing until it runs out.</div>}
    </div>
  );
}

