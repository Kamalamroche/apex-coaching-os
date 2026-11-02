import { CLIENTS, exerciseFor, firstName, formatRest, type TrainingMode } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, BackLink, Bar, Label, Spark, riskColor } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";
import { Transfer } from "./Transfer";

type Segment = "All" | "Needs attention" | TrainingMode;
const SEGMENTS: Segment[] = ["All", "Needs attention", "Online", "Hybrid", "In person"];
type ProfileTab = "Overview" | "Program" | "Check-ins";

const CHECK_INS = [
  { date: "Sat 18 Oct", weight: "62.6 kg", stats: "Energy 4/5 · sleep 7 h", note: "Hip a little tight after RDLs" },
  { date: "Sat 11 Oct", weight: "62.9 kg", stats: "Energy 3/5 · sleep 6 h", note: "Busy week at work" },
  { date: "Sat 4 Oct", weight: "63.1 kg", stats: "Energy 4/5 · sleep 7.5 h", note: "Loving the new program" },
];

interface Props {
  id: number | null;
  setId: (id: number | null) => void;
  say: (m: string) => void;
  goBuild: () => void;
}

export function Clients({ id, setId, say, goBuild }: Props) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Segment>("All");
  const [transfer, setTransfer] = useState(false);
  if (transfer) return <Transfer say={say} onBack={() => setTransfer(false)} />;
  const c = CLIENTS.find((x) => x.id === id);
  if (c) return <ClientProfile clientId={c.id} onBack={() => setId(null)} say={say} goBuild={goBuild} />;

  const list = CLIENTS.filter(
    (x) => (seg === "All" || (seg === "Needs attention" ? x.risk !== "low" : x.mode === seg)) && x.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div><div className="eyebrow">Clients</div><h1 className="h1">{CLIENTS.length} active</h1></div>
      <input id="clientsearch" className="field" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">{SEGMENTS.map((s) => <button key={s} className={`chip ${seg === s ? "on" : ""}`} onClick={() => setSeg(s)}>{s}</button>)}</div>
      <div className="card flat list">
        {list.length === 0 && <div className="li"><div className="small">No clients match. Clear the search or pick another segment.</div></div>}
        {list.map((x) => (
          <button key={x.id} className="li" onClick={() => setId(x.id)}>
            <Avatar initials={x.initials} tone={riskColor(x.risk)} />
            <div className="grow">
              <div className="h3">{x.name}</div>
              <div className="small">{x.plan} · {x.mode}</div>
              <div style={{ marginTop: 6 }}><Bar pct={x.adherence} color={riskColor(x.risk)} /></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontWeight: 700, color: riskColor(x.risk) }}>{x.adherence}%</div>
              <div className="tiny">{x.lastSeen}</div>
            </div>
          </button>
        ))}
      </div>
      <button className="btn ghost block" onClick={() => say("Invite link copied")}>+ Invite a client</button>
      <button className="btn ghost block" onClick={() => setTransfer(true)}>Import or export clients</button>
    </>
  );
}

function ClientProfile({ clientId, onBack, say, goBuild }: { clientId: number; onBack: () => void; say: (m: string) => void; goBuild: () => void }) {
  const store = useStore();
  const { workout } = useApexState(store);
  const [tab, setTab] = useState<ProfileTab>("Overview");
  const c = CLIENTS.find((x) => x.id === clientId);
  if (!c) return null;
  return (
    <>
      <BackLink onClick={onBack}>All clients</BackLink>
      <div className="row">
        <Avatar initials={c.initials} size={56} tone={riskColor(c.risk)} />
        <div className="grow"><h1 className="h1" style={{ fontSize: 22 }}>{c.name}</h1><div className="small">{c.plan} · {c.mode} · last seen {c.lastSeen.toLowerCase()}</div></div>
      </div>
      <div className="chips">{(["Overview", "Program", "Check-ins"] as const).map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === "Overview" && (
        <>
          <div className="kpis">
            <div className="kpi"><b style={{ color: riskColor(c.risk) }}>{c.adherence}%</b><small>Adherence, 4 wks</small></div>
            <div className="kpi"><b>{c.weightKg}</b><small>Weight, kg</small></div>
            <div className="kpi"><b>{c.streak}</b><small>Day streak</small></div>
          </div>
          <div className="card">
            <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Squat e1RM, 8 weeks</h3><Label kind="data">Data</Label></div>
            <Spark data={[88, 90, 91, 94, 94, 97, 99, 101]} unit="kg" />
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn act" style={{ flex: 1 }} onClick={() => say(`Message thread opened with ${firstName(c.name)}`)}>Message</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={goBuild}>Edit program</button>
          </div>
        </>
      )}

      {tab === "Program" && (
        <div className="card flat list">
          {workout.items.map((it) => (
            <div key={it.key} className="ex">
              <span className="grp">{it.group}</span>
              <div className="grow"><div className="h3">{exerciseFor(it).name}</div><div className="small num">{it.sets}×{it.reps}{it.kg ? ` · ${it.kg} kg` : ""} · RPE {it.rpe}</div></div>
              <span className="tiny num">{it.restSeconds ? formatRest(it.restSeconds) : "→"}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "Check-ins" && (
        <div className="card flat list">
          {CHECK_INS.map((r) => (
            <div key={r.date} className="li"><div className="grow"><div className="h3">{r.date} · <span className="num">{r.weight}</span></div><div className="small">{r.stats}</div><div className="tiny">“{r.note}”</div></div></div>
          ))}
          <div style={{ padding: 12 }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Label kind="ai">AI summary</Label>
              <span className="small">Weight down 0.5 kg over 3 weeks, energy steady, one mention of hip tightness. Suggest asking about the hip before progressing RDLs.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
