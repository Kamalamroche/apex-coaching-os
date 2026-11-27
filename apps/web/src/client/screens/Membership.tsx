import { currentMembership, formatPounds, isLiveMembership, membershipLabel } from "@apex/core";
import { Icons, Label, Price, StatusChip } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useClientBilling, type ClientBillingData } from "../../data/BillingContext";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** The client's coaching membership: join a plan, see when it renews, and manage it on Stripe. */
export function Membership({ say }: { say: (m: string) => void }) {
  const billing = useClientBilling();
  const { coachName } = useAppInfo();
  const [data, setData] = useState<ClientBillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    billing.load().then((d) => { setData(d); setError(null); }, (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your membership"));
  }, [billing]);
  useEffect(() => {
    reload();
    return billing.watch(reload);
  }, [billing, reload]);

  const run = async (key: string, fn: () => Promise<void>, demoDone?: string) => {
    setBusy(key);
    try {
      await fn();
      if (billing.demo) { if (demoDone) say(demoDone); reload(); setBusy(null); }
      // Live: the browser is on its way to Stripe, so the button stays busy.
    } catch (e) {
      setBusy(null);
      say(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const current = data ? currentMembership(data.memberships) : null;
  const live = current && isLiveMembership(current.status) ? current : null;
  const plan = live && data?.plans.find((p) => p.id === live.planId);
  const label = membershipLabel(live);
  const failed = live && (live.status === "past_due" || live.status === "unpaid");

  return (
    <>
      <div>
        <div className="eyebrow">Membership</div>
        <h1 className="h1">{live ? plan?.name ?? "Your coaching" : `Coaching with ${coachName}`}</h1>
        {!live && <p className="sub">Pick the plan you've agreed with {coachName}. You can cancel any time.</p>}
      </div>
      {error && <div className="card small" style={{ color: "var(--crit)" }}>{error}</div>}
      {!data && !error && <div className="card small">Loading…</div>}

      {live && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="sect"><h3 className="h3">Your plan</h3><Label kind="data">Data</Label></div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            {live.amountPence != null ? <Price amount={formatPounds(live.amountPence)} per={live.interval ?? "month"} size={26} /> : <span className="num">—</span>}
            <StatusChip {...label} />
          </div>
          {failed && (
            <div className="small" style={{ background: "var(--crit-soft)", color: "var(--crit)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
              Your last payment didn't go through. Update your card to keep your coaching running.
            </div>
          )}
          <button className={`btn ${failed ? "act" : "ghost"} block`} disabled={!!busy} onClick={() => void run("manage", billing.manage, "Demo: membership ended. Live, Stripe's page lets you change card or cancel.")}>
            {busy === "manage" ? "Opening…" : failed ? "Update card" : "Manage payments"}
          </button>
          <div className="tiny">Card details, receipts and cancelling are handled securely by Stripe.</div>
        </div>
      )}

      {data && !live && (
        <>
          {data.plans.length === 0 && <div className="card small">{coachName} hasn't set up any plans yet. They'll appear here when they do.</div>}
          {data.plans.map((p) => (
            <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <h3 className="h3">{p.name}</h3>
                <Price amount={formatPounds(p.amountPence)} per={p.interval} />
              </div>
              {p.description && <p className="small" style={{ margin: 0 }}>{p.description}</p>}
              <button className="btn act block" disabled={!!busy} onClick={() => void run(p.id, () => billing.join(p.id), `Demo: you joined ${p.name}. No card was charged.`)}>
                {busy === p.id ? "Opening secure checkout…" : `Join ${p.name}`}
              </button>
            </div>
          ))}
          {data.plans.length > 0 && (
            <div className="tiny row" style={{ gap: 6 }}><Icons.check width={13} height={13} /> Secure card payment by Stripe. APEX never sees your card number.{billing.demo && " Demo: no card is charged."}</div>
          )}
        </>
      )}

      {!!data?.payments.length && (
        <div className="card flat list">
          <div className="li"><div className="grow h3">Payments</div><Label kind="data">Data</Label></div>
          {data.payments.map((p) => (
            <div key={p.id} className="li">
              <div className="grow"><div className="small" style={{ color: "var(--text)" }}>{shortDate(p.paidAt)}</div></div>
              <span className="num" style={{ fontWeight: 700 }}>{formatPounds(p.amountPence)}</span>
              <StatusChip text={p.status === "paid" ? "Paid" : "Failed"} tone={p.status === "paid" ? "good" : "crit"} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
