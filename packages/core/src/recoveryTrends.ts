/* What sits behind the Recovery screen's graphics: the night as a timeline of sleep stages, how each
   of last night's numbers sits against the client's own usual, training load against the next morning,
   and when they go to bed and get up. Pure functions; the screens only draw what comes out. */

import { baseline, bestPerDay, formatSleep, vsBaseline, type RecoveryDay, type SleepStages } from "./recovery";

export type HypnoStage = keyof SleepStages;

/** One character per five minutes from getting into bed: d deep, l light, r REM, a awake. */
export const HYPNO_EPOCH_MIN = 5;
const CODE: Record<string, HypnoStage> = { d: "deep", l: "light", r: "rem", a: "awake" };

export interface HypnoRun {
  stage: HypnoStage;
  /** Minutes after getting into bed. */
  start: number;
  minutes: number;
}

/** The night as runs of the same stage, so a chart draws a handful of blocks rather than a hundred. */
export function hypnoRuns(hypnogram: string): HypnoRun[] {
  const runs: HypnoRun[] = [];
  [...hypnogram].forEach((c, i) => {
    const stage = CODE[c];
    if (!stage) return;
    const last = runs[runs.length - 1];
    if (last && last.stage === stage && last.start + last.minutes === i * HYPNO_EPOCH_MIN) last.minutes += HYPNO_EPOCH_MIN;
    else runs.push({ stage, start: i * HYPNO_EPOCH_MIN, minutes: HYPNO_EPOCH_MIN });
  });
  return runs;
}

/** Minutes in each stage, counted from a hypnogram. */
export function stagesFromHypnogram(hypnogram: string): SleepStages {
  const s: SleepStages = { deep: 0, rem: 0, light: 0, awake: 0 };
  for (const c of hypnogram) if (CODE[c]) s[CODE[c]] += HYPNO_EPOCH_MIN;
  return s;
}

/** Oura's sleep_phase_5_min: 1 deep, 2 light, 3 REM, 4 awake. */
export const ouraHypnogram = (phases: string): string => [...phases].map((c) => ({ "1": "d", "2": "l", "3": "r", "4": "a" })[c] ?? "").join("");

/** Fitbit's levels.data: runs with a start time, a level and seconds. Sampled every five minutes from `start`. */
export function fitbitHypnogram(data: { dateTime: string; level: string; seconds: number }[], start: string): string {
  const t0 = new Date(start).getTime();
  const spans = data.map((d) => ({ from: new Date(d.dateTime).getTime(), to: new Date(d.dateTime).getTime() + d.seconds * 1000, c: ({ deep: "d", light: "l", rem: "r", wake: "a", awake: "a", restless: "a", asleep: "l" } as Record<string, string>)[d.level] ?? "" }));
  const end = Math.max(...spans.map((s) => s.to));
  let out = "";
  for (let t = t0 + 150_000; t < end; t += HYPNO_EPOCH_MIN * 60_000) out += spans.find((s) => t >= s.from && t < s.to)?.c ?? "a";
  return out;
}

/* ---------- Last night against the client's usual ---------- */

export type ContributorKey = "sleep" | "hrv" | "rhr" | "timing" | "load";

export interface Contributor {
  key: ContributorKey;
  label: string;
  /** Last night's figure as the client reads it, e.g. "7 h 40 m". */
  value: string;
  /** Standard scores from the client's usual, turned so that positive is always better. Clamped to ±2.5. */
  score: number;
  /** "12% above usual", "your usual", "40 min later than usual". */
  note: string;
}

const clampZ = (z: number) => Math.max(-2.5, Math.min(2.5, Math.round(z * 100) / 100));
const zOf = (v: number, b: { mean: number; sd: number }, floor: number) => (v - b.mean) / Math.max(b.sd, floor);
const pctNote = (pct: number | null) => (pct === null || Math.abs(pct) < 3 ? "your usual" : `${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} usual`);

