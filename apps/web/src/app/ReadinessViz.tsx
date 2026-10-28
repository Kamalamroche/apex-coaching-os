import { BAND_LABEL, READINESS_QUESTIONS, readinessReason, type Readiness, type ReadinessAnswers, type ReadinessBand } from "@apex/core";
import { Gauge, Icons, Label, MiniRing } from "@apex/ui";
import type { CSSProperties } from "react";

/* Readiness graphics shared by the client check and the coach's session summary. Original HELIX styling. */

export const bandColour = (band: ReadinessBand | null): string => (band === "ready" ? "var(--good)" : band === "steady" ? "var(--warn)" : band === "low" ? "var(--crit)" : "var(--text3)");
export const answerColour = (n: number | undefined): string => (!n ? "var(--text3)" : n >= 4 ? "var(--good)" : n === 3 ? "var(--warn)" : "var(--crit)");
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
            <MiniRing value={v ?? null} size={size} color={answerColour(v)} label={`${q.label} ${v ?? "not answered"} of 5`}><Icon /></MiniRing>
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
      <div className="sect" style={{ margin: 0 }}><h3 className="h3">Readiness</h3><span className="row" style={{ gap: 6 }}>{r.adjusted && <span className="chip" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>Went lighter</span>}<Label kind="data">Data</Label></span></div>
      <div className="rdy-sum">
        <Gauge value={r.score} size={96} stroke={9} color={bandColour(r.band)} marks={[45, 70]} label={`Readiness ${r.score} out of 100, ${BAND_LABEL[r.band]}`}>
          <b className="rdy-num sm">{r.score}</b><span className="rdy-word" style={{ fontSize: 9 }}>{BAND_LABEL[r.band]}</span>
        </Gauge>
        <div className="grow"><Contributors answers={r} size={38} /></div>
      </div>
      <div className="small" style={{ color: "var(--text)" }}>{readinessReason(r)}{r.adjusted ? " Chose the lighter session." : ""}</div>
    </div>
  );
}
