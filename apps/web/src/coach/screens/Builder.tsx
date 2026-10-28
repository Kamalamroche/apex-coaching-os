import {
  addExercise, alternativesFor, exerciseById, exerciseFor, insertExercise, isSuperset, moveItem, removeItem, searchExercises, swapExercise, updateItem,
  type Exercise, type Workout, type WorkoutItem,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, Sheet } from "@apex/ui";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import { AiAdjust } from "./AiAdjust";
import { ImportPdf } from "./ImportPdf";
import { EXERCISE_MIME, LibraryPanel } from "./LibraryPanel";

const RECENT_IDS = [2, 9, 13];
/** Drag payload for a workout row being moved. */
const ITEM_MIME = "application/x-apex-item";

const hasType = (e: DragEvent, type: string) => Array.from(e.dataTransfer.types).includes(type);
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

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
  const [libOpen, setLibOpen] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => searchExercises(q), [q]);

  const edit = (fn: (w: Workout) => Workout) => store.saveWorkout(fn(store.get().workout));
  const upd = (key: string, patch: Partial<WorkoutItem>) => edit((w) => updateItem(w, key, patch));
  const add = (ex: Exercise, at?: number) => {
    const cur = store.get().workout;
    const next = at === undefined ? addExercise(cur, ex) : insertExercise(cur, ex, at);
    const item = next.items.find((i) => !cur.items.some((c) => c.key === i.key));
    edit(() => next);
    setQ("");
    setFresh(item?.key ?? null);
    say(`${ex.name} added${item ? ` as ${item.group}` : ""} · rest ${item?.restSeconds} s`);
  };
  const move = (key: string, at: number) => edit((w) => moveItem(w, key, at));

  /* Where a drop at this pointer height lands: before the first row whose middle is below it. */
  const indexAt = (y: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [];
    const i = Array.from(rows).findIndex((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
    return i < 0 ? rows.length : i;
  };
  const onListOver = (e: DragEvent) => {
    if (hasType(e, EXERCISE_MIME) || hasType(e, ITEM_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = hasType(e, ITEM_MIME) ? "move" : "copy";
      setDropAt(indexAt(e.clientY));
    }
  };
  const onListDrop = (e: DragEvent) => {
    const exId = e.dataTransfer.getData(EXERCISE_MIME);
    const key = e.dataTransfer.getData(ITEM_MIME);
    if (!exId && !key) return;
    e.preventDefault();
    e.stopPropagation();
    const at = indexAt(e.clientY);
    if (exId) add(exerciseById(Number(exId)), at);
    else move(key, at);
    setDropAt(null);
    setArmed(null);
  };
  /* A PDF dropped anywhere on the builder opens the importer. */
  const onPageOver = (e: DragEvent) => { if (hasType(e, "Files")) { e.preventDefault(); setFileOver(true); } };
  const onPageDrop = (e: DragEvent) => {
    if (!hasType(e, "Files")) return;
    e.preventDefault();
    setFileOver(false);
    const file = Array.from(e.dataTransfer.files).find(isPdf);
    if (file) setPdf(file);
    else say("Drop a PDF program to import it");
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
    <div
      className={`full bld ${fileOver ? "file-over" : ""}`}
      onDragOver={onPageOver}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false); }}
      onDrop={onPageDrop}
    >
      <aside className="bld-side card flat"><LibraryPanel onAdd={(ex) => add(ex)} /></aside>
      <section className="bld-main">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div className="eyebrow">{clientName} · Week {workout.week} of {workout.ofWeeks}</div><h1 className="h1" style={{ fontSize: 22 }}>{workout.name}</h1></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}><Icons.file width={16} height={16} />Import PDF</button>
          <button className="btn ghost sm" onClick={() => setAiOpen(true)}>Adjust with AI</button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdf(f); e.target.value = ""; }} />
      </div>

      <div className="bld-quick" style={{ position: "relative" }}>
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
          <button className="chip bld-libchip" onClick={() => setLibOpen(true)}><Icons.plus width={12} height={12} />Browse library</button>
          <span className="tiny" style={{ alignSelf: "center" }}>Recent:</span>
          {RECENT_IDS.map((id) => <button key={id} className="chip" onClick={() => add(exerciseById(id))}>+ {exerciseById(id).name}</button>)}
        </div>
      )}

      <div
        ref={listRef}
        className={`card flat list bld-list ${dropAt !== null ? "dragging" : ""} ${dropAt !== null && dropAt >= workout.items.length ? "drop-end" : ""}`}
        onDragOver={onListOver}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null); }}
        onDrop={onListDrop}
      >
        {workout.items.length === 0 && (
          <div className="bld-empty">
            <b>Drag movements here</b>
            <span className="small">From the library, or drop a PDF program anywhere on this page. Search above works too.</span>
          </div>
        )}
        {workout.items.map((it, i) => {
          const ex = exerciseFor(it);
          return (
            <div
              key={it.key}
              data-row
              className={`bld-row ${dropAt === i ? "drop-before" : ""} ${fresh === it.key ? "fresh" : ""}`}
              draggable={armed === it.key}
              onDragStart={(e) => { e.dataTransfer.setData(ITEM_MIME, it.key); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { setArmed(null); setDropAt(null); }}
              onAnimationEnd={() => setFresh(null)}
            >
              <div className="row" style={{ gap: 10 }}>
                <button
                  className="bld-handle"
                  aria-label={`Move ${ex.name}. Drag, or use the arrow keys`}
                  onPointerDown={() => setArmed(it.key)}
                  onPointerUp={() => setArmed(null)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); move(it.key, i - 1); }
                    if (e.key === "ArrowDown" && i < workout.items.length - 1) { e.preventDefault(); move(it.key, i + 2); }
                  }}
                ><Icons.grip width={14} height={14} /></button>
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
      <p className="tiny" style={{ margin: 0 }}>Edits save to {first}'s program as you type{mode === "demo" ? ". Open the client app to see them" : " and show in their app straight away"}. Drag the dots to reorder.</p>
      </section>

      {fileOver && <div className="bld-filedrop" aria-hidden><Icons.file width={28} height={28} /><b>Drop the PDF to import it</b><span className="small">You review every exercise before it's added</span></div>}

      {libOpen && (
        <Sheet onClose={() => setLibOpen(false)} label="Movement library">
          <LibraryPanel onAdd={(ex) => add(ex)} />
          <button className="btn ghost block" onClick={() => setLibOpen(false)}>Done</button>
        </Sheet>
      )}

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

      {pdf && (
        <ImportPdf
          file={pdf}
          workout={workout}
          onClose={() => setPdf(null)}
          onApply={(next, msg) => { edit(() => next); setPdf(null); say(msg); }}
        />
      )}
    </div>
  );
}

function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="card full" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 22 }}>
      <h1 className="h1" style={{ fontSize: 22 }}>{title}</h1>
      <p className="sub" style={{ margin: 0 }}>{body}</p>
      {action && <button className="btn act" style={{ alignSelf: "flex-start" }} onClick={onAction}>{action}</button>}
    </div>
  );
}
