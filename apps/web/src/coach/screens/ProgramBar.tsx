import { DAY_NAMES, addDay, copyWeek, daysInWeek, deleteWeek, freeDayIndex, removeDay, type Program } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label, Sheet } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";

/** Weeks and days of the program. Pick a day to edit it; add days, copy a week forward (as is or progressed), remove. */
export function ProgramBar({ say, onTemplates, onCopilot }: { say: (m: string) => void; onTemplates: () => void; onCopilot: () => void }) {
  const store = useStore();
  const { program, activeDay, workout } = useApexState(store);
  const [week, setWeek] = useState(workout.week);
  const [tools, setTools] = useState(false);
  const [adding, setAdding] = useState(false);
  // Follow the open day when it changes from elsewhere (a template, a copy).
  const [seen, setSeen] = useState(activeDay);
  if (seen !== activeDay) { setSeen(activeDay); setWeek(workout.week); }

  const days = daysInWeek(program, week);
  const weeks = Array.from({ length: Math.max(program.weeks, ...program.days.map((d) => d.week)) }, (_, i) => i + 1);
  const save = (p: Program, open?: string) => store.saveProgram(p, open);
  const pickWeek = (w: number) => {
    setWeek(w);
    const first = daysInWeek(program, w)[0];
    if (first) store.selectDay(first.key);
  };

  const add = (dayIndex: number, copy: boolean) => {
    const { program: p, day } = addDay(program, week, dayIndex, copy ? workout : undefined);
    save(p, day.key);
    setAdding(false);
    say(`${DAY_NAMES[dayIndex]} added to week ${week}${copy ? `, copied from ${workout.name}` : ""}`);
  };

  const copyForward = (progress: boolean) => {
    const to = week + 1;
    const { program: p, added } = copyWeek(program, week, to, { progress });
    if (!added.length) return say(`Week ${to} already has those days planned`);
    save(p, added[0]?.key);
    setTools(false);
    say(`Week ${week} copied to week ${to}${progress ? " with next week's loads" : ""}`);
  };

  const openDay = program.days.find((d) => d.key === activeDay);
  const free = freeDayIndex(program, week, openDay?.dayIndex ?? -1);
  return (
    <div className="pb">
      <div className="pb-head">
      <div className="pb-weeks" role="tablist" aria-label="Weeks">
        {weeks.map((w) => {
          const n = daysInWeek(program, w).length;
          return (
            <button key={w} role="tab" aria-selected={w === week} className={`pb-week ${w === week ? "on" : ""} ${n ? "" : "empty"}`} onClick={() => pickWeek(w)}>
              <span>W{w}</span><i>{n ? `${n}d` : "–"}</i>
            </button>
          );
        })}
        <button className="pb-week add" aria-label="Add a week" onClick={() => { save({ ...program, weeks: weeks.length + 1 }); setWeek(weeks.length + 1); }}>+</button>
      </div>
      <div className="pb-tools">
        <button className="btn ghost sm" onClick={() => setTools(true)}>Week tools</button>
        <button className="btn ghost sm" onClick={onTemplates}>Templates</button>
        <button className="btn ghost sm pb-cop" onClick={onCopilot}>Copilot</button>
      </div>
      </div>
      <div className="pb-days">
        {days.map((d) => (
          <button key={d.key} className={`pb-day ${d.key === activeDay ? "on" : ""}`} onClick={() => store.selectDay(d.key)}>
            <b>{DAY_NAMES[d.dayIndex]}</b><span>{d.name}</span>
          </button>
        ))}
        {free !== null && <button className="pb-day add" onClick={() => setAdding(true)}>+ Day</button>}
      </div>

      {adding && (
        <Sheet onClose={() => setAdding(false)} label="Add a training day">
          <div><div className="eyebrow">Week {week}</div><h2 className="h2">Add a training day</h2></div>
          <div className="pb-pick">
            {DAY_NAMES.map((n, i) => {
              const taken = days.some((d) => d.dayIndex === i);
              return <button key={n} className="chip" disabled={taken} onClick={() => add(i, false)} style={taken ? { opacity: 0.35 } : undefined}>{n}</button>;
            })}
          </div>
          <p className="small" style={{ margin: 0 }}>Pick a day to start it empty, or copy the open day:</p>
          <div className="pb-pick">
            {DAY_NAMES.map((n, i) => days.some((d) => d.dayIndex === i) ? null : <button key={n} className="chip on" onClick={() => add(i, true)}>Copy “{workout.name}” to {n}</button>)}
          </div>
          <button className="btn ghost block" onClick={() => setAdding(false)}>Cancel</button>
        </Sheet>
      )}

      {tools && (
        <Sheet onClose={() => setTools(false)} label="Week tools">
          <div><div className="eyebrow">Week {week} · {days.length} day{days.length === 1 ? "" : "s"}</div><h2 className="h2">Week tools</h2></div>
          <div className="card flat list">
            <button className="li" disabled={!days.length} onClick={() => copyForward(true)}>
              <div className="grow">
                <div className="row" style={{ gap: 8 }}><span className="h3">Copy to week {week + 1}, progressed</span><Label kind="ai">AI suggestion</Label></div>
                <div className="small">Loads go up where every rep was hit at or under target RPE. Review them in each day before the client trains.</div>
              </div>
            </button>
            <button className="li" disabled={!days.length} onClick={() => copyForward(false)}>
              <div className="grow"><div className="h3">Copy to week {week + 1} as it is</div><div className="small">Same exercises, sets and loads on the same weekdays.</div></div>
            </button>
            {program.days.length > 1 && (
              <button className="li" onClick={() => { save(removeDay(program, activeDay)); setTools(false); say(`${workout.name} removed`); }}>
                <div className="grow"><div className="h3" style={{ color: "var(--crit)" }}>Delete the open day</div><div className="small">{DAY_NAMES[openDay?.dayIndex ?? 0]} · {workout.name}</div></div>
              </button>
            )}
            {weeks.length > 1 && program.days.some((d) => d.week !== week) && (
              <button className="li" onClick={() => { save(deleteWeek(program, week)); setTools(false); setWeek(Math.max(1, week - 1)); say(`Week ${week} deleted; later weeks moved up`); }}>
                <div className="grow"><div className="h3" style={{ color: "var(--crit)" }}>Delete week {week}</div><div className="small">Later weeks move up one.</div></div>
              </button>
            )}
          </div>
          <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Day name
            <input className="field" value={workout.name} onChange={(e) => store.saveWorkout({ ...workout, name: e.target.value })} />
          </label>
          <button className="btn ghost block" onClick={() => setTools(false)}>Done</button>
        </Sheet>
      )}
    </div>
  );
}
