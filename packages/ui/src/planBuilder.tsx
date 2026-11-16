import { Icons } from "./icons";
import "./planBuilder.css";

export interface PlanRow { group: string; name: string; dose: string; note?: string; circuit?: boolean }
export interface PlanDayView { day: string; name: string; minutes: number; rows: PlanRow[] }

/** What the builder read from the coach's words, as chips. Anything it guessed is shown in a quieter style. */
export function UnderstoodChips({ understood, assumed }: { understood: string[]; assumed: string[] }) {
  return (
    <div className="pbd-chips" aria-label="What the plan builder understood">
      {understood.map((u) => <span key={u} className="pbd-chip"><Icons.check width={12} height={12} />{u}</span>)}
      {assumed.map((u) => <span key={u} className="pbd-chip assumed" title="Not in your description, so a safe default">{u}</span>)}
    </div>
  );
}

/** One training day of a built plan: warm-up, lettered lifts, supersets and the finisher. */
export function PlanDayCard({ view, index }: { view: PlanDayView; index: number }) {
  return (
    <article className="pbd-day" style={{ ["--i" as string]: index }}>
      <header className="pbd-day-head">
        <span className="pbd-dow">{view.day}</span>
        <b>{view.name}</b>
        <span className="tiny num"><Icons.clock width={12} height={12} /> {view.minutes} min</span>
      </header>
      <ol className="pbd-rows">
        {view.rows.map((r, i) => (
          <li key={i} className={`pbd-row ${r.group.startsWith("W") ? "warm" : ""} ${r.circuit ? "circuit" : ""}`}>
            <span className="pbd-grp">{r.group}</span>
            <span className="pbd-name">{r.name}{r.note && <i>{r.note}</i>}</span>
            <span className="pbd-dose num">{r.dose}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export interface PlanWeekView { week: number; kind: "base" | "build" | "peak" | "lighter"; label: string }
const EFFORT: Record<PlanWeekView["kind"], number> = { base: 0.55, build: 0.75, peak: 1, lighter: 0.35 };

/** The block at a glance: one bar per week, taller when harder. Tap a week to see its days. */
export function WeekStrip({ weeks, selected, onSelect }: { weeks: PlanWeekView[]; selected: number; onSelect: (week: number) => void }) {
  return (
    <div className="pbd-weeks" role="tablist" aria-label="Weeks">
      {weeks.map((w) => (
        <button
          key={w.week}
          role="tab"
          aria-selected={w.week === selected}
          className={`pbd-wk ${w.kind} ${w.week === selected ? "on" : ""}`}
          onClick={() => onSelect(w.week)}
          title={`Week ${w.week}: ${w.label}`}
          aria-label={`Week ${w.week}, ${w.label.toLowerCase()}`}
        >
          <span className="pbd-wk-bar" style={{ ["--h" as string]: EFFORT[w.kind] }} />
          <span className="pbd-wk-n num">{w.week}</span>
        </button>
      ))}
    </div>
  );
}
