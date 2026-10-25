import { CLIENTS, firstName, type Client } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, Label, Sheet } from "@apex/ui";
import { useState } from "react";
import { store } from "../../store";

interface TriageItem {
  id: string;
  clientId: number;
  severity: "crit" | "warn";
  label: "Insight" | "Data";
  title: string;
  evidence: string;
  action: string;
  /** AI-drafted message. When missing, the action opens the client instead. */
  draft: string | null;
}

/* Sample triage. In the real build these are ranked server-side from logged sessions and check-ins. */
const TRIAGE: TriageItem[] = [
  { id: "t1", clientId: 1, severity: "crit", label: "Insight", title: "Sarah Mitchell has missed 3 sessions", evidence: "Last session 14 Oct · check-in mood 2/5 · adherence 42% (was 81% in September)", action: "Message", draft: "Hi Sarah, I noticed the last couple of weeks have been tough to fit in. No pressure at all. Would a shorter 30-minute version of your sessions help this week?" },
  { id: "t2", clientId: 2, severity: "warn", label: "Insight", title: "James's bench has stalled for 3 weeks", evidence: "e1RM 96 → 96 → 95 kg · every top set at RPE 9–9.5", action: "Review", draft: null },
  { id: "t3", clientId: 3, severity: "warn", label: "Data", title: "Lena's check-in is 2 days overdue", evidence: "Weekly check-in due Thu 23 Oct · no reply to reminder", action: "Nudge", draft: "Hey Lena, quick reminder that your weekly check-in is ready. It takes about two minutes and helps me adjust next week's plan." },
];

const PROGRESSIONS = [
  { clientId: 2, exercise: "Back squat", from: "100 kg", to: "102.5 kg", why: "All 4×5 sets at RPE 7 for two sessions" },
  { clientId: 4, exercise: "Bench press", from: "110 kg", to: "112.5 kg", why: "Top set RPE 7.5, target 8" },
  { clientId: 5, exercise: "Trap bar deadlift", from: "67.5 kg", to: "70 kg", why: "4×5 at RPE 7, target 8" },
];

const clientById = (id: number): Client => {
  const c = CLIENTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown client ${id}`);
  return c;
};

export function Brief({ openClient, say }: { openClient: (id: number) => void; say: (m: string) => void }) {
  const { log } = useApexState(store);
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TriageItem | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({ 2: true, 4: true, 5: true });
  const pending = TRIAGE.filter((i) => !handled[i.id]);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const handle = (id: string) => setHandled((d) => ({ ...d, [id]: true }));

  return (
    <>
      <div className="full">
        <div className="eyebrow">Saturday 25 October</div>
        <h1 className="h1">Morning, Kamal. {pending.length ? `${pending.length} clients need you.` : "Everyone's on track."}</h1>
      </div>
      <div className="kpis full">
        <div className="kpi"><b>{CLIENTS.length}</b><small>Active clients</small><i style={{ color: "var(--good)" }}>+2 this month</i></div>
        <div className="kpi"><b>74%</b><small>Sessions done, 7 days</small><i style={{ color: "var(--good)" }}>+4 pts</i></div>
        <div className="kpi"><b style={{ color: "var(--act)" }}>{pending.length}</b><small>Need you today</small><i style={{ color: "var(--text3)" }}>{TRIAGE.length - pending.length} handled</i></div>
      </div>

      <section>
        <div className="sect"><h2 className="h2">Needs you today</h2><span className="tiny">Ranked by urgency</span></div>
        <div className="card flat list">
          {pending.length === 0 && (
            <div className="li"><div className="grow"><div className="h3">All clear</div><div className="small">New flags appear here as clients log, skip or check in.</div></div></div>
          )}
          {pending.map((it) => {
            const c = clientById(it.clientId);
            const tone = it.severity === "crit" ? "var(--crit)" : "var(--warn)";
            return (
              <div key={it.id} className="tri">
                <div className="stripe" style={{ background: tone }} />
                <div>
                  <div className="row" style={{ gap: 10 }}><Avatar initials={c.initials} size={32} tone={tone} /><div className="grow"><div className="h3">{it.title}</div></div></div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Label kind={it.label === "Data" ? "data" : "insight"}>{it.label}</Label>
                    <span className="small">{it.evidence}</span>
                  </div>
                  <div className="acts">
                    <button className="btn act sm" onClick={() => (it.draft ? setDraft(it) : openClient(it.clientId))}>{it.action}</button>
                    <button className="btn ghost sm" onClick={() => openClient(it.clientId)}>Open client</button>
                    <button className="btn ghost sm" onClick={() => { handle(it.id); say("Dismissed for today"); }}>Dismiss</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="sect"><h2 className="h2">Progressions ready</h2><Label kind="insight">Rule-based</Label></div>
        <div className="card flat list">
          {PROGRESSIONS.map((p) => (
            <label key={p.clientId} className="li" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={!!selected[p.clientId]} onChange={(e) => setSelected((s) => ({ ...s, [p.clientId]: e.target.checked }))} style={{ width: 20, height: 20, accentColor: "var(--act)" }} />
              <div className="grow">
                <div className="h3">{firstName(clientById(p.clientId).name)} · {p.exercise}</div>
                <div className="small"><span className="num">{p.from} → <b style={{ color: "var(--act)" }}>{p.to}</b></span> · {p.why}</div>
              </div>
            </label>
          ))}
          <div style={{ padding: 12 }}>
            <button className="btn act block" disabled={selectedCount === 0} onClick={() => { say(`${selectedCount} progressions applied to next session`); setSelected({}); }}>Apply selected</button>
          </div>
        </div>
      </section>

      <section>
        <div className="sect"><h2 className="h2">Latest activity</h2></div>
        <div className="card flat list">
          {log && (
            <div className="li">
              <Avatar initials="PS" size={34} tone="var(--good)" />
              <div className="grow">
                <div className="h3">Priya finished {log.workoutName}</div>
                <div className="small"><Label kind="data">Data</Label> <span className="num">{log.sets} sets · {log.volumeKg.toLocaleString()} kg · RPE {log.rpe}</span>{log.prs > 0 ? ` · ${log.prs} PR` : ""}</div>
              </div>
              <span className="tiny">Just now</span>
            </div>
          )}
          <div className="li"><Avatar initials="OT" size={34} tone="var(--good)" /><div className="grow"><div className="h3">Omar hit a 100 kg squat PR</div><div className="small">Send a congratulations?</div></div><button className="btn ghost sm" onClick={() => say("Message sent to Omar")}>Send</button></div>
          <div className="li"><Avatar initials="PS" size={34} /><div className="grow"><div className="h3">Priya submitted a check-in</div><div className="small">Sleep 7.5 h · energy 4/5 · weight 62.3 kg</div></div><button className="btn ghost sm" onClick={() => openClient(5)}>View</button></div>
        </div>
      </section>

      {draft && (
        <Sheet onClose={() => setDraft(null)} label="Draft message">
          <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">Drafted in your tone · nothing sent yet</span></div>
          <h2 className="h2">Message to {firstName(clientById(draft.clientId).name)}</h2>
          <textarea id="draftmsg" className="field" rows={5} defaultValue={draft.draft ?? ""} style={{ resize: "vertical", lineHeight: 1.5 }} />
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn act" style={{ flex: 2 }} onClick={() => { handle(draft.id); setDraft(null); say("Sent · logged as your decision"); }}>Approve and send</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
