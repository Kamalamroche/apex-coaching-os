import { SCORES, type BodyPoint, type CompareRow, type Measure, type Score } from "@apex/core";
import type { ReactNode } from "react";
import { Label } from "./primitives";
import "./assessment.css";

/* Posture and mobility assessments: the photo with its measured lines, the score picker, the mobility profile,
   the before and after table, and the guide drawn over the client's camera. Flat and drawn in-app. */

type View = "front" | "side" | "back";
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const seen = (p: BodyPoint | undefined) => !!p && (p.visibility ?? 1) >= 0.5;

/** A posture photo (or a plain grid when there's none) with the body points and the lines that were measured. */
export function PostureView({ url, points, aspect, view, measures, height = 300 }: { url: string | null; points: BodyPoint[] | null; aspect: number | null; view: View; measures: Measure[]; height?: number }) {
  const ar = aspect ?? 0.75;
  const W = 300 * ar, H = 300;
  const P = (i: number) => points?.[i];
  const at = (p: BodyPoint) => [p.x * W, p.y * H] as const;
  const flagged = (label: string) => measures.find((m) => m.label === label)?.flag ?? false;
  const line = (a: BodyPoint | undefined, b: BodyPoint | undefined, flag: boolean, extend = 0.18) => {
    if (!seen(a) || !seen(b)) return null;
    const [x1, y1] = at(a!), [x2, y2] = at(b!);
    const dx = x2 - x1, dy = y2 - y1;
    return <line x1={x1 - dx * extend} y1={y1 - dy * extend} x2={x2 + dx * extend} y2={y2 + dy * extend} className={flag ? "pv-m flag" : "pv-m ok"} />;
  };
  let side: number[] = [];
  if (view === "side" && points) {
    const v = (i: number) => P(i)?.visibility ?? 0;
    side = v(7) + v(11) + v(23) + v(27) >= v(8) + v(12) + v(24) + v(28) ? [7, 11, 23, 25, 27] : [8, 12, 24, 26, 28];
  }
  const ankle = side.length ? P(side[4]!) : undefined;
  return (
    <div className={`pv ${url ? "has-photo" : ""}`} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${view} posture photo with measured lines`}>
        <defs><pattern id={`pvg-${view}`} width={W / 12} height={H / 16} patternUnits="userSpaceOnUse"><path d={`M ${W / 12} 0 L 0 0 0 ${H / 16}`} className="pv-grid" /></pattern></defs>
        {url ? <image href={url} width={W} height={H} preserveAspectRatio="xMidYMid slice" /> : <rect width={W} height={H} className="pv-bg" />}
        <rect width={W} height={H} fill={`url(#pvg-${view})`} />
        {points && view !== "side" && BONES.map(([a, b]) => seen(P(a)) && seen(P(b)) ? <line key={`${a}-${b}`} x1={at(P(a)!)[0]} y1={at(P(a)!)[1]} x2={at(P(b)!)[0]} y2={at(P(b)!)[1]} className="pv-bone" /> : null)}
        {points && view !== "side" && seen(P(0)) && <circle cx={at(P(0)!)[0]} cy={at(P(0)!)[1] + 2} r={14} className="pv-head" />}
        {view !== "side" && <>{line(P(11), P(12), flagged("Shoulder level"))}{line(P(23), P(24), flagged("Hip level"))}</>}
        {ankle && seen(ankle) && <line x1={at(ankle)[0]} y1={6} x2={at(ankle)[0]} y2={H - 4} className="pv-plumb" />}
        {side.length > 0 && !url && <polyline points={side.slice(1).map((i) => P(i)).filter(seen).map((p) => at(p!).join(",")).join(" ")} className="pv-bone" fill="none" style={{ strokeWidth: 16 }} />}
        {side.length > 0 && seen(P(side[0]!)) && <circle cx={at(P(side[0]!)!)[0]} cy={at(P(side[0]!)!)[1] - 2} r={13} className="pv-head" />}
        {side.length > 0 && <polyline points={side.map((i) => P(i)).filter(seen).map((p) => at(p!).join(",")).join(" ")} className={flagged("Head position") || flagged("Body line") ? "pv-m flag" : "pv-m ok"} />}
        {points && (view === "side" ? side : [11, 12, 23, 24, 25, 26, 27, 28]).map((i) => seen(P(i)) ? <circle key={i} cx={at(P(i)!)[0]} cy={at(P(i)!)[1]} r={4} className="pv-pt" /> : null)}
      </svg>
      {!url && <span className="pv-note tiny">Demo figure</span>}
    </div>
  );
}

/** APEX's score for one test, on the 0 to 3 scale. */
export function ScoreScale({ value }: { value: Score | null }) {
  return (
    <div className="as-scores" role="img" aria-label={value === null ? "Not scored yet" : `Score ${value} of 3, ${SCORES.find((s) => s.score === value)?.label}`}>
      {SCORES.map((s) => (
        <span key={s.score} className={`as-score s${s.score} ${value === s.score ? "on" : ""}`}><b className="num">{s.score}</b><span>{s.label}</span></span>
      ))}
    </div>
  );
}

const ringTone = (p: number) => (p >= 75 ? "var(--good)" : p >= 50 ? "var(--act)" : "var(--crit)");

/** Mobility profile: the overall score and a bar per test. */
export function AssessmentProfile({ percent, headline, sub, rows, label }: { percent: number | null; headline: string; sub: string; rows: { key: string; title: string; detail: string; score: Score | null; suggested: boolean }[]; label?: ReactNode }) {
  const r = 34, len = 2 * Math.PI * r;
  return (
    <section className="card stack as-profile">
      <div className="row" style={{ gap: 14 }}>
        <div className="as-ring" role="img" aria-label={percent === null ? "Not scored yet" : `Score ${percent} out of 100`}>
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r={r} className="as-ring-track" /><circle cx="40" cy="40" r={r} className="as-ring-val" style={{ stroke: percent === null ? "var(--line2)" : ringTone(percent), strokeDasharray: `${((percent ?? 0) / 100) * len} ${len}` }} /></svg>
          <b className="num">{percent ?? "–"}</b>
        </div>
        <div className="grow"><div className="h3">{headline}</div><div className="small">{sub}</div></div>
      </div>
      <div className="sect" style={{ marginBottom: 0 }}><span className="h3">By test</span>{label ?? <Label kind="data">Data</Label>}</div>
      <div className="as-rows">
        {rows.map((x) => (
          <div key={x.key} className="as-row">
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}><span className="small" style={{ color: "var(--text)" }}>{x.title}</span><span className="tiny num">{x.detail}</span></div>
            <div className={`as-bar ${x.suggested ? "sugg" : ""}`}><i style={{ width: `${x.score === null ? 0 : ((x.score + (x.score === 0 ? 0.3 : 0)) / 3) * 100}%`, background: x.score === null ? "var(--line2)" : x.score >= 3 ? "var(--good)" : x.score === 2 ? "var(--act)" : "var(--crit)" }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Re-test: before and after, better in green. */
export function CompareTable({ rows, before, after }: { rows: CompareRow[]; before: string; after: string }) {
  if (!rows.length) return null;
  return (
    <table className="as-compare">
      <thead><tr><th scope="col" /><th scope="col">{before}</th><th scope="col">{after}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}><th scope="row">{r.label}</th><td className="num">{r.before}</td><td className={`num ${r.better === true ? "good" : r.better === false ? "bad" : ""}`}>{r.after}{r.better === true ? " ▲" : r.better === false ? " ▼" : ""}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** Drawn over the client's camera: a grid, an outline to stand in and, side on, a line for the ankle. */
export function CameraGuide({ view }: { view: View | "move" }) {
  return (
    <svg className="as-guide" viewBox="0 30 300 470" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {[1, 2].map((i) => <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={533} className="g" />)}
      {[1, 2, 3].map((i) => <line key={`h${i}`} x1={0} y1={i * 133} x2={300} y2={i * 133} className="g" />)}
      {view === "side" ? (
        <>
          <line x1={146} y1={40} x2={146} y2={500} className="plumb" />
          <path d="M 158 62 a 22 22 0 1 1 -1 0 M 144 106 Q 128 120 130 180 Q 128 250 136 290 L 130 400 L 134 488 L 176 492 L 164 476 L 158 400 L 166 290 Q 176 230 172 172 Q 174 118 158 106 Z" className="outline" />
        </>
      ) : view === "move" ? null : (
        <path d="M 150 60 a 22 22 0 1 1 -0.1 0 M 136 104 L 104 116 Q 96 200 92 268 L 104 270 L 116 170 L 120 290 L 124 488 L 146 488 L 150 320 L 154 488 L 176 488 L 180 290 L 184 170 L 196 270 L 208 268 Q 204 200 196 116 L 164 104 Z" className="outline" />
      )}
    </svg>
  );
}
