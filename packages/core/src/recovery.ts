/* Recovery from a client's watch or ring: sleep, HRV, resting heart rate, stress, the provider's own
   recovery score and strain. One RecoveryDay per morning per source. Providers send very different
   shapes; the mappers at the bottom turn each into a RecoveryDay, and readinessFromWatch turns a
   morning's numbers into suggested answers for the readiness check (the client can still change them). */

import type { ReadinessAnswers } from "./readiness";

export type RecoverySource = "whoop" | "oura" | "garmin" | "polar" | "fitbit" | "manual";

export const RECOVERY_SOURCES: Record<RecoverySource, string> = { whoop: "Whoop", oura: "Oura", garmin: "Garmin", polar: "Polar", fitbit: "Fitbit", manual: "Entered by hand" };

export interface SleepStages {
  deep: number;
  rem: number;
  light: number;
  awake: number;
}

export interface RecoveryDay {
  /** The morning it belongs to, YYYY-MM-DD in the client's time zone. */
  date: string;
  source: RecoverySource;
  /** Time asleep, not time in bed. */
  sleepMinutes?: number;
  /** Minutes in each stage. */
  stages?: SleepStages;
  /** The provider's sleep score, 0–100. */
  sleepScore?: number;
  /** Overnight heart-rate variability (RMSSD), ms. */
  hrvMs?: number;
  restingHr?: number;
  /** The provider's own score, 0–100: Whoop recovery, Oura readiness, Garmin Body Battery, Polar Nightly Recharge. */
  recoveryScore?: number;
  /** Daytime stress, 0–100 (higher is more stressed). */
  stress?: number;
  /** Whoop strain, 0–21, for the day before. */
  strain?: number;
  steps?: number;
  respiratoryRate?: number;
}

export type RecoveryMetric = "sleepMinutes" | "hrvMs" | "restingHr" | "recoveryScore" | "stress" | "sleepScore" | "steps";

/** Sources a watch measured beat what the client typed in; then the one with the most numbers. */
const rank = (d: RecoveryDay) => (d.source === "manual" ? 0 : 100) + Object.keys(d).length;

