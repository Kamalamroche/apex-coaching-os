import { MEASURES, type CheckIn, type MeasureKey, type Measurement } from "./checkins";
import { addDays, habitCompliance, type Habit, type HabitTick } from "./lifestyle";
import type { RecentSession } from "./types";

/* The monthly progress report: the last four weeks of a client's training, body and habits, set against the four
   weeks before. Pure, so the coach screen, the message and the tests all read the same numbers. */

export const REPORT_DAYS = 28;

export interface ReportBest { exercise: string; kg: number; previousKg: number; at: string }
export interface ReportBody { key: MeasureKey; label: string; unit: string; from: number; to: number; change: number }
export interface ReportRating { key: "energy" | "mood" | "sleepHours"; label: string; avg: number; previousAvg: number | null }

export interface ProgressReport {
  /** First and last day covered, as YYYY-MM-DD. */
  from: string;
  to: string;
  /** "12 Oct – 8 Nov" */
  label: string;
  sessions: number;
  previousSessions: number;
  minutes: number;
  volumeKg: number;
  previousVolumeKg: number;
  /** Sessions in each of the four weeks, oldest first. */
  weeks: number[];
  /** Weeks with at least two sessions. */
  steadyWeeks: number;
  /** Best new lift per exercise in the period, biggest jump first, at most five. */
  bests: ReportBest[];
  /** Measurements that changed, from the last one before the period (or the first in it) to the latest. */
  body: ReportBody[];
  /** Share of planned habits ticked over the period, 0–100, or null with no habits. */
  habits: number | null;
  checkIns: number;
  ratings: ReportRating[];
  /** Short plain-English observations, each one backed by the numbers above. */
  highlights: string[];
}

export interface ReportInput {
  sessions: RecentSession[];
  measurements: Measurement[];
  checkIns: CheckIn[];
  habits: Habit[];
  ticks: HabitTick[];
  /** YYYY-MM-DD, the last day covered. */
  today: string;
}

const day = (iso: string) => iso.slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** "12 Oct – 8 Nov" */
export const reportLabel = (from: string, to: string) => `${short(from)} – ${short(to)}`;

/** Body changes worth showing: lower is better for waist, hips and body fat; the rest are shown as they are. */
const LOWER_IS_BETTER: MeasureKey[] = ["waistCm", "hipsCm", "bodyFatPct"];

