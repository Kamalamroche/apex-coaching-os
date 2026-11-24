import { setupProgress, setupSteps, type SetupInput, type SetupStepId } from "@apex/core";
import { Icons } from "@apex/ui";
import { useEffect, useState } from "react";
import { DEMO_SETUP, loadSetup } from "../../data/coachSetup";
import type { CoachLiveProps } from "../CoachApp";

const HIDE_KEY = "apex.setupCard.hidden";
const readHidden = () => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };

/** Get set up: five steps to be ready for real clients. Ticks itself from real data; gone once all are done. */
export function SetupCard({ live, onStep }: { live?: CoachLiveProps; onStep: (id: SetupStepId) => void }) {
  const [input, setInput] = useState<SetupInput | null>(live ? null : DEMO_SETUP);
  const [hidden, setHidden] = useState(readHidden);
  useEffect(() => { if (live) void loadSetup(live.db, live.coachId).then(setInput).catch(() => setInput(null)); }, [live]);
  if (!input || hidden) return null;
  const steps = setupSteps(input);
  const p = setupProgress(steps);
  if (p.complete) return null;
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* private mode: hidden for this visit */ } };

  return (
    <section className="card full" style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-label="Get set up">
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <div className="grow">
          <h2 className="h2">Get set up</h2>
          <p className="small" style={{ margin: "4px 0 0" }}>{p.done} of {p.total} done. Each step ticks itself when it's done.</p>
        </div>
        <button className="link tiny" onClick={hide}>Hide</button>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ width: `${(p.done / p.total) * 100}%`, height: "100%", background: "var(--act)", transition: "width .4s" }} />
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => (
          <li key={s.id} className="row" style={{ gap: 12, alignItems: "center", opacity: s.done ? 0.6 : 1 }}>
            <span aria-hidden="true" style={{ flex: "none", display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%", background: s.done ? "var(--act)" : "var(--act-soft)", color: s.done ? "var(--act-ink)" : "var(--act)", font: "800 12px/1 var(--num)" }}>
              {s.done ? <Icons.check width={14} height={14} /> : i + 1}
            </span>
            <div className="grow">
              <div className="h3" style={{ textDecoration: s.done ? "line-through" : undefined }}>{s.title}</div>
              {!s.done && <div className="tiny">{s.why}</div>}
            </div>
            {!s.done && <button className={`btn sm ${s === p.next ? "act" : "ghost"}`} onClick={() => onStep(s.id)}>{s.action}</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}
