import { COPILOT_EXAMPLES, changeCount, exerciseById, formatRest, parseCommand, runCommand, type CopilotResult, type WorkoutItem } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, Label, Sheet, useUnits, type Units } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { speechApi, type Recognition } from "./ImportPdf";
import { useStore } from "../../data/StoreContext";

const line = (it: WorkoutItem, u: Units) => `${it.sets}×${it.reps}${it.kg ? ` · ${u.fw(it.kg)}` : ""} · ${formatRest(it.restSeconds)}`;

/** One instruction for the whole program, shown as a diff. Nothing changes until the coach accepts. */
export function Copilot({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const u = useUnits();
  const store = useStore();
  const { program, activeDay } = useApexState(store);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [miss, setMiss] = useState(false);
  // Say it instead of typing: the browser's own speech recognition, where it has one. The change still waits for Accept.
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  const canSpeak = speechApi() !== null;
  const speak = () => {
    if (listening) return rec.current?.stop();
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = "en-GB";
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let said = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res) { said += res[0].transcript; final ||= res.isFinal; } }
      setText(said);
      if (final) preview(said);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    rec.current = r;
    setResult(null); setMiss(false);
    setListening(true);
    r.start();
  };

  const preview = (t = text) => {
    const cmd = parseCommand(t, program);
    setMiss(!cmd);
    setResult(cmd ? runCommand(program, cmd) : null);
  };
  const accept = () => {
    if (!result) return;
    store.saveProgram(result.program, activeDay);
    const n = changeCount(result);
    say(`${result.command.summary} · ${n} change${n === 1 ? "" : "s"} · logged as your decision`);
    onClose();
  };
  const byDay = result ? [...new Set(result.changes.map((c) => c.day))] : [];

  return (
    <Sheet onClose={onClose} label="Programme Copilot">
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You see every change before it applies</span></div>
      <div><div className="eyebrow">{program.name} · {program.weeks} weeks</div><h2 className="h2">Programme Copilot</h2></div>
      <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); preview(); }}>
        <input className="field" value={text} onChange={(e) => { setText(e.target.value); setResult(null); setMiss(false); }} placeholder="Type or say what to change…" aria-label="Instruction" autoFocus />
        {canSpeak && <button type="button" className={`btn cop-mic ${listening ? "act" : "ghost"}`} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Say it"} onClick={speak}><Icons.mic width={17} height={17} aria-hidden="true" /><span className="t">{listening ? "Listening" : "Say it"}</span></button>}
        <button className="btn act" disabled={!text.trim()}>Preview</button>
      </form>
      <div className="pb-pick">
        {COPILOT_EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => { setText(e); preview(e); }}>{e}</button>)}
      </div>

      {miss && <p className="small" style={{ margin: 0 }}>I couldn't read that one. Copilot understands swaps (by equipment or exercise), deloads, adding or removing sets, adding kg or %, rest, reps and moving a day, with an optional week or day. Try one of the examples.</p>}

      {result && (
        <>
          <div className="cop-sum"><b>{result.command.summary}</b><span className="tiny num">{changeCount(result)} change{changeCount(result) === 1 ? "" : "s"}{result.changes.length ? ` across ${byDay.length} day${byDay.length === 1 ? "" : "s"}` : ""}</span></div>
          {result.moves && result.moves.length > 0 && (
            <div className="card flat list">
              {result.moves.map((m) => <div key={m.day} className="li cop-row"><span className="label l-ai">Moved</span><div className="grow small"><b style={{ color: "var(--text)" }}>{m.day}</b><div className="tiny">{m.text}</div></div></div>)}
            </div>
          )}
          {changeCount(result) === 0 && <p className="small" style={{ margin: 0 }}>Nothing in the programme matches, so nothing would change.</p>}
          {byDay.map((day) => (
            <div key={day}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{day}</div>
              <div className="card flat list">
                {result.changes.filter((c) => c.day === day).map((c) => (
                  <div key={c.before.key} className="li cop-row">
                    <span className="label l-ai">Changed</span>
                    <div className="grow small">
                      {c.before.exerciseId !== c.after.exerciseId ? (
                        <><s>{exerciseById(c.before.exerciseId).name}</s> → <b style={{ color: "var(--text)" }}>{exerciseById(c.after.exerciseId).name}</b></>
                      ) : <b style={{ color: "var(--text)" }}>{exerciseById(c.after.exerciseId).name}</b>}
                      <div className="num tiny" style={{ marginTop: 3 }}><s>{line(c.before, u)}</s> → {line(c.after, u)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {result.skipped.length > 0 && (
            <div className="small" style={{ margin: 0 }}>
              <Label kind="insight">Left as is</Label>{" "}
              {[...new Set(result.skipped.map((s) => s.why))].join(" · ")}
            </div>
          )}
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setResult(null)}>Reject</button>
            <button className="btn act" style={{ flex: 2 }} disabled={!changeCount(result)} onClick={accept}>Accept {changeCount(result)} change{changeCount(result) === 1 ? "" : "s"}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
