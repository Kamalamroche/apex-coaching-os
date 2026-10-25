import { EXERCISES, type BodyArea, type Exercise } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, Icons } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";
import { ExerciseCard } from "./ExerciseCard";

const FILTERS: ("All" | BodyArea)[] = ["All", "Legs", "Chest", "Back", "Shoulders", "Core"];

export function Train({ start }: { start: () => void }) {
  const store = useStore();
  const { workout, log } = useApexState(store);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const list = filter === "All" ? EXERCISES : EXERCISES.filter((e) => e.category === filter);

  if (selected) {
    return (
      <>
        <BackLink onClick={() => setSelected(null)}>Library</BackLink>
        <ExerciseCard exercise={selected} />
      </>
    );
  }
  const schedule = [
    { date: "Sat 25 Oct", name: workout.name, state: log ? "done" : "today" },
    { date: "Mon 27 Oct", name: "Upper A · Strength", state: "next" },
    { date: "Wed 29 Oct", name: "Lower B · Volume", state: "next" },
    { date: "Fri 31 Oct", name: "Upper B · Volume", state: "next" },
  ];
  return (
    <>
      <div><div className="eyebrow">Program · week {workout.week} of {workout.ofWeeks}</div><h1 className="h1">Foundations</h1></div>
      <div className="card flat list">
        {schedule.map((r) => (
          <div key={r.date} className="li">
            <div className="grow"><div className="tiny">{r.date}</div><div className="h3">{r.name}</div></div>
            {r.state === "today" ? <button className="btn act sm" onClick={start}>Start</button> : r.state === "done" ? <span className="label l-dec">Done</span> : <span className="tiny">Planned</span>}
          </div>
        ))}
      </div>
      <section>
        <div className="sect"><h2 className="h2">Exercise library</h2><span className="tiny num">{list.length}</span></div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {FILTERS.map((c) => <button key={c} className={`chip ${filter === c ? "on" : ""}`} onClick={() => setFilter(c)}>{c}</button>)}
        </div>
        <div className="card flat list">
          {list.map((e) => (
            <button key={e.id} className="li" onClick={() => setSelected(e)}>
              <div className="ava" style={{ borderRadius: 8, background: "var(--bg2)", color: "var(--text3)" }}><Icons.figure width={26} height={26} /></div>
              <div className="grow"><div className="h3">{e.name}</div><div className="small">{e.muscles.join(", ")} · {e.equipment}</div></div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
