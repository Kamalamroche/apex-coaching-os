import { CLIENTS, currentMembership, formatPlanPrice, formatPounds, initials, membershipLabel, monthlyPence, monthlyRecurring, parsePounds, revenueByMonth, type BillingInterval, type Membership } from "@apex/core";
import { Avatar, Label, StatusChip } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoachBilling } from "../../data/billing";
import { demoCoachBilling, liveCoachBilling, type CoachBillingLink } from "../../data/BillingContext";
import type { CoachLiveProps } from "../CoachApp";

/* Business: money in. Live, every number comes from Stripe through the webhook; the demo uses sample memberships. */

export function Business({ live, say }: { live?: CoachLiveProps; say: (m: string) => void }) {
  const link = useMemo(() => (live ? liveCoachBilling(live.db, live.coachId) : demoCoachBilling), [live?.db, live?.coachId]);
  const [data, setData] = useState<CoachBilling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    link.load().then((d) => { setData(d); setError(null); }, (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load payments"));
  }, [link]);
  useEffect(reload, [reload]);

  // Everyone the coach coaches, with their newest membership (or none yet).
  const people = live
    ? (live.clients ?? []).map((c) => ({ id: c.id, name: c.name }))
    : CLIENTS.map((c) => ({ id: String(c.id), name: c.name }));
  const rows = people.map((p) => ({ ...p, membership: currentMembership((data?.memberships ?? []).filter((m) => m.clientId === p.id)) }));
  const mrr = monthlyRecurring(data?.memberships ?? []);
  const paying = rows.filter((r) => r.membership && ["active", "trialing", "past_due"].includes(r.membership.status)).length;
  const failed = rows.filter((r) => r.membership && (r.membership.status === "past_due" || r.membership.status === "unpaid")).length;
  const months = revenueByMonth(data?.payments ?? [], 6);
  const thisMonth = months.at(-1)?.pence ?? 0;

  return (
    <>
      <div className="full">
        <div className="eyebrow">Business</div>
        <h1 className="h1">{formatPounds(mrr)} monthly recurring</h1>
        <p className="sub">{link.demo ? "Sample figures. Live, every number here comes from Stripe." : "From Stripe. Updates as soon as a client pays, renews or cancels."}</p>
      </div>
      {error && <div className="card full small" style={{ color: "var(--crit)" }}>{error}</div>}

      <div className="kpis full">
        <div className="kpi"><b>{paying}</b><small>Paying clients</small></div>
        <div className="kpi"><b>{formatPounds(thisMonth)}</b><small>Paid this month</small></div>
        <div className="kpi"><b style={{ color: failed ? "var(--crit)" : undefined }}>{failed}</b><small>Failed payments</small></div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="sect"><h3 className="h3">Monthly revenue, 6 months</h3><Label kind="data">Data</Label></div>
          <RevenueBars months={months} />
        </div>
        <Plans link={link} data={data} reload={reload} say={say} />
      </div>

      <div className="card flat list">
        <div className="li"><div className="grow h3">Clients</div><Label kind="data">Data</Label></div>
        {rows.length === 0 && <div className="li small">No clients yet. Invite one from Clients.</div>}
        {rows.map((r) => <MemberRow key={r.id} name={r.name} membership={r.membership} planName={data?.plans.find((p) => p.id === r.membership?.planId)?.name} />)}
        {!link.demo && rows.some((r) => !r.membership) && (
          <div className="li tiny">Clients join from More → Membership in their app.</div>
        )}
      </div>
    </>
  );
}

