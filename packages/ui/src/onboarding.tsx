import type { OnboardingStep } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import { EditorialTitle } from "./primitives";
import "./onboarding.css";

/* The new-client welcome flow: a progress track, "Step 2 of 4", the step title, and a way to skip. */

export function OnboardingHeader({ step, index, total, onSkip, skipLabel = "Do this later" }: { step: OnboardingStep; index: number; total: number; onSkip?: () => void; skipLabel?: string }) {
  return (
    <header className="ob-head" aria-label={`Welcome, step ${index + 1} of ${total}`}>
      <ol className="ob-track" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => <li key={i} className={i < index ? "done" : i === index ? "on" : ""} />)}
      </ol>
      <div className="ob-step">
        <span className="eyebrow">Welcome · step {index + 1} of {total}</span>
        {onSkip && <button type="button" className="ob-skip" onClick={onSkip}>{skipLabel}</button>}
      </div>
      <EditorialTitle as="h1" text={step.title} />
      <p className="ob-caption">{step.caption}</p>
    </header>
  );
}

/** The last screen of the flow. */
export function OnboardingDone({ coach, children }: { coach: string; children?: ReactNode }) {
  return (
    <section className="card ob-done" aria-label="You're all set">
      <span className="ob-tick" aria-hidden="true"><Icons.check width={26} height={26} /></span>
      <EditorialTitle as="h2" text="You're all set" caption={`${coach} has everything needed to get you started`} />
      {children}
    </section>
  );
}
