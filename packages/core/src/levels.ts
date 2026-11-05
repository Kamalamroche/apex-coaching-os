import { addDays } from "./lifestyle";
import { localDate } from "./recovery";
import { dayRings, type RingInput } from "./rings";
import { pictureWeight } from "./summary";

/* Points, levels and milestones. Worked out from what the client has already done, so nothing is stored and
   nothing can be gamed by tapping: workouts, personal bests, closed rings, check-ins, form checks and goals.
   Pure: the screens draw them. */

export const POINTS = {
  workout: 100,
  best: 40,
  cardio: 40,
  ring: 10,
  /** Extra when all three rings close on one day. */
  fullDay: 20,
  checkIn: 50,
  formCheck: 30,
  goal: 150,
} as const;

/** Level names and the points they start at. Plain words, our own ladder. */
export const LEVELS: { name: string; from: number }[] = [
  { name: "First steps", from: 0 },
  { name: "Finding rhythm", from: 400 },
  { name: "Regular", from: 1000 },
  { name: "Committed", from: 2000 },
  { name: "Strong habits", from: 3500 },
  { name: "Athlete", from: 5500 },
  { name: "Relentless", from: 8000 },
  { name: "Elite", from: 11500 },
  { name: "Summit", from: 16000 },
];

export interface LevelInput extends RingInput {
  /** When each check-in was sent (ISO). */
  checkIns: string[];
  formChecks: number;
  goalsReached: number;
  today: string;
  /** Days of rings to count back, default 120 (about what the app keeps). */
  lookback?: number;
}

export interface PointsLine {
  key: "workout" | "best" | "cardio" | "ring" | "fullDay" | "checkIn" | "formCheck" | "goal";
  label: string;
  count: number;
  points: number;
}

export interface LevelState {
  points: number;
  /** 1-based. */
  level: number;
  name: string;
  /** Points at the start of this level and of the next (null at the top). */
  from: number;
  next: number | null;
  nextName: string | null;
  /** 0 to 1 through this level. */
  progress: number;
  /** Points earned in the last 7 days. */
  thisWeek: number;
  lines: PointsLine[];
}

const dayOf = (iso: string) => localDate(new Date(iso));

/** Every scored thing with its day, so the total and "this week" come from one list. */
function events(i: LevelInput): { key: PointsLine["key"]; day: string; points: number }[] {
  const out: { key: PointsLine["key"]; day: string; points: number }[] = [];
  for (const s of i.sessions) {
    out.push({ key: "workout", day: dayOf(s.at), points: POINTS.workout });
    for (let n = 0; n < s.bests.length; n++) out.push({ key: "best", day: dayOf(s.at), points: POINTS.best });
  }
  for (const a of i.activities) if (a.movingSeconds >= 600) out.push({ key: "cardio", day: dayOf(a.startedAt), points: POINTS.cardio });
  for (const c of i.checkIns) out.push({ key: "checkIn", day: dayOf(c), points: POINTS.checkIn });
  const lookback = i.lookback ?? 120;
  for (let n = lookback; n >= 0; n--) {
    const day = addDays(i.today, -n);
    const closed = dayRings(i, day).filter((r) => r.closed).length;
    for (let k = 0; k < closed; k++) out.push({ key: "ring", day, points: POINTS.ring });
    if (closed === 3) out.push({ key: "fullDay", day, points: POINTS.fullDay });
  }
  for (let n = 0; n < i.formChecks; n++) out.push({ key: "formCheck", day: "", points: POINTS.formCheck });
  for (let n = 0; n < i.goalsReached; n++) out.push({ key: "goal", day: "", points: POINTS.goal });
  return out;
}

const LABELS: Record<PointsLine["key"], string> = {
  workout: "Workouts", best: "Personal bests", cardio: "Cardio sessions", ring: "Rings closed", fullDay: "Full days (all three rings)",
  checkIn: "Check-ins", formCheck: "Form checks", goal: "Goals reached",
};

export function levelFor(points: number): { level: number; name: string; from: number; next: number | null; nextName: string | null; progress: number } {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1]!.from) i++;
  const cur = LEVELS[i]!;
  const nxt = LEVELS[i + 1] ?? null;
  return {
    level: i + 1, name: cur.name, from: cur.from, next: nxt?.from ?? null, nextName: nxt?.name ?? null,
    progress: nxt ? Math.min(1, (points - cur.from) / (nxt.from - cur.from)) : 1,
  };
}