function RevenueBars({ months }: { months: { label: string; pence: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.pence));
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
        {months.map((m, i) => {
          const latest = i === months.length - 1;
          return (
            <div key={`${m.label}${i}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
              <span className="num tiny" style={{ color: latest ? "var(--act)" : "var(--text3)", fontWeight: 700 }}>{m.pence >= 100000 ? `£${(m.pence / 100000).toFixed(2)}k` : formatPounds(m.pence)}</span>
              <div style={{ width: "100%", height: `${Math.max(2, (m.pence / max) * 84)}px`, borderRadius: "4px 4px 0 0", background: latest ? "var(--act)" : "var(--blue-soft)", borderTop: latest ? "none" : "2px solid var(--blue)" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>{months.map((m, i) => <span key={`${m.label}${i}`} className="tiny" style={{ flex: 1, textAlign: "center" }}>{m.label}</span>)}</div>
    </>
  );
}

function MemberRow({ name, membership, planName }: { name: string; membership: Membership | null; planName?: string }) {
  const label = membershipLabel(membership);
  const live = membership && label.text !== "Ended";
  return (
    <div className="li">
      <Avatar initials={initials(name)} size={34} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="h3">{name}</div>
        <div className="small">{live ? planName ?? "Coaching" : "No membership"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        {live && membership.amountPence != null && <span className="num" style={{ fontWeight: 700 }}>{formatPounds(monthlyPence(membership.amountPence, membership.interval ?? "month"))}<span className="tiny"> /mo</span></span>}
        <StatusChip {...label} />
      </div>
    </div>
  );
}

function Plans({ link, data, reload, say }: { link: CoachBillingLink; data: CoachBilling | null; reload: () => void; say: (m: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pence = parsePounds(price);
  const plans = [...(data?.plans ?? [])].sort((a, b) => Number(b.active) - Number(a.active));
  const members = (planId: string) => (data?.memberships ?? []).filter((m) => m.planId === planId && ["active", "trialing", "past_due"].includes(m.status)).length;

  const create = async () => {
    if (!name.trim() || pence == null) return;
    setBusy(true);
    setError(null);
    try {
      await link.createPlan({ name: name.trim(), description: description.trim(), amountPence: pence, interval });
      say(`${name.trim()} is ready · clients can join it now`);
      setAdding(false); setName(""); setPrice(""); setDescription(""); setInterval("month");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the plan");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string, planName: string) => {
    if (!confirm(`Stop new sign-ups to ${planName}? Clients already on it keep paying until they cancel.`)) return;
    try {
      await link.archivePlan(id);
      say(`${planName} closed to new sign-ups`);
      reload();
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't change the plan");
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="sect">
        <h3 className="h3">Coaching plans</h3>
        {!adding && <button className="btn act sm" onClick={() => setAdding(true)}>New plan</button>}
      </div>
      {plans.length === 0 && !adding && <p className="small" style={{ margin: 0 }}>No plans yet. Add one, and your clients can pay for it by card from their app.</p>}
      {plans.length > 0 && (
        <div className="list" style={{ margin: "0 -14px" }}>
          {plans.map((p) => (
            <div key={p.id} className="li" style={{ opacity: p.active ? 1 : 0.55 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="h3">{p.name}</div>
                <div className="small">{formatPlanPrice(p.amountPence, p.interval)} · {members(p.id)} on it{p.active ? "" : " · closed"}</div>
              </div>
              {p.active && <button className="btn ghost sm" onClick={() => void archive(p.id, p.name)}>Close</button>}
            </div>
          ))}
        </div>
      )}
      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="field" placeholder="Plan name, e.g. Online coaching" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="field" inputMode="decimal" placeholder="Price, £" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!price && pence == null} />
            <div className="seg" role="radiogroup" aria-label="How often">
              {(["month", "week"] as const).map((i) => <button key={i} className={interval === i ? "on" : ""} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)}>{i === "month" ? "Monthly" : "Weekly"}</button>)}
            </div>
          </div>
          <textarea className="field" rows={2} placeholder="What's included (clients see this)" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          {price && pence == null && <div className="tiny" style={{ color: "var(--crit)" }}>Enter a price between £1 and £10,000.</div>}
          {error && <div className="small" style={{ color: "var(--crit)" }}>{error}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn act" disabled={busy || !name.trim() || pence == null} onClick={() => void create()}>{busy ? "Creating…" : pence != null ? `Create · ${formatPlanPrice(pence, interval)}` : "Create plan"}</button>
            <button className="btn ghost" disabled={busy} onClick={() => { setAdding(false); setError(null); }}>Cancel</button>
          </div>
          <div className="tiny">Prices are fixed once a plan is made. To change a price, add a new plan and close the old one. Existing clients keep what they agreed.</div>
        </div>
      )}
    </div>
  );
}
