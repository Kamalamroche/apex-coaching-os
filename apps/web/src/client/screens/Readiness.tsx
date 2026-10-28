import {
  BAND_LABEL, READINESS_QUESTIONS, describeLighter, exerciseFor, lighterSession, readinessOf, readinessReason,
  type Readiness, type ReadinessAnswers, type Workout, type WorkoutItem,
} from "@apex/core";
import { Icons, Label } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";

const line = (it: WorkoutItem) => `${it.sets}×${it.reps}${it.kg ? ` · ${it.kg} kg` : ""}`;

/** Four taps before the first set. On a low day the client can pick a lighter version of today; the program stays as the coach wrote it. */
export function ReadinessCheck({ workout, onStart, onExit }: { workout: Workout; onStart: (readiness: Readiness | null, session: Workout) => void; onExit: () => void }) {
  const { coachName } = useAppInfo();
  const [a, setA] = useState<Partial<ReadinessAnswers>>({});
  const complete = READINESS_QUESTIONS.every((q) => a[q.key]);
  const r = complete ? readinessOf(a as ReadinessAnswers) : null;
  const lighter = r && r.band !== "ready" ? lighterSession(workout, r.band) : null;
  const changed = lighter ? workout.items.map((it, i) => [it, lighter.items[i]!] as const).filter(([b, l]) => line(b) !== line(l)) : [];

  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit}>✕ Exit</button>
        <span className="small" style={{ fontWeight: 700 }}>{workout.name}</span>
        <button className="link" onClick={() => onStart(null, workout)}>Skip</button>
      </div>
      <main className="main" style={{ paddingBottom: 40 }}>
        <div><div className="eyebrow">Before you start</div><h1 className="h1">How ready are you today?</h1><div className="small" style={{ marginTop: 4 }}>Four taps. {coachName} sees this with your session.</div></div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {READINESS_QUESTIONS.map((q) => (
            <div key={q.key} className="rdy-q" role="group" aria-label={q.label}>
              <div className="sect"><h3 className="h3">{q.label}</h3><span className="tiny">1 {q.low} · 5 {q.high}</span></div>
              <div className="rpe">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} className={a[q.key] === n ? "on" : ""} aria-pressed={a[q.key] === n} onClick={() => setA((x) => ({ ...x, [q.key]: n }))}>{n}</button>)}
              </div>
            </div>
          ))}
        </div>

        {r && (
          <div className={`card rdy-${r.band}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="sect" style={{ margin: 0 }}><Label kind="data">Data</Label><span className="rdy-band">{BAND_LABEL[r.band]}</span></div>
            <div className="rdy-score"><b className="num">{r.score}</b><span className="small">/ 100 readiness</span></div>
            <div className="rdy-meter"><span style={{ width: `${r.score}%` }} /></div>
            <div className="small" style={{ color: "var(--text)" }}>{readinessReason(r)}</div>
          </div>
        )}

        {r && lighter && r.band !== "ready" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="row" style={{ gap: 8 }}><Label kind="ai">AI suggestion</Label><span className="tiny">Rule-based · your choice</span></div>
            <div className="small" style={{ color: "var(--text)" }}>A lighter version of today: {describeLighter(r.band)}. Same exercises, so it still counts.</div>
            {changed.length > 0 && (
              <div className="list">
                {changed.slice(0, 4).map(([b, l]) => (
                  <div key={b.key} className="tiny num cop-row" style={{ padding: "4px 0", borderTop: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text)" }}>{exerciseFor(b).name}</span> <s>{line(b)}</s> → {line(l)}
                  </div>
                ))}
                {changed.length > 4 && <div className="tiny" style={{ paddingTop: 4 }}>and {changed.length - 4} more</div>}
              </div>
            )}
            <div className="row">
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => onStart(r, workout)}>Train as planned</button>
              <button className="btn act" style={{ flex: 1 }} onClick={() => onStart({ ...r, adjusted: true }, lighter)}>Go lighter</button>
            </div>
          </div>
        )}

        {r?.band === "ready" && (
          <button className="btn act block" style={{ minHeight: 54, fontSize: 16 }} onClick={() => onStart(r, workout)}><Icons.play /> Start workout</button>
        )}
      </main>
    </div>
  );
}
