import {
  addExercise, alternativesFor, exerciseById, exerciseFor, isSuperset, removeItem, searchExercises, swapExercise, updateItem,
  type Exercise, type Workout, type WorkoutItem,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Sheet } from "@apex/ui";
import { useMemo, useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import { AiAdjust } from "./AiAdjust";

const RECENT_IDS = [2, 9, 13];

const highlight = (name: string, q: string) => {
  const s = q.trim();
  const i = name.toLowerCase().indexOf(s.toLowerCase());
  if (!s || i < 0) return name;
  return <>{name.slice(0, i)}<mark>{name.slice(i, i + s.length)}</mark>{name.slice(i + s.length)}</>;
};

export function Builder({ say, onInvite }: { say: (m: string) => void; onInvite: () => void }) {
  const store = useStore();
  const { clientName, mode } = useAppInfo();
  const { status, error } = useStoreStatus();
  const { workout } = useApexState(store);
  const [q, setQ] = useState("");
  const [swapping, setSwapping] = useState<WorkoutItem | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const hits = useMemo(() => searchExercises(q), [q]);

  const edit = (fn: (w: Workout) => Workout) => store.saveWorkout(fn(store.get().workout));
  const upd = (key: string, patch: Partial<WorkoutItem>) => edit((w) => updateItem(w, key, patch));
  const add = (ex: Exercise) => {
    const next = addExercise(workout, ex);
    edit(() => next);
    setQ("");
    say(`${ex.name} added · rest set to ${next.items.at(-1)?.restSeconds} s`);
  };

  const first = clientName.split(" ")[0] ?? clientName;
  if (mode === "live" && !clientName) {
    return <Empty title="No clients yet" body="Invite your first client, then build their program here." action="Invite a client" onAction={onInvite} />;
  }
  if (status === "loading") return <Empty title="Loading program…" body={`Fetching ${first}'s program.`} />;
  if (status === "error") return <Empty title="Couldn't load the program" body={error ?? "Unknown error"} />;
  if (status === "no-program") {
    return <Empty title={`${first} has no program yet`} body="Start from the Foundations template, then edit it here. Changes save as you type." action="Create program" onAction={() => void (store as { createProgram?: () => Promise<void> }).createProgram?.()} />;
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div className="eyebrow">{clientName} · Week {workout.week} of {workout.ofWeeks}</div><h1 className="h1" style={{ fontSize: 22 }}>{workout.name}</h1></div>
        <button className="btn ghost sm" onClick={() => setAiOpen(true)}>Adjust with AI</button>
      </div>

      <div style={{ position: "relative" }}>
        <input id="exsearch" className="field" placeholder='Add exercise: try "rdl", "hinge" or "cable"' value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {q && (
          <div className="card flat list" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 30, boxShadow: "0 12px 30px rgba(0,0,0,.3)" }}>
            {hits.length === 0 && <div className="hit small">No match for “{q}”. Create it as a custom exercise.</div>}
            {hits.map(({ exercise: e, matchedAlias }) => (
              <button key={e.id} className="hit" onClick={() => add(e)}>
                <div className="grow">
                  <div className="h3">{highlight(e.name, q)}</div>
                  <div className="tiny">{e.pattern} · {e.equipment}{matchedAlias ? ` · matched “${matchedAlias}”` : ""}</div>
                </div>
                <span className="btn act sm">Add</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {!q && (
        <div className="chips">
          <span className="tiny" style={{ alignSelf: "center" }}>Recent:</span>
          {RECENT_IDS.map((id) => <button key={id} className="chip" onClick={() => add(exerciseById(id))}>+ {exerciseById(id).name}</button>)}
        </div>
      )}

      <div className="card flat list">
        {workout.items.length === 0 && <div className="li small">This workout is empty. Search above to add the first exercise.</div>}
        {workout.items.map((it) => {
          const ex = exerciseFor(it);
          return (
            <div key={it.key} style={{ padding: "12px 14px" }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="grp" style={{ width: 28 }}>{it.group}</span>
                <div className="grow"><div className="h3">{ex.name}</div><div className="tiny">{ex.pattern} · {ex.equipment}{isSuperset(it) ? " · superset" : ""}</div></div>
                <button className="btn ghost sm" onClick={() => setSwapping(it)}>Swap</button>
                <button className="iconbtn" aria-label={`Remove ${ex.name}`} onClick={() => edit((w) => removeItem(w, it.key))}>×</button>
              </div>
              <div className="mini">
                <label>Sets<input id={`s-${it.key}`} inputMode="numeric" value={it.sets} onChange={(e) => upd(it.key, { sets: Number(e.target.value.replace(/\D/g, "")) || 1 })} /></label>
                <label>Reps<input id={`r-${it.key}`} value={it.reps} onChange={(e) => upd(it.key, { reps: e.target.value })} /></label>
                <label>kg<input id={`k-${it.key}`} inputMode="decimal" value={it.kg} onChange={(e) => upd(it.key, { kg: Number(e.target.value) || 0 })} /></label>
                <label>RPE<input id={`p-${it.key}`} inputMode="decimal" value={it.rpe} onChange={(e) => upd(it.key, { rpe: Number(e.target.value) || 0 })} /></label>
                <label>Rest s<input id={`t-${it.key}`} inputMode="numeric" value={it.restSeconds} onChange={(e) => upd(it.key, { restSeconds: Number(e.target.value) || 0 })} /></label>
              </div>
              <div className="tiny" style={{ marginTop: 6 }}>Last time: <span className="num">{it.lastTime}</span></div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => say("Day duplicated to Thursday")}>Duplicate day</button>
        <button className="btn act" style={{ flex: 1.4 }} onClick={() => say(`Published · ${first}'s app updated`)}>Publish to client</button>
      </div>
      <p className="tiny" style={{ margin: 0 }}>Edits save to {first}'s program as you type{mode === "demo" ? ". Open the client app to see them" : " and show in their app straight away"}.</p>

      {swapping && (
        <Sheet onClose={() => setSwapping(null)} label="Swap exercise">
          <div><div className="eyebrow">Swap {exerciseFor(swapping).name}</div><h2 className="h2">Same pattern, {first}'s equipment</h2></div>
          <div className="card flat list">
            {alternativesFor(exerciseFor(swapping)).map((a) => (
              <button key={a.id} className="li" onClick={() => { edit((w) => swapExercise(w, swapping.key, a.id)); setSwapping(null); say(`Swapped to ${a.name}`); }}>
                <div className="grow"><div className="h3">{a.name}</div><div className="small">{a.equipment} · {a.muscles.join(", ")}</div></div>
                <span className="btn act sm">Use</span>
              </button>
            ))}
          </div>
          <button className="btn ghost block" onClick={() => setSwapping(null)}>Cancel</button>
        </Sheet>
      )}

      {aiOpen && (
        <AiAdjust
          workout={workout}
          onClose={() => setAiOpen(false)}
          onApply={(next, msg) => { edit(() => next); setAiOpen(false); say(msg); }}
        />
      )}
    </>
  );
}

function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 22 }}>
      <h1 className="h1" style={{ fontSize: 22 }}>{title}</h1>
      <p className="sub" style={{ margin: 0 }}>{body}</p>
      {action && <button className="btn act" style={{ alignSelf: "flex-start" }} onClick={onAction}>{action}</button>}
    </div>
  );
}
