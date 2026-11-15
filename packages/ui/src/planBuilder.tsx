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
