import { useEffect, useRef, useState } from "react";
import { Icons } from "./icons";
import "./handsFree.css";

/* Hands-free workout visuals: the pocket screen (big, calm, ignores stray touches) and the toggle on the player. */

const SAY = ["Done", "Done 8 reps", "Rest 30 more", "Skip rest", "Next", "Repeat", "Tips", "Finish workout"];

export interface PocketView {
  exercise: string;
  /** "Set 2 of 3 · 5 reps · 100 kg" */
  line: string;
  /** Seconds left in the rest or timed set, or null. */
  timer: { label: string; left: number } | null;
  progress: string;
}

/** Full-screen while the phone is in a pocket: only a long press unlocks it, so nothing gets tapped by accident. */
export function PocketLock({ view, heard, listening, micProblem, onUnlock }: { view: PocketView; heard: string; listening: boolean; micProblem: string | null; onUnlock: () => void }) {
  const [hold, setHold] = useState(0);
  const timer = useRef<number | null>(null);
  const start = () => {
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setHold(p);
      if (p >= 1) { end(); onUnlock(); }
    }, 30);
  };
  const end = () => { if (timer.current !== null) window.clearInterval(timer.current); timer.current = null; setHold(0); };
  useEffect(() => end, []);
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="hf-lock" role="dialog" aria-label="Hands-free, phone locked" onContextMenu={(e) => e.preventDefault()}>
      <div className="hf-top">
        <span className={`hf-mic${listening ? " on" : ""}`}><Icons.mic width={16} height={16} /> {micProblem ?? (listening ? "Listening" : "Speaking")}</span>
        <span className="num hf-prog">{view.progress}</span>
      </div>
      <div className="hf-main">
        <div className="hf-ex">{view.exercise}</div>
        <div className="hf-line">{view.line}</div>
        {view.timer && <div className="hf-timer"><small>{view.timer.label}</small><b className="num">{mm(Math.max(0, view.timer.left))}</b></div>}
        <div className="hf-heard">{heard ? <>Heard: <q>{heard}</q></> : "Say a command any time"}</div>
      </div>
      <div className="hf-say">
        {SAY.map((s) => <span key={s}>{s}</span>)}
      </div>
      <button className="hf-unlock" onPointerDown={start} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}>
        <i style={{ transform: `scaleX(${hold})` }} />
        <Icons.lock width={16} height={16} /><span>Hold to unlock</span>
      </button>
    </div>
  );
}
