import {
  addExercise, alternativesFor, estimatedOneRepMax, exerciseById, exerciseFor, insertExercise, isSuperset, kgFromPercent, moveItem, parseLastTime, removeItem, searchExercises,
  swapExercise, toggleSuperset, updateItem, DAY_NAMES, addDay, blockAt, blockLabel, freeDayIndex, setCircuit, setRounds, setTargets, setVarySets, updateSetTarget,
  type Exercise, type Workout, type WorkoutItem,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, Sheet } from "@apex/ui";
import { Fragment, useMemo, useRef, useState, type DragEvent } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import { AiAdjust } from "./AiAdjust";
import { Copilot } from "./Copilot";
import { ImportPdf } from "./ImportPdf";
import { ProgramBar } from "./ProgramBar";
import { PlateauFixes, usePlateaus } from "./Plateaus";
import { Templates } from "./Templates";
import type { CoachLiveProps } from "../CoachApp";
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

export function Builder({ say, onInvite, live }: { say: (m: string) => void; onInvite: () => void; live?: CoachLiveProps }) {
  const store = useStore();
  const { clientName, mode } = useAppInfo();
  const { status, error } = useStoreStatus();
  const { workout, program, activeDay } = useApexState(store);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [q, setQ] = useState("");
  const [swapping, setSwapping] = useState<WorkoutItem | null>(null);
  const [plateauOpen, setPlateauOpen] = useState<number | null>(null);
  const plateaus = usePlateaus();
  const [aiOpen, setAiOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  /* What the importer reads: a PDF, or "text" to paste one in. */
  const [importing, setImporting] = useState<File | "text" | null>(null);
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
  /* "75%" in the kg box loads 75% of the estimated 1RM from the last logged set. */
  const setKg = (it: WorkoutItem, raw: string) => {
    const pct = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(raw.trim());
    if (!pct) return upd(it.key, { kg: Number(raw.replace(",", ".")) || 0 });
    const kg = kgFromPercent(it, Number(pct[1]?.replace(",", ".")));
    if (kg === null) return say("No logged sets yet, so there's no 1RM to work from");
    upd(it.key, { kg });
    say(`${pct[1]}% of the estimated 1RM = ${kg} kg`);
  };

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
    if (file) setImporting(file);
    else say("Drop a PDF program to import it");
  };

  const first = clientName.split(" ")[0] ?? clientName;
  const openDay = program.days.find((d) => d.key === activeDay);
  const duplicateDay = () => {
    if (!openDay) return;
    const at = freeDayIndex(program, openDay.week, openDay.dayIndex);
    if (at === null) return say(`Week ${openDay.week} has no free day left`);
    const { program: p, day } = addDay(program, openDay.week, at, workout);
    store.saveProgram(p, day.key);
    say(`${workout.name} duplicated to ${DAY_NAMES[at]}`);
  };
  if (mode === "live" && !clientName) {
    return <Empty title="No clients yet" body="Invite your first client, then build their program here." action="Invite a client" onAction={onInvite} />;
  }
  if (status === "loading") return <Empty title="Loading program…" body={`Fetching ${first}'s program.`} />;
  if (status === "error") return <Empty title="Couldn't load the program" body={error ?? "Unknown error"} />;
  if (status === "no-program") {
    return (
      <>
        <Empty title={`${first} has no program yet`} body="Start from a template (yours or an APEX starter), or from the Foundations day, then edit it here. Changes save as you type." action="Choose a template" onAction={() => setTemplatesOpen(true)} secondary="Start with Foundations" onSecondary={() => void (store as { createProgram?: () => Promise<void> }).createProgram?.()} />
        {templatesOpen && <Templates live={live} say={say} onClose={() => setTemplatesOpen(false)} />}
      </>
    );
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
      <ProgramBar say={say} onTemplates={() => setTemplatesOpen(true)} onCopilot={() => setCopilotOpen(true)} />
      {"hasPlanColumns" in store && !(store as { hasPlanColumns: () => boolean }).hasPlanColumns() && workout.items.some((x) => x.setPlan || x.blockStyle) && (
        <div className="card" style={{ background: "var(--warn-soft)", borderColor: "var(--warn)", padding: "10px 12px" }}>
          <span className="small" style={{ color: "var(--text)" }}>Per-set targets and circuits are only kept on this screen until the program builder SQL is run in Supabase.</span>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div className="eyebrow">{clientName} · Week {workout.week} of {workout.ofWeeks} · {DAY_NAMES[openDay?.dayIndex ?? 0]}</div><h1 className="h1" style={{ fontSize: 22 }}>{workout.name}</h1></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm bld-pdfbtn" onClick={() => fileRef.current?.click()}><Icons.file width={16} height={16} />Import PDF</button>
          <button className="btn ghost sm bld-pdfbtn" style={{ whiteSpace: "nowrap" }} onClick={() => setImporting("text")}>Paste or speak</button>
          <button className="btn ghost sm" style={{ whiteSpace: "nowrap" }} onClick={() => setAiOpen(true)}>Adjust with AI</button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setImporting(f); e.target.value = ""; }} />
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
          <button className="chip bld-libchip" onClick={() => fileRef.current?.click()}><Icons.file width={12} height={12} />Import PDF</button>
          <button className="chip bld-libchip" onClick={() => setImporting("text")}>Paste or speak</button>
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
          const e1rm = estimatedOneRepMax(parseLastTime(it.lastTime));
          const linked = workout.items[i - 1]?.group[0] === it.group[0];
          const block = blockAt(workout.items, i);
          const circuit = it.blockStyle === "circuit";
          const vary = !!it.setPlan;
          const stalled = plateaus.find((p) => p.exercise.id === it.exerciseId);
          return (
            <Fragment key={it.key}>
            {block.start === i && block.items.length > 1 && (
              <div className={`bld-block ${circuit ? "circuit" : ""}`}>
                <span className="grp" style={{ width: 28 }}>{it.group[0]}</span>
                <b>{blockLabel(block.items)}</b>
                <span className="tiny">{block.items.length} exercises{circuit ? ", station to station, rest after each round" : ", back to back"}</span>
                <span className="grow" />
                {circuit && (
                  <label className="bld-rounds">Rounds<input inputMode="numeric" value={it.sets} onChange={(e) => edit((w) => setRounds(w, it.key, Math.min(20, Number(e.target.value.replace(/\D/g, "")) || 1)))} /></label>
                )}
                <button className={`chip ${circuit ? "on" : ""}`} aria-pressed={circuit} onClick={() => { edit((w) => setCircuit(w, it.key, !circuit)); say(circuit ? "Back to a linked set" : "Running as a circuit"); }}>Circuit</button>
              </div>
            )}
            <div
              data-row
              className={`bld-row ${dropAt === i ? "drop-before" : ""} ${fresh === it.key ? "fresh" : ""}`}
              draggable={armed === it.key}
              data-lifted={armed === it.key && dropAt !== null ? "" : undefined}
              onDragStart={(e) => { e.dataTransfer.setData(ITEM_MIME, it.key); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { setArmed(null); setDropAt(null); }}
              onAnimationEnd={() => setFresh(null)}
            >
              <div className="row" style={{ gap: 10 }}>
                <button
                  className="bld-handle"
                  aria-label={`Move ${ex.name}. Drag, or use the arrow keys`}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse") { setArmed(it.key); return; }
                    // Touch screens don't drag natively: follow the finger and drop where it lifts.
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
                    setArmed(it.key);
                  }}
                  onPointerMove={(e) => { if (e.pointerType !== "mouse" && armed === it.key) setDropAt(indexAt(e.clientY)); }}
                  onPointerUp={(e) => {
                    if (e.pointerType !== "mouse" && armed === it.key && dropAt !== null) move(it.key, dropAt);
                    setArmed(null);
                    setDropAt(null);
                  }}
                  onPointerCancel={() => { setArmed(null); setDropAt(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); move(it.key, i - 1); }
                    if (e.key === "ArrowDown" && i < workout.items.length - 1) { e.preventDefault(); move(it.key, i + 2); }
                  }}
                ><Icons.grip width={14} height={14} /></button>
                <span className="grp" style={{ width: 28 }}>{it.group}</span>
                <div className="grow"><div className="h3">{ex.name}</div><div className="tiny">{ex.pattern} · {ex.equipment}{isSuperset(it) ? ` · ${circuit ? "station" : "linked"} ${it.group.slice(1)}` : ""}</div></div>
                <button className="btn ghost sm" onClick={() => setSwapping(it)}>Swap</button>
                <button className="iconbtn" aria-label={`Remove ${ex.name}`} onClick={() => edit((w) => removeItem(w, it.key))}>×</button>
              </div>
              <div className="mini">
                <label>{circuit ? "Rounds" : "Sets"}<input id={`s-${it.key}`} inputMode="numeric" value={it.sets} onChange={(e) => { const n = Math.min(20, Number(e.target.value.replace(/\D/g, "")) || 1); edit((w) => (circuit ? setRounds(w, it.key, n) : updateItem(w, it.key, { sets: n }))); }} /></label>
                <label>{circuit ? "Reps / time" : "Reps"}<input id={`r-${it.key}`} value={vary ? "per set" : it.reps} disabled={vary} onChange={(e) => upd(it.key, { reps: e.target.value })} /></label>
                <label>kg<input id={`k-${it.key}`} inputMode="decimal" value={vary ? "per set" : it.kg} disabled={vary} title="Type a percentage such as 75% to load from the estimated 1RM" onChange={(e) => setKg(it, e.target.value)} /></label>
                <label>RPE<input id={`p-${it.key}`} inputMode="decimal" value={it.rpe} onChange={(e) => upd(it.key, { rpe: Number(e.target.value) || 0 })} /></label>
                <label>Rest s<input id={`t-${it.key}`} inputMode="numeric" value={it.restSeconds} onChange={(e) => upd(it.key, { restSeconds: Number(e.target.value) || 0 })} /></label>
              </div>
              {vary && (
                <div className="bld-sets">
                  {setTargets(it).map((t, n) => (
                    <div key={n} className="bld-set">
                      <span className="tiny num">Set {n + 1}</span>
                      <label>Reps<input value={t.reps} onChange={(e) => edit((w) => updateItem(w, it.key, updateSetTarget(it, n, { reps: e.target.value })))} aria-label={`Set ${n + 1} reps`} /></label>
                      <label>kg<input inputMode="decimal" value={t.kg} onChange={(e) => edit((w) => updateItem(w, it.key, updateSetTarget(it, n, { kg: Number(e.target.value.replace(",", ".")) || 0 })))} aria-label={`Set ${n + 1} kg`} /></label>
                    </div>
                  ))}
                </div>
              )}
              {plateauOpen === it.exerciseId && stalled && <PlateauFixes plateau={stalled} say={say} onDone={() => setPlateauOpen(null)} />}
              <div className="bld-foot">
                <span className="tiny">Last time: <span className="num">{it.lastTime}</span>{e1rm ? <> · e1RM <span className="num">{e1rm} kg</span></> : null}</span>
                <span className="row" style={{ gap: 6 }}>
                  {stalled && <button className="chip plat-chip" aria-expanded={plateauOpen === it.exerciseId} onClick={() => setPlateauOpen(plateauOpen === it.exerciseId ? null : it.exerciseId)} title={stalled.reason}>Stalled</button>}
                  <button className={`chip bld-ss ${vary ? "on" : ""}`} aria-pressed={vary} onClick={() => edit((w) => updateItem(w, it.key, setVarySets(it, !vary)))} title="Different reps and kg on each set: pyramids, top set and back-offs">{vary ? "Per set ✓" : "Per set"}</button>
                  {i > 0 && (
                    <button className={`chip bld-ss ${linked ? "on" : ""}`} aria-pressed={linked} onClick={() => edit((w) => toggleSuperset(w, it.key))} title={linked ? "Unlink from the exercise above" : "Link with the exercise above: superset, tri-set, giant set or circuit"}>
                      {linked ? "Linked ✓" : "+ Link above"}
                    </button>
                  )}
                </span>
              </div>
            </div>
            </Fragment>
          );
        })}
      </div>
      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={duplicateDay}>Duplicate day</button>
        <button className="btn act" style={{ flex: 1.4 }} onClick={() => say(`Published · ${first}'s app updated`)}>Publish to client</button>
      </div>
      <p className="tiny" style={{ margin: 0 }}>Edits save to {first}'s program as you type{mode === "demo" ? ". Open the client app to see them" : " and show in their app straight away"}. Drag the dots to reorder. Type a percentage such as 75% in kg to load from the estimated 1RM.</p>
      </section>

      {fileOver && <div className="bld-filedrop" aria-hidden><Icons.file width={28} height={28} /><b>Drop the PDF to import it</b><span className="small">You review every exercise before it's added</span></div>}

      {templatesOpen && <Templates live={live} say={say} onClose={() => setTemplatesOpen(false)} />}

      {libOpen && (
        <Sheet onClose={() => setLibOpen(false)} label="Movement library">
          <LibraryPanel onAdd={(ex) => add(ex)} inSheet />
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

      {copilotOpen && <Copilot onClose={() => setCopilotOpen(false)} say={say} />}

      {aiOpen && (
        <AiAdjust
          workout={workout}
          onClose={() => setAiOpen(false)}
          onApply={(next, msg) => { edit(() => next); setAiOpen(false); say(msg); }}
        />
      )}

      {importing && (
        <ImportPdf
          file={importing === "text" ? null : importing}
          workout={workout}
          onClose={() => setImporting(null)}
          onApply={(next, msg) => { edit(() => next); setImporting(null); say(msg); }}
        />
      )}
    </div>
  );
}

function Empty({ title, body, action, onAction, secondary, onSecondary }: { title: string; body: string; action?: string; onAction?: () => void; secondary?: string; onSecondary?: () => void }) {
  return (
    <div className="card full" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 22 }}>
      <h1 className="h1" style={{ fontSize: 22 }}>{title}</h1>
      <p className="sub" style={{ margin: 0 }}>{body}</p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {action && <button className="btn act" onClick={onAction}>{action}</button>}
        {secondary && <button className="btn ghost" onClick={onSecondary}>{secondary}</button>}
      </div>
    </div>
  );
}
