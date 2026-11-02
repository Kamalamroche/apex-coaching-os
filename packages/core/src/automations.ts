/* Automatic messages: a welcome when a client joins, a nudge after missed workouts, and a check-in reminder.
   The coach turns each one on and writes the wording; the database sends them every hour
   (public.run_automations in supabase/migrations/20261103090000_automatic_messages.sql).
   This file holds the settings, the wording placeholders and the row converters. Pure, so it is unit tested. */

export type AutomationKind = "welcome" | "missed" | "checkin";

export interface AutomationSettings {
  welcomeOn: boolean;
  welcomeBody: string;
  missedOn: boolean;
  /** Days without a finished workout before the nudge goes. */
  missedDays: number;
  missedBody: string;
  checkinOn: boolean;
  checkinBody: string;
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
  sendHour: 9,
  timezone: "Europe/London",
};

export const AUTOMATIONS: { kind: AutomationKind; title: string; when: (s: AutomationSettings) => string }[] = [
  { kind: "welcome", title: "Welcome", when: () => "When a client joins, unless you've already messaged them" },
  { kind: "missed", title: "Missed workouts", when: (s) => `When a client hasn't finished a workout for ${s.missedDays} days. Once per gap` },
  { kind: "checkin", title: "Check-in reminder", when: (s) => `On their check-in day at ${hourLabel(s.sendHour)}, if they haven't sent one yet` },
];

export const MISSED_DAY_CHOICES = [2, 3, 4, 5, 7, 10, 14];

export const hourLabel = (h: number): string => (h === 0 ? "midnight" : h === 12 ? "midday" : h < 12 ? `${h} am` : `${h - 12} pm`);

/** The coach's wording with the placeholders filled in, as the client will see it. */
export function fillMessage(body: string, v: { firstName: string; coach: string; days?: number }): string {
  return body.replaceAll("{first_name}", v.firstName).replaceAll("{coach}", v.coach).replaceAll("{days}", String(v.days ?? ""));
}

export const isOn = (s: AutomationSettings, k: AutomationKind): boolean => (k === "welcome" ? s.welcomeOn : k === "missed" ? s.missedOn : s.checkinOn);
export const bodyOf = (s: AutomationSettings, k: AutomationKind): string => (k === "welcome" ? s.welcomeBody : k === "missed" ? s.missedBody : s.checkinBody);
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
  checkin_on: s.checkinOn, checkin_body: s.checkinBody.trim(), send_hour: s.sendHour, timezone: s.timezone,
});

export const fromAutomationRow = (r: AutomationRow): AutomationSettings => ({
  welcomeOn: r.welcome_on, welcomeBody: r.welcome_body, missedOn: r.missed_on, missedDays: Number(r.missed_days), missedBody: r.missed_body,
  checkinOn: r.checkin_on, checkinBody: r.checkin_body, sendHour: Number(r.send_hour), timezone: r.timezone,
});

export const fromSendRow = (r: AutomationSendRow): AutomationSend => ({ clientId: r.client_id, kind: r.kind, sentAt: r.sent_at });
