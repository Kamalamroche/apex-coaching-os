/* Get set up: the five things a new trainer does to be ready for real clients, in the order
   that pays off fastest. Pure, so nothing is stored: each step ticks itself the moment the
   real thing exists (a client, a template, booking hours, a priced service, a live page). */

export type SetupStepId = "clients" | "template" | "hours" | "service" | "page";

export interface SetupInput {
  /** Clients joined, invited or imported. */
  clients: number;
  templates: number;
  /** Weekly booking windows set. */
  bookingWindows: number;
  /** Active services with a price above zero. */
  pricedServices: number;
  pagePublished: boolean;
}

export interface SetupStep {
  id: SetupStepId;
  title: string;
  why: string;
  action: string;
  done: boolean;
}

export function setupSteps(i: SetupInput): SetupStep[] {
  return [
    { id: "clients", title: "Bring your clients in", why: "Import them from your old app or a spreadsheet, or send an invite link.", action: "Add clients", done: i.clients > 0 },
    { id: "template", title: "Save a programme template", why: "Build it once, then give it to any client in two taps.", action: "Open Builder", done: i.templates > 0 },
    { id: "hours", title: "Set your booking hours", why: "Clients book sessions and calls into your free times.", action: "Set hours", done: i.bookingWindows > 0 },
    { id: "service", title: "Add a service with a price", why: "Sessions, packs or online coaching, so people know what you offer.", action: "Add a service", done: i.pricedServices > 0 },
    { id: "page", title: "Publish your page", why: "Your own link for Instagram and WhatsApp, with booking and enquiries built in.", action: "Open your page", done: i.pagePublished },
  ];
}

/** "3 of 5 done" and whether the card can go away for good. */
export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean; next: SetupStep | null } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length, next: steps.find((s) => !s.done) ?? null };
}
