import {
  afterSet, blockAt, blockLabel, buildSummary, distanceMetres, completedSets, countPersonalBests, defaultBarFor, exerciseFor, formatRest, initialSets, isPersonalBest,
  sessionVolume, setTargets, summaryMessage, timedSeconds, totalSets, usesPlates, type Readiness, type SessionLog, type SessionSets, type SetEntry, type TrainingHistory, type Workout,
} from "@apex/core";
import { Icons } from "@apex/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useStore } from "../../data/StoreContext";
import { PlateCalculator } from "./PlateCalculator";
import { ReadinessCheck } from "./Readiness";

const RPE_SCALE = [6, 7, 8, 9, 10];

/** Guided workout: one exercise per screen, pre-filled sets, auto rest timer. Supersets, giant sets and circuits
    move station to station and rest after the round; timed stations get a work countdown. */
export function Player({ onExit, onDone }: { onExit: () => void; onDone: () => void }) {
  const store = useStore();
  // Snapshot the program at start so a coach edit mid-session can't reshuffle the sets being logged.
  const [w, setW] = useState(() => store.get().workout);
  /** Undefined until the client answers or skips the readiness check. */
  const [readiness, setReadiness] = useState<Readiness | null | undefined>(undefined);
  // Bests and last session as they were before this workout, so the summary compares against them.
  const [history] = useState(() => store.get().history);
  const [idx, setIdx] = useState(0);
  const [sets, setSets] = useState<SessionSets>(() => initialSets(w));
  const [rpe, setRpe] = useState<Record<string, number>>({});
  const [rest, setRest] = useState<{ left: number } | null>(null);
  /** Work countdown for a timed station ("40s"): the set ticks itself off when it reaches zero. */
  const [work, setWork] = useState<{ key: string; set: number; left: number } | null>(null);
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

  useEffect(() => {
    if (!work) return;
    if (work.left <= 0) {
      try { navigator.vibrate?.([120, 80, 120]); } catch { /* not supported */ }
      setWork(null);
      complete(work.key, work.set);
      return;
    }
    const id = setTimeout(() => setWork((x) => x && { ...x, left: x.left - 1 }), 1000);
    return () => clearTimeout(id);
    // complete() reads this render's sets; only the tick matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work]);

  /** Marks a set done, then rests and/or moves to the next station of the block. */
  function complete(key: string, i: number) {
    const at = w.items.findIndex((x) => x.key === key);
    const after = { ...sets, [key]: (sets[key] ?? []).map((x, j) => (j === i ? { ...x, done: true } : x)) };
    setSets(after);
    const { next, restSeconds } = afterSet(w, after, at);
    if (restSeconds) setRest({ left: restSeconds });
    if (next !== null) setTimeout(() => { setIdx(next); setShowCues(false); window.scrollTo(0, 0); }, 350);
  }

  if (readiness === undefined) {
    return (
      <ReadinessCheck workout={w} history={history.readiness} onExit={onExit} onStart={(r, session) => {
        setReadiness(r);
        setW(session);
        setSets(initialSets(session));
        startedAt.current = Date.now();
      }} />
    );
  }

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
    if (itemSets[i]?.done) return patchSet(i, { done: false });
    if (work?.key === it.key && work.set === i) setWork(null);
    complete(it.key, i);
  };

  const block = blockAt(w.items, idx);
  const inBlock = block.items.length > 1;
  const circuit = it.blockStyle === "circuit";
  const targets = setTargets(it);
  const hasKg = targets.some((t) => t.kg > 0);
  const workSecs = timedSeconds(it.reps);
  const round = itemSets.filter((s) => s.done).length + 1;

  if (finishing) return <Finish workout={w} sets={sets} history={history} readiness={readiness} minutes={minutes} onDone={onDone} />;

  // The plate calculator opens on the next set still to do.
  const nextSet = itemSets.find((s) => !s.done) ?? itemSets.at(-1);
  const plateKg = Number(nextSet?.kg.replace(",", ".")) || it.kg;

  const next = w.items[idx + 1];
  return (
    <div className="shell">
      <div className="top">
        <button className="iconbtn" onClick={onExit} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.close width={15} height={15} /> Exit</button>
        <span className="num small" style={{ fontWeight: 700 }}>{done}/{total} sets</span>
        <span className="tiny">{idx + 1} of {w.items.length}</span>
      </div>
      <div style={{ height: 4, background: "var(--line)" }}>
        <div style={{ height: "100%", width: `${(done / total) * 100}%`, background: "var(--act)", transition: "width .4s" }} />
      </div>
      <main className="main" style={{ paddingBottom: rest ? 170 : 110 }}>
        <div className="video"><span className="tag label l-data">{inBlock ? `${blockLabel(block.items)} · ${it.group}` : `Block ${it.group}`}</span><Icons.figure /></div>
        <div>
          <div className="eyebrow">{ex.muscles.join(" · ")}</div>
          <h1 className="h1" style={{ fontSize: 26 }}>{ex.name}</h1>
          <div className="small num" style={{ marginTop: 4 }}>
            {circuit ? `Round ${Math.min(round, it.sets)} of ${it.sets} · ${it.reps}` : `Target ${it.sets}×${it.setPlan ? targets.map((t) => t.reps).join("/") : it.reps}`}
            {it.kg ? ` @ ${it.setPlan ? `up to ${Math.max(...targets.map((t) => t.kg))}` : it.kg} kg` : ""} · RPE {it.rpe} · rest {it.restSeconds ? formatRest(it.restSeconds) : inBlock ? "none, next station" : "none, go to next"}
          </div>
          {inBlock && (
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {block.items.map((b) => <span key={b.key} className={`chip ${b.key === it.key ? "on" : ""}`}>{b.group} {exerciseFor(b).name}</span>)}
            </div>
          )}
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
            {[circuit ? "Rnd" : "Set", hasKg ? "kg" : "—", workSecs ? "Secs" : distanceMetres(it.reps) ? "Metres" : "Reps", "Target", ""].map((h, i) => <span key={i} className="tiny" style={{ textAlign: "center", fontWeight: 700 }}>{h}</span>)}
          </div>
          {itemSets.map((s, i) => (
            <div key={i} className="sets" style={{ marginBottom: 8, opacity: s.done ? 0.75 : 1 }}>
              <span className="num" style={{ textAlign: "center", fontWeight: 800, color: s.done ? "var(--good)" : "var(--text2)" }}>{i + 1}</span>
              {hasKg ? (
                <input id={`pk-${it.key}-${i}`} className="cell" inputMode="decimal" value={s.kg} onChange={(e) => patchSet(i, { kg: e.target.value })} aria-label={`Set ${i + 1} weight`} />
              ) : (
                <span className="tiny" style={{ textAlign: "center" }}>BW</span>
              )}
              <input id={`pr-${it.key}-${i}`} className="cell" inputMode="numeric" value={s.reps} onChange={(e) => patchSet(i, { reps: e.target.value })} aria-label={`Set ${i + 1} reps`} />
              <span className="num tiny" style={{ textAlign: "center" }}>{targets[i]?.reps ?? it.reps}{it.setPlan && targets[i]?.kg ? <><br />{targets[i]?.kg} kg</> : null}</span>
              <button className={`tick ${s.done ? "on" : ""}`} onClick={() => toggle(i)} aria-label={`Complete set ${i + 1}`}><Icons.check width={20} height={20} strokeWidth={2.25} /></button>
            </div>
          ))}
        </div>
        {workSecs && !exerciseDone && (
          <button className="btn act block" style={{ minHeight: 52 }} disabled={!!work} onClick={() => { const n = itemSets.findIndex((s) => !s.done); if (n >= 0) setWork({ key: it.key, set: n, left: workSecs }); setRest(null); }}>
            {work ? "Working…" : `Start ${workSecs} s`}
          </button>
        )}
        {isPersonalBest(it, itemSets, history.bestKg) && (
          <div className="card" style={{ background: "var(--act-soft)", borderColor: "var(--act)", padding: "10px 12px" }}><b style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.trophy width={16} height={16} style={{ color: "var(--act)" }} />New personal best</b> <span className="small">on {ex.name}</span></div>
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
      {work && (
        <div className="rest" role="timer" aria-live="polite" style={{ background: "var(--act)", color: "var(--act-ink)" }}>
          <div className="grow"><div className="tiny" style={{ color: "inherit", opacity: 0.7 }}>Work · {exerciseFor(w.items.find((x) => x.key === work.key) ?? it).name}</div><b>{formatRest(work.left)}</b></div>
          <button className="btn sm" style={{ background: "var(--bg)", color: "var(--text)" }} onClick={() => setWork(null)}>Stop</button>
          <button className="btn sm" style={{ background: "var(--bg)", color: "var(--text)" }} onClick={() => setWork((x) => x && { ...x, left: 0 })}>Done</button>
        </div>
      )}
      {rest && !work && (
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

function Finish({ workout: w, sets, history, readiness, minutes, onDone }: { workout: Workout; sets: SessionSets; history: TrainingHistory; readiness: Readiness | null; minutes: () => number; onDone: () => void }) {
  const store = useStore();
  const { clientName, coachName } = useAppInfo();
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  // Freeze the duration when the summary opens, so time spent here doesn't count as training.
  const [mins] = useState(minutes);
  const volume = sessionVolume(sets);
  const prs = countPersonalBests(w, sets, history.bestKg);
  const count = completedSets(sets);
  const summary = useMemo(() => ({ ...buildSummary(w, sets, mins, history), ...(readiness ? { readiness } : {}) }), [w, sets, mins, history, readiness]);
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
