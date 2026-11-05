import { MEASURES, changeOver, measurementSeries, type MeasureKey, type Measurement, type Pose, type ProgressPhoto } from "./checkins";
import { addDays, habitDays, type Habit, type HabitTick } from "./lifestyle";
import { localDate } from "./recovery";
import { pictureWeight } from "./summary";
import type { PersonalBest, RecentSession } from "./types";

/* The weekly story and the progress cards a client can share. Pure: the screens draw them, nothing here posts anything.
   Body numbers are never on a card unless the client switches them on. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (iso: string) => localDate(new Date(iso));
const shortDay = (day: string) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""}`;

/** Monday of the week the day falls in, as YYYY-MM-DD. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDays(day, -dow);
}

/** "20 – 26 Oct", or "27 Oct – 2 Nov" across a month. */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  return monday.slice(5, 7) === sunday.slice(5, 7) ? `${Number(monday.slice(8))} – ${shortDay(sunday)}` : `${shortDay(monday)} – ${shortDay(sunday)}`;
}

/**
 * The week the story tells: the latest week before this one with a finished session. When the client has only trained
 * this week, it is this week so far. Null before the first session.
 */
export function storyWeek(sessions: RecentSession[], today: string): string | null {
  const thisWeek = mondayOf(today);
  const weeks = [...new Set(sessions.map((s) => mondayOf(dayOf(s.at))))].sort().reverse();
  return weeks.find((w) => w < thisWeek) ?? weeks[0] ?? null;
}

export interface BodyChange {
  key: MeasureKey;
  label: string;
  unit: string;
  /** Change from the first to the latest measurement, e.g. -4.2. */
  delta: number;
  first: number;
  last: number;
  since: string;
}

/** The measurement that moved most against where the client started, as a share of its starting value. */
export function biggestChange(measurements: Measurement[], keys: MeasureKey[] = ["waistCm", "weightKg", "bodyFatPct", "hipsCm"]): BodyChange | null {
  let best: BodyChange | null = null;
  let bestScore = 0;
  for (const key of keys) {
    const series = measurementSeries(measurements, key);
    const c = changeOver(series);
    if (!c || series.length < 2 || c.delta === 0) continue;
    const score = Math.abs(c.delta) / Math.max(1, Math.abs(c.first));
    if (score > bestScore) {
      const m = MEASURES.find((x) => x.key === key)!;
      bestScore = score;
      best = { key, label: m.label, unit: m.unit, delta: c.delta, first: c.first, last: c.last, since: series[0]!.at };
    }
  }
  return best;
}

export function bodyChange(measurements: Measurement[], key: MeasureKey): BodyChange | null {
  const series = measurementSeries(measurements, key);
  const c = changeOver(series);
  if (!c || series.length < 2) return null;
  const m = MEASURES.find((x) => x.key === key)!;
  return { key, label: m.label, unit: m.unit, delta: c.delta, first: c.first, last: c.last, since: series[0]!.at };
}

export interface WeekStory {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  label: string;
  /** True while the week is still going. */
  soFar: boolean;
  workouts: number;
  /** Monday to Sunday: trained that day. */
  days: boolean[];
  kg: number;
  minutes: number;
  sets: number;
  /** "about 3 grand pianos", or null when there was nothing to picture. */
  fun: string | null;
  /** The best of the week's personal bests (biggest jump), or null. */
  best: PersonalBest | null;
  bests: number;
  /** Weeks in a row, up to this one, with at least one workout. */
  streakWeeks: number;
  /** Habits done and due over the week, when the client has habits. */
  habits: { done: number; due: number } | null;
  /** kg against the week before, null without one. */
  vsLastWeekKg: number | null;
  coach: string | null;
}