export function levelState(i: LevelInput): LevelState {
  const ev = events(i);
  const points = ev.reduce((a, e) => a + e.points, 0);
  const weekStart = addDays(i.today, -6);
  const thisWeek = ev.filter((e) => e.day && e.day >= weekStart && e.day <= i.today).reduce((a, e) => a + e.points, 0);
  const lines = (Object.keys(LABELS) as PointsLine["key"][])
    .map((key) => {
      const mine = ev.filter((e) => e.key === key);
      return { key, label: LABELS[key], count: mine.length, points: mine.reduce((a, e) => a + e.points, 0) };
    })
    .filter((l) => l.count > 0);
  return { points, ...levelFor(points), thisWeek, lines };
}

/* ---------- Milestones ---------- */

export type MilestoneKind = "workouts" | "kg" | "bests" | "streak";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** "50 workouts", "100 tonnes lifted". */
  title: string;
  /** The big number and its unit for a card: "50" "workouts". */
  value: string;
  unit: string;
  /** One line under it, e.g. "That's about 14 cars." */
  sub: string;
  need: number;
  have: number;
  earned: boolean;
  /** Local day it was reached, when known. */
  at: string | null;
}

const LADDERS: Record<MilestoneKind, number[]> = {
  workouts: [1, 10, 25, 50, 100, 200, 365],
  kg: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  bests: [1, 5, 10, 25, 50],
  streak: [7, 14, 30, 60, 100],
};

const tonnes = (kg: number) => `${(kg / 1000).toLocaleString("en-GB")}`;

function describe(kind: MilestoneKind, need: number): Pick<Milestone, "title" | "value" | "unit" | "sub"> {
  switch (kind) {
    case "workouts": return { title: need === 1 ? "First workout" : `${need} workouts`, value: String(need), unit: need === 1 ? "workout" : "workouts", sub: need === 1 ? "The first one is the hardest." : "Every one of them logged." };
    case "kg": {
      const pic = pictureWeight(need);
      return { title: `${tonnes(need)} tonnes lifted`, value: tonnes(need), unit: "tonnes", sub: pic ? `Lifted in total. That's ${pic}.` : "Lifted in total." };
    }
    case "bests": return { title: need === 1 ? "First personal best" : `${need} personal bests`, value: String(need), unit: need === 1 ? "personal best" : "personal bests", sub: "Stronger than you've ever been." };
    case "streak": return { title: `${need}-day streak`, value: String(need), unit: "days", sub: "In a row, at least one ring closed every day." };
  }
}

/** Milestones, earned and next, with the day each was reached. */
export function milestones(i: LevelInput): Milestone[] {
  const sorted = [...i.sessions].sort((a, b) => a.at.localeCompare(b.at));
  const reachedAt = (kind: MilestoneKind, need: number): { have: number; at: string | null } => {
    if (kind === "streak") return streakReach(i, need);
    let have = 0;
    for (const s of sorted) {
      have += kind === "workouts" ? 1 : kind === "kg" ? s.volumeKg : s.bests.length;
      if (have >= need) return { have, at: dayOf(s.at) };
    }
    return { have, at: null };
  };
  const out: Milestone[] = [];
  for (const kind of Object.keys(LADDERS) as MilestoneKind[]) {
    for (const need of LADDERS[kind]) {
      const r = reachedAt(kind, need);
      out.push({ id: `${kind}-${need}`, kind, ...describe(kind, need), need, have: Math.min(Math.round(r.have), need), earned: r.at !== null, at: r.at });
    }
  }
  return out;
}

/** First day a run of `need` ring days was completed, scanning the lookback window. */
function streakReach(i: LevelInput, need: number): { have: number; at: string | null } {
  const lookback = i.lookback ?? 120;
  let run = 0;
  let best = 0;
  for (let n = lookback; n >= 0; n--) {
    const day = addDays(i.today, -n);
    if (dayRings(i, day).some((r) => r.closed)) {
      run++;
      best = Math.max(best, run);
      if (run === need) return { have: need, at: day };
    } else if (day !== i.today) run = 0;
  }
  return { have: best, at: null };
}

/** The next milestone in each ladder that isn't earned yet, closest first. */
export function nextMilestones(list: Milestone[], n = 3): Milestone[] {
  const firsts = (Object.keys(LADDERS) as MilestoneKind[]).map((k) => list.find((m) => m.kind === k && !m.earned)).filter((m): m is Milestone => !!m);
  return firsts.sort((a, b) => b.have / b.need - a.have / a.need).slice(0, n);
}

/** The newest milestone reached in the last `days` days that the client hasn't seen yet. */
export function freshMilestone(list: Milestone[], today: string, seen: string[], days = 3): Milestone | null {
  const from = addDays(today, -(days - 1));
  return list.filter((m) => m.earned && m.at && m.at >= from && !seen.includes(m.id)).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0] ?? null;
}
