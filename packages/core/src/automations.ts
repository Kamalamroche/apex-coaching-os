/* Automatic messages: a welcome when a client joins, a nudge after missed workouts, a check-in reminder and a low-protein nudge.
   The coach turns each one on and writes the wording; the database sends them every hour
   (public.run_automations, last defined in supabase/migrations/20261112090000_nutrition_nudge.sql).
   This file holds the settings, the wording placeholders and the row converters. Pure, so it is unit tested. */

export type AutomationKind = "welcome" | "missed" | "checkin" | "protein";

export interface AutomationSettings {
  welcomeOn: boolean;
  welcomeBody: string;
  missedOn: boolean;
  /** Days without a finished workout before the nudge goes. */
  missedDays: number;
  missedBody: string;
  checkinOn: boolean;
  checkinBody: string;
  /** Low protein: food logged on each of the last 3 days, every one under 80% of the protein target. */
  proteinOn: boolean;
  proteinBody: string;
  /** Local hour (0–23) the nudge and the reminder go out. The welcome goes within the hour of joining. */
  sendHour: number;
  /** IANA time zone the send hour is in. */
  timezone: string;
}

/** Placeholders the coach can use in the wording. */
export const PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "{first_name}", meaning: "client's first name" },
  { key: "{coach}", meaning: "your first name" },
  { key: "{days}", meaning: "days since their last workout" },
];

export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  welcomeOn: false,
  welcomeBody: "Hi {first_name}, welcome aboard! I'm really glad you're here. Your first workouts are in the app, and you can message me here any time. Let's get going. {coach}",
  missedOn: false,
  missedDays: 4,
  missedBody: "Hi {first_name}, it's been {days} days since your last session. No stress, life gets busy. Want me to shorten this week's workouts so you can get one in? {coach}",
  checkinOn: false,
  checkinBody: "Morning {first_name}! Your weekly check-in is due today. It takes about two minutes and helps me plan your next week. {coach}",
  proteinOn: false,
  proteinBody: "Hi {first_name}, protein has been a little low the last few days. Easy wins: skyr or Greek yogurt, eggs, a tin of tuna, or a shake after training. Want me to add a high-protein recipe to your plan? {coach}",
  sendHour: 9,
  timezone: "Europe/London",
};

/** Share of the protein target under which a day counts as low, and how many days in a row it takes. */
export const PROTEIN_NUDGE = { share: 0.8, days: 3 };

export const AUTOMATIONS: { kind: AutomationKind; title: string; when: (s: AutomationSettings) => string }[] = [
  { kind: "welcome", title: "Welcome", when: () => "When a client joins, unless you've already messaged them" },
  { kind: "missed", title: "Missed workouts", when: (s) => `When a client hasn't finished a workout for ${s.missedDays} days. Once per gap` },
  { kind: "checkin", title: "Check-in reminder", when: (s) => `On their check-in day at ${hourLabel(s.sendHour)}, if they haven't sent one yet` },
  { kind: "protein", title: "Low protein", when: (s) => `When a client logs food ${PROTEIN_NUDGE.days} days in a row and every day is under ${PROTEIN_NUDGE.share * 100}% of their protein target. At ${hourLabel(s.sendHour)}, at most once a week` },
];

export const MISSED_DAY_CHOICES = [2, 3, 4, 5, 7, 10, 14];

export const hourLabel = (h: number): string => (h === 0 ? "midnight" : h === 12 ? "midday" : h < 12 ? `${h} am` : `${h - 12} pm`);

/** The coach's wording with the placeholders filled in, as the client will see it. */
export function fillMessage(body: string, v: { firstName: string; coach: string; days?: number }): string {
  return body.replaceAll("{first_name}", v.firstName).replaceAll("{coach}", v.coach).replaceAll("{days}", String(v.days ?? ""));
}

export const isOn = (s: AutomationSettings, k: AutomationKind): boolean => (k === "welcome" ? s.welcomeOn : k === "missed" ? s.missedOn : k === "protein" ? s.proteinOn : s.checkinOn);
export const bodyOf = (s: AutomationSettings, k: AutomationKind): string => (k === "welcome" ? s.welcomeBody : k === "missed" ? s.missedBody : k === "protein" ? s.proteinBody : s.checkinBody);

/** True when the client's last `days` days (before today) were all logged and all under the protein share. Mirrors the SQL. */
export function proteinLow(dayProtein: (number | null)[], target: number): boolean {
  if (!(target > 0) || dayProtein.length < PROTEIN_NUDGE.days) return false;
  return dayProtein.slice(-PROTEIN_NUDGE.days).every((p) => p !== null && p < target * PROTEIN_NUDGE.share);
}
export const countOn = (s: AutomationSettings): number => AUTOMATIONS.filter((a) => isOn(s, a.kind)).length;

/** What stops the settings from saving, or null. */
export function automationProblem(s: AutomationSettings): string | null {
  for (const a of AUTOMATIONS) {
    const b = bodyOf(s, a.kind).trim();
    if (isOn(s, a.kind) && !b) return `Write the ${a.title.toLowerCase()} message, or turn it off.`;
    if (b.length > 1000) return `The ${a.title.toLowerCase()} message is too long (1,000 characters at most).`;
  }
  if (!Number.isInteger(s.sendHour) || s.sendHour < 0 || s.sendHour > 23) return "Pick a send time.";
  if (s.missedDays < 2 || s.missedDays > 14) return "Pick between 2 and 14 days for the missed workout nudge.";
  return null;
}

/** One message the database sent. */
export interface AutomationSend {
  clientId: string;
  kind: AutomationKind;
  sentAt: string;
}

/* ---------- Database rows ---------- */

export interface AutomationRow {
  coach_id: string;
  welcome_on: boolean;
  welcome_body: string;
  missed_on: boolean;
  missed_days: number;
  missed_body: string;
  checkin_on: boolean;
  checkin_body: string;
  /** Missing until the nutrition nudge SQL has run. */
  protein_on?: boolean;
  protein_body?: string;
  send_hour: number;
  timezone: string;
}

export interface AutomationSendRow {
  client_id: string;
  kind: AutomationKind;
  sent_at: string;
}

export const toAutomationRow = (s: AutomationSettings, coachId: string): AutomationRow => ({
  coach_id: coachId, welcome_on: s.welcomeOn, welcome_body: s.welcomeBody.trim(), missed_on: s.missedOn, missed_days: s.missedDays, missed_body: s.missedBody.trim(),
  checkin_on: s.checkinOn, checkin_body: s.checkinBody.trim(), protein_on: s.proteinOn, protein_body: s.proteinBody.trim(), send_hour: s.sendHour, timezone: s.timezone,
});

export const fromAutomationRow = (r: AutomationRow): AutomationSettings => ({
  welcomeOn: r.welcome_on, welcomeBody: r.welcome_body, missedOn: r.missed_on, missedDays: Number(r.missed_days), missedBody: r.missed_body,
  checkinOn: r.checkin_on, checkinBody: r.checkin_body,
  proteinOn: r.protein_on ?? false, proteinBody: r.protein_body || DEFAULT_AUTOMATIONS.proteinBody, sendHour: Number(r.send_hour), timezone: r.timezone,
});

export const fromSendRow = (r: AutomationSendRow): AutomationSend => ({ clientId: r.client_id, kind: r.kind, sentAt: r.sent_at });
