import { businessSummary, parsePounds, pounds, sampleBusiness, type BizClient, type BizInput } from "@apex/core";
import { Avatar, BusinessHero, ClientFlow, CountUp, Icons, IncomeBars, Label, SourceRows } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { loadBusiness, setClientFee, setClientStatus } from "../../data/business";
import type { CoachLiveProps } from "../CoachApp";
import { CoachProgrammes } from "./CoachProgrammes";
import { CoachAgreements } from "./CoachAgreements";
import { CoachClasses } from "./CoachClasses";
import { useExtras } from "../../data/extras";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** The coach's business from their own records: fees, packs, programme sales, clients joining and leaving, leads, sessions. */
export function Business({ live, say = () => {}, openGym }: { live?: CoachLiveProps; say?: (m: string) => void; openGym?: () => void }) {
  const { mode } = useAppInfo();
  const [shop, setShop] = useState(false);
  const [view, setView] = useState<"agreements" | "classes" | null>(null);
  const extras = useExtras();
  const [data, setData] = useState<BizInput | null>(null);
  const [needsSql, setNeedsSql] = useState(false);
  const [failed, setFailed] = useState(false);
  const isLive = mode === "live" && !!live;
  const load = useCallback(() => {
    if (!isLive || !live) { setData(sampleBusiness(new Date())); return; }
    setFailed(false);
    loadBusiness(live.db, live.coachId).then((r) => { setData(r.input); setNeedsSql(r.needsSql); }, (e: unknown) => { console.error("Couldn't load business", e); setFailed(true); });
  }, [isLive, live?.db, live?.coachId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);
  const sum = useMemo(() => (data ? businessSummary(data) : null), [data]);

  if (shop) return <CoachProgrammes live={live} onBack={() => setShop(false)} say={say} />;
  if (view === "agreements") return <CoachAgreements live={isLive ? live : undefined} onBack={() => setView(null)} say={say} />;
  if (view === "classes") return <CoachClasses onBack={() => setView(null)} say={say} />;

  const saveFee = async (c: BizClient, text: string) => {
    const pence = parsePounds(text);
    if (pence === null) { say("Type an amount like 150 or 149.99"); return false; }
    if (pence === c.feePence) return true;
    try {
      if (isLive && live) await setClientFee(live.db, live.coachId, c.id, pence);
      setData((d) => (d ? { ...d, clients: d.clients.map((x) => (x.id === c.id ? { ...x, feePence: pence } : x)) } : d));
      say(`${c.name.split(" ")[0]}: ${pounds(pence)} a month`);
      return true;
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't save the fee");
      return false;
    }
  };

  const saveStatus = async (c: BizClient, status: "active" | "paused" | "ended") => {
    if (status === c.status) return;
    const first = c.name.split(" ")[0];
    if (status === "ended" && !confirm(`End coaching with ${c.name}? They leave your client list and count as having left this month. Their history stays, and you can bring them back below.`)) return;
    try {
      if (isLive && live) await setClientStatus(live.db, live.coachId, c.id, status);
      const now = new Date().toISOString();
      setData((d) => (d ? { ...d, clients: d.clients.map((x) => (x.id === c.id ? { ...x, status, endedAt: status === "ended" ? now : null } : x)) } : d));
      if (isLive) live?.refreshClients();
      say(status === "ended" ? `Coaching with ${first} ended` : status === "paused" ? `${first} paused` : `${first} is back`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't change that");
    }
  };

  const links = (
    <>
      {openGym && (
        <div className="card flat list full">
          <button className="li" onClick={openGym}>
            <Icons.clients width={18} height={18} style={{ color: "var(--act)" }} />
            <div className="grow"><div className="h3">Gym</div><div className="tiny">Your trainers, their roles and every client in one place</div></div>
            <span className="tiny">›</span>
          </button>
        </div>
      )}
      <div className="card flat list full">
        <button className="li" onClick={() => setShop(true)}>
          <span className="mi c2"><Icons.train /></span>
          <div className="grow"><div className="h3">Programmes</div><div className="small">Sell ready-made plans to many clients at once, free or paid</div></div>
          <Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} />
        </button>
        {extras && (
          <>
            <button className="li" onClick={() => setView("classes")}>
              <span className="mi c1"><Icons.clients /></span>
              <div className="grow"><div className="h3">Group classes</div><div className="small">Classes with a place limit and a waitlist that moves up by itself</div></div>
              <Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} />
            </button>
            <button className="li" onClick={() => setView("agreements")}>
              <span className="mi c4"><Icons.note /></span>
              <div className="grow"><div className="h3">Contracts and waivers</div><div className="small">Clients sign by typing their name. See who has and who hasn't</div></div>
              <Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} />
            </button>
          </>
        )}
      </div>
    </>
  );

  if (failed) {
    return (
      <>
        <div className="full"><div className="eyebrow">Business</div><h1 className="h1">Couldn't load your numbers</h1></div>
        <div className="card small full">Check your connection and try again.<div style={{ marginTop: 10 }}><button className="btn ghost" onClick={load}>Try again</button></div></div>
        {links}
      </>
    );
  }
  if (!sum || !data) return <div className="full"><div className="eyebrow">Business</div><h1 className="h1">Loading…</h1></div>;

  const current = data.clients.filter((c) => c.status === "active" || c.status === "paused").sort((a, b) => b.feePence - a.feePence || a.name.localeCompare(b.name));
  const past = data.clients.filter((c) => c.status === "ended").sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
  const s30 = sum.sessions30;
  const pills = [
    `${sum.active} active${sum.paused ? ` · ${sum.paused} paused` : ""}`,
    `${sum.newThisMonth} joined this month`,
    ...(sum.churnPct !== null ? [`${sum.churnPct}% left in 30 days`] : []),
  ];
  return (
    <>
      <div className="full">
        <BusinessHero title={`${pounds(sum.recurringPence)} a month`} caption={mode === "demo" ? "Sample business · your real one fills in when you sign in" : "Monthly recurring, from the fees you set"} pills={pills} />
      </div>
      {needsSql && <div className="card small full" style={{ borderColor: "var(--warn)" }}>One step left: run the business SQL so fees and leaving dates can be saved. Everything else below is already your real data.</div>}

      <div className="gy-stats full">
        <div className="gy-stat" style={{ ["--i" as string]: 0 }}><b>£<CountUp value={Math.round(sum.thisMonth.totalPence / 100)} /></b><span>income this month</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 1 }}><b>{sum.retained90Pct === null ? "–" : <><CountUp value={sum.retained90Pct} />%</>}</b><span>still with you after 90 days</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 2 }}><b>{sum.conversionPct === null ? "–" : <><CountUp value={sum.conversionPct} />%</>}</b><span>of leads became clients</span></div>
      </div>
      <div className="kpis full">
        <div className="kpi"><b className="num">{sum.perClientPence ? pounds(sum.perClientPence) : "–"}</b><small>Average fee per client</small></div>
        <div className="kpi"><b className="num">{sum.avgMonths === null ? "–" : `${sum.avgMonths} mo`}</b><small>Average time a client stays</small></div>
        <div className="kpi"><b className="num">{sum.lifetimePence === null ? "–" : pounds(sum.lifetimePence)}</b><small>{sum.lifetimePence === null ? "Client value shows once someone has left" : "What a client is worth over their stay"}</small></div>
      </div>

      <div className="card full">
        <div className="sect"><h3 className="h3">Income, last 6 months</h3><Label kind="data">Data</Label></div>
        <IncomeBars months={sum.months} />
        <p className="bz-note" style={{ marginTop: 10 }}>Fees count in each month a client was with you, at the fee they pay now. Card payments join in once Stripe is connected.</p>
      </div>

      <div className="card">
        <div className="sect"><h3 className="h3">Clients joining and leaving</h3><Label kind="data">Data</Label></div>
        <ClientFlow months={sum.months} />
        <p className="bz-note" style={{ marginTop: 10 }}>{sum.lostThisMonth ? `${sum.lostThisMonth} left this month.` : "Nobody has left this month."} Ending a client below records the date.</p>
      </div>

      <div className="card">
        <div className="sect"><h3 className="h3">Where clients come from</h3><Label kind="data">Data</Label></div>
        {sum.sources.length ? <SourceRows sources={sum.sources} /> : <div className="small">No enquiries in the last 90 days. Share your Train with me link from Messages to start.</div>}
        {sum.leads90 > 0 && <p className="bz-note" style={{ marginTop: 10 }}>{sum.won90} of {sum.leads90} enquiries in the last 90 days became clients.</p>}
      </div>

      <div className="card">
        <div className="sect"><h3 className="h3">1:1 sessions, last 30 days</h3><Label kind="data">Data</Label></div>
        <div className="kpis">
          <div className="kpi"><b className="num">{s30.delivered}</b><small>Delivered</small></div>
          <div className="kpi"><b className="num" style={{ color: s30.noShows ? "var(--crit)" : undefined }}>{s30.noShows}</b><small>No-shows{s30.noShowPct !== null ? ` · ${s30.noShowPct}%` : ""}</small></div>
          <div className="kpi"><b className="num" style={{ color: s30.lateCancels ? "var(--warn)" : undefined }}>{s30.lateCancels}</b><small>Late cancels</small></div>
        </div>
      </div>

      <div className="card flat list">
        <div className="li" style={{ display: "block" }}>
          <div className="sect" style={{ margin: 0 }}><h3 className="h3">What each client pays</h3><Label kind="dec">Coach decision</Label></div>
          <div className="tiny" style={{ marginTop: 4 }}>{sum.noFee ? `${sum.noFee} client${sum.noFee === 1 ? " has" : "s have"} no fee yet, so the monthly figure is missing them.` : "Monthly fee per client. Type a new amount and press Enter."}</div>
        </div>
        {current.length === 0 && <div className="li"><div className="small">No clients yet. Invite one from the Clients tab.</div></div>}
        {current.map((c) => <FeeRow key={c.id} client={c} onSave={saveFee} onStatus={saveStatus} disabled={needsSql} />)}
        {mode === "demo" && (
          <div className="li" style={{ background: "var(--good-soft)" }}>
            <div className="grow"><div className="h3" style={{ color: "var(--good)" }}>Next payout</div><div className="small">Sample · real payouts come from Stripe</div></div>
            <span className="num" style={{ fontWeight: 700, color: "var(--good)" }}>{pounds(Math.round(sum.recurringPence * 0.48))}</span>
          </div>
        )}
      </div>
      {past.length > 0 && (
        <details className="card flat list">
          <summary className="li" style={{ cursor: "pointer" }}><div className="grow"><div className="h3">Past clients</div><div className="tiny">{past.length} ended · bring someone back if they return</div></div></summary>
          {past.map((c) => (
            <div key={c.id} className="li">
              <Avatar initials={initials(c.name)} size={30} />
              <div className="grow"><div className="h3">{c.name}</div><div className="small">{c.endedAt ? `Left ${new Date(c.endedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Left before dates were recorded"}</div></div>
              <button className="btn ghost" onClick={() => void saveStatus(c, "active")}>Bring back</button>
            </div>
          ))}
        </details>
      )}
      {links}
    </>
  );
}

function FeeRow({ client, onSave, onStatus, disabled }: { client: BizClient; onSave: (c: BizClient, text: string) => Promise<boolean>; onStatus: (c: BizClient, s: "active" | "paused" | "ended") => Promise<void>; disabled: boolean }) {
  const shown = client.feePence ? (client.feePence / 100).toFixed(client.feePence % 100 ? 2 : 0) : "";
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = async () => { if (text !== shown && !(await onSave(client, text))) setText(shown); };
  return (
    <div className="li">
      <Avatar initials={initials(client.name)} size={34} />
      <div className="grow">
        <div className="h3">{client.name}</div>
        <select className="bz-status" aria-label={`${client.name}'s coaching status`} value={client.status} onChange={(e) => void onStatus(client, e.target.value as "active" | "paused" | "ended")}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">End coaching…</option>
        </select>
      </div>
      <label className="bz-fee">
        <span className="tiny">£</span>
        <input className="field num" inputMode="decimal" placeholder="0" aria-label={`${client.name}'s monthly fee in pounds`} value={text} disabled={disabled}
          onChange={(e) => setText(e.target.value)} onBlur={() => void commit()} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="tiny">/mo</span>
      </label>
    </div>
  );
}
