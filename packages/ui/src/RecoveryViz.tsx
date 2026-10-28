import { formatSleep, type Baseline, type RecoveryDay, type SleepStages } from "@apex/core";
import { useId, useState, type PointerEvent } from "react";

/* Recovery visuals, plain SVG and tokens only: sleep stages, nightly sleep bars, and a trend
   line with the client's own usual range shaded behind it. */

export const STAGE_COLOURS: Record<keyof SleepStages, string> = { deep: "var(--blue)", rem: "var(--ai)", light: "var(--data)", awake: "var(--warn)" };
export const STAGE_LABEL: Record<keyof SleepStages, string> = { deep: "Deep", rem: "REM", light: "Light", awake: "Awake" };
const STAGE_ORDER: (keyof SleepStages)[] = ["deep", "rem", "light", "awake"];

export function SleepStagesBar({ stages }: { stages: SleepStages }) {
  const total = STAGE_ORDER.reduce((a, k) => a + stages[k], 0) || 1;
  return (
    <div className="rc-stages">
      <div className="rc-stage-strip" role="img" aria-label={STAGE_ORDER.map((k) => `${STAGE_LABEL[k]} ${formatSleep(stages[k])}`).join(", ")}>
        {STAGE_ORDER.map((k) => stages[k] > 0 && <i key={k} style={{ flexGrow: stages[k], background: STAGE_COLOURS[k] }} />)}
      </div>
      <div className="rc-stage-key">
        {STAGE_ORDER.map((k) => (
          <div key={k}>
            <span><i style={{ background: STAGE_COLOURS[k] }} />{STAGE_LABEL[k]}</span>
            <b className="num">{formatSleep(stages[k]).replace(/^0 h /, "")}</b>
            <small className="num">{Math.round((stages[k] / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Nights as stacked bars (deep at the bottom), with an 8-hour line. Oldest on the left. */
export function SleepBars({ days, target = 480 }: { days: RecoveryDay[]; target?: number }) {
  const nights = [...days].reverse();
  const max = Math.max(target + 60, ...nights.map((d) => d.sleepMinutes ?? 0));
  const H = 130;
  return (
    <div className="rc-sleepbars" style={{ height: H + 22 }} role="img" aria-label={`Sleep, last ${nights.length} nights`}>
      <div className="rc-target" style={{ bottom: 22 + (target / max) * H }}><span className="tiny num">{target / 60} h</span></div>
      {nights.map((d, i) => {
        const now = i === nights.length - 1;
        const total = d.sleepMinutes ?? 0;
        return (
          <div key={d.date} className={`rc-night ${now ? "now" : ""}`} title={`${d.date}: ${formatSleep(total)}`}>
            <div className="rc-night-bar" style={{ height: (total / max) * H }}>
              {d.stages ? STAGE_ORDER.filter((k) => k !== "awake").map((k) => <i key={k} style={{ flexGrow: d.stages![k], background: STAGE_COLOURS[k] }} />) : <i style={{ flexGrow: 1, background: "var(--data)" }} />}
            </div>
            <span className="tiny">{new Date(`${d.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A metric over the last weeks with the client's usual range (mean ± 1 sd) shaded. Drag to read a day. */
export function TrendChart({ days, value, colour, unit, usual, lowerIsBetter = false, label }: {
  days: RecoveryDay[];
  value: (d: RecoveryDay) => number | undefined;
  colour: string;
  unit: string;
  usual: Baseline | null;
  lowerIsBetter?: boolean;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  const [at, setAt] = useState<number | null>(null);
  const pts = [...days].reverse().map((d) => ({ d, v: value(d) })).filter((p): p is { d: RecoveryDay; v: number } => typeof p.v === "number");
  if (pts.length < 2) return null;
  const W = 600, H = 150, top = 16, bottom = 20;
  const vals = pts.map((p) => p.v);
  const lo0 = Math.min(...vals, usual ? usual.mean - usual.sd : Infinity);
  const hi0 = Math.max(...vals, usual ? usual.mean + usual.sd : -Infinity);
  const pad = Math.max(1, (hi0 - lo0) * 0.15);
  const lo = lo0 - pad, hi = hi0 + pad;
  const x = (i: number) => (i / (pts.length - 1)) * (W - 12) + 6;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1)} ${H - bottom}L${x(0)} ${H - bottom}Z`;
  const shown = at ?? pts.length - 1;
  const p = pts[shown]!;
  const good = (v: number) => (usual ? (lowerIsBetter ? v <= usual.mean + usual.sd * 0.5 : v >= usual.mean - usual.sd * 0.5) : true);
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (pts.length - 1)));
  };
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <span className="tiny">{at === null ? "Last night" : new Date(`${p.d.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
        <span className="num small" style={{ fontWeight: 800, color: colour }}>{Math.round(p.v * 10) / 10} {unit}{usual ? <span className="tiny" style={{ fontWeight: 600 }}> · usual {Math.round(usual.mean)}</span> : null}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setAt(null)} role="img" aria-label={label}>
        <defs><linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colour} stopOpacity=".28" /><stop offset="1" stopColor={colour} stopOpacity="0" /></linearGradient></defs>
        {usual && <rect x="0" width={W} y={y(usual.mean + usual.sd)} height={Math.max(2, y(usual.mean - usual.sd) - y(usual.mean + usual.sd))} fill="var(--good-soft)" rx="6" />}
        {usual && <line x1="0" x2={W} y1={y(usual.mean)} y2={y(usual.mean)} stroke="var(--good)" strokeOpacity=".55" strokeDasharray="4 5" />}
        <path d={area} fill={`url(#t${id})`} />
        <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((q, i) => <circle key={q.d.date} cx={x(i)} cy={y(q.v)} r={i === shown ? 6 : 2.6} fill={i === shown ? colour : good(q.v) ? colour : "var(--crit)"} stroke={i === shown ? "var(--card)" : "none"} strokeWidth="2" />)}
        {at !== null && <line x1={x(shown)} x2={x(shown)} y1={top - 8} y2={H - bottom} stroke="var(--text2)" strokeWidth="1" />}
        <text x="6" y={H - 4} fontSize="11" fill="var(--text3)" fontFamily="var(--num)">{pts.length} days ago</text>
        <text x={W - 6} y={H - 4} fontSize="11" fill="var(--text3)" textAnchor="end" fontFamily="var(--num)">Today</text>
      </svg>
      {usual && <div className="tiny" style={{ marginTop: 4 }}><i className="rc-usual-key" /> Your usual range, last {usual.n} days</div>}
    </div>
  );
}
