import { CLIENTS, DEMO_CLIENT_ID, exerciseFor, firstName, formatRest, type TrainingMode } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, BackLink, Bar, ClientTable, Label, Spark, riskColor, useUnits } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";
import { ClientCheckIns } from "./CheckIns";
import { ClientReport } from "./Report";
import { CoachHabits, CoachNutritionPanel, IntakeView } from "./Lifestyle";
import { ClientFormChecks } from "./FormChecks";
import { ClientGoals } from "./Goals";
import { ClientNotes, TagFilter, TagList, useClientTags } from "./ClientNotes";
import { clientTableRows, hasTag, type SortDir, type TableSortKey } from "@apex/core";
import { Transfer } from "./Transfer";
import { useMemo } from "react";
import { demoRosterHealth } from "../../data/health";
import { ClientHealthPanel } from "./ClientHealth";
import { CoachCardio, CoachRecovery } from "./CoachCardio";
import { OneToOneTab } from "./OneToOne";

type Segment = "All" | "Needs attention" | TrainingMode;
const SEGMENTS: Segment[] = ["All", "Needs attention", "Online", "Hybrid", "In person"];
type ProfileTab = "Overview" | "Programme" | "Report" | "Check-ins" | "Form checks" | "Goals" | "Habits" | "Nutrition" | "Recovery" | "About" | "Notes" | "In person";

const CHECK_INS = [
  { date: "Sat 18 Oct", weight: "62.6 kg", stats: "Energy 4/5 · sleep 7 h", note: "Hip a little tight after RDLs" },
  { date: "Sat 11 Oct", weight: "62.9 kg", stats: "Energy 3/5 · sleep 6 h", note: "Busy week at work" },
  { date: "Sat 4 Oct", weight: "63.1 kg", stats: "Energy 4/5 · sleep 7.5 h", note: "Loving the new programme" },
];

interface Props {
  id: number | null;
  setId: (id: number | null) => void;
  say: (m: string) => void;
  goBuild: () => void;
  /** Open the profile on this tab (from the Brief). */
  startTab?: string;
}

export function Clients({ id, setId, say, goBuild, startTab }: Props) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Segment>("All");
  const [transfer, setTransfer] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const { tags, reload: reloadTags } = useClientTags();
  const [sort, setSort] = useState<{ key: TableSortKey; dir: SortDir }>({ key: "need", dir: "asc" });
  const roster = useMemo(() => demoRosterHealth(), []);
  if (transfer) return <div className="cl-profile"><Transfer say={say} onBack={() => setTransfer(false)} /></div>;
  const c = CLIENTS.find((x) => x.id === id);
  if (c) return <div className="cl-profile"><ClientProfile clientId={c.id} startTab={startTab} onBack={() => { setId(null); void reloadTags(); }} say={say} goBuild={goBuild} /></div>;

  const list = CLIENTS.filter(
    (x) => (seg === "All" || (seg === "Needs attention" ? x.risk !== "low" : x.mode === seg)) && x.name.toLowerCase().includes(q.toLowerCase()) && (!tag || hasTag(tags[String(x.id)], tag)),
  );
  const shown = new Set(list.map((x) => String(x.id)));
  const tableRows = clientTableRows(roster.filter((r) => shown.has(r.client.id)), { daysSince: (x) => daysFromLabel(x.lastSeen), feePence: (x) => x.monthlyRevenue * 100 });
  return (
    <div className="full stack" style={{ gap: 18 }}>
      <div><div className="eyebrow">Clients</div><h1 className="h1">{CLIENTS.length} active</h1></div>
      <input id="clientsearch" className="field" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">{SEGMENTS.map((s) => <button key={s} className={`chip ${seg === s ? "on" : ""}`} onClick={() => setSeg(s)}>{s}</button>)}</div>
      <TagFilter tags={tags} value={tag} onChange={setTag} />
      <div className="cl-desk">
        <ClientTable rows={tableRows} sort={sort.key} dir={sort.dir} onSort={(key, dir) => setSort({ key, dir })} onOpen={(cid) => setId(Number(cid))} below={(r) => <TagList tags={tags[r.id]} />} />
        <div className="tiny" style={{ marginTop: 8 }}>Health and its parts are worked out from the last two weeks (Insight). Click a column to sort, or a client to open them.</div>
      </div>
      <div className="card flat list cl-phone">
        {list.length === 0 && <div className="li"><div className="small">No clients match. Clear the search or pick another segment.</div></div>}
        {list.map((x) => (
          <button key={x.id} className="li" onClick={() => setId(x.id)}>
            <Avatar initials={x.initials} tone={riskColor(x.risk)} />
            <div className="grow">
              <div className="h3">{x.name}</div>
              <div className="small">{x.plan} · {x.mode}</div>
              <TagList tags={tags[String(x.id)]} />
              <div style={{ marginTop: 6 }}><Bar pct={x.adherence} color={riskColor(x.risk)} /></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontWeight: 700, color: riskColor(x.risk) }}>{x.adherence}%</div>
              <div className="tiny">{x.lastSeen}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => say("Invite link copied")}>+ Invite a client</button>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => setTransfer(true)}>Import or export clients</button>
      </div>
    </div>
  );
}

