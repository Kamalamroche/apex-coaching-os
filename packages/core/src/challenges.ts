/* Challenges: the coach runs a challenge for all their clients (e.g. "Most sessions in November" or
   "10,000 steps a day"); clients join, log their numbers and see a leaderboard of first names.
   Session challenges count finished workouts by themselves; the rest are logged by hand, one number a day.
   Live: challenges, challenge_members, challenge_logs and public.challenge_board()
   (supabase/migrations/20261103210000_challenges.sql). Pure, so it is unit tested. */

import { addDays } from "./lifestyle";

export type ChallengeMetric = "sessions" | "logged";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  /** "sessions" for session challenges; anything short for logged ones, e.g. "steps" or "km". */
  unit: string;
  /** Optional total to aim for over the whole challenge. */
  goal: number | null;
  /** YYYY-MM-DD, both days included. */
  startsOn: string;
  endsOn: string;
  createdAt: string;
}

/** One line of the leaderboard. Clients see first names and an initial only. */
export interface BoardLine {
  name: string;
  total: number;
  isMe: boolean;
}

export interface RankedLine extends BoardLine {
  rank: number;
}

export interface ChallengeLog {
  challengeId: string;
  day: string;
  value: number;
}

export const CHALLENGE_PRESETS: { title: string; description: string; metric: ChallengeMetric; unit: string; goal: number | null; days: number }[] = [
  { title: "Most sessions this month", description: "Every finished workout counts. Show up, tick it off, climb the board.", metric: "sessions", unit: "sessions", goal: 12, days: 28 },
  { title: "Step it up", description: "Log your daily steps. Aim for 10,000 a day.", metric: "logged", unit: "steps", goal: 280000, days: 28 },
  { title: "100 km in a month", description: "Walk, run, ride or row. Log your kilometres each day.", metric: "logged", unit: "km", goal: 100, days: 30 },
];

export const MAX_CHALLENGE_DAYS = 92;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export type ChallengePhase = "upcoming" | "live" | "ended";

export function challengePhase(c: Challenge, today: string): ChallengePhase {
  if (today < c.startsOn) return "upcoming";
  if (today > c.endsOn) return "ended";
  return "live";
}

/** "Starts in 3 days", "5 days left", "Last day", "Ended". */
export function phaseText(c: Challenge, today: string): string {
  const phase = challengePhase(c, today);
  if (phase === "ended") return "Ended";
  if (phase === "upcoming") {
    const n = dayDiff(today, c.startsOn);
    return n === 1 ? "Starts tomorrow" : `Starts in ${n} days`;
  }
  const left = dayDiff(today, c.endsOn);
  return left === 0 ? "Last day" : `${left + 1} days left`;
}

export const challengeDays = (c: Pick<Challenge, "startsOn" | "endsOn">): number => dayDiff(c.startsOn, c.endsOn) + 1;

/** Highest first; equal totals share a rank (1, 2, 2, 4). */
export function rankBoard(lines: BoardLine[]): RankedLine[] {
  const sorted = [...lines].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return sorted.map((l, i) => ({ ...l, rank: i > 0 && sorted[i - 1]!.total === l.total ? sorted.findIndex((x) => x.total === l.total) + 1 : i + 1 }));
}

/** "Priya Sharma" → "Priya S." */
export function boardName(fullName: string): string {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

export const formatTotal = (n: number): string => (Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toLocaleString("en-GB", { maximumFractionDigits: 1 }));

/** What stops the challenge from saving, or null. */
export function challengeProblem(c: Challenge): string | null {
  if (!c.title.trim()) return "Give the challenge a name.";
  if (c.title.length > 80) return "Keep the name under 80 characters.";
  if (c.description.length > 500) return "Keep the description under 500 characters.";
  if (c.metric === "logged" && !c.unit.trim()) return "Say what people log, e.g. steps or km.";
  if (c.unit.length > 16) return "Keep the unit short, e.g. steps.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(c.endsOn)) return "Pick a start and an end date.";
  if (c.endsOn < c.startsOn) return "The end date is before the start.";
  if (challengeDays(c) > MAX_CHALLENGE_DAYS) return "Keep a challenge to three months at most.";
  if (c.goal !== null && (!Number.isFinite(c.goal) || c.goal <= 0)) return "The goal needs to be above zero, or left empty.";
  return null;
}

/** A new challenge from a preset, starting today. */
export function challengeFromPreset(i: number, today: string, now = new Date()): Challenge {
  const p = CHALLENGE_PRESETS[i] ?? CHALLENGE_PRESETS[0]!;
  return { id: crypto.randomUUID(), title: p.title, description: p.description, metric: p.metric, unit: p.unit, goal: p.goal, startsOn: today, endsOn: addDays(today, p.days - 1), createdAt: now.toISOString() };
}

/** Total of one person's logs in a challenge. */
export const myTotal = (logs: ChallengeLog[], challengeId: string): number => logs.filter((l) => l.challengeId === challengeId).reduce((s, l) => s + l.value, 0);

/* ---------- Database rows ---------- */

export interface ChallengeRow {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  unit: string;
  goal: number | null;
  starts_on: string;
  ends_on: string;
  created_at: string;
}

export const toChallengeRow = (c: Challenge, coachId: string): Omit<ChallengeRow, "created_at"> => ({
  id: c.id, coach_id: coachId, title: c.title.trim(), description: c.description.trim() || null, metric: c.metric, unit: c.metric === "sessions" ? "sessions" : c.unit.trim(),
  goal: c.goal, starts_on: c.startsOn, ends_on: c.endsOn,
});

export const fromChallengeRow = (r: ChallengeRow): Challenge => ({
  id: r.id, title: r.title, description: r.description ?? "", metric: r.metric, unit: r.unit, goal: r.goal === null ? null : Number(r.goal), startsOn: r.starts_on, endsOn: r.ends_on, createdAt: r.created_at,
});

/* ---------- Demo ---------- */

export function sampleChallenges(today: string): { challenges: Challenge[]; boards: Record<string, BoardLine[]> } {
  const a: Challenge = { ...challengeFromPreset(0, addDays(today, -9)), id: "demo-challenge-1", title: "Most sessions this month", createdAt: `${addDays(today, -10)}T09:00:00.000Z` };
  const b: Challenge = { ...challengeFromPreset(1, addDays(today, -3)), id: "demo-challenge-2", createdAt: `${addDays(today, -4)}T09:00:00.000Z` };
  return {
    challenges: [a, b],
    boards: {
      [a.id]: [
        { name: "Omar T.", total: 7, isMe: false }, { name: "Priya S.", total: 6, isMe: true }, { name: "James K.", total: 6, isMe: false },
        { name: "Lena R.", total: 4, isMe: false }, { name: "Marcus W.", total: 3, isMe: false }, { name: "Sarah M.", total: 1, isMe: false },
      ],
      [b.id]: [{ name: "Lena R.", total: 38420, isMe: false }, { name: "Omar T.", total: 31050, isMe: false }, { name: "Marcus W.", total: 22800, isMe: false }],
    },
  };
}
