import {
  clockLabel, formatSleep, hypnoRuns, type Baseline, type Contributor, type HypnoStage, type LoadDay, type RecoveryDay, type SleepSchedule, type SleepStages,
} from "@apex/core";
import { useState, type CSSProperties, type PointerEvent } from "react";

/* Recovery visuals, plain SVG and tokens only. Calm by design: hairlines, flat fills, the four
   --viz hues for identity and good/warn/crit only for state. Every chart can be scrubbed to read a day. */

/** Fixed order and hue per stage: deep, light, REM, awake take --viz-1..4 so they always read apart. */
export const STAGE_COLOURS: Record<keyof SleepStages, string> = { deep: "var(--viz-1)", light: "var(--viz-3)", rem: "var(--viz-4)", awake: "var(--viz-2)" };
export const STAGE_LABEL: Record<keyof SleepStages, string> = { deep: "Deep", rem: "REM", light: "Light", awake: "Awake" };
const STAGE_ORDER: (keyof SleepStages)[] = ["deep", "light", "rem", "awake"];
/** Lanes from top to bottom: awake highest, deep lowest, the way a night is usually drawn. */
const LANE: Record<HypnoStage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", opts);
const scrubIndex = (e: PointerEvent<Element>, n: number) => {
  const r = e.currentTarget.getBoundingClientRect();
  return Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (n - 1));
};

function StageKey({ stages }: { stages: SleepStages }) {
  const total = STAGE_ORDER.reduce((a, k) => a + stages[k], 0) || 1;
  return (
    <div className="rc-stage-key">
      {STAGE_ORDER.map((k) => (
        <div key={k}>
          <span><i style={{ background: STAGE_COLOURS[k] }} />{STAGE_LABEL[k]}</span>
          <b className="num">{formatSleep(stages[k]).replace(/^0 h /, "")}</b>
          <small className="num">{Math.round((stages[k] / total) * 100)}%</small>
        </div>
      ))}
    </div>
  );
}

/** Time in each stage as one strip, for providers that send totals but no timeline. */
export function SleepStagesBar({ stages }: { stages: SleepStages }) {
  return (
    <div className="rc-stages">
      <div className="rc-stage-strip" role="img" aria-label={STAGE_ORDER.map((k) => `${STAGE_LABEL[k]} ${formatSleep(stages[k])}`).join(", ")}>
        {STAGE_ORDER.map((k) => stages[k] > 0 && <i key={k} style={{ flexGrow: stages[k], background: STAGE_COLOURS[k] }} />)}
      </div>
      <StageKey stages={stages} />
    </div>
  );
}

/**
 * The night as it happened: four lanes (awake, REM, light, deep), each block where the client was in
 * that stage, with thin risers between them and the clock along the bottom. Drag to read a moment.
 */
