import type { ReactNode } from "react";
import "./liveTimer.css";

/* Live session timer face: the same picture on the coach's phone and every client's. Big, calm, readable at 3 m. */

export interface LiveFace {
  title: string;
  /** "Squats", "Rest", "Get ready" */
  name: string;
  kind: "work" | "rest";
  clock: string;
  /** 0 to 1 through the block. */
  progress: number;
  round: string;
  next: string | null;
  paused: boolean;
}

export function LiveTimerFace({ f, top, children }: { f: LiveFace; top?: ReactNode; children?: ReactNode }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className={`lt ${f.kind} ${f.paused ? "paused" : ""}`}>
      <div className="lt-top">{top}</div>
      <div className="lt-title">{f.title}</div>
      <div className="lt-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="lt-track" cx="50" cy="50" r={r} />
          <circle className="lt-arc" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * f.progress} transform="rotate(-90 50 50)" />
        </svg>
        <div className="lt-mid">
          <span className="lt-kind">{f.paused ? "Paused" : f.kind === "work" ? "Work" : "Rest"}</span>
          <b className="num" aria-live="polite">{f.clock}</b>
          <span className="lt-name">{f.name}</span>
        </div>
      </div>
      <div className="lt-round">{f.round}</div>
      {f.next && <div className="lt-next"><span>Next</span> {f.next}</div>}
      {children}
    </div>
  );
}
