/* The first-week journey: six small things that make a new client stick, worked out from what they've already done.
   Pure, so nothing is stored: a step ticks itself the moment the real thing happens. */

export type FirstWeekStepId = "intake" | "notifications" | "workout" | "habit" | "hello" | "checkin";

export interface FirstWeekStep {
  id: FirstWeekStepId;
  title: string;
  why: string;
  action: string;
  done: boolean;
}

export interface FirstWeekInput {
  hasIntake: boolean;
  /** null when this device can't show notifications at all: the step is left out rather than shown as impossible. */
  notificationsOn: boolean | null;
  sessions: number;
  habitTicks: number;
  foodLogged: number;
  messagesFromClient: number;
  checkIns: number;
  coach: string;
}

export function firstWeekSteps(i: FirstWeekInput): FirstWeekStep[] {
  const coach = i.coach || "your coach";
  const steps: (FirstWeekStep | null)[] = [
    { id: "intake", title: "Tell us about you", why: `Your goals, week and any injuries, so ${coach} can tailor everything.`, action: "Start", done: i.hasIntake },
    i.notificationsOn === null ? null : { id: "notifications", title: "Switch on reminders", why: `So you never miss a session or a message from ${coach}.`, action: "Switch on", done: i.notificationsOn },
    { id: "workout", title: "Do your first workout", why: "The hardest one is the first. Every set you log builds your history.", action: "Start", done: i.sessions > 0 },
    { id: "habit", title: "Tick a habit or log a meal", why: "Small daily wins add up faster than big weekly ones.", action: "Open", done: i.habitTicks + i.foodLogged > 0 },
    { id: "hello", title: `Say hello to ${coach}`, why: "A quick message: how you feel, or one question.", action: "Message", done: i.messagesFromClient > 0 },
    { id: "checkin", title: "Send your first check-in", why: "Two minutes once a week, so your plan keeps fitting you.", action: "Check in", done: i.checkIns > 0 },
  ];
  return steps.filter((s): s is FirstWeekStep => s !== null);
}

export interface FirstWeekProgress { done: number; total: number; next: FirstWeekStep | null; complete: boolean }

export function firstWeekProgress(steps: FirstWeekStep[]): FirstWeekProgress {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, next: steps.find((s) => !s.done) ?? null, complete: done === steps.length };
}

/** Show the journey to clients who haven't finished it, until it's done (plus the day it's finished, to celebrate) or they hide it. */
export function showFirstWeek(p: FirstWeekProgress, opts: { dismissed: boolean; completedAt: number | null; now: number }): boolean {
  if (opts.dismissed) return false;
  if (!p.complete) return true;
  return opts.completedAt !== null && opts.now - opts.completedAt < 86400000;
}