export function weeklyStory(input: {
  sessions: RecentSession[];
  today: string;
  habits?: Habit[];
  ticks?: HabitTick[];
  coach?: string | null;
}): WeekStory | null {
  const week = storyWeek(input.sessions, input.today);
  if (!week) return null;
  const inWeek = (w: string) => input.sessions.filter((s) => mondayOf(dayOf(s.at)) === w);
  const list = inWeek(week);
  const kg = list.reduce((a, s) => a + s.volumeKg, 0);
  const bests = list.flatMap((s) => s.bests);
  const best = [...bests].sort((a, b) => b.kg - b.previousKg - (a.kg - a.previousKg))[0] ?? null;
  let streakWeeks = 0;
  for (let w = week; inWeek(w).length; w = addDays(w, -7)) streakWeeks++;
  const prev = inWeek(addDays(week, -7));
  const last = addDays(week, 6) < input.today ? addDays(week, 6) : input.today;
  const days = input.habits?.length ? habitDays(input.habits, input.ticks ?? [], last, 7).filter((d) => d.day >= week) : [];
  const due = days.reduce((a, d) => a + d.due, 0);
  return {
    week,
    label: weekLabel(week),
    soFar: week === mondayOf(input.today),
    workouts: list.length,
    days: Array.from({ length: 7 }, (_, i) => list.some((x) => dayOf(x.at) === addDays(week, i))),
    kg: Math.round(kg),
    minutes: list.reduce((a, s) => a + s.minutes, 0),
    sets: list.reduce((a, s) => a + s.sets, 0),
    fun: kg > 0 ? pictureWeight(kg) : null,
    best,
    bests: bests.length,
    streakWeeks,
    habits: due ? { done: days.reduce((a, d) => a + d.done, 0), due } : null,
    vsLastWeekKg: prev.length ? Math.round(kg - prev.reduce((a, s) => a + s.volumeKg, 0)) : null,
    coach: input.coach?.trim() || null,
  };
}

/** The slides of the story, in order. Slides with nothing to say are left out. */
export type StorySlide =
  | { kind: "cover"; label: string; soFar: boolean; workouts: number; minutes: number; days: boolean[] }
  | { kind: "lifted"; kg: number; fun: string | null; vsLastWeekKg: number | null; sets: number }
  | { kind: "best"; best: PersonalBest; others: number }
  | { kind: "habits"; done: number; due: number }
  | { kind: "streak"; weeks: number }
  | { kind: "body"; change: BodyChange }
  | { kind: "milestone"; title: string; value: string; unit: string; sub: string }
  | { kind: "end"; coach: string | null };

export function storySlides(s: WeekStory, body: BodyChange | null = null): StorySlide[] {
  const out: StorySlide[] = [{ kind: "cover", label: s.label, soFar: s.soFar, workouts: s.workouts, minutes: s.minutes, days: s.days }];
  if (s.kg > 0) out.push({ kind: "lifted", kg: s.kg, fun: s.fun, vsLastWeekKg: s.vsLastWeekKg, sets: s.sets });
  if (s.best) out.push({ kind: "best", best: s.best, others: s.bests - 1 });
  if (s.habits) out.push({ kind: "habits", ...s.habits });
  if (s.streakWeeks >= 2) out.push({ kind: "streak", weeks: s.streakWeeks });
  if (body) out.push({ kind: "body", change: body });
  out.push({ kind: "end", coach: s.coach });
  return out;
}

/** First and latest photo of a pose, for a before and after. Null until there are two on different days. */
export function beforeAfterPair(photos: ProgressPhoto[], pose: Pose): { before: ProgressPhoto; after: ProgressPhoto; weeks: number } | null {
  const list = photos.filter((p) => p.pose === pose && p.url).sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  const before = list[0];
  const after = list.at(-1);
  if (!before || !after || dayOf(before.takenAt) === dayOf(after.takenAt)) return null;
  return { before, after, weeks: Math.max(1, Math.round((Date.parse(after.takenAt) - Date.parse(before.takenAt)) / (7 * 86400000))) };
}

/** "−4.2 cm" with a real minus sign. */
export const signedUnit = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n * 10) / 10).toLocaleString("en-GB")} ${unit}`;

/** The personal bests the client can share, newest first. */
export function recentBests(sessions: RecentSession[]): (PersonalBest & { at: string })[] {
  return sessions.flatMap((s) => s.bests.map((b) => ({ ...b, at: s.at })));
}

/** The caption that goes with a progress card. */
export function storyCaption(kind: "week" | "photos" | "body" | "best", coach: string | null, link: string): string {
  const lead = { week: "My week in training.", photos: "Progress, one week at a time.", body: "Small changes add up.", best: "New personal best." }[kind];
  return `${lead} ${coach ? `Coached by ${coach} on APEX.` : "Tracked on APEX."} ${link}`;
}
