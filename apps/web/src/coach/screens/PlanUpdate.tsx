import { changeLine, planUpdateMessage, type PlanChange } from "@apex/core";
import { Label, Sheet, useUnits } from "@apex/ui";
import { useState } from "react";

const IDEAS = ["Every rep was clean last week, so we go up.", "Deload week to recover before the next block.", "Swapped to suit your equipment.", "Shorter session to fit your busy week."];

/** Publishing a day with changes: the coach says why in one line, and the client gets the changes and the reason. */
export function PlanUpdateSheet({ first, workoutName, changes, onSend, onSkip, onClose }: {
  first: string; workoutName: string; changes: PlanChange[];
  onSend: (message: string) => void; onSkip: () => void; onClose: () => void;
}) {
  const u = useUnits();
  const [why, setWhy] = useState("");
  return (
    <Sheet onClose={onClose} label={`Tell ${first} what changed`}>
      <div className="row" style={{ gap: 8 }}><Label kind="dec">Coach decision</Label><span className="tiny">{first} sees this on Today and in your chat</span></div>
      <h2 className="h2">Tell {first} what changed</h2>
      <ul className="pu-list">
        {changes.map((c, i) => <li key={i} className={`pu-${c.kind}`}>{u.kt(changeLine(c))}</li>)}
      </ul>
      <label className="stack" style={{ gap: 6 }}>
        <span className="tiny">Why, in one line</span>
        <textarea className="field" value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder={`e.g. "${IDEAS[0]}"`} />
      </label>
      <div className="chips" style={{ flexWrap: "wrap" }}>
        {IDEAS.map((t) => <button key={t} className="chip" onClick={() => setWhy(t)}>{t}</button>)}
      </div>
      <button className="btn act block" onClick={() => onSend(planUpdateMessage(workoutName, changes, why))}>Publish and tell {first}</button>
      <button className="btn ghost block" onClick={onSkip}>Publish without a message</button>
    </Sheet>
  );
}
