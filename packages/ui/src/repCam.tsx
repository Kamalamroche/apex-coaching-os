import { Icons } from "./icons";
import "./repCam.css";

/* Camera rep counter visuals: the live overlay over the camera, and the result card. Calm and readable from 2 m away. */

export interface RepCamLive {
  reps: number;
  /** 0 at the top of the rep, 1 at the bottom, for the depth bar. Null while the body isn't in view. */
  depth: number | null;
  /** "Go lower", "Keep your body straight", or null. */
  cue: string | null;
  /** "0:42" */
  clock: string;
  /** Seconds left in a countdown before starting, or null. */
  countdown: number | null;
  seen: boolean;
  unit: string;
}

export function RepCamOverlay({ v, onStop }: { v: RepCamLive; onStop: () => void }) {
  return (
    <div className="rc-over">
      <div className="rc-top">
        <span className="rc-clock num">{v.clock}</span>
        <button type="button" className="rc-stop" onClick={onStop} aria-label="Stop"><Icons.close width={20} height={20} /></button>
      </div>
      {v.countdown !== null ? (
        <div className="rc-count num" key={v.countdown}>{v.countdown || "Go"}</div>
      ) : (
        <div className="rc-reps">
          <b className="num" key={v.reps}>{v.reps}</b>
          <span>{v.unit}</span>
        </div>
      )}
      <div className="rc-bottom">
        {!v.seen && v.countdown === null && <div className="rc-cue warn">Step back so your whole body is in view</div>}
        {v.seen && v.cue && <div className="rc-cue">{v.cue}</div>}
        <div className="rc-depth" aria-hidden="true"><i style={{ width: `${Math.round((v.depth ?? 0) * 100)}%` }} /></div>
        <div className="rc-depth-l"><span>Top</span><span>Full depth</span></div>
      </div>
    </div>
  );
}

export interface RepCamResultView {
  reps: number;
  unit: string;
  seconds: number;
  notes: string[];
  coach: string;
}

export function RepCamResult({ r, onLog, onAgain, logging }: { r: RepCamResultView; onLog: () => void; onAgain: () => void; logging: boolean }) {
  return (
    <div className="rc-result card stack">
      <div className="eyebrow">Counted by camera</div>
      <div className="rc-big"><b className="num">{r.reps}</b><span>{r.unit} in {r.seconds} s</span></div>
      {r.notes.length ? (
        <ul className="rc-notes">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      ) : <div className="small">Every rep was full depth. Clean work.</div>}
      <button className="btn act block" disabled={logging || r.reps === 0} onClick={onLog}>{logging ? "Logging…" : `Log ${r.reps} to the challenge`}</button>
      <button className="btn ghost block" onClick={onAgain}>Try again</button>
      <div className="tiny" style={{ textAlign: "center" }}>{r.coach} sees the count and any form notes. The video never leaves your phone.</div>
    </div>
  );
}
