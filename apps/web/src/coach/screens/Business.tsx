import { CLIENTS } from "@apex/core";
import { Avatar, Label } from "@apex/ui";
import { SampleNote } from "../../app/AppContext";

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const REVENUE = [920, 1010, 1080, 1150, 1170, 1220];

export function Business() {
  const max = Math.max(...REVENUE);
  const total = CLIENTS.reduce((a, c) => a + c.monthlyRevenue, 0);
  return (
    <>
      <div className="full">
        <div className="eyebrow">Business</div>
        <h1 className="h1">£{total.toLocaleString()} monthly recurring</h1>
        <p className="sub">Sample figures. Real numbers come from Stripe once billing is connected.</p>
      </div>
      <SampleNote />
      <div className="card">
        <div className="sect"><h3 className="h3">Monthly revenue, 6 months</h3><Label kind="data">Data</Label></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {REVENUE.map((v, i) => {
            const latest = i === REVENUE.length - 1;
            return (
              <div key={MONTHS[i]} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
                <span className="num tiny" style={{ color: latest ? "var(--act)" : "var(--text3)", fontWeight: 700 }}>£{(v / 1000).toFixed(2)}k</span>
                <div style={{ width: "100%", height: `${(v / max) * 84}px`, borderRadius: "4px 4px 0 0", background: latest ? "var(--act)" : "var(--blue-soft)", borderTop: latest ? "none" : "2px solid var(--blue)" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>{MONTHS.map((m) => <span key={m} className="tiny" style={{ flex: 1, textAlign: "center" }}>{m}</span>)}</div>
      </div>
      <div className="card flat list">
        {CLIENTS.map((c) => (
          <div key={c.id} className="li"><Avatar initials={c.initials} size={34} /><div className="grow"><div className="h3">{c.name}</div><div className="small">{c.plan} · {c.mode}</div></div><span className="num" style={{ fontWeight: 700 }}>£{c.monthlyRevenue}</span></div>
        ))}
        <div className="li" style={{ background: "var(--good-soft)" }}>
          <div className="grow"><div className="h3" style={{ color: "var(--good)" }}>Next payout</div><div className="small">Friday 31 October</div></div>
          <span className="num" style={{ fontWeight: 700, color: "var(--good)" }}>£{Math.round(total * 0.48).toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
