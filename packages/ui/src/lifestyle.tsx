import type { ReactNode } from "react";
import { Bar } from "./primitives";

/* Small visuals for habits and nutrition. Flat, hairline, colour only where it carries meaning. */

export interface DayDot {
  day: string;
  due: number;
  done: number;
}

const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];
const letter = (day: string) => WEEKDAY[(new Date(`${day}T12:00:00`).getDay() + 6) % 7];

/** One square per day: filled = everything done, half = some, outline = none, faint = nothing due. */
export function HabitDays({ days, today, labels = true }: { days: DayDot[]; today: string; labels?: boolean }) {
  return (
    <div className="hb-days" role="img" aria-label={days.map((d) => `${d.day}: ${d.done} of ${d.due}`).join(", ")}>
      {days.map((d) => {
        const state = !d.due ? "none" : d.done >= d.due ? "all" : d.done ? "some" : d.day === today ? "open" : "miss";
        return (
          <div key={d.day} className="hb-day">
            <div className={`hb-sq ${state}`}>{state === "some" && <i style={{ width: `${Math.round((d.done / d.due) * 100)}%` }} />}</div>
            {labels && <div className="tiny" style={{ fontWeight: d.day === today ? 800 : 500, color: d.day === today ? "var(--text)" : undefined }}>{letter(d.day)}</div>}
          </div>
        );
      })}
    </div>
  );
}

export interface MacroLine {
  label: string;
  value: number;
  target: number;
  unit: string;
  colour: string;
}

/** Eaten against target, one bar per macro. */
export function MacroBars({ lines }: { lines: MacroLine[] }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {lines.map((l) => (
        <div key={l.label}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <span className="small">{l.label}</span>
            <span className="num small" style={{ fontWeight: 700, color: "var(--text)" }}>{Math.round(l.value).toLocaleString()} / {l.target.toLocaleString()} {l.unit}</span>
          </div>
          <Bar pct={l.target ? Math.min(100, (l.value / l.target) * 100) : 0} color={l.colour} />
        </div>
      ))}
    </div>
  );
}

/** A labelled number input on one line, for targets. */
export function NumberField({ id, label, unit, value, onChange }: { id: string; label: ReactNode; unit: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label}
      <div className="row" style={{ gap: 6 }}>
        <input id={id} className="field num" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <span className="tiny">{unit}</span>
      </div>
    </label>
  );
}

/** Point on a circle, degrees clockwise from 12 o'clock. */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const arcPath = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/** Calories eaten against the target on an open arc, with what's left and how many foods are logged either side. */
export function FuelGauge({ eaten, target, logs }: { eaten: number; target: number | null; logs: number }) {
  const SWEEP = 240;
  const pct = target ? Math.min(1, eaten / target) : 0;
  const over = !!target && eaten > target;
  const left = target ? Math.round(target - eaten) : null;
  return (
    <div className="fuel">
      <div className="fuel-arc">
        <svg viewBox="0 0 200 140" role="img" aria-label={target ? `${Math.round(eaten)} of ${target} kcal eaten` : `${Math.round(eaten)} kcal eaten`}>
          <path d={arcPath(100, 86, 74, -SWEEP / 2, SWEEP / 2)} stroke="var(--line)" strokeWidth={10} strokeLinecap="round" fill="none" />
          {pct > 0 && <path d={arcPath(100, 86, 74, -SWEEP / 2, -SWEEP / 2 + Math.max(2, SWEEP * pct))} stroke={over ? "var(--warn)" : "var(--act)"} strokeWidth={10} strokeLinecap="round" fill="none" />}
        </svg>
        <div className="mid"><b>{Math.round(eaten).toLocaleString("en-GB")}</b><span>{target ? `of ${target.toLocaleString("en-GB")} kcal` : "kcal today"}</span></div>
      </div>
      <div className="fuel-side">
        <div><b>{left === null ? "–" : Math.abs(left).toLocaleString("en-GB")}</b><small>{left !== null && left < 0 ? "kcal over" : "kcal left"}</small></div>
        <div style={{ alignItems: "flex-end" }}><b>{logs}</b><small>{logs === 1 ? "food logged" : "foods logged"}</small></div>
      </div>
    </div>
  );
}

/** One macro as a small ring: grams eaten in the middle, the target underneath. */
export function MacroRings({ lines }: { lines: MacroLine[] }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <div className="rings">
      {lines.map((l) => {
        const pct = l.target ? Math.min(1, l.value / l.target) : 0;
        return (
          <div key={l.label} className="ring">
            <div className="r">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx={32} cy={32} r={R} stroke="var(--line)" strokeWidth={6} fill="none" />
                {pct > 0 && <circle cx={32} cy={32} r={R} stroke={l.colour} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${C * pct} ${C}`} />}
              </svg>
              <b>{Math.round(l.value)}<small style={{ fontSize: 10, color: "var(--text2)" }}>{l.unit}</small></b>
            </div>
            <small>{l.label} · <span className="num">{l.target ? `${l.target.toLocaleString("en-GB")} ${l.unit}` : "no target"}</span></small>
          </div>
        );
      })}
    </div>
  );
}
