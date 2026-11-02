import { BAND_LABEL, READINESS_QUESTIONS, readinessBand, readinessReason, type Readiness, type ReadinessAnswers, type ReadinessBand, type ReadinessPoint } from "@apex/core";
import { Gauge, Icons, Label, MiniRing } from "@apex/ui";
import type { CSSProperties } from "react";

/* Readiness graphics shared by the client check and the coach's session summary. Original HELIX styling. */

export const bandColour = (band: ReadinessBand | null): string => (band === "ready" ? "var(--good)" : band === "steady" ? "var(--warn)" : band === "low" ? "var(--crit)" : "var(--text3)");
export const answerColour = (n: number | undefined): string => (!n ? "var(--text3)" : n >= 4 ? "var(--good)" : n === 3 ? "var(--warn)" : "var(--crit)");
/** Each factor's own colour, so the four read apart at a glance. Quality (low → high) stays red → amber → green. */
export const FACTOR_COLOUR = { sleep: "var(--viz-1)", energy: "var(--viz-2)", soreness: "var(--viz-3)", stress: "var(--viz-4)" } as const;
export const QUESTION_ICON = { sleep: Icons.sleep, energy: Icons.energy, soreness: Icons.soreness, stress: Icons.stress } as const;

/** The four answers as small rings, each with its icon and word. */
export function Contributors({ answers, size = 52 }: { answers: Partial<ReadinessAnswers>; size?: number }) {
  return (
    <div className="rdy-contrib">
      {READINESS_QUESTIONS.map((q) => {
        const v = answers[q.key];
        const Icon = QUESTION_ICON[q.key];
        return (
          <div key={q.key}>
            <MiniRing value={v ?? null} size={size} color={FACTOR_COLOUR[q.key]} label={`${q.label} ${v ?? "not answered"} of 5`}><Icon /></MiniRing>
            <span className="tiny" style={{ color: "var(--text2)", fontWeight: 700 }}>{q.label}</span>
            <span className="tiny" style={{ color: answerColour(v) }}>{v ? (size >= 48 ? q.scale[v - 1] : `${v}/5`) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact card for a finished session: gauge, the four answers, and whether the client went lighter. */
export function ReadinessSummary({ readiness: r }: { readiness: Readiness }) {
  return (
    <div className="card" style={{ "--band": bandColour(r.band), padding: "12px", display: "flex", flexDirection: "column", gap: 10 } as CSSProperties}>
      <div className="sect" style={{ margin: 0 }}><h3 className="h3">Readiness</h3><span className="row" style={{ gap: 6 }}>{r.adjusted && <span className="chip">Went lighter</span>}<Label kind="data">Data</Label></span></div>
      <div className="rdy-sum">
        <Gauge value={r.score} size={96} stroke={9} color={bandColour(r.band)} label={`Readiness ${r.score} out of 100, ${BAND_LABEL[r.band]}`}>
          <b className="rdy-num sm">{r.score}</b><span className="rdy-word" style={{ fontSize: 9 }}>{BAND_LABEL[r.band]}</span>
        </Gauge>
        <div className="grow"><Contributors answers={r} size={38} /></div>
      </div>
      <div className="small" style={{ color: "var(--text)" }}>{readinessReason(r)}{r.adjusted ? " Chose the lighter session." : ""}</div>
    </div>
  );
}

const DAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Bars for the last sessions' scores plus today, each in its band colour, with a dashed line at the usual score. */
export function ReadinessTrend({ points, today, usual }: { points: ReadinessPoint[]; today: number; usual: number | null }) {
  const bars = [...points.slice(-6).map((p) => ({ score: p.score, day: DAY[new Date(p.at).getDay()] ?? "", now: false })), { score: today, day: "Today", now: true }];
  const h = 120;
  return (
    <div className="rdy-trend" role="img" aria-label={`Readiness over the last ${bars.length} sessions: ${bars.map((b) => b.score).join(", ")}`}>
      <div className="rdy-trend-plot" style={{ height: h }}>
        {usual !== null && <div className="rdy-usual" style={{ bottom: (usual / 100) * h }}><span className="tiny num">usual {usual}</span></div>}
        {bars.map((b, i) => (
          <div key={i} className={`rdy-bar ${b.now ? "now" : ""}`} style={{ "--b": bandColour(readinessBand(b.score)) } as CSSProperties}>
            <span className="num">{b.score}</span>
            <i style={{ height: Math.max(6, (b.score / 100) * (h - 18)) }} />
          </div>
        ))}
      </div>
      <div className="rdy-trend-days">{bars.map((b, i) => <span key={i} className={`tiny ${b.now ? "now" : ""}`}>{b.day}</span>)}</div>
    </div>
  );
}

/** The four answers as rows: icon, word, a five-step meter in the factor's colour. */
export function ContributorRows({ answers }: { answers: ReadinessAnswers }) {
  return (
    <div className="rdy-rows">
      {READINESS_QUESTIONS.map((q) => {
        const v = answers[q.key];
        const Icon = QUESTION_ICON[q.key];
        return (
          <div key={q.key} className="rdy-row" style={{ "--c": FACTOR_COLOUR[q.key], "--q": answerColour(v) } as CSSProperties}>
            <span className="rdy-ico sm"><Icon /></span>
            <div className="grow">
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}><b className="small" style={{ color: "var(--text)" }}>{q.label}</b><span className="rdy-val">{q.scale[v - 1]}</span></div>
              <div className="rdy-seg">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= v ? "on" : ""} />)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
