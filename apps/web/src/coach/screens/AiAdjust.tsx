import { ADJUSTMENTS, diffWorkouts, exerciseById, formatRest, type Adjustment, type Workout } from "@apex/core";
import { Label, Sheet } from "@apex/ui";
import { useState } from "react";

interface Props {
  workout: Workout;
  onClose: () => void;
  onApply: (next: Workout, message: string) => void;
}

/** AI proposals shown as a diff. Nothing changes until the coach accepts. */
export function AiAdjust({ workout, onClose, onApply }: Props) {
  const [picked, setPicked] = useState<Adjustment | null>(null);
  const next = picked?.apply(workout);
  return (
    <Sheet onClose={onClose} label="Adjust this workout">
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You review every change before it applies</span></div>
      <h2 className="h2">Adjust this workout</h2>
      <div className="chips">
        {ADJUSTMENTS.map((a) => <button key={a.id} className={`chip ${picked?.id === a.id ? "on" : ""}`} onClick={() => setPicked(a)}>{a.title}</button>)}
      </div>
      {!picked || !next ? (
        <p className="small" style={{ margin: 0 }}>Pick an adjustment to see the proposed changes.</p>
      ) : (
        <>
          <p className="small" style={{ margin: 0 }}>{picked.note}</p>
          <div className="card flat list">
            {diffWorkouts(workout, next).map((change) =>
              change.kind === "removed" ? (
                <div key={change.before.key} className="li">
                  <span className="label l-crit">Removed</span>
                  <span className="small" style={{ textDecoration: "line-through" }}>{exerciseById(change.before.exerciseId).name}</span>
                </div>
              ) : (
                <div key={change.before.key} className="li">
                  <span className={`label ${change.kind === "changed" ? "l-ai" : "l-data"}`}>{change.kind === "changed" ? "Changed" : "Same"}</span>
                  <div className="grow small">
                    <b style={{ color: "var(--text)" }}>{exerciseById(change.after.exerciseId).name}</b>{" "}
                    <span className="num">{change.after.sets}×{change.after.reps} · RPE {change.after.rpe} · {formatRest(change.after.restSeconds)}</span>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Reject</button>
            <button className="btn act" style={{ flex: 2 }} onClick={() => onApply(next, `${picked.title} applied · logged as your decision`)}>Accept changes</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
