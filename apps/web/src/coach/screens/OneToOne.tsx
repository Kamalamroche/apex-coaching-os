import {
  coachSessionLog, coachSessionMessage, completedSets, exerciseFor, firstName, formatRest, hasMeasurements, initialSets, isPersonalBest, noteTimeline,
  sessionLine, sessionNoteProblem, sessionVolume, setTargets, totalSets, SESSION_NOTE_MAX,
  type PhotoUpload, type SessionLog, type SessionNote, type SessionSets, type SetEntry,
} from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, Icons, NoteTimeline, RunProgress, RunStats, Sheet, ShareSwitch, WeightWheel, WheelInput, useUnits } from "@apex/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { MeasureInputs, PoseSlots, blankMeasures, parseMeasures } from "../../app/ProgressParts";
import { useExtras } from "../../data/extras";
import { useStore } from "../../data/StoreContext";
import { ONE_TO_ONE_SQL, type LiveStore } from "../../data/supabaseStore";

/* One-to-one tools on the client's profile: run a session on the coach's own phone or tablet, write session notes
   (just for the coach, or shared with the client), and take weight, measurements and photos in person. */

const RPE_SCALE = [6, 7, 8, 9, 10];
/** The demo log of the last session the coach ran here, so the "client finished a session" toast skips it. */
export const coachRunLog = { key: "" };
const errText = (e: unknown, fallback: string) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : fallback;
  // The coach's insert policies arrive with the one-to-one SQL; before that, RLS turns the write away.
  return /row-level security|42501/i.test(m) ? ONE_TO_ONE_SQL : m;
};

/** The client's "In person" tab: start a session, do an in-person check, and the session notes timeline. */
export function OneToOneTab({ clientId, clientName, canRun, whyNot, say }: { clientId: string; clientName: string; canRun: boolean; whyNot?: string; say: (m: string) => void }) {
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState(0);
  const first = firstName(clientName);
  // The session takes the whole screen, so nothing else on the profile gets in the way while the client trains.
  if (running) return (
    <div className="oo-stage" role="dialog" aria-modal="true" aria-label={`Session with ${first}`}>
      <div className="oo-stage-in">
        <RunSession clientId={clientId} clientName={clientName} onExit={() => setRunning(false)} onSaved={(m) => { setRunning(false); setVersion((v) => v + 1); say(m); }} />
      </div>
    </div>
  );
  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        {canRun && <button className="btn act" style={{ flex: 2, minHeight: 52 }} onClick={() => setRunning(true)}><Icons.play width={18} height={18} /> Run a session with {first}</button>}
        <button className="btn ghost" style={{ flex: 1, minHeight: 52 }} onClick={() => setChecking(true)}><Icons.figure width={18} height={18} /> In-person check</button>
      </div>
      {!canRun && whyNot && <div className="tiny">{whyNot}</div>}
      <SessionNotes key={version} clientId={clientId} clientName={clientName} say={say} />
      {checking && <InPersonCheckSheet clientName={clientName} onClose={() => setChecking(false)} onSaved={(m) => { setChecking(false); say(m); }} />}
    </>
  );
}

/** Write a note and read them back on a timeline. */
function SessionNotes({ clientId, clientName, say }: { clientId: string; clientName: string; say: (m: string) => void }) {
  const api = useExtras();
  const first = firstName(clientName);
  const [notes, setNotes] = useState<SessionNote[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!api) return;
    api.notes.list(clientId).then((n) => { setNotes(n); setErr(null); }, (e: unknown) => { setNotes([]); setErr(errText(e, "Couldn't load notes")); });
  }, [api, clientId]);
  useEffect(load, [load]);
  if (!api) return null;
  const problem = body.trim() ? sessionNoteProblem(body) : null;
  const save = async () => {
    setBusy(true);
    try {
      await api.notes.add({ clientId, body, shared, session: null });
      setBody("");
      say(shared ? `Note saved and shared with ${first}` : "Note saved, only you can see it");
      load();
    } catch (e) {
      say(errText(e, "Couldn't save the note"));
    } finally {
      setBusy(false);
    }
  };
  const act = (fn: () => Promise<void>, msg: string) => fn().then(() => { say(msg); load(); }, (e: unknown) => say(errText(e, "Couldn't change the note")));
  const groups = noteTimeline(notes ?? []);
  return (
    <section className="stack" style={{ gap: 12 }}>
      <div className="sect"><h2 className="h2">Session notes</h2></div>
      <div className="card stack" style={{ gap: 10 }}>
        <textarea id="sessionnote-new" className="field" rows={3} maxLength={SESSION_NOTE_MAX + 50} placeholder={`What happened today, what to change next time, anything ${first} mentioned`} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row" style={{ flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          <ShareSwitch shared={shared} onChange={setShared} client={first} />
          <button className="btn act" disabled={busy || !body.trim() || !!problem} onClick={() => void save()}>{busy ? "Saving…" : "Save note"}</button>
        </div>
        <div className="tiny">{problem ?? (shared ? `${first} sees this in Progress, under notes from you.` : `Only you see this. You can share it later.`)}</div>
      </div>
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      {notes === null ? <div className="small">Loading notes…</div> : notes.length === 0 ? (
        <div className="card small">No session notes yet. Write one after your next session, or run the session here and add it at the end.</div>
      ) : (
        <NoteTimeline groups={groups} client={first} actions={(n) => (
          <>
            <button className="link" onClick={() => void act(() => api.notes.setShared(n.id, !n.shared), n.shared ? `Now only you can see it` : `Shared with ${first}`)}>{n.shared ? "Make private" : `Share with ${first}`}</button>
            <button className="link" style={{ color: "var(--crit)" }} onClick={() => { if (confirm("Delete this note?")) void act(() => api.notes.remove(n.id), "Note deleted"); }}>Delete</button>
          </>
        )} />
      )}
    </section>
  );
}

