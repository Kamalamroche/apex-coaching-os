import { filterLibrary, type BodyArea, type Exercise, type TrainingType } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, Icons } from "@apex/ui";
import { useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { Cardio } from "./Cardio";
import { ExerciseCard } from "./ExerciseCard";

const AREAS: ("All" | BodyArea)[] = ["All", "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body"];
const TYPES: ("All" | TrainingType)[] = ["All", "Strength", "Accessory", "Power", "Plyometric", "Isometric", "Balance", "Core", "Mobility", "Stretching", "Yoga"];
const PAGE = 40;

export function Train({ start, say }: { start: () => void; say: (m: string) => void }) {
  const store = useStore();
  const [mode, setMode] = useState<"strength" | "cardio">("strength");
  const { workout, log } = useApexState(store);
  const [area, setArea] = useState<(typeof AREAS)[number]>("All");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const list = useMemo(() => filterLibrary({ query, area, type }), [query, area, type]);
  const refilter = (fn: () => void) => { fn(); setShown(PAGE); };

  const modes = (
    <div className="chips" role="tablist" aria-label="Training type">
      <button role="tab" aria-selected={mode === "strength"} className={`chip ${mode === "strength" ? "on" : ""}`} onClick={() => setMode("strength")}>Strength</button>
      <button role="tab" aria-selected={mode === "cardio"} className={`chip ${mode === "cardio" ? "on" : ""}`} onClick={() => setMode("cardio")}>Cardio</button>
    </div>
  );
  if (mode === "cardio") return <>{modes}<Cardio say={say} /></>;
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
      {modes}
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
        <input className="field" placeholder='Search: try "rdl", "glutes" or "band"' value={query} onChange={(e) => refilter(() => setQuery(e.target.value))} autoComplete="off" style={{ marginBottom: 10 }} />
        <div className="chips" style={{ marginBottom: 6 }}>
          {AREAS.map((c) => <button key={c} className={`chip ${area === c ? "on" : ""}`} onClick={() => refilter(() => setArea(c))}>{c}</button>)}
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {TYPES.map((c) => <button key={c} className={`chip ${type === c ? "on" : ""}`} onClick={() => refilter(() => setType(c))}>{c === "All" ? "All types" : c}</button>)}
        </div>
        <div className="card flat list">
          {list.length === 0 && <div className="li small">No movements match. Try another search or clear a filter.</div>}
          {list.slice(0, shown).map((e) => (
            <button key={e.id} className="li" onClick={() => setSelected(e)}>
              <div className="ava" style={{ borderRadius: 8, background: "var(--bg2)", color: "var(--text3)" }}><Icons.figure width={26} height={26} /></div>
              <div className="grow"><div className="h3">{e.name}</div><div className="small">{e.muscles.length ? e.muscles.join(", ") : e.type} · {e.equipment}</div></div>
            </button>
          ))}
        </div>
        {list.length > shown && <button className="btn ghost sm" style={{ marginTop: 10, width: "100%" }} onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button>}
      </section>
    </>
  );
}