/** Minutes after 18:00 of an ISO time in local time, so 23:30 and 00:30 sit next to each other. */
export const clockMinutes = (iso: string): number => {
  const d = new Date(iso);
  return (((d.getHours() - 18 + 24) % 24) * 60 + d.getMinutes());
};
/** 18:00 + minutes as "23:40". */
export const clockLabel = (m: number): string => {
  const t = (Math.round(m) + 18 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * Each part of last night against the client's own last two weeks: sleep time, HRV, resting heart rate,
 * bedtime (later than usual is worse; earlier is fine) and yesterday's training load (much more than usual is worse).
 * Only parts with enough history appear.
 */
export function contributors(days: RecoveryDay[], date: string, loadByDate: Map<string, number> = new Map()): Contributor[] {
  const all = bestPerDay(days);
  const d = all.find((x) => x.date === date);
  if (!d) return [];
  const out: Contributor[] = [];
  const sb = baseline(days, "sleepMinutes", date);
  if (d.sleepMinutes !== undefined && sb) {
    out.push({ key: "sleep", label: "Sleep", value: formatSleep(d.sleepMinutes), score: clampZ(zOf(d.sleepMinutes, sb, 15)), note: pctNote(vsBaseline(d.sleepMinutes, sb)) });
  }
  const hb = baseline(days, "hrvMs", date);
  if (d.hrvMs !== undefined && hb) {
    out.push({ key: "hrv", label: "HRV", value: `${Math.round(d.hrvMs)} ms`, score: clampZ(zOf(d.hrvMs, hb, 2)), note: pctNote(vsBaseline(d.hrvMs, hb)) });
  }
  const rb = baseline(days, "restingHr", date);
  if (d.restingHr !== undefined && rb) {
    const diff = Math.round(d.restingHr - rb.mean);
    out.push({ key: "rhr", label: "Resting HR", value: `${d.restingHr} bpm`, score: clampZ(-zOf(d.restingHr, rb, 1)), note: Math.abs(diff) < 2 ? "your usual" : `${Math.abs(diff)} bpm ${diff > 0 ? "above" : "below"} usual` });
  }
  if (d.bedtime) {
    const prior = all.filter((x) => x.date < date && x.bedtime).slice(0, 14).map((x) => clockMinutes(x.bedtime!));
    if (prior.length >= 4) {
      const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
      const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / prior.length);
      const late = Math.round(clockMinutes(d.bedtime) - mean);
      out.push({ key: "timing", label: "Bedtime", value: clockLabel(clockMinutes(d.bedtime)), score: clampZ(late > 0 ? -late / Math.max(sd, 15) : 0.3), note: Math.abs(late) < 15 ? "your usual" : `${Math.abs(late)} min ${late > 0 ? "later" : "earlier"} than usual` });
    }
  }
  const yesterday = shiftDate(date, -1);
  const prior = [...Array(14)].map((_, i) => loadByDate.get(shiftDate(date, -2 - i)) ?? 0);
  if (loadByDate.size && prior.some((v) => v > 0)) {
    const y = loadByDate.get(yesterday) ?? 0;
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / prior.length);
    // Rest or an ordinary day is neutral; only a day well above usual counts against recovery.
    const z = (y - mean) / Math.max(sd, 30);
    out.push({ key: "load", label: "Yesterday's training", value: y ? `${Math.round(y)} load` : "Rest day", score: clampZ(y === 0 ? 0.5 : z > 0.5 ? -(z - 0.5) : 0.3), note: y === 0 ? "a rest day" : z > 1 ? "well above usual" : z > 0.5 ? "above usual" : "about usual" });
  }
  return out;
}

/** "YYYY-MM-DD" moved by n days. */
export function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Training load against recovery ---------- */

export interface LoadItem {
  /** YYYY-MM-DD the session happened. */
  date: string;
  minutes: number;
  /** How hard it felt, 1–10. Five when not given. */
  rpe?: number;
}

/** Session load (minutes × effort, the common sRPE measure) summed per day. */
export function loadByDay(items: LoadItem[]): Map<string, number> {
  const by = new Map<string, number>();
  for (const it of items) if (it.minutes > 0) by.set(it.date, (by.get(it.date) ?? 0) + it.minutes * (it.rpe ?? 5));
  return by;
}

export interface LoadDay {
  date: string;
  load: number;
  recoveryScore?: number;
  hrvMs?: number;
}