export function Hypnogram({ day }: { day: RecoveryDay & { hypnogram: string; bedtime: string } }) {
  const [at, setAt] = useState<number | null>(null);
  const runs = hypnoRuns(day.hypnogram);
  const total = day.hypnogram.length * 5;
  if (!runs.length || !total) return null;
  const W = 340, laneH = 20, gap = 6, top = 2, axis = 18;
  const H = top + 4 * laneH + 3 * gap + axis;
  const x = (m: number) => (m / total) * W;
  const y = (s: HypnoStage) => top + LANE[s] * (laneH + gap);
  const start = new Date(day.bedtime);
  const clock = (m: number) => new Date(start.getTime() + m * 60_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  // Hour ticks on the hour.
  const first = 60 - start.getMinutes();
  const ticks = [...Array(Math.ceil(total / 60))].map((_, i) => first + i * 60).filter((m) => m > 20 && m < total - 20);
  const shown = at === null ? null : runs.find((r) => at >= r.start && at < r.start + r.minutes) ?? null;
  const stages = day.stages ?? runs.reduce<SleepStages>((s, r) => ({ ...s, [r.stage]: s[r.stage] + r.minutes }), { deep: 0, rem: 0, light: 0, awake: 0 });
  return (
    <div className="rc-stages">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="tiny">{shown ? `${clock(shown.start)} – ${clock(shown.start + shown.minutes)}` : `In bed ${clock(0)} – ${clock(total)}`}</span>
        <span className="num small" style={{ fontWeight: 700 }}>{shown ? `${STAGE_LABEL[shown.stage]} · ${shown.minutes} min` : `${formatSleep(total - stages.awake)} asleep`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" role="img" aria-label={`Sleep stages through the night, ${runs.length} changes`}
        onPointerMove={(e) => setAt(scrubIndex(e, total + 1))} onPointerDown={(e) => setAt(scrubIndex(e, total + 1))} onPointerLeave={() => setAt(null)}>
        {(["awake", "rem", "light", "deep"] as HypnoStage[]).map((s) => <rect key={s} x="0" y={y(s)} width={W} height={laneH} rx="4" fill="var(--bg2)" />)}
        {runs.slice(1).map((r, i) => {
          const prev = runs[i]!;
          const [a, b] = [y(prev.stage), y(r.stage)].sort((p, q) => p - q);
          return <line key={`v${i}`} x1={x(r.start)} x2={x(r.start)} y1={a! + laneH / 2} y2={b! + laneH / 2} stroke="var(--line2)" strokeWidth="1.5" />;
        })}
        {runs.map((r, i) => (
          <rect key={i} x={x(r.start) + 0.5} y={y(r.stage) + 3} width={Math.max(1.5, x(r.minutes) - 1)} height={laneH - 6} rx="3"
            fill={STAGE_COLOURS[r.stage]} opacity={shown && shown !== r ? 0.35 : 1} />
        ))}
        {at !== null && <line x1={x(at)} x2={x(at)} y1={0} y2={H - axis + 2} stroke="var(--text2)" strokeWidth="1" />}
        {ticks.map((m) => <text key={m} x={x(m)} y={H - 6} fontSize="11" fill="var(--text3)" textAnchor="middle" fontFamily="var(--num)">{clock(m).slice(0, 2)}:00</text>)}
      </svg>
      <StageKey stages={stages} />
    </div>
  );
}

/** Nights as stacked bars (deep at the bottom), with an 8-hour line. Oldest on the left. */
export function SleepBars({ days, target = 480 }: { days: RecoveryDay[]; target?: number }) {
  const nights = [...days].reverse();
  const [at, setAt] = useState<number | null>(null);
  const max = Math.max(target + 60, ...nights.map((d) => d.sleepMinutes ?? 0));
  const H = 120;
  const shown = nights[at ?? nights.length - 1];
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span className="tiny">{at === null ? `Last ${nights.length} nights` : dayLabel(shown!.date)}</span>
        {shown?.sleepMinutes !== undefined && <span className="num small" style={{ fontWeight: 700 }}>{formatSleep(shown.sleepMinutes)}</span>}
      </div>
      <div className="rc-sleepbars" style={{ height: H + 22 }} role="img" aria-label={`Sleep, last ${nights.length} nights`}
        onPointerMove={(e) => setAt(scrubIndex(e, nights.length))} onPointerDown={(e) => setAt(scrubIndex(e, nights.length))} onPointerLeave={() => setAt(null)}>
        <div className="rc-target" style={{ bottom: 22 + (target / max) * H }}><span className="tiny num">{target / 60} h</span></div>
        {nights.map((d, i) => {
          const on = i === (at ?? nights.length - 1);
          return (
            <div key={d.date} className={`rc-night ${on ? "now" : ""}`}>
              <div className="rc-night-bar" style={{ height: ((d.sleepMinutes ?? 0) / max) * H }}>
                {d.stages ? STAGE_ORDER.filter((k) => k !== "awake").map((k) => <i key={k} style={{ flexGrow: d.stages![k], background: STAGE_COLOURS[k] }} />) : <i style={{ flexGrow: 1, background: "var(--viz-1)" }} />}
              </div>
              <span className="tiny">{dayLabel(d.date, { weekday: "narrow" })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * When the client went to bed and got up, night by night: a floating bar from bedtime to wake time on
 * a clock that runs down the page, with dashed lines at their usual times. Steadier is better.
 */
export function SleepScheduleChart({ schedule }: { schedule: SleepSchedule }) {
  const [at, setAt] = useState<number | null>(null);
  const { nights } = schedule;
  const lo = Math.floor((Math.min(...nights.map((n) => n.bed)) - 30) / 60) * 60;
  const hi = Math.ceil((Math.max(...nights.map((n) => n.wake)) + 30) / 60) * 60;
  const W = 340, H = 220, left = 40, axis = 18;
  const col = (W - left) / nights.length;
  const y = (m: number) => 8 + ((m - lo) / (hi - lo)) * (H - axis - 12);
  const shown = nights[at ?? nights.length - 1]!;
  const hours = [...Array((hi - lo) / 60 + 1)].map((_, i) => lo + i * 60).filter((_, i, a) => a.length < 8 || i % 2 === 0);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span className="tiny">{at === null ? "Last night" : dayLabel(shown.date)}</span>
        <span className="num small" style={{ fontWeight: 700 }}>{clockLabel(shown.bed)} – {clockLabel(shown.wake)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" role="img" aria-label={`Bedtimes and wake times, usual ${clockLabel(schedule.bed)} to ${clockLabel(schedule.wake)}`}
        onPointerMove={(e) => setAt(scrubIndex(e, nights.length))} onPointerDown={(e) => setAt(scrubIndex(e, nights.length))} onPointerLeave={() => setAt(null)}>
        {hours.map((m) => (
          <g key={m}>
            <line x1={left} x2={W} y1={y(m)} y2={y(m)} stroke="var(--line)" />
            <text x="0" y={y(m) + 4} fontSize="11" fill="var(--text3)" fontFamily="var(--num)">{clockLabel(m)}</text>
          </g>
        ))}
        {[schedule.bed, schedule.wake].map((m, i) => <line key={i} x1={left} x2={W} y1={y(m)} y2={y(m)} stroke="var(--text3)" strokeDasharray="4 5" />)}
        {nights.map((n, i) => {
          const on = i === (at ?? nights.length - 1);
          const w = Math.min(18, col - 6);
          return <rect key={n.date} x={left + i * col + (col - w) / 2} y={y(n.bed)} width={w} height={Math.max(4, y(n.wake) - y(n.bed))} rx="4" fill="var(--viz-1)" opacity={on ? 1 : 0.45} />;
        })}
        {nights.map((n, i) => <text key={n.date} x={left + i * col + col / 2} y={H - 3} fontSize="11" fill={i === (at ?? nights.length - 1) ? "var(--text)" : "var(--text3)"} textAnchor="middle" fontFamily="var(--num)">{dayLabel(n.date, { weekday: "narrow" })}</text>)}
      </svg>
      <div className="tiny" style={{ marginTop: 4 }}><i className="rc-dash-key" /> Your usual: in bed {clockLabel(schedule.bed)}, up {clockLabel(schedule.wake)} · bedtime varies by ±{schedule.bedSpread} min</div>
    </div>
  );
}

/**
 * Last night's parts against the client's own usual. The centre line is their usual; the shaded band
 * is their normal spread. A dot right of centre is better than usual, left is worse, whatever the metric.
 */
export function BalanceRows({ items }: { items: Contributor[] }) {
  const pos = (z: number) => 50 + (z / 2.5) * 46;
  const state = (z: number) => (z >= -0.5 ? "var(--good)" : z >= -1.25 ? "var(--warn)" : "var(--crit)");
  return (
    <div className="rc-balance" role="list">
      <div className="rc-balance-scale tiny" aria-hidden><span>Worse</span><span>Your usual</span><span>Better</span></div>
      {items.map((c) => (
        <div key={c.key} className="rc-balance-row" role="listitem" aria-label={`${c.label} ${c.value}, ${c.note}`}>
          <div className="rc-balance-head"><span>{c.label}</span><b className="num">{c.value}</b></div>
          <div className="rc-balance-track">
            <i className="rc-balance-usual" />
            <i className="rc-balance-mid" />
            <i className="rc-balance-fill" style={{ left: `${Math.min(50, pos(c.score))}%`, width: `${Math.abs(pos(c.score) - 50)}%`, background: state(c.score) } as CSSProperties} />
            <i className="rc-balance-dot" style={{ left: `${pos(c.score)}%`, background: state(c.score) }} />
          </div>
          <span className="tiny" style={{ color: c.score < -0.5 ? "var(--text)" : undefined }}>{c.note}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Training load and the next morning's recovery, one above the other on the same days. Two measures,
 * two charts sharing a time line (never two scales on one plot), so a hard day lines up with the
 * morning after it. Drag across either to read a day.
 */
export function LoadRecoveryChart({ days }: { days: LoadDay[] }) {
  const [at, setAt] = useState<number | null>(null);
  const n = days.length;
  const W = 340, loadH = 64, recH = 96, gap = 18, axis = 18;
  const H = loadH + gap + recH + axis;
  const col = W / n;
  const maxLoad = Math.max(1, ...days.map((d) => d.load));
  const shownI = at ?? n - 1;
  const shown = days[shownI]!;
  const pts = days.map((d, i) => ({ i, v: d.recoveryScore })).filter((p): p is { i: number; v: number } => p.v !== undefined);
  const floor = Math.max(0, Math.floor((Math.min(100, ...pts.map((p) => p.v)) - 10) / 10) * 10);
  const ry = (v: number) => loadH + gap + 14 + (1 - (v - floor) / (100 - floor)) * (recH - 14);
  const cx = (i: number) => i * col + col / 2;
  const line = pts.map((p, k) => `${k ? "L" : "M"}${cx(p.i).toFixed(1)} ${ry(p.v).toFixed(1)}`).join("");
  const band = (v: number) => (v >= 67 ? "var(--good)" : v >= 34 ? "var(--warn)" : "var(--crit)");
  const move = (e: PointerEvent<SVGSVGElement>) => setAt(scrubIndex(e, n));
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
        <span className="tiny">{at === null ? "Today" : dayLabel(shown.date)}</span>
        <span className="small num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--text2)", fontWeight: 600 }}>Load </span>{Math.round(shown.load)}
          <span style={{ color: "var(--text2)", fontWeight: 600 }}> · Recovery </span>{shown.recoveryScore ?? "–"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" role="img" aria-label={`Training load and recovery over the last ${n} days`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setAt(null)}>
        <text x="0" y="10" fontSize="11" fill="var(--text3)">Training load</text>
        <line x1="0" x2={W} y1={loadH} y2={loadH} stroke="var(--line)" />
        {days.map((d, i) => d.load > 0 && (
          <rect key={d.date} x={i * col + col * 0.2} width={col * 0.6} y={loadH - Math.max(3, (d.load / maxLoad) * (loadH - 18))} height={Math.max(3, (d.load / maxLoad) * (loadH - 18))} rx="3"
            fill="var(--viz-2)" opacity={i === shownI ? 1 : 0.55} />
        ))}
        <text x="0" y={loadH + gap + 10} fontSize="11" fill="var(--text3)">Recovery</text>
        {[34, 67].filter((v) => v > floor).map((v) => <line key={v} x1="0" x2={W} y1={ry(v)} y2={ry(v)} stroke="var(--line)" strokeDasharray="2 4" />)}
        <line x1="0" x2={W} y1={ry(floor)} y2={ry(floor)} stroke="var(--line)" />
        <path d={line} fill="none" stroke="var(--viz-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => <circle key={p.i} cx={cx(p.i)} cy={ry(p.v)} r={p.i === shownI ? 5.5 : 3} fill={band(p.v)} stroke="var(--card)" strokeWidth="2" />)}
        <line x1={cx(shownI)} x2={cx(shownI)} y1="14" y2={H - axis} stroke="var(--text2)" strokeWidth="1" opacity={at === null ? 0 : 1} />
        {days.map((d, i) => (i === n - 1 || (new Date(`${d.date}T12:00:00`).getDay() === 1 && i < n - 4)) && (
          <text key={d.date} x={cx(i)} y={H - 4} fontSize="11" fill="var(--text3)" textAnchor={i === n - 1 ? "end" : "middle"} fontFamily="var(--num)">{i === n - 1 ? "Today" : dayLabel(d.date, { day: "numeric", month: "short" })}</text>
        ))}
      </svg>
      <div className="rc-legend tiny"><span><i style={{ background: "var(--viz-2)" }} />Training load (minutes × effort)</span><span><i style={{ background: "var(--viz-1)", height: 2 }} />Recovery score</span></div>
    </div>
  );
}

/** Four weeks at a glance: one square per morning, Monday first, filled by how recovered the client was. */
export function RecoveryCalendar({ days, today }: { days: RecoveryDay[]; today: string }) {
  const [at, setAt] = useState<string | null>(null);
  const by = new Map(days.map((d) => [d.date, d]));
  const end = new Date(`${today}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 27);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) cells.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  const score = (d?: RecoveryDay) => d?.recoveryScore ?? d?.sleepScore;
  const fill = (v?: number) => (v === undefined ? "var(--bg2)" : v >= 67 ? "var(--good)" : v >= 34 ? "var(--warn)" : "var(--crit)");
  const shown = at ? by.get(at) : undefined;
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="tiny">{at ? dayLabel(at) : "Tap a day"}</span>
        <span className="small num" style={{ fontWeight: 700 }}>{at ? (score(shown) !== undefined ? `${score(shown)} · ${shown?.sleepMinutes ? formatSleep(shown.sleepMinutes) : ""}` : "No data") : ""}</span>
      </div>
      <div className="rc-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="tiny">{d}</span>)}
        {cells.map((c) => {
          const v = score(by.get(c));
          return (
            <button key={c} type="button" className={`rc-cal-day ${c === today ? "today" : ""} ${c === at ? "on" : ""}`} aria-label={`${dayLabel(c)}: ${v ?? "no data"}`}
              style={{ "--f": fill(v) } as CSSProperties} onClick={() => setAt(at === c ? null : c)}>
              <span className="num">{v ?? ""}</span>
            </button>
          );
        })}
      </div>
      <div className="rc-legend tiny"><span><i style={{ background: "var(--good)" }} />67+ recovered</span><span><i style={{ background: "var(--warn)" }} />34–66</span><span><i style={{ background: "var(--crit)" }} />Under 34</span></div>
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
  const [at, setAt] = useState<number | null>(null);
  const pts = [...days].reverse().map((d) => ({ d, v: value(d) })).filter((p): p is { d: RecoveryDay; v: number } => typeof p.v === "number");
  if (pts.length < 2) return null;
  const W = 340, H = 140, top = 12, bottom = 20;
  const vals = pts.map((p) => p.v);
  const lo0 = Math.min(...vals, usual ? usual.mean - usual.sd : Infinity);
  const hi0 = Math.max(...vals, usual ? usual.mean + usual.sd : -Infinity);
  const pad = Math.max(1, (hi0 - lo0) * 0.15);
  const lo = lo0 - pad, hi = hi0 + pad;
  const x = (i: number) => (i / (pts.length - 1)) * (W - 12) + 6;
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const shown = at ?? pts.length - 1;
  const p = pts[shown]!;
  const off = (v: number) => (usual ? (lowerIsBetter ? v > usual.mean + usual.sd : v < usual.mean - usual.sd) : false);
  const onMove = (e: PointerEvent<SVGSVGElement>) => setAt(scrubIndex(e, pts.length));
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <span className="tiny">{at === null ? "Last night" : dayLabel(p.d.date)}</span>
        <span className="num small" style={{ fontWeight: 700 }}>{Math.round(p.v * 10) / 10} {unit}{usual ? <span className="tiny" style={{ fontWeight: 600 }}> · usual {Math.round(usual.mean)}</span> : null}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setAt(null)} role="img" aria-label={label}>
        {usual && <rect x="0" width={W} y={y(usual.mean + usual.sd)} height={Math.max(2, y(usual.mean - usual.sd) - y(usual.mean + usual.sd))} fill="var(--bg2)" rx="4" />}
        {usual && <line x1="0" x2={W} y1={y(usual.mean)} y2={y(usual.mean)} stroke="var(--text3)" strokeDasharray="4 5" />}
        <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((q, i) => <circle key={q.d.date} cx={x(i)} cy={y(q.v)} r={i === shown ? 5.5 : off(q.v) ? 3.5 : 2.5} fill={off(q.v) ? "var(--crit)" : colour} stroke="var(--card)" strokeWidth={i === shown || off(q.v) ? 2 : 0} />)}
        {at !== null && <line x1={x(shown)} x2={x(shown)} y1={top - 8} y2={H - bottom} stroke="var(--text2)" strokeWidth="1" />}
        <text x="6" y={H - 4} fontSize="11" fill="var(--text3)" fontFamily="var(--num)">{pts.length} days ago</text>
        <text x={W - 6} y={H - 4} fontSize="11" fill="var(--text3)" textAnchor="end" fontFamily="var(--num)">Today</text>
      </svg>
      {usual && <div className="tiny" style={{ marginTop: 4 }}><i className="rc-usual-key" /> Your usual range, last {usual.n} days · <i className="rc-off-key" /> outside it</div>}
    </div>
  );
}