export function progressReport(input: ReportInput): ProgressReport {
  const to = input.today;
  const from = addDays(to, -(REPORT_DAYS - 1));
  const prevFrom = addDays(from, -REPORT_DAYS);
  const inPeriod = (d: string) => d >= from && d <= to;
  const inPrevious = (d: string) => d >= prevFrom && d < from;

  const now = input.sessions.filter((s) => inPeriod(day(s.at)));
  const before = input.sessions.filter((s) => inPrevious(day(s.at)));
  const weeks = [0, 1, 2, 3].map((w) => {
    const a = addDays(from, w * 7), b = addDays(from, w * 7 + 6);
    return now.filter((s) => day(s.at) >= a && day(s.at) <= b).length;
  });

  // Best new lift per exercise: the heaviest, keeping the earliest "was" so the jump covers the whole month.
  const byExercise = new Map<string, ReportBest>();
  for (const s of [...now].sort((a, b) => a.at.localeCompare(b.at))) {
    for (const b of s.bests) {
      const seen = byExercise.get(b.exercise);
      if (!seen) byExercise.set(b.exercise, { exercise: b.exercise, kg: b.kg, previousKg: b.previousKg, at: s.at });
      else if (b.kg > seen.kg) byExercise.set(b.exercise, { ...seen, kg: b.kg, at: s.at });
    }
  }
  const bests = [...byExercise.values()].sort((a, b) => (b.kg - b.previousKg) - (a.kg - a.previousKg) || b.kg - a.kg).slice(0, 5);

  const measured = [...input.measurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const body: ReportBody[] = [];
  for (const m of MEASURES) {
    const withValue = measured.filter((x) => typeof x[m.key] === "number");
    const latest = [...withValue].reverse().find((x) => inPeriod(day(x.measuredAt)));
    if (!latest) continue;
    const base = [...withValue].reverse().find((x) => day(x.measuredAt) < from) ?? withValue.find((x) => inPeriod(day(x.measuredAt)));
    if (!base || base.id === latest.id) continue;
    const a = base[m.key] as number, b = latest[m.key] as number;
    const change = round1(b - a);
    if (change !== 0) body.push({ key: m.key, label: m.label, unit: m.unit, from: a, to: b, change });
  }

  const ciNow = input.checkIns.filter((c) => inPeriod(day(c.submittedAt)));
  const ciBefore = input.checkIns.filter((c) => inPrevious(day(c.submittedAt)));
  const ratings: ReportRating[] = [];
  for (const r of [{ key: "energy", label: "Energy" }, { key: "mood", label: "Mood" }, { key: "sleepHours", label: "Sleep" }] as const) {
    const vals = (list: CheckIn[]) => list.map((c) => c[r.key]).filter((v): v is number => typeof v === "number");
    const a = avg(vals(ciNow));
    if (a === null) continue;
    const p = avg(vals(ciBefore));
    ratings.push({ key: r.key, label: r.label, avg: round1(a), previousAvg: p === null ? null : round1(p) });
  }

  const habits = habitCompliance(input.habits, input.ticks, to, REPORT_DAYS);
  const report: ProgressReport = {
    from, to, label: reportLabel(from, to),
    sessions: now.length,
    previousSessions: before.length,
    minutes: now.reduce((a, s) => a + s.minutes, 0),
    volumeKg: Math.round(now.reduce((a, s) => a + s.volumeKg, 0)),
    previousVolumeKg: Math.round(before.reduce((a, s) => a + s.volumeKg, 0)),
    weeks,
    steadyWeeks: weeks.filter((n) => n >= 2).length,
    bests,
    body,
    habits: habits === null ? null : Math.round(habits),
    checkIns: ciNow.length,
    ratings,
    highlights: [],
  };
  report.highlights = reportHighlights(report);
  return report;
}

/** A few short observations, most encouraging first. Each one only says what the numbers show. */
export function reportHighlights(r: ProgressReport): string[] {
  const out: string[] = [];
  if (r.sessions === 0) {
    out.push("No sessions logged in the last 4 weeks. A short, easy restart session would be a good first step.");
    return out;
  }
  if (r.steadyWeeks === 4) out.push("Trained at least twice every week of the month. That consistency is what drives results.");
  else if (r.previousSessions > 0 && r.sessions > r.previousSessions) out.push(`${r.sessions - r.previousSessions} more sessions than the month before.`);
  else if (r.previousSessions > 0 && r.sessions < r.previousSessions) out.push(`${r.previousSessions - r.sessions} fewer sessions than the month before. Worth asking what got in the way.`);
  const top = r.bests[0];
  if (top) out.push(`Biggest lift jump: ${top.exercise}, up ${round1(top.kg - top.previousKg)} kg to ${top.kg} kg.`);
  if (r.previousVolumeKg > 0) {
    const pct = Math.round(((r.volumeKg - r.previousVolumeKg) / r.previousVolumeKg) * 100);
    if (pct >= 10 && pct <= 100 && r.previousSessions >= 2) out.push(`Lifted ${pct}% more in total than the month before.`);
  }
  for (const b of r.body) {
    if (LOWER_IS_BETTER.includes(b.key) && b.change < 0) { out.push(`${b.label} down ${Math.abs(b.change)}${b.unit === "%" ? " points" : ` ${b.unit}`}.`); break; }
  }
  if (r.habits !== null && r.habits >= 80) out.push(`Habits ticked ${r.habits}% of the time.`);
  else if (r.habits !== null && r.habits < 50) out.push(`Habits ticked ${r.habits}% of the time. One habit at a time may stick better.`);
  return out.slice(0, 4);
}

const sp = (unit: string) => (unit === "%" ? "%" : ` ${unit}`);
const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-GB")}${sp(unit)}`;

/** The report as the chat message the client receives. The coach's note goes first, in their own words. */
export function reportMessage(r: ProgressReport, first: string, note: string): string {
  const lines = [`📊 Your month in review, ${first} (${r.label})`];
  if (note.trim()) lines.push("", note.trim(), "");
  lines.push(`🏋️ ${r.sessions} ${r.sessions === 1 ? "session" : "sessions"} · ${r.minutes} min · ${r.volumeKg.toLocaleString("en-GB")} kg lifted`);
  if (r.previousSessions > 0) lines.push(`📈 vs the month before: ${signed(r.sessions - r.previousSessions, r.sessions - r.previousSessions === 1 || r.sessions - r.previousSessions === -1 ? "session" : "sessions")}`);
  for (const b of r.bests) lines.push(`🏆 ${b.exercise}: ${b.kg} kg (was ${b.previousKg} kg)`);
  for (const b of r.body) lines.push(`📏 ${b.label}: ${b.from} → ${b.to}${sp(b.unit)} (${signed(b.change, b.unit)})`);
  if (r.habits !== null) lines.push(`✅ Habits: ${r.habits}% ticked`);
  return lines.join("\n");
}
