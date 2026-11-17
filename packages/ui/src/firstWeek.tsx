import type { FirstWeekProgress, FirstWeekStep, FirstWeekStepId } from "@apex/core";
import { MiniRing } from "./Gauge";
import { Icons, type IconName } from "./icons";
import { Celebrate } from "./motion";
import { EditorialTitle } from "./primitives";

/* The first-week journey on Today: a ring of how far along they are, then each step as a row.
   The next step is the only one with a button, so there's always one clear thing to do. */

const ICON: Record<FirstWeekStepId, IconName> = { intake: "note", notifications: "bell", workout: "train", habit: "food", hello: "chat", checkin: "check" };

export function FirstWeekCard({ steps, progress, onStep, onHide }: { steps: FirstWeekStep[]; progress: FirstWeekProgress; onStep: (id: FirstWeekStepId) => void; onHide: () => void }) {
  return (
    <section className="fw-card" aria-label="Your first week">
      {progress.complete && <Celebrate />}
      <div className="fw-head">
        <MiniRing value={progress.done} max={progress.total} size={64} color="var(--act)" label={`${progress.done} of ${progress.total} done`}>
          <b className="num fw-count">{progress.done}<small>/{progress.total}</small></b>
        </MiniRing>
        <div className="grow">
          <EditorialTitle as="h2" text="Your first week" caption={progress.complete ? "All done · you're off" : "Six small wins"} className="fw-title" />
        </div>
        <button className="iconbtn fw-hide" aria-label="Hide your first week" onClick={onHide}><Icons.close width={16} height={16} /></button>
      </div>
      <ol className="fw-steps">
        {steps.map((s, i) => {
          const I = Icons[ICON[s.id]];
          const next = progress.next?.id === s.id;
          return (
            <li key={s.id} className={`${s.done ? "done" : ""}${next ? " next" : ""}`} style={{ ["--i" as string]: i }}>
              <span className="fw-dot" aria-hidden="true">{s.done ? <Icons.check width={14} height={14} /> : <I width={15} height={15} />}</span>
              <span className="grow">
                <b>{s.title}</b>
                {next && <small>{s.why}</small>}
              </span>
              {next && <button className="btn act sm" onClick={() => onStep(s.id)}>{s.action}</button>}
              {!s.done && !next && <button className="fw-later" onClick={() => onStep(s.id)} aria-label={s.title}>›</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