/** The sample clients' "Today" / "Yesterday" / "4 days ago" as whole days. */
function daysFromLabel(label: string): number | null {
  const l = label.toLowerCase();
  if (l === "today") return 0;
  if (l === "yesterday") return 1;
  const m = /^(\d+) days? ago$/.exec(l);
  return m ? Number(m[1]) : null;
}

function ClientProfile({ clientId, startTab, onBack, say, goBuild }: { clientId: number; startTab?: string; onBack: () => void; say: (m: string) => void; goBuild: () => void }) {
  const u = useUnits();
  const store = useStore();
  const { workout } = useApexState(store);
  const [tab, setTab] = useState<ProfileTab>(() => (startTab === "In person" ? "In person" : clientId === DEMO_CLIENT_ID && startTab === "Recovery" ? "Recovery" : "Overview"));
  const c = CLIENTS.find((x) => x.id === clientId);
  const health = useMemo(() => demoRosterHealth().find((r) => r.client.id === String(clientId)) ?? null, [clientId]);
  if (!c) return null;
  return (
    <>
      <BackLink onClick={onBack}>All clients</BackLink>
      <div className="row">
        <Avatar initials={c.initials} size={56} tone={riskColor(c.risk)} />
        <div className="grow"><h1 className="h1" style={{ fontSize: 22 }}>{c.name}</h1><div className="small">{c.plan} · {c.mode} · last seen {c.lastSeen.toLowerCase()}</div></div>
      </div>
      <div className="chips" style={{ flexWrap: "wrap" }}>{(c.id === DEMO_CLIENT_ID ? (["Overview", "In person", "Programme", "Report", "Check-ins", "Form checks", "Goals", "Habits", "Nutrition", "Recovery", "About", "Notes"] as const) : (["Overview", "In person", "Programme", "Check-ins", "Notes"] as const)).map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === "Overview" && (
        <>
          <div className="kpis">
            <div className="kpi"><b style={{ color: riskColor(c.risk) }}>{c.adherence}%</b><small>Adherence, 4 wks</small></div>
            <div className="kpi"><b>{u.w(c.weightKg)}</b><small>Weight, {u.weight}</small></div>
            <div className="kpi"><b>{c.streak}</b><small>Day streak</small></div>
          </div>
          {health && <ClientHealthPanel health={health.health} trend={health.trend} />}
          <div className="card">
            <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Squat e1RM, 8 weeks</h3><Label kind="data">Data</Label></div>
            <Spark data={[88, 90, 91, 94, 94, 97, 99, 101].map((kg) => u.w(kg))} unit={u.weight} />
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn act" style={{ flex: 1 }} onClick={() => say(`Message thread opened with ${firstName(c.name)}`)}>Message</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={goBuild}>Edit programme</button>
          </div>
        </>
      )}

      {tab === "Programme" && (
        <div className="card flat list">
          {workout.items.map((it) => (
            <div key={it.key} className="ex">
              <span className="grp">{it.group}</span>
              <div className="grow"><div className="h3">{exerciseFor(it).name}</div><div className="small num">{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""} · RPE {it.rpe}</div></div>
              <span className="tiny num">{it.restSeconds ? formatRest(it.restSeconds) : "→"}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "Report" && c.id === DEMO_CLIENT_ID && <ClientReport clientName={c.name} say={say} />}
      {tab === "Check-ins" && c.id === DEMO_CLIENT_ID && <ClientCheckIns clientName={c.name} say={say} />}
      {tab === "Form checks" && <ClientFormChecks clientName={c.name} say={say} />}
      {tab === "Goals" && <ClientGoals clientName={c.name} say={say} />}
      {tab === "Habits" && <CoachHabits clientName={c.name} say={say} />}
      {tab === "Nutrition" && <CoachNutritionPanel clientName={c.name} say={say} />}
      {tab === "Recovery" && <RecoveryTab name={c.name} />}
      {tab === "About" && <IntakeView clientName={c.name} />}
      {tab === "Notes" && <ClientNotes clientId={String(c.id)} clientName={c.name} say={say} />}
      {tab === "In person" && <OneToOneTab clientId={String(c.id)} clientName={c.name} canRun={c.id === DEMO_CLIENT_ID} whyNot={`In the demo you can run a session with ${CLIENTS.find((x) => x.id === DEMO_CLIENT_ID)?.name ?? "the sample client"}, whose app you can open too. Notes and in-person checks work for everyone.`} say={say} />}
      {tab === "Check-ins" && c.id !== DEMO_CLIENT_ID && (
        <div className="card flat list">
          {CHECK_INS.map((r) => (
            <div key={r.date} className="li"><div className="grow"><div className="h3">{r.date} · <span className="num">{u.kt(r.weight)}</span></div><div className="small">{r.stats}</div><div className="tiny">“{r.note}”</div></div></div>
          ))}
          <div style={{ padding: 12 }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Label kind="ai">AI summary</Label>
              <span className="small">Weight down {u.fw(0.5)} over 3 weeks, energy steady, one mention of hip tightness. Suggest asking about the hip before progressing RDLs.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Sleep, readiness and cardio from the client's connected watch and logged runs, moved here from the Brief. */
export function RecoveryTab({ name }: { name: string }) {
  return (
    <>
      <CoachRecovery />
      <CoachCardio />
      <div className="tiny">From {firstName(name)}'s connected watch and the runs, rides and swims they log. Nothing here yet? It fills in once they connect a watch or log cardio.</div>
    </>
  );
}
