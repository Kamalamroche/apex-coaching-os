import {
  BAND_ADVICE, BAND_LABEL, READINESS_QUESTIONS, describeLighter, exerciseFor, lighterSession, readinessOf, vsUsual,
  type Readiness, type ReadinessAnswers, type ReadinessPoint, type Workout, type WorkoutItem,
} from "@apex/core";
import { Gauge, Icons, Label } from "@apex/ui";
import { useState, type CSSProperties } from "react";
import { useAppInfo } from "../../app/AppContext";
import { ContributorRows, FACTOR_COLOUR, QUESTION_ICON, ReadinessTrend, SCORE_GRADIENT, answerColour, bandColour } from "../../app/ReadinessViz";

const line = (it: WorkoutItem) => `${it.sets}×${it.reps}${it.kg ? ` · ${it.kg} kg` : ""}`;
const LEVEL_HEIGHTS = [14, 20, 26, 32, 38];
const FOUR = ["var(--ai)", "var(--act)", "var(--data)", "var(--blue)"];

/** Before the first set: four taps, then a score screen (score, advice, what's driving it, the week, today's plan).
    On a low day the client can pick a lighter version of today; the program stays as the coach wrote it. */
export function ReadinessCheck({ workout, history, onStart, onExit }: { workout: Workout; history: ReadinessPoint[] | undefined; onStart: (readiness: Readiness | null, session: Workout) => void; onExit: () => void }) {
  const { coachName } = useAppInfo();
  const [a, setA] = useState<Partial<ReadinessAnswers>>({});
  const [step, setStep] = useState<"ask" | "score">("ask");
  const answered = READINESS_QUESTIONS.filter((q) => a[q.key]).length;
  const r = answered === READINESS_QUESTIONS.length ? readinessOf(a as ReadinessAnswers) : null;

  if (step === "score" && r) return <Score r={r} workout={workout} history={history} onBack={() => setStep("ask")} onStart={onStart} onExit={onExit} />;

  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit}>✕ Exit</button>
        <span className="small" style={{ fontWeight: 700 }}>{workout.name}</span>
        <button className="link" onClick={() => onStart(null, workout)}>Skip</button>
      </div>
      <main className="main" style={{ paddingBottom: 40 }}>
        <section className="rdy-hero" style={{ "--band": "var(--ai)", flexDirection: "row", gap: 16, padding: "18px 16px" } as CSSProperties}>
          <Gauge value={answered ? (answered / 4) * 100 : null} size={96} stroke={9} color="var(--act)" gradient={FOUR} label={`${answered} of 4 answered`}>
            <b className="rdy-num sm">{answered}<span style={{ fontSize: 14, color: "var(--text3)" }}>/4</span></b>
          </Gauge>
          <div style={{ textAlign: "left" }}>
            <div className="eyebrow">Daily readiness</div>
            <h1 className="h1" style={{ fontSize: 22 }}>How are you feeling today?</h1>
            <div className="small" style={{ marginTop: 4 }}>Four taps. {coachName} sees this with your session.</div>
          </div>
        </section>

        {READINESS_QUESTIONS.map((q) => {
          const v = a[q.key];
          const Icon = QUESTION_ICON[q.key];
          return (
            <div key={q.key} className="rdy-q" role="group" aria-label={q.label} style={{ "--c": FACTOR_COLOUR[q.key], "--q": answerColour(v) } as CSSProperties}>
              <div className="rdy-qh">
                <span className="rdy-ico"><Icon /></span>
                <div><h3 className="h3">{q.label}</h3><div className="tiny">1 {q.low} · 5 {q.high}</div></div>
                <span className="rdy-val">{v ? q.scale[v - 1] : "Tap a level"}</span>
              </div>
              <div className="rdy-lvl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`${v && n <= v ? "fill" : ""} ${v === n ? "on" : ""}`} aria-pressed={v === n} aria-label={`${q.label} ${n}: ${q.scale[n - 1]}`} onClick={() => setA((x) => ({ ...x, [q.key]: n }))}>
                    <i style={{ height: LEVEL_HEIGHTS[n - 1], opacity: v && n <= v ? 0.5 + n * 0.1 : 1 }} />{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button className="btn act block" style={{ minHeight: 54, fontSize: 16 }} disabled={!r} onClick={() => { setStep("score"); window.scrollTo(0, 0); }}>
          {r ? "See my readiness" : `${4 - answered} to go`}
        </button>
      </main>
    </div>
  );
}

function Score({ r, workout, history, onBack, onStart, onExit }: { r: Readiness; workout: Workout; history: ReadinessPoint[] | undefined; onBack: () => void; onStart: (readiness: Readiness | null, session: Workout) => void; onExit: () => void }) {
  const colour = bandColour(r.band);
  const advice = BAND_ADVICE[r.band];
  const usual = vsUsual(history, r.score);
  const lighter = r.band !== "ready" ? lighterSession(workout, r.band) : null;
  const changed = lighter ? workout.items.map((it, i) => [it, lighter.items[i]!] as const).filter(([b, l]) => line(b) !== line(l)) : [];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit}>✕ Exit</button>
        <span className="small" style={{ fontWeight: 700 }}>Your readiness</span>
        <button className="link" onClick={onBack}>Edit answers</button>
      </div>
      <main className="main" style={{ paddingBottom: 40 }}>
        <section className="rdy-hero" style={{ "--band": colour } as CSSProperties}>
          <div className="eyebrow">{today}</div>
          <Gauge value={r.score} size={230} stroke={18} color={colour} gradient={SCORE_GRADIENT} label={`Readiness ${r.score} out of 100, ${BAND_LABEL[r.band]}`}>
            <b className="rdy-num num">{r.score}</b><span className="rdy-word">{BAND_LABEL[r.band]}</span>
          </Gauge>
          {usual && (
            <span className="rdy-delta" style={{ "--d": usual.diff >= 0 ? "var(--good)" : "var(--crit)" } as CSSProperties}>
              {usual.diff >= 0 ? "▲" : "▼"} <span className="num">{Math.abs(usual.diff)}</span> {usual.diff >= 0 ? "above" : "below"} your usual <span className="num">{usual.usual}</span>
            </span>
          )}
          <div style={{ textAlign: "center" }}>
            <h2 className="h2" style={{ fontSize: 22 }}>{advice.title}</h2>
            <div className="small" style={{ marginTop: 4 }}>{advice.line}</div>
          </div>
        </section>

        <section>
          <div className="sect"><h3 className="h3">What's driving it</h3><Label kind="data">Data · your answers</Label></div>
          <div className="card"><ContributorRows answers={r} /></div>
        </section>

        <section>
          <div className="sect"><h3 className="h3">Your last sessions</h3><span className="tiny">Readiness score</span></div>
          <div className="card rdy-card" style={{ "--band": colour } as CSSProperties}><ReadinessTrend points={history ?? []} today={r.score} usual={usual?.usual ?? null} /></div>
        </section>

        <section>
          <div className="sect"><h3 className="h3">Today's plan</h3><span className="tiny">{workout.name}</span></div>
          {lighter ? (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, borderColor: "color-mix(in srgb,var(--ai) 40%,var(--line))", background: "radial-gradient(80% 60% at 100% 0%,var(--ai-soft),transparent 70%),var(--card)" }}>
              <div className="row" style={{ gap: 8 }}><Label kind="ai">AI suggestion</Label><span className="tiny">Rule-based · your choice</span></div>
              <div className="small" style={{ color: "var(--text)" }}>A lighter version of today: {describeLighter(r.band === "ready" ? "steady" : r.band)}. Same exercises, so it still counts.</div>
              {changed.length > 0 && (
                <div className="list">
                  {changed.slice(0, 4).map(([b, l]) => (
                    <div key={b.key} className="tiny num cop-row" style={{ padding: "5px 0", borderTop: "1px solid var(--line)" }}>
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
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, borderColor: "color-mix(in srgb,var(--good) 40%,var(--line))", background: "radial-gradient(80% 60% at 100% 0%,var(--good-soft),transparent 70%),var(--card)" }}>
              <div className="small" style={{ color: "var(--text)" }}>As {workout.items.length ? "planned" : "written"}: <span className="num">{workout.items.length}</span> exercises · about <span className="num">{workout.minutes}</span> min.</div>
              <button className="btn act block" style={{ minHeight: 54, fontSize: 16 }} onClick={() => onStart(r, workout)}><Icons.play /> Start workout</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
