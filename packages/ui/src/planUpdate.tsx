import type { PlanUpdate } from "@apex/core";
import { Icons } from "./icons";
import { Label } from "./primitives";
import { useUnits } from "./prefs";

/* Client side of "why your plan changed": the coach's reason in their words, then the changes, in the client's units. */
export function PlanChangedCard({ update, coach, onDone }: { update: PlanUpdate; coach: string; onDone: () => void }) {
  const u = useUnits();
  return (
    <section className="pu-card" aria-label="Your plan changed">
      <div className="pu-head">
        <span className="pu-ic" aria-hidden="true"><Icons.train width={16} height={16} /></span>
        <div className="grow">
          <b>{coach || "Your coach"} updated {update.workoutName || "your plan"}</b>
          <Label kind="dec">Coach decision</Label>
        </div>
      </div>
      {update.why && <p className="pu-why">“{update.why}”</p>}
      {update.lines.length > 0 && (
        <ul className="pu-list">
          {update.lines.map((l, i) => <li key={i} style={{ ["--i" as string]: i }}>{u.kt(l)}</li>)}
        </ul>
      )}
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onDone}>Got it</button>
    </section>
  );
}
