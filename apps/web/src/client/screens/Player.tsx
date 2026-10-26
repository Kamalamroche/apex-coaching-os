import {
  buildSummary, completedSets, countPersonalBests, defaultBarFor, exerciseFor, formatRest, initialSets, isPersonalBest, isSuperset,
  sessionVolume, summaryMessage, totalSets, usesPlates, type SessionLog, type SessionSets, type SetEntry, type TrainingHistory, type Workout,
} from "@apex/core";
import { Icons } from "@apex/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useStore } from "../../data/StoreContext";
import { PlateCalculator } from "./PlateCalculator";

const RPE_SCALE = [6, 7, 8, 9, 10];

/** Guided workout: one exercise per screen, pre-filled sets, auto rest timer, superset auto-advance. */
export function Player({ onExit, onDone }: { onExit: () => void; onDone: () => void }) {
  const store = useStore();
  // Snapshot the program at start so a coach edit mid-session can't reshuffle the sets being logged.
  const [w] = useState(() => store.get().workout);
  // Bests and last session as they were before this workout, so the summary compares against them.
  const [history] = useState(() => store.get().history);
  const [idx, setIdx] = useState(0);
  const [sets, setSets] = useState<SessionSets>(() => initialSets(w));
  const [rpe, setRpe] = useState<Record<string, number>>({});
  const [rest, setRest] = useState<{ left: number } | null>(null);
  const [showCues, setShowCues] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [plates, setPlates] = useState(false);
  /** Bar chosen in the plate calculator, per exercise, for this session. */
  const [barKg, setBarKg] = useState<Record<number, number>>({});
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      try { navigator.vibrate?.(200); } catch { /* not supported */ }
      setRest(null);
      return;
    }
    const id = setTimeout(() => setRest((r) => r && { left: r.left - 1 }), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  const it = w.items[idx];
  if (!it) return null;
  const ex = exerciseFor(it);
  const itemSets: SetEntry[] = sets[it.key] ?? [];
  const done = completedSets(sets);
  const total = totalSets(sets);
  const exerciseDone = itemSets.every((s) => s.done);
  const minutes = () => Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));

  const patchSet = (i: number, patch: Partial<SetEntry>) =>
    setSets((s) => ({ ...s, [it.key]: (s[it.key] ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const toggle = (i: number) => {
    const nowDone = !itemSets[i]?.done;
    patchSet(i, { done: nowDone });
    if (!nowDone) return;
    if (it.restSeconds) setRest({ left: it.restSeconds });
    else if (isSuperset(it) && idx < w.items.length - 1) setTimeout(() => setIdx(idx + 1), 350);
  };

  if (finishing) return <Finish workout={w} sets={sets} history={history} minutes={minutes} onDone={onDone} />;

  // The plate calculator opens on the next set still to do.
  const nextSet = itemSets.find((s) => !s.done) ?? itemSets.at(-1);
  const plateKg = Number(nextSet?.kg.replace(",", ".")) || it.kg;

  const next = w.items[idx + 1];
  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit}>✕ Exit</button>
        <span className="num small" style={{ fontWeight: 700 }}>{done}/{total} sets</span>
        <span className="tiny">{idx + 1} of {w.items.length}</span>
      </div>
      <div style={{ height: 4, background: "var(--line)" }}>
        <div style={{ height: "100%", width: `${(done / total) * 100}%`, background: "var(--act)", transition: "width .4s" }} />
      </div>
      <main className="main" style={{ paddingBottom: rest ? 170 : 110 }}>
        <div className="video"><span className="tag label l-data">{isSuperset(it) ? `Superset ${it.group}` : `Block ${it.group}`}</span><Icons.figure /></div>
        <div>
          <div className="eyebrow">{ex.muscles.join(" · ")}</div>
          <h1 className="h1" style={{ fontSize: 26 }}>{ex.name}</h1>
          <div className="small num" style={{ marginTop: 4 }}>Target {it.sets}×{it.reps}{it.kg ? ` @ ${it.kg} kg` : ""} · RPE {it.rpe} · rest {it.restSeconds ? formatRest(it.restSeconds) : "none, go to next"}</div>
          <div className="row" style={{ gap: 14, marginTop: 6 }}>
            <button className="link" onClick={() => setShowCues(!showCues)}>{showCues ? "Hide cues" : "Show cues"}</button>
            {usesPlates(ex) && it.kg > 0 && <button className="link" onClick={() => setPlates(true)}>Plate calculator</button>}
          </div>
          {showCues && <ol className="small" style={{ margin: "6px 0 0", paddingLeft: 20 }}>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ol>}
        </div>
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="small">Last time: <b className="num" style={{ color: "var(--text)" }}>{it.lastTime}</b></div>
        </div>
        <div>
          <div className="sets" style={{ marginBottom: 6 }}>
            {["Set", it.kg ? "kg" : "—", it.reps.includes("s") ? "Secs" : "Reps", "Target", ""].map((h, i) => <span key={i} className="tiny" style={{ textAlign: "center", fontWeight: 700 }}>{h}</span>)}
          </div>
          {itemSets.map((s, i) => (
            <div key={i} className="sets" style={{ marginBottom: 8, opacity: s.done ? 0.75 : 1 }}>
              <span className="num" style={{ textAlign: "center", fontWeight: 800, color: s.done ? "var(--good)" : "var(--text2)" }}>{i + 1}</span>
              {it.kg ? (
                <input id={`pk-${it.key}-${i}`} className="cell" inputMode="decimal" value={s.kg} onChange={(e) => patchSet(i, { kg: e.target.value })} aria-label={`Set ${i + 1} weight`} />
              ) : (
                <span className="tiny" style={{ textAlign: "center" }}>BW</span>
              )}
              <input id={`pr-${it.key}-${i}`} className="cell" inputMode="numeric" value={s.reps} onChange={(e) => patchSet(i, { reps: e.target.value })} aria-label={`Set ${i + 1} reps`} />
              <span className="num tiny" style={{ textAlign: "center" }}>{it.reps}</span>
              <button className={`tick ${s.done ? "on" : ""}`} onClick={() => toggle(i)} aria-label={`Complete set ${i + 1}`}>✓</button>
            </div>
          ))}
        </div>
        {isPersonalBest(it, itemSets, history.bestKg) && (
          <div className="card" style={{ background: "var(--act-soft)", borderColor: "var(--act)", padding: "10px 12px" }}><b>🎉 New personal best</b> <span className="small">on {ex.name}</span></div>
        )}
        {exerciseDone && (
          <div className="card">
            <h3 className="h3" style={{ marginBottom: 8 }}>How hard was that? (RPE)</h3>
            <div className="rpe">{RPE_SCALE.map((n) => <button key={n} className={rpe[it.key] === n ? "on" : ""} onClick={() => setRpe((r) => ({ ...r, [it.key]: n }))}>{n}</button>)}</div>
          </div>
        )}
      </main>
      {plates && (
        <PlateCalculator exercise={ex} kg={plateKg} barKg={barKg[ex.id] ?? defaultBarFor(ex)} setBarKg={(kg) => setBarKg((b) => ({ ...b, [ex.id]: kg }))} onClose={() => setPlates(false)} />
      )}
      {rest && (
        <div className="rest" role="timer" aria-live="polite">
          <div className="grow"><div className="tiny" style={{ color: "inherit", opacity: 0.7 }}>Rest</div><b>{formatRest(rest.left)}</b></div>
          <button className="btn sm" style={{ background: "var(--bg)", color: "var(--text)" }} onClick={() => setRest((r) => r && { left: r.left + 30 })}>+30 s</button>
          <button className="btn act sm" onClick={() => setRest(null)}>Skip</button>
        </div>
      )}
      <nav className="tabs" style={{ gap: 8, padding: "10px 16px calc(12px + env(safe-area-inset-bottom,0px))" }}>
        <button className="btn ghost" style={{ flex: 1 }} disabled={idx === 0} onClick={() => { setIdx(idx - 1); setShowCues(false); }}>Back</button>
        {next ? (
          <button className={`btn ${exerciseDone ? "act" : "ghost"}`} style={{ flex: 2 }} onClick={() => { setIdx(idx + 1); setShowCues(false); window.scrollTo(0, 0); }}>Next: {exerciseFor(next).name}</button>
        ) : (
          <button className="btn act" style={{ flex: 2 }} onClick={() => { setRest(null); setFinishing(true); }}>Finish workout</button>
        )}
      </nav>
    </div>
  );
}

function Finish({ workout: w, sets, history, minutes, onDone }: { workout: Workout; sets: SessionSets; history: TrainingHistory; minutes: () => number; onDone: () => void }) {
  const store = useStore();
  const { clientName, coachName } = useAppInfo();
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  // Freeze the duration when the summary opens, so time spent here doesn't count as training.
  const [mins] = useState(minutes);
  const volume = sessionVolume(sets);
  const prs = countPersonalBests(w, sets, history.bestKg);
  const count = completedSets(sets);
  const summary = useMemo(() => buildSummary(w, sets, mins, history), [w, sets, mins, history]);
  const save = () => {
    if (sessionRpe === null) return;
    const log: SessionLog = { workoutName: w.name, sets: count, volumeKg: volume, minutes: mins, rpe: sessionRpe, prs, summary, ...(note.trim() ? { note: note.trim() } : {}) };
    store.finishSession(log, sets);
    // The coach gets the summary straight away in the message thread too.
    store.sendMessage("client", summaryMessage(log));
    onDone();
  };
  return (
    <div className="shell">
      <main className="main" style={{ paddingBottom: 40 }}>
        <div className="eyebrow" style={{ color: "var(--good)" }}>Workout complete</div>
        <h1 className="h1">Nice work, {clientName.split(" ")[0]}.</h1>
        <div className="kpis">
          <div className="kpi"><b>{count}</b><small>Sets · {summary.totalReps ?? 0} reps</small></div>
          <div className="kpi"><b>{volume.toLocaleString()}</b><small>kg lifted</small></div>
          <div className="kpi"><b>{mins}</b><small>Minutes</small></div>
        </div>
        <WorkoutSummaryCard summary={summary} />
        <div className="card">
          <h3 className="h3" style={{ marginBottom: 8 }}>How hard was the whole session?</h3>
          <div className="rpe">{RPE_SCALE.map((n) => <button key={n} className={sessionRpe === n ? "on" : ""} onClick={() => setSessionRpe(n)}>{n}</button>)}</div>
          <div className="tiny" style={{ marginTop: 6 }}>6 = easy, 10 = maximal</div>
        </div>
        <input id="sessionnote" className="field" placeholder={`Note for ${coachName} (optional)`} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn act block" style={{ minHeight: 52 }} disabled={sessionRpe === null} onClick={save}>Save and send to {coachName}</button>
        <div className="tiny" style={{ textAlign: "center" }}>{coachName} gets this summary as soon as you save.</div>
      </main>
    </div>
  );
}
