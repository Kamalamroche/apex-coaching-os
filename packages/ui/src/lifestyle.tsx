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
