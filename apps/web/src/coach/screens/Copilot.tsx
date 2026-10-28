import { COPILOT_EXAMPLES, exerciseById, formatRest, parseCommand, runCommand, type CopilotResult, type WorkoutItem } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label, Sheet } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";

const line = (it: WorkoutItem) => `${it.sets}×${it.reps}${it.kg ? ` · ${it.kg} kg` : ""} · ${formatRest(it.restSeconds)}`;

/** One instruction for the whole program, shown as a diff. Nothing changes until the coach accepts. */
export function Copilot({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const store = useStore();
  const { program, activeDay } = useApexState(store);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [miss, setMiss] = useState(false);

  const preview = (t = text) => {
    const cmd = parseCommand(t, program);
    setMiss(!cmd);
    setResult(cmd ? runCommand(program, cmd) : null);
  };
  const accept = () => {
    if (!result) return;
    store.saveProgram(result.program, activeDay);
    say(`${result.command.summary} · ${result.changes.length} change${result.changes.length === 1 ? "" : "s"} · logged as your decision`);
    onClose();
  };
  const byDay = result ? [...new Set(result.changes.map((c) => c.day))] : [];

  return (
    <Sheet onClose={onClose} label="Program Copilot">
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You see every change before it applies</span></div>
      <div><div className="eyebrow">{program.name} · {program.weeks} weeks</div><h2 className="h2">Program Copilot</h2></div>
      <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); preview(); }}>
        <input className="field" value={text} onChange={(e) => { setText(e.target.value); setResult(null); setMiss(false); }} placeholder="Tell Copilot what to change…" aria-label="Instruction" autoFocus />
        <button className="btn act" disabled={!text.trim()}>Preview</button>
      </form>
      <div className="pb-pick">
        {COPILOT_EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => { setText(e); preview(e); }}>{e}</button>)}
      </div>

      {miss && <p className="small" style={{ margin: 0 }}>I couldn't read that one. Copilot understands swaps (by equipment or exercise), deloads, adding or removing sets, adding kg or %, rest and reps, with an optional week or day. Try one of the examples.</p>}

      {result && (
        <>
          <div className="cop-sum"><b>{result.command.summary}</b><span className="tiny num">{result.changes.length} change{result.changes.length === 1 ? "" : "s"} across {byDay.length} day{byDay.length === 1 ? "" : "s"}</span></div>
          {result.changes.length === 0 && <p className="small" style={{ margin: 0 }}>Nothing in the program matches, so nothing would change.</p>}
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
                      <div className="num tiny" style={{ marginTop: 3 }}><s>{line(c.before)}</s> → {line(c.after)}</div>
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
            <button className="btn act" style={{ flex: 2 }} disabled={!result.changes.length} onClick={accept}>Accept {result.changes.length} change{result.changes.length === 1 ? "" : "s"}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
