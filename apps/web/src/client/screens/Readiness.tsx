import {
  BAND_LABEL, READINESS_QUESTIONS, describeLighter, exerciseFor, lighterSession, readinessOf, readinessReason,
  type Readiness, type ReadinessAnswers, type Workout, type WorkoutItem,
} from "@apex/core";
import { Gauge, Icons, Label } from "@apex/ui";
import { useState, type CSSProperties } from "react";
import { useAppInfo } from "../../app/AppContext";
import { Contributors, QUESTION_ICON, answerColour, bandColour } from "../../app/ReadinessViz";

const line = (it: WorkoutItem) => `${it.sets}×${it.reps}${it.kg ? ` · ${it.kg} kg` : ""}`;
const LEVEL_HEIGHTS = [14, 20, 26, 32, 38];

/** Four taps before the first set. On a low day the client can pick a lighter version of today; the program stays as the coach wrote it. */
export function ReadinessCheck({ workout, onStart, onExit }: { workout: Workout; onStart: (readiness: Readiness | null, session: Workout) => void; onExit: () => void }) {
  const { coachName } = useAppInfo();
  const [a, setA] = useState<Partial<ReadinessAnswers>>({});
  const answered = READINESS_QUESTIONS.filter((q) => a[q.key]).length;
  const r = answered === READINESS_QUESTIONS.length ? readinessOf(a as ReadinessAnswers) : null;
  const lighter = r && r.band !== "ready" ? lighterSession(workout, r.band) : null;
  const changed = lighter ? workout.items.map((it, i) => [it, lighter.items[i]!] as const).filter(([b, l]) => line(b) !== line(l)) : [];
  const colour = bandColour(r?.band ?? null);

  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit}>✕ Exit</button>
        <span className="small" style={{ fontWeight: 700 }}>{workout.name}</span>
        <button className="link" onClick={() => onStart(null, workout)}>Skip</button>
      </div>
      <main className="main" style={{ paddingBottom: 40 }}>
        <section className="rdy-hero" style={{ "--band": colour } as CSSProperties}>
          <div style={{ textAlign: "center" }}><div className="eyebrow">Before you start</div><h1 className="h1" style={{ fontSize: 22 }}>How ready are you today?</h1></div>
          <Gauge value={r?.score ?? (answered ? (answered / 4) * 100 : null)} color={r ? colour : "var(--line2)"} marks={r ? [45, 70] : []} label={r ? `Readiness ${r.score} out of 100, ${BAND_LABEL[r.band]}` : `${answered} of 4 answered`}>
            {r ? (
              <><b className="rdy-num num">{r.score}</b><span className="rdy-word">{BAND_LABEL[r.band]}</span></>
            ) : (
              <><b className="rdy-num num wait">{answered}<span style={{ fontSize: 26 }}>/4</span></b><span className="rdy-word wait">answered</span></>
            )}
          </Gauge>
          <Contributors answers={a} />
          <div className="small" style={{ textAlign: "center", color: r ? "var(--text)" : undefined }}>{r ? readinessReason(r) : `Four taps. ${coachName} sees this with your session.`}</div>
          {r && <Label kind="data">Data · your answers</Label>}
        </section>

        {READINESS_QUESTIONS.map((q) => {
          const v = a[q.key];
          const Icon = QUESTION_ICON[q.key];
          return (
            <div key={q.key} className="rdy-q" role="group" aria-label={q.label} style={{ "--c": answerColour(v) } as CSSProperties}>
              <div className="rdy-qh">
                <span className="rdy-ico"><Icon /></span>
                <div><h3 className="h3">{q.label}</h3><div className="tiny">1 {q.low} · 5 {q.high}</div></div>
                <span className="rdy-val">{v ? q.scale[v - 1] : "Tap a level"}</span>
              </div>
              <div className="rdy-lvl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`${v && n <= v ? "fill" : ""} ${v === n ? "on" : ""}`} aria-pressed={v === n} aria-label={`${q.label} ${n}: ${q.scale[n - 1]}`} onClick={() => setA((x) => ({ ...x, [q.key]: n }))}>
                    <i style={{ height: LEVEL_HEIGHTS[n - 1] }} />{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {r && lighter && r.band !== "ready" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, borderColor: "color-mix(in srgb,var(--ai) 35%,var(--line))" }}>
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
