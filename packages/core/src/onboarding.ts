/* Welcome flow for a brand-new client: sign, tell us about you, book a first session, switch on reminders.
   One guided path instead of four separate places. Pure: which steps apply comes from what the client has done. */

export type OnboardingStepId = "sign" | "about" | "book" | "reminders";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  caption: string;
}

export interface OnboardingInput {
  /** Required agreements still to sign. */
  toSign: number;
  hasIntake: boolean;
  /** The coach has booking hours set up. */
  canBook: boolean;
  /** Something already booked in the future. */
  hasBooking: boolean;
  /** null when this device can't show notifications at all. */
  remindersOn: boolean | null;
  coach: string;
}

/** A client counts as new until they have answered the questionnaire. Everyone else keeps the normal app. */
export function needsOnboarding(i: Pick<OnboardingInput, "hasIntake">): boolean {
  return !i.hasIntake;
}

/** The steps that still apply, in order. Fixed once at the start of the flow, so "Step 2 of 4" never jumps. */
export function onboardingSteps(i: OnboardingInput): OnboardingStep[] {
  const coach = i.coach || "your coach";
  const all: (OnboardingStep | false)[] = [
    i.toSign > 0 && { id: "sign", title: "Sign your agreement", caption: `So you and ${coach} both know what to expect.` },
    !i.hasIntake && { id: "about", title: "Tell us about you", caption: `Your goals, week and any injuries, so ${coach} can tailor your plan.` },
    i.canBook && !i.hasBooking && { id: "book", title: "Book your first session", caption: `Pick a time that suits you. ${coach} gets it straight away.` },
    i.remindersOn === false && { id: "reminders", title: "Switch on reminders", caption: `So you never miss a session or a message from ${coach}.` },
  ];
  return all.filter((s): s is OnboardingStep => !!s);
}

/** Where the client is: the first step not finished or skipped, or null when the flow is over. */
export function onboardingAt(steps: OnboardingStep[], finished: OnboardingStepId[]): { step: OnboardingStep; index: number; total: number } | null {
  const index = steps.findIndex((s) => !finished.includes(s.id));
  return index < 0 ? null : { step: steps[index]!, index, total: steps.length };
}