/** Weight, measurements and photos, taken on the coach's device during a session. */
function InPersonCheckSheet({ clientName, onClose, onSaved }: { clientName: string; onClose: () => void; onSaved: (m: string) => void }) {
  return (
    <Sheet onClose={onClose} label="In-person check">
      <h2 className="h2">In-person check</h2>
      <div className="tiny">Measure {firstName(clientName)} now and it goes straight into their Progress, next to what they log themselves.</div>
      <InPersonCheck onCancel={onClose} onSaved={onSaved} />
    </Sheet>
  );
}

function InPersonCheck({ onCancel, onSaved }: { onCancel?: () => void; onSaved: (m: string) => void }) {
  const store = useStore();
  const u = useUnits();
  const { progress } = useApexState(store);
  const [value, setValue] = useState(blankMeasures);
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const parsed = parseMeasures(value, u);
  const any = hasMeasurements(parsed) || photos.length > 0;
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (hasMeasurements(parsed)) await store.logMeasurements(parsed);
      if (photos.length) await store.addPhotos(photos);
      onSaved([hasMeasurements(parsed) && "Measurements", photos.length && `${photos.length} photo${photos.length === 1 ? "" : "s"}`].filter(Boolean).join(" and ") + " saved");
    } catch (e) {
      setErr(errText(e, "Couldn't save"));
      setBusy(false);
    }
  };
  return (
    <>
      <MeasureInputs value={value} onChange={setValue} last={progress.measurements} />
      <PoseSlots value={photos} onChange={setPhotos} />
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row">
        {onCancel && <button className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>}
        <button className="btn act" style={{ flex: 2 }} disabled={!any || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save check"}</button>
      </div>
    </>
  );
}

