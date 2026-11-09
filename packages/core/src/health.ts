/* Client health score: one 0–100 number per client from what they actually did (training, check-ins, habits,
   food logging, staying in touch), so the coach sees who needs them first. Rule-based (Insight), explained in plain
   words, never sent to the client. Parts with no data (no habits set, no food targets) are left out, not scored as zero.
   Pure, so it is unit tested. */

export interface HealthInput {
  startedAt: string;
  /** When finished sessions ended (any order). */
  sessions: string[];
  /** Sessions a week in the client's plan. Null when unknown: then 3 a week is the bar. */
  plannedPerWeek: number | null;
  /** When check-ins were sent. */
  checkIns: string[];
  /** Habits, with the weekdays they're due (0 = Monday … 6 = Sunday) and when they started. */
  habits: { days: number[]; createdAt: string }[];
  /** Days ("2026-11-09") a habit was ticked, one entry per tick. */
  habitTicks: string[];
  /** True when the coach set food targets, so logging food is part of the plan. */
  hasFoodTargets: boolean;
  /** Days ("2026-11-09") with at least one food entry. */
  foodDays: string[];
  /** When the client last sent a message. */
  clientMessages: string[];
}

export type HealthBand = "new" | "good" | "watch" | "low";

export interface HealthPart { key: "training" | "checkins" | "habits" | "food" | "contact"; label: string; score: number; weight: number; note: string }

export interface Health {
  /** 0–100. Null for a client in their first week. */
  score: number | null;
  band: HealthBand;
  parts: HealthPart[];
  /** The one or two things pulling the score down, in plain words. */
  reasons: string[];
}

const DAY = 864e5;
export const HEALTH_BANDS: Record<HealthBand, string> = { new: "New", good: "On track", watch: "Keep an eye", low: "Needs you" };
const WEIGHTS = { training: 40, checkins: 20, habits: 15, food: 15, contact: 10 } as const;

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Monday = 0 … Sunday = 6, from a "YYYY-MM-DD" day. */
const weekday = (key: string) => (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;

function within(list: string[], from: number, to: number): number {
  let n = 0;
  for (const iso of list) {
    const ms = Date.parse(iso);
    if (ms > from && ms <= to) n++;
  }
  return n;
}

function latest(list: string[], to: number): number | null {
  let best: number | null = null;
  for (const iso of list) {
    const ms = Date.parse(iso);
    if (ms <= to && (best === null || ms > best)) best = ms;
  }
  return best;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The client's health as of `now`. Call again with a date a week back for the trend. */
export function clientHealth(input: HealthInput, now: Date): Health {
  const end = now.getTime();
  const started = Date.parse(input.startedAt);
  if (end - started < 7 * DAY) return { score: null, band: "new", parts: [], reasons: ["In their first week"] };

  const parts: HealthPart[] = [];

  // Training: sessions in the last 14 days against the plan, docked when the last one was a while ago.
  const per = input.plannedPerWeek && input.plannedPerWeek > 0 ? Math.min(7, input.plannedPerWeek) : 3;
  const windowDays = Math.min(14, Math.floor((end - started) / DAY));
  const expected = Math.max(1, Math.round((per * windowDays) / 7));
  const done = within(input.sessions, end - windowDays * DAY, end);
  const last = latest(input.sessions, end);
  const gap = last === null ? Math.floor((end - started) / DAY) : Math.floor((end - last) / DAY);
  let training = Math.min(1, done / expected);
  if (gap > 7) training *= gap > 14 ? 0.3 : 0.6;
  parts.push({ key: "training", label: "Training", score: training, weight: WEIGHTS.training, note: last === null ? "No sessions yet" : `${done} of ${expected} planned sessions in ${windowDays} days${gap > 7 ? `, last one ${gap} days ago` : ""}` });

  // Check-ins: weekly is the rhythm.
  const lastCheckIn = latest(input.checkIns, end);
  const ciGap = lastCheckIn === null ? null : Math.floor((end - lastCheckIn) / DAY);
  const checkins = ciGap === null ? 0 : ciGap <= 8 ? 1 : ciGap <= 15 ? 0.5 : 0;
  parts.push({ key: "checkins", label: "Check-ins", score: checkins, weight: WEIGHTS.checkins, note: ciGap === null ? "No check-in yet" : ciGap <= 1 ? "Checked in this week" : `Last check-in ${ciGap} days ago` });

  // Habits: ticks against what was due over the last 7 days.
  const live = input.habits.filter((h) => Date.parse(h.createdAt) <= end);
  if (live.length) {
    let due = 0;
    for (let i = 0; i < 7; i++) {
      const ms = end - i * DAY;
      const wd = weekday(dayKey(ms));
      for (const h of live) if (Date.parse(h.createdAt) <= ms && h.days.includes(wd)) due++;
    }
    const from = dayKey(end - 6 * DAY);
    const to = dayKey(end);
    const ticks = input.habitTicks.filter((d) => d >= from && d <= to).length;
    if (due > 0) parts.push({ key: "habits", label: "Habits", score: Math.min(1, ticks / due), weight: WEIGHTS.habits, note: `${Math.min(ticks, due)} of ${due} habits ticked this week` });
  }

  // Food: days logged in the last 7, only when the coach set targets.
  if (input.hasFoodTargets) {
    const from = dayKey(end - 6 * DAY);
    const to = dayKey(end);
    const days = new Set(input.foodDays.filter((d) => d >= from && d <= to)).size;
    parts.push({ key: "food", label: "Food log", score: Math.min(1, days / 5), weight: WEIGHTS.food, note: `Logged food on ${plural(days, "day")} of 7` });
  }

  // Staying in touch: when the client last wrote.
  const lastMsg = latest(input.clientMessages, end);
  const msgGap = lastMsg === null ? null : Math.floor((end - lastMsg) / DAY);
  const contact = msgGap === null ? 0.3 : msgGap <= 7 ? 1 : msgGap <= 14 ? 0.6 : 0.2;
  parts.push({ key: "contact", label: "In touch", score: contact, weight: WEIGHTS.contact, note: msgGap === null ? "Hasn't messaged yet" : msgGap <= 1 ? "Messaged in the last day" : `Last message ${msgGap} days ago` });

  const total = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.score * p.weight, 0) / total) * 100);
  const band: HealthBand = score >= 75 ? "good" : score >= 50 ? "watch" : "low";
  // What costs the most points, biggest first.
  const reasons = parts
    .map((p) => ({ p, lost: (1 - p.score) * p.weight }))
    .filter((x) => x.lost >= 5)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 2)
    .map((x) => x.p.note);
  return { score, band, parts, reasons: reasons.length ? reasons : ["Doing everything asked"] };
}

/** Score change over the last 7 days, or null when either end has no score. */
export function healthTrend(input: HealthInput, now: Date): number | null {
  const a = clientHealth(input, now).score;
  const b = clientHealth(input, new Date(now.getTime() - 7 * DAY)).score;
  return a === null || b === null ? null : a - b;
}

export interface RosterRow<T> { client: T; health: Health; trend: number | null }

/** Clients who need the coach first: lowest score, then biggest drop. New clients last. */
export function byNeed<T>(rows: RosterRow<T>[]): RosterRow<T>[] {
  return [...rows].sort((a, b) => {
    if (a.health.score === null || b.health.score === null) return a.health.score === null ? (b.health.score === null ? 0 : 1) : -1;
    return a.health.score - b.health.score || (a.trend ?? 0) - (b.trend ?? 0);
  });
}