/** The last `span` days, oldest first: that day's training load and that morning's recovery. */
export function loadAndRecovery(days: RecoveryDay[], load: Map<string, number>, today: string, span = 28): LoadDay[] {
  const by = new Map(bestPerDay(days).map((d) => [d.date, d]));
  return [...Array(span)].map((_, i) => {
    const date = shiftDate(today, i - span + 1);
    const r = by.get(date);
    return { date, load: load.get(date) ?? 0, ...(r?.recoveryScore !== undefined ? { recoveryScore: r.recoveryScore } : {}), ...(r?.hrvMs !== undefined ? { hrvMs: r.hrvMs } : {}) };
  });
}

export interface LoadEffect {
  /** Next-morning HRV after the hardest days against after the others, in %. */
  hrvPct: number;
  hardDays: number;
  /** Load from which a day counts as hard here: the top third of training days. */
  threshold: number;
}

/**
 * How the client's body answers a hard day: next-morning HRV after their hardest third of training
 * days against every other morning. Null until there are at least three hard days and three others.
 */
export function loadEffect(days: RecoveryDay[], load: Map<string, number>): LoadEffect | null {
  const trained = [...load.values()].filter((v) => v > 0).sort((a, b) => a - b);
  if (trained.length < 3) return null;
  const threshold = trained[Math.floor(trained.length * (2 / 3))]!;
  const hard: number[] = [];
  const other: number[] = [];
  for (const d of bestPerDay(days)) {
    if (d.hrvMs === undefined) continue;
    (((load.get(shiftDate(d.date, -1)) ?? 0) >= threshold) ? hard : other).push(d.hrvMs);
  }
  if (hard.length < 3 || other.length < 3) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return { hrvPct: Math.round(((avg(hard) - avg(other)) / avg(other)) * 100), hardDays: hard.length, threshold };
}

/* ---------- Sleep schedule ---------- */

export interface SleepWindow {
  date: string;
  /** Minutes after 18:00. */
  bed: number;
  wake: number;
  asleep?: number;
}

export interface SleepSchedule {
  nights: SleepWindow[];
  bed: number;
  wake: number;
  /** Spread of bedtimes, minutes (one standard deviation). Lower is steadier. */
  bedSpread: number;
}

/** Bedtimes and wake times for the last `span` nights, oldest first, with their averages. Null below four nights. */
export function sleepSchedule(days: RecoveryDay[], span = 14): SleepSchedule | null {
  const nights = bestPerDay(days)
    .filter((d) => d.bedtime && d.wakeTime)
    .slice(0, span)
    .reverse()
    .map((d) => ({ date: d.date, bed: clockMinutes(d.bedtime!), wake: clockMinutes(d.wakeTime!), ...(d.sleepMinutes !== undefined ? { asleep: d.sleepMinutes } : {}) }));
  if (nights.length < 4) return null;
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const bed = mean(nights.map((n) => n.bed));
  return { nights, bed, wake: mean(nights.map((n) => n.wake)), bedSpread: Math.round(Math.sqrt(mean(nights.map((n) => (n.bed - bed) ** 2)))) };
}

/* ---------- The morning in a sentence ---------- */

/**
 * One plain sentence about last night, built from the contributors: the best thing and the thing
 * holding the score back. Rule-based, so the screen labels it an Insight, never a prediction.
 */
export function morningLine(list: Contributor[]): string {
  if (!list.length) return "";
  const sorted = [...list].sort((a, b) => a.score - b.score);
  const worst = sorted[0]!;
  const best = sorted[sorted.length - 1]!;
  const phrase = (c: Contributor) => (c.key === "load" ? `yesterday's training was ${c.note}` : c.key === "timing" ? `bedtime was ${c.note}` : `${c.label === "HRV" ? "HRV" : c.label.toLowerCase()} is ${c.note}`);
  if (worst.score >= -0.5) return `Everything is at or above your usual${best.score > 0.75 ? `, and ${phrase(best)}` : ""}.`;
  if (best.score <= 0.25) return `Most numbers are below your usual: ${phrase(worst)}. An easier day fits.`;
  return `${phrase(best).replace(/^./, (c) => c.toUpperCase())}, but ${phrase(worst)}.`;
}