/** Every exercise on one screen with its sets, so the coach can log as the client trains. Two columns on a tablet. */
function RunSession({ clientId, clientName, onExit, onSaved }: { clientId: string; clientName: string; onExit: () => void; onSaved: (m: string) => void }) {
  const store = useStore();
  const u = useUnits();
  const first = firstName(clientName);
  // Snapshot the plan and the bests at the start, so the summary compares against how things stood before today.
  const [w] = useState(() => store.get().workout);
  const [history] = useState(() => store.get().history);
  const [sets, setSets] = useState<SessionSets>(() => initialSets(w));
  const [rest, setRest] = useState<{ left: number; total: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef(Date.now());
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) { try { navigator.vibrate?.(200); } catch { /* not supported */ } setRest(null); return; }
    const id = setTimeout(() => setRest((r) => r && { ...r, left: r.left - 1 }), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  const minutes = () => Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
  const done = completedSets(sets);
  const total = totalSets(sets);
  const patch = (key: string, i: number, p: Partial<SetEntry>) => setSets((s) => ({ ...s, [key]: (s[key] ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const toggle = (key: string, i: number, restSeconds: number) => {
    const on = sets[key]?.[i]?.done;
    patch(key, i, { done: !on });
    if (!on && restSeconds) setRest({ left: restSeconds, total: restSeconds });
  };

  if (finishing) return <FinishRun clientId={clientId} clientName={clientName} workoutName={w.name} log={coachSessionLog(w, sets, minutes(), history, 8)} sets={sets} onBack={() => setFinishing(false)} onSaved={onSaved} />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <BackLink onClick={() => { if (done === 0 || confirm("Leave without saving this session?")) onExit(); }}>{done ? "Leave without saving" : "Back to profile"}</BackLink>
      <div className="oo-top">
        <div>
          <div className="eyebrow">In person · {first}</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{w.name}</h1>
        </div>
        <RunStats done={done} total={total} volume={`${Math.round(u.w(sessionVolume(sets))).toLocaleString("en-GB")} ${u.weight}`} minutes={minutes()} />
      </div>
      <RunProgress pct={total ? (done / total) * 100 : 0} />
      <div className="oo-grid">
        {w.items.map((it, n) => {
          const ex = exerciseFor(it);
          const rows = sets[it.key] ?? [];
          const targets = setTargets(it);
          const hasKg = targets.some((t) => t.kg > 0) || rows.some((r) => Number(r.kg) > 0);
          const allDone = rows.length > 0 && rows.every((r) => r.done);
          return (
            <section key={it.key} className={`oo-ex ${allDone ? "done" : ""}`} style={{ ["--i" as string]: Math.min(n, 8) }} aria-label={ex.name}>
              <div className="oo-ex-head">
                <span className="grp">{it.group}</span>
                <div className="grow">
                  <div className="oo-ex-name">{ex.name}</div>
                  <div className="oo-ex-meta num">{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""} · RPE {it.rpe} · rest {it.restSeconds ? formatRest(it.restSeconds) : "none"}</div>
                  {it.lastTime && <div className="oo-ex-meta">Last time: <b className="num">{u.kt(it.lastTime)}</b></div>}
                  {it.note && <div className="oo-ex-note">{it.note}</div>}
                </div>
              </div>
              <div className="oo-set head"><span>Set</span><span>{hasKg ? u.weight : "Load"}</span><span>Reps</span><span /></div>
              {rows.map((s, i) => (
                <div key={i} className={`oo-set ${s.done ? "on" : ""}`}>
                  <span className="n">{i + 1}</span>
                  {hasKg ? (
                    <WeightWheel id={`cr-k-${it.key}-${i}`} className="field" title={`${ex.name}, set ${i + 1} weight`} min={0} max={400} step={0.25} fallback={targets[i]?.kg || it.kg || 20} value={s.kg} onChange={(v) => patch(it.key, i, { kg: v })} />
                  ) : <span className="tiny" style={{ textAlign: "center" }}>BW</span>}
                  <WheelInput id={`cr-r-${it.key}-${i}`} className="field" title={`${ex.name}, set ${i + 1} reps`} unit="reps" min={0} max={100} step={1} fallback={Number(targets[i]?.reps ?? it.reps) || 8} value={s.reps} onChange={(v) => patch(it.key, i, { reps: v })} />
                  <button className={`tick ${s.done ? "on" : ""}`} onClick={() => toggle(it.key, i, it.restSeconds)} aria-label={`${s.done ? "Undo" : "Complete"} ${ex.name} set ${i + 1}`}><Icons.check width={20} height={20} strokeWidth={2.25} /></button>
                </div>
              ))}
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button className="link" onClick={() => setSets((s) => { const r = s[it.key] ?? []; const last = r.at(-1); return { ...s, [it.key]: [...r, { kg: last?.kg ?? "", reps: last?.reps ?? "", done: false }] }; })}>+ Add a set</button>
                {isPersonalBest(it, rows, history.bestKg) && <span className="oo-best"><Icons.trophy width={14} height={14} />New best</span>}
              </div>
            </section>
          );
        })}
      </div>
      {rest && (
        <div className="oo-rest" role="timer" aria-live="polite" aria-label={`Rest, ${formatRest(rest.left)} left`}>
          <span>Rest <b>{formatRest(rest.left)}</b></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" onClick={() => setRest((r) => r && { left: r.left + 30, total: r.total + 30 })}>+30 s</button>
            <button className="btn sm ghost" onClick={() => setRest(null)}>Skip</button>
          </span>
        </div>
      )}
      <button className="btn act block" style={{ minHeight: 54 }} disabled={done === 0} onClick={() => { setRest(null); setFinishing(true); document.querySelector(".oo-stage")?.scrollTo(0, 0); }}>Finish session · {done} set{done === 1 ? "" : "s"}</button>
      <div className="tiny" style={{ textAlign: "center" }}>Tick each set as {first} finishes it. Nothing is saved until you finish.</div>
    </div>
  );
}

/** Effort, the session note (private or shared), an optional in-person check, then save and tell the client. */
function FinishRun({ clientId, clientName, workoutName, log: base, sets, onBack, onSaved }: { clientId: string; clientName: string; workoutName: string; log: SessionLog; sets: SessionSets; onBack: () => void; onSaved: (m: string) => void }) {
  const store = useStore() as ReturnType<typeof useStore> & Partial<Pick<LiveStore, "saveCoachSession">>;
  const api = useExtras();
  const u = useUnits();
  const first = firstName(clientName);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(true);
  const [tell, setTell] = useState(true);
  const [check, setCheck] = useState(false);
  const [checked, setChecked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const log: SessionLog = { ...base, rpe: rpe ?? base.rpe };
  const noteProblem = note.trim() ? sessionNoteProblem(note) : null;
  const message = coachSessionMessage(log, first, shared ? note : null);

  const save = async () => {
    if (rpe === null) return;
    setBusy(true);
    setErr(null);
    try {
      if (store.saveCoachSession) await store.saveCoachSession(log, sets);
      else { coachRunLog.key = JSON.stringify(log); store.finishSession(log, sets); }
    } catch (e) {
      setErr(errText(e, "The session wasn't saved"));
      setBusy(false);
      return;
    }
    // The session is in. Anything after this is extra, so a failure is reported but doesn't undo it.
    const missed: string[] = [];
    if (note.trim() && api) await api.notes.add({ clientId, body: note, shared, session: sessionLine(log) }).catch((e: unknown) => missed.push(`the note (${errText(e, "not saved")})`));
    if (tell) store.sendMessage("coach", message);
    onSaved(missed.length ? `Session saved, but not ${missed.join(", ")}` : `Session saved to ${first}'s history${tell ? " and sent to them" : ""}`);
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <BackLink onClick={onBack}>Back to the sets</BackLink>
      <div>
        <div className="eyebrow" style={{ color: "var(--good)" }}>Session done{log.prs ? ` · ${log.prs} personal best${log.prs > 1 ? "s" : ""}` : ""}</div>
        <h1 className="h1" style={{ fontSize: 24 }}>{workoutName} with {first}</h1>
      </div>
      <div className="kpis">
        <div className="kpi"><b>{log.sets}</b><small>Sets · {log.summary?.totalReps ?? 0} reps</small></div>
        <div className="kpi"><b>{Math.round(u.w(log.volumeKg)).toLocaleString("en-GB")}</b><small>{u.weight} lifted</small></div>
        <div className="kpi"><b>{log.minutes}</b><small>Minutes</small></div>
      </div>
      <div className="card">
        <h3 className="h3" style={{ marginBottom: 8 }}>How hard was it for {first}? (RPE)</h3>
        <div className="rpe">{RPE_SCALE.map((n) => <button key={n} className={rpe === n ? "on" : ""} onClick={() => setRpe(n)}>{n}</button>)}</div>
        <div className="tiny" style={{ marginTop: 6 }}>Ask {first}, or use your own read. 6 = easy, 10 = maximal.</div>
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <h3 className="h3">Session note</h3>
        <textarea id="sessionnote-run" className="field" rows={3} placeholder="Technique, how they felt, what to change next time" value={note} onChange={(e) => setNote(e.target.value)} />
        <ShareSwitch shared={shared} onChange={setShared} client={first} />
        {noteProblem && <div className="tiny" style={{ color: "var(--crit)" }}>{noteProblem}</div>}
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        <button className="row link" style={{ justifyContent: "space-between", width: "100%" }} onClick={() => setCheck((c) => !c)} aria-expanded={check}>
          <span className="h3" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.figure width={18} height={18} />Weight, measurements or photos</span>
          <span className="tiny">{check ? "Hide" : "Add now"}</span>
        </button>
        {check && <InPersonCheck onSaved={(m) => { setCheck(false); setChecked(m); }} />}
        {checked && !check && <div className="small" style={{ color: "var(--good)" }}>{checked}. It's in {first}'s Progress.</div>}
      </div>
      <div className="card stack" style={{ gap: 8 }}>
        <label className="row" style={{ gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} />
          <span className="h3">Send {first} the summary in Messages</span>
        </label>
        {tell && <div className="oo-msg">{message}</div>}
      </div>
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <button className="btn act block" style={{ minHeight: 54 }} disabled={rpe === null || busy || !!noteProblem} onClick={() => void save()}>{busy ? "Saving…" : rpe === null ? "Pick the effort to save" : `Save to ${first}'s history`}</button>
      <div className="tiny" style={{ textAlign: "center" }}>It counts as a session {first} trained, so their Progress, bests and health score update.</div>
    </div>
  );
}
