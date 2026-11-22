import { asPlannedSession, exerciseFor, summaryMessage } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Sheet, useUnits } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";

const EFFORT: [number, string][] = [[5, "Easy"], [6, "Steady"], [7, "Solid"], [8, "Hard"], [9, "Very hard"], [10, "All out"]];

/**
 * "Done as planned": for a session the client already did exactly as written (at the gym, no phone).
 * One tap logs every set at its target; they add how hard it felt and how long it took. The coach sees it marked.
 */
export function AsPlannedSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const store = useStore();
  const u = useUnits();
  const { workout: w, history } = useApexState(store);
  const { coachName } = useAppInfo();
  const [rpe, setRpe] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(String(w.minutes || 45));
  const [note, setNote] = useState("");
  const mins = Math.max(1, Math.min(300, Math.round(Number(minutes) || 0)));
  const save = () => {
    if (rpe === null) return;
    const { log, sets } = asPlannedSession(w, history, { minutes: mins, rpe, note });
    store.finishSession(log, sets);
    store.sendMessage("client", summaryMessage(log));
    onDone();
  };
  return (
    <Sheet onClose={onClose} label="Done as planned">
      <div><div className="eyebrow">Done as planned</div><h2 className="h2">{w.name}</h2></div>
      <p className="small">Did every set exactly as {coachName} wrote it? Log it in one go. If anything changed, start the session instead and log the real numbers.</p>
      <ul className="ap-list">
        {w.items.map((it) => <li key={it.key}><span>{exerciseFor(it).name}</span><span className="num">{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""}</span></li>)}
      </ul>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small"><b>How hard was it?</b></span>
        <div className="chips" role="radiogroup" aria-label="How hard was it">
          {EFFORT.map(([n, label]) => <button key={n} role="radio" aria-checked={rpe === n} className={`chip ${rpe === n ? "on" : ""}`} onClick={() => setRpe(n)}>{label} · {n}</button>)}
        </div>
      </div>
      <label className="small stack" style={{ gap: 6 }}><b>Minutes</b>
        <input className="field" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} style={{ maxWidth: 120 }} />
      </label>
      <label className="small stack" style={{ gap: 6 }}><b>Note for {coachName}</b> <span className="tiny">Optional</span>
        <textarea className="field" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it feel?" />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn act grow" disabled={rpe === null} onClick={save}>{rpe === null ? "Pick how hard" : "Log as done"}</button>
      </div>
    </Sheet>
  );
}
