import { EXERCISES, filterLibrary, type BodyArea, type Exercise } from "@apex/core";
import { Icons } from "@apex/ui";
import { useMemo, useState } from "react";

const AREAS: ("All" | BodyArea)[] = ["All", "Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body"];
const SHOWN = 80;

/** Drag payload for a library exercise; the workout list reads it on drop. */
export const EXERCISE_MIME = "application/x-apex-exercise";

/** The movement library as a drag source. Drag a row into the workout, or tap + to add it at the end. */
export function LibraryPanel({ onAdd }: { onAdd: (ex: Exercise) => void }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState<(typeof AREAS)[number]>("All");
  const [more, setMore] = useState(false);
  const all = useMemo(() => filterLibrary({ query: q, area }), [q, area]);
  const rows = more ? all : all.slice(0, SHOWN);

  return (
    <div className="bld-lib">
      <div className="bld-lib-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="eyebrow">Movement library</div>
          <span className="tiny num">{all.length} / {EXERCISES.length}</span>
        </div>
        <input className="field" placeholder='Search: "rdl", "glutes", "cable"' value={q} onChange={(e) => { setQ(e.target.value); setMore(false); }} autoComplete="off" aria-label="Search the library" />
        <div className="chips">
          {AREAS.map((a) => <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => { setArea(a); setMore(false); }}>{a}</button>)}
        </div>
      </div>
      <div className="bld-lib-list" role="list">
        {rows.length === 0 && <p className="small" style={{ padding: 14, margin: 0 }}>No movement matches “{q}”.</p>}
        {rows.map((e) => (
          <div
            key={e.id}
            role="listitem"
            className="bld-src"
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData(EXERCISE_MIME, String(e.id));
              ev.dataTransfer.setData("text/plain", e.name);
              ev.dataTransfer.effectAllowed = "copy";
            }}
          >
            <Icons.grip width={14} height={14} className="bld-grip" aria-hidden />
            <div className="grow">
              <div className="h3" style={{ fontSize: 14 }}>{e.name}</div>
              <div className="tiny">{e.pattern} · {e.equipment}</div>
            </div>
            <button className="bld-add" aria-label={`Add ${e.name}`} onClick={() => onAdd(e)}><Icons.plus width={16} height={16} /></button>
          </div>
        ))}
        {!more && all.length > SHOWN && (
          <button className="link" style={{ padding: 14 }} onClick={() => setMore(true)}>Show all {all.length}</button>
        )}
      </div>
    </div>
  );
}