/** One day per date, the best source for it, newest first. */
export function bestPerDay(days: RecoveryDay[]): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  for (const d of days) {
    const cur = by.get(d.date);
    if (!cur || rank(d) > rank(cur)) by.set(d.date, cur && cur.source !== d.source ? { ...pick(cur), ...d } : d);
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Gaps in the winning source are filled from the other one (e.g. steps from Fitbit, sleep from Oura). */
const pick = (d: RecoveryDay): Partial<RecoveryDay> => {
  const { source: _s, date: _d, ...rest } = d;
  return rest;
};

export function mergeRecovery(list: RecoveryDay[], incoming: RecoveryDay[]): RecoveryDay[] {
  const by = new Map(list.map((d) => [`${d.date}:${d.source}`, d]));
  for (const d of incoming) by.set(`${d.date}:${d.source}`, { ...by.get(`${d.date}:${d.source}`), ...d });
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

/** Average and spread of a metric over the `days` mornings before `date`. Null with fewer than 4 readings. */
export function baseline(days: RecoveryDay[], metric: RecoveryMetric, date: string, span = 14): Baseline | null {
  const vals = bestPerDay(days)
    .filter((d) => d.date < date)
    .slice(0, span)
    .map((d) => d[metric])
    .filter((v): v is number => typeof v === "number");
  if (vals.length < 4) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return { mean, sd, n: vals.length };
}

/** "+12%" style change of `value` against the baseline. */
export const vsBaseline = (value: number, b: Baseline | null): number | null => (b && b.mean ? Math.round(((value - b.mean) / b.mean) * 100) : null);

const band = (v: number, cuts: [number, number, number, number]): number => (v >= cuts[0] ? 5 : v >= cuts[1] ? 4 : v >= cuts[2] ? 3 : v >= cuts[3] ? 2 : 1);

export interface WatchSuggestion {
  answers: Partial<ReadinessAnswers>;
  /** Why, per answer, in words the client reads, e.g. "6 h 10 m asleep". */
  why: Partial<Record<keyof ReadinessAnswers, string>>;
  source: RecoverySource;
}

export const formatSleep = (minutes: number): string => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, "0")} m`;

/**
 * This morning's numbers as readiness answers. Rule-based so it can be explained:
 * - Sleep: hours asleep (8 h+ is a 5, under 5 h a 1), nudged by the provider's sleep score.
 * - Energy: the provider's recovery score when it has one; otherwise HRV against the client's own
 *   last two weeks, with a point off when resting heart rate is 5+ bpm above usual.
 * - Stress: daytime stress (Garmin, Oura).
 * - Soreness: no watch can feel that, so the client always answers it.
 */
export function readinessFromWatch(days: RecoveryDay[], date: string): WatchSuggestion | null {
  const today = bestPerDay(days).find((d) => d.date === date);
  if (!today) return null;
  const answers: Partial<ReadinessAnswers> = {};
  const why: WatchSuggestion["why"] = {};
  if (today.sleepMinutes) {
    let s = band(today.sleepMinutes / 60, [8, 7, 6, 5]);
    if (today.sleepScore !== undefined) s = Math.round((s + band(today.sleepScore, [85, 75, 65, 50])) / 2);
    answers.sleep = s;
    why.sleep = `${formatSleep(today.sleepMinutes)} asleep${today.sleepScore !== undefined ? `, sleep score ${today.sleepScore}` : ""}`;
  } else if (today.sleepScore !== undefined) {
    answers.sleep = band(today.sleepScore, [85, 75, 65, 50]);
    why.sleep = `Sleep score ${today.sleepScore}`;
  }
  if (today.recoveryScore !== undefined) {
    answers.energy = band(today.recoveryScore, [80, 67, 50, 34]);
    why.energy = `${today.source === "oura" ? "Readiness" : today.source === "garmin" ? "Body Battery" : today.source === "polar" ? "Nightly Recharge" : "Recovery"} ${today.recoveryScore}`;
  } else if (today.hrvMs) {
    const b = baseline(days, "hrvMs", date);
    if (b) {
      const z = b.sd > 0 ? (today.hrvMs - b.mean) / b.sd : 0;
      let e = z >= 0.5 ? 5 : z >= -0.25 ? 4 : z >= -1 ? 3 : z >= -1.75 ? 2 : 1;
      const rhr = today.restingHr ? baseline(days, "restingHr", date) : null;
      const rhrUp = rhr && today.restingHr ? today.restingHr - rhr.mean : 0;
      if (rhrUp >= 5) e = Math.max(1, e - 1);
      answers.energy = e;
      const pct = vsBaseline(today.hrvMs, b) ?? 0;
      why.energy = `HRV ${Math.round(today.hrvMs)} ms, ${pct === 0 ? "your usual" : `${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} usual`}${rhrUp >= 5 ? `; resting HR ${Math.round(rhrUp)} bpm up` : ""}`;
    }
  }
  if (today.stress !== undefined) {
    // Garmin: 0–25 rest, 26–50 low, 51–75 medium, 76–100 high.
    answers.stress = today.stress <= 20 ? 5 : today.stress <= 30 ? 4 : today.stress <= 45 ? 3 : today.stress <= 60 ? 2 : 1;
    why.stress = `Stress ${today.stress}/100 yesterday`;
  }
  if (!Object.keys(answers).length) return null;
  return { answers, why, source: today.source };
}

/** YYYY-MM-DD in local time. */
export const localDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- Provider mappers. Each takes what that provider's API sends and returns RecoveryDays. ---------- */

const msToMin = (ms: number | undefined) => (ms === undefined ? undefined : Math.round(ms / 60000));
const sToMin = (s: number | undefined) => (s === undefined || s === null ? undefined : Math.round(s / 60));
const r1 = (n: number | undefined | null) => (n === undefined || n === null ? undefined : Math.round(n * 10) / 10);
const clean = (d: RecoveryDay): RecoveryDay => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined && v !== null && !(typeof v === "number" && Number.isNaN(v)))) as unknown as RecoveryDay;

/** Whoop API v2: /recovery, /activity/sleep and /cycle records. A night belongs to the morning it ended. */
export interface WhoopData {
  recovery?: { sleep_id?: string; created_at: string; score_state: string; score?: { recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number } }[];
  sleep?: { id?: string; end: string; nap?: boolean; score_state: string; score?: { stage_summary?: { total_in_bed_time_milli?: number; total_awake_time_milli?: number; total_light_sleep_time_milli?: number; total_slow_wave_sleep_time_milli?: number; total_rem_sleep_time_milli?: number }; sleep_performance_percentage?: number; respiratory_rate?: number } }[];
  cycle?: { start: string; end?: string | null; score_state: string; score?: { strain?: number } }[];
}

export function fromWhoop(data: WhoopData, tzDate: (iso: string) => string = (iso) => localDate(new Date(iso))): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  const day = (date: string) => by.get(date) ?? by.set(date, { date, source: "whoop" }).get(date)!;
  for (const s of data.sleep ?? []) {
    if (s.nap || s.score_state !== "SCORED" || !s.score?.stage_summary) continue;
    const st = s.score.stage_summary;
    const deep = msToMin(st.total_slow_wave_sleep_time_milli) ?? 0;
    const rem = msToMin(st.total_rem_sleep_time_milli) ?? 0;
    const light = msToMin(st.total_light_sleep_time_milli) ?? 0;
    Object.assign(day(tzDate(s.end)), {
      sleepMinutes: deep + rem + light, stages: { deep, rem, light, awake: msToMin(st.total_awake_time_milli) ?? 0 },
      sleepScore: s.score.sleep_performance_percentage, respiratoryRate: r1(s.score.respiratory_rate),
    });
  }
  for (const r of data.recovery ?? []) {
    if (r.score_state !== "SCORED" || !r.score) continue;
    Object.assign(day(tzDate(r.created_at)), { recoveryScore: r.score.recovery_score, restingHr: r.score.resting_heart_rate, hrvMs: r1(r.score.hrv_rmssd_milli) });
  }
  // A cycle runs from waking to waking; its strain belongs to the next morning.
  for (const c of data.cycle ?? []) {
    if (c.score_state !== "SCORED" || c.score?.strain === undefined || !c.end) continue;
    day(tzDate(c.end)).strain = r1(c.score.strain);
  }
  return [...by.values()].map(clean);
}

/** Oura API v2 usercollection: daily_sleep, sleep, daily_readiness, daily_activity, daily_stress. */
export interface OuraData {
  daily_sleep?: { day: string; score?: number | null }[];
  sleep?: { day: string; type?: string; total_sleep_duration?: number | null; deep_sleep_duration?: number | null; rem_sleep_duration?: number | null; light_sleep_duration?: number | null; awake_time?: number | null; average_hrv?: number | null; lowest_heart_rate?: number | null; average_breath?: number | null }[];
  daily_readiness?: { day: string; score?: number | null }[];
  daily_activity?: { day: string; steps?: number | null }[];
  /** Seconds of high stress and of high recovery in the day. */
  daily_stress?: { day: string; stress_high?: number | null; recovery_high?: number | null }[];
}

export function fromOura(data: OuraData): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  const day = (date: string) => by.get(date) ?? by.set(date, { date, source: "oura" }).get(date)!;
  for (const s of data.daily_sleep ?? []) if (s.score != null) day(s.day).sleepScore = s.score;
  for (const s of data.sleep ?? []) {
    if (s.type && s.type !== "long_sleep") continue;
    Object.assign(day(s.day), {
      sleepMinutes: sToMin(s.total_sleep_duration ?? undefined),
      stages: { deep: sToMin(s.deep_sleep_duration ?? 0) ?? 0, rem: sToMin(s.rem_sleep_duration ?? 0) ?? 0, light: sToMin(s.light_sleep_duration ?? 0) ?? 0, awake: sToMin(s.awake_time ?? 0) ?? 0 },
      hrvMs: s.average_hrv ?? undefined, restingHr: s.lowest_heart_rate ?? undefined, respiratoryRate: r1(s.average_breath),
    });
  }
  for (const r of data.daily_readiness ?? []) if (r.score != null) day(r.day).recoveryScore = r.score;
  for (const a of data.daily_activity ?? []) if (a.steps != null) day(a.day).steps = a.steps;
  // Oura reports time spent stressed; as a 0–100 figure: share of stressed time in the stressed + restored time.
  for (const s of data.daily_stress ?? []) {
    const hi = s.stress_high ?? 0;
    const rec = s.recovery_high ?? 0;
    if (hi + rec > 0) day(s.day).stress = Math.round((hi / (hi + rec)) * 100);
  }
  return [...by.values()].map(clean);
}

/** Garmin Health API summaries: dailies, sleeps and hrv. */
export interface GarminData {
  dailies?: { calendarDate: string; restingHeartRateInBeatsPerMinute?: number; averageStressLevel?: number; steps?: number; bodyBatteryHighestValue?: number }[];
  sleeps?: { calendarDate: string; durationInSeconds?: number; deepSleepDurationInSeconds?: number; lightSleepDurationInSeconds?: number; remSleepInSeconds?: number; awakeDurationInSeconds?: number; overallSleepScore?: { value?: number } }[];
  hrv?: { calendarDate: string; lastNightAvg?: number }[];
}

export function fromGarmin(data: GarminData): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  const day = (date: string) => by.get(date) ?? by.set(date, { date, source: "garmin" }).get(date)!;
  for (const d of data.dailies ?? []) {
    // Garmin sends -1 for "no stress reading".
    Object.assign(day(d.calendarDate), { restingHr: d.restingHeartRateInBeatsPerMinute, stress: d.averageStressLevel !== undefined && d.averageStressLevel >= 0 ? d.averageStressLevel : undefined, steps: d.steps, recoveryScore: d.bodyBatteryHighestValue });
  }
  for (const s of data.sleeps ?? []) {
    const deep = sToMin(s.deepSleepDurationInSeconds) ?? 0;
    const light = sToMin(s.lightSleepDurationInSeconds) ?? 0;
    const rem = sToMin(s.remSleepInSeconds) ?? 0;
    const awake = sToMin(s.awakeDurationInSeconds) ?? 0;
    Object.assign(day(s.calendarDate), { sleepMinutes: deep + light + rem || sToMin(s.durationInSeconds), stages: { deep, rem, light, awake }, sleepScore: s.overallSleepScore?.value });
  }
  for (const h of data.hrv ?? []) day(h.calendarDate).hrvMs = h.lastNightAvg;
  return [...by.values()].map(clean);
}

/** Fitbit Web API: sleep (v1.2), hrv, activities/heart and activities/steps date ranges. */
export interface FitbitData {
  sleep?: { dateOfSleep: string; isMainSleep?: boolean; minutesAsleep?: number; efficiency?: number; levels?: { summary?: { deep?: { minutes: number }; rem?: { minutes: number }; light?: { minutes: number }; wake?: { minutes: number } } } }[];
  hrv?: { dateTime: string; value?: { dailyRmssd?: number } }[];
  "activities-heart"?: { dateTime: string; value?: { restingHeartRate?: number } }[];
  "activities-steps"?: { dateTime: string; value: string | number }[];
}

export function fromFitbit(data: FitbitData): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  const day = (date: string) => by.get(date) ?? by.set(date, { date, source: "fitbit" }).get(date)!;
  for (const s of data.sleep ?? []) {
    if (s.isMainSleep === false) continue;
    const l = s.levels?.summary;
    Object.assign(day(s.dateOfSleep), {
      sleepMinutes: s.minutesAsleep,
      ...(l?.deep ? { stages: { deep: l.deep.minutes, rem: l.rem?.minutes ?? 0, light: l.light?.minutes ?? 0, awake: l.wake?.minutes ?? 0 } } : {}),
    });
  }
  for (const h of data.hrv ?? []) if (h.value?.dailyRmssd) day(h.dateTime).hrvMs = r1(h.value.dailyRmssd);
  for (const h of data["activities-heart"] ?? []) if (h.value?.restingHeartRate) day(h.dateTime).restingHr = h.value.restingHeartRate;
  for (const s of data["activities-steps"] ?? []) {
    const n = Number(s.value);
    // Fitbit lists every date in the range, with 0 steps on days the watch wasn't worn.
    if (n > 0) day(s.dateTime).steps = n;
  }
  return [...by.values()].map(clean);
}

/** Polar AccessLink: /users/sleep nights and /users/nightly-recharge. */
export interface PolarData {
  nights?: { date: string; light_sleep?: number; deep_sleep?: number; rem_sleep?: number; total_interruption_duration?: number; sleep_score?: number }[];
  recharges?: { date: string; heart_rate_avg?: number; heart_rate_variability_avg?: number; nightly_recharge_status?: number }[];
}

export function fromPolar(data: PolarData): RecoveryDay[] {
  const by = new Map<string, RecoveryDay>();
  const day = (date: string) => by.get(date) ?? by.set(date, { date, source: "polar" }).get(date)!;
  for (const n of data.nights ?? []) {
    const deep = sToMin(n.deep_sleep) ?? 0;
    const light = sToMin(n.light_sleep) ?? 0;
    const rem = sToMin(n.rem_sleep) ?? 0;
    Object.assign(day(n.date), { sleepMinutes: deep + light + rem, stages: { deep, rem, light, awake: sToMin(n.total_interruption_duration) ?? 0 }, sleepScore: n.sleep_score });
  }
  // Nightly Recharge status runs from 1 (very poor) to 6 (very good); as 0–100.
  for (const r of data.recharges ?? []) {
    Object.assign(day(r.date), { hrvMs: r.heart_rate_variability_avg, restingHr: r.heart_rate_avg, recoveryScore: r.nightly_recharge_status ? Math.round(((r.nightly_recharge_status - 1) / 5) * 100) : undefined });
  }
  return [...by.values()].map(clean);
}
