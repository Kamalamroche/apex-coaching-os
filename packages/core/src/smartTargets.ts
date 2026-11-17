/* Smart targets: how many calories a client really burns, worked out from what they eat and how their weight moves.
 * Pure maths, no AI service. The same idea as an "adaptive" calorie coach: if someone eats 2,000 kcal a day and their
 * weight holds still, they burn about 2,000. If they lose 0.5 kg a week on 2,000, they burn about 2,550.
 * The result is only ever a suggestion: the coach accepts it, edits it or keeps the current targets. */

import { addDays, type FoodEntry, type NutritionTargets } from "./lifestyle";

/** Energy in a kilogram of body weight change (fat and water mixed), the usual working figure. */
export const KCAL_PER_KG = 7700;
/** How far back the check looks, in days (food and weigh-ins from the same window). */
export const SMART_WINDOW_DAYS = 28;
/** A day under this many kcal is treated as half logged and left out. */
export const PARTIAL_DAY_KCAL = 1000;

export type SmartGoal = "lose" | "maintain" | "gain";

export const SMART_GOALS: { key: SmartGoal; label: string; hint: string; pctPerWeek: number }[] = [
  { key: "lose", label: "Lose fat", hint: "About 0.5% of body weight a week", pctPerWeek: -0.5 },
  { key: "maintain", label: "Maintain", hint: "Hold weight steady", pctPerWeek: 0 },
  { key: "gain", label: "Build muscle", hint: "About 0.25% of body weight a week", pctPerWeek: 0.25 },
];

export interface WeighIn {
  /** Local date, YYYY-MM-DD. */
  day: string;
  kg: number;
}

export interface Expenditure {
  /** Calories a day the client really burns, rounded to 10. */
  kcal: number;
  /** Average eaten on fully logged days. */
  avgIntake: number;
  loggedDays: number;
  weighIns: number;
  /** Weight trend in kg per week (negative = losing). */
  trendKgPerWeek: number;
  /** The latest trend weight. */
  weightKg: number;
  confidence: "good" | "fair";
}

export type SmartCheck =
  | { status: "waiting"; loggedDays: number; weighIns: number; reason: string }
  | { status: "ready"; est: Expenditure };

const DAY_MS = 86_400_000;
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
const round = (v: number, to: number) => Math.round(v / to) * to;

/** Weigh-ins from check-ins and measurements, one per day (the last one wins). */
export function weighInsFrom(...lists: { at: string | null | undefined; kg: number | null | undefined }[][]): WeighIn[] {
  const byDay = new Map<string, number>();
  for (const list of lists) {
    for (const w of list) {
      if (!w.at || w.kg == null || !(w.kg > 25 && w.kg < 350)) continue;
      byDay.set(w.at.slice(0, 10), w.kg);
    }
  }
  return [...byDay.entries()].map(([day, kg]) => ({ day, kg })).sort((a, b) => a.day.localeCompare(b.day));
}

/** Straight-line fit through the weigh-ins: slope in kg per day and the fitted weight on the last day. */
function trend(w: WeighIn[]): { perDay: number; last: number } {
  const xs = w.map((p) => dayNum(p.day));
  const n = w.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = w.reduce((a, p) => a + p.kg, 0) / n;
  let sxy = 0;
  let sxx = 0;
  w.forEach((p, i) => { sxy += (xs[i]! - mx) * (p.kg - my); sxx += (xs[i]! - mx) ** 2; });
  const perDay = sxx ? sxy / sxx : 0;
  return { perDay, last: my + perDay * (xs[n - 1]! - mx) };
}

/**
 * What the client burns a day, from the last four weeks of food and weigh-ins.
 * Needs at least 14 fully logged days and 3 weigh-ins spread over 14 days or more; otherwise says what's missing.
 * Today is left out, because today's log is rarely finished.
 */
export function estimateExpenditure(food: FoodEntry[], weighIns: WeighIn[], today: string): SmartCheck {
  const from = addDays(today, -SMART_WINDOW_DAYS);
  const perDay = new Map<string, number>();
  for (const f of food) if (f.day >= from && f.day < today) perDay.set(f.day, (perDay.get(f.day) ?? 0) + f.kcal);
  const full = [...perDay.values()].filter((k) => k >= PARTIAL_DAY_KCAL);
  const w = weighIns.filter((p) => p.day >= from && p.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  const span = w.length ? dayNum(w[w.length - 1]!.day) - dayNum(w[0]!.day) : 0;
  const missing: string[] = [];
  if (full.length < 14) missing.push(`${14 - full.length} more fully logged day${14 - full.length === 1 ? "" : "s"}`);
  if (w.length < 3 || span < 14) missing.push(w.length < 3 ? `${3 - w.length} more weigh-in${3 - w.length === 1 ? "" : "s"}` : "weigh-ins spread over two weeks");
  if (missing.length) return { status: "waiting", loggedDays: full.length, weighIns: w.length, reason: `Needs ${missing.join(" and ")} in the last four weeks.` };

  const avgIntake = full.reduce((a, b) => a + b, 0) / full.length;
  const t = trend(w);
  const kcal = round(avgIntake - t.perDay * KCAL_PER_KG, 10);
  return {
    status: "ready",
    est: {
      kcal,
      avgIntake: round(avgIntake, 10),
      loggedDays: full.length,
      weighIns: w.length,
      trendKgPerWeek: Math.round(t.perDay * 7 * 100) / 100,
      weightKg: Math.round(t.last * 10) / 10,
      confidence: full.length >= 21 && w.length >= 4 ? "good" : "fair",
    },
  };
}

/** A starting goal for the chips: the intake answer if it says so, else what the current targets are aiming at. */
export function guessSmartGoal(intakeGoal: string, targetKcal: number | null, est: Expenditure | null): SmartGoal {
  const g = intakeGoal.toLowerCase();
  if (/\b(lose|loss|lean|cut|tone|slim|fat)\b/.test(g)) return "lose";
  if (/\b(gain|muscle|bulk|build|size|mass)\b/.test(g)) return "gain";
  if (targetKcal != null && est) {
    if (targetKcal < est.kcal - 100) return "lose";
    if (targetKcal > est.kcal + 100) return "gain";
  }
  return "maintain";
}

export interface SmartSuggestion {
  goal: SmartGoal;
  /** Calories a day for the goal's pace. */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Change from the current daily calories. */
  delta: number;
  /** Close enough to keep what's there (under 100 kcal apart). */
  keep: boolean;
  /** The same change applied to rest days, when the coach set them. */
  restDay: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  /** One plain sentence for the coach. */
  why: string;
}

/**
 * New targets for the goal from the measured burn. Protein and fat stay as the coach set them; carbs take the change,
 * never below zero. Calories stay inside 1,200 to 6,000 a day.
 */
export function smartSuggestion(est: Expenditure, current: NutritionTargets, goal: SmartGoal, name: string): SmartSuggestion {
  const pace = SMART_GOALS.find((g) => g.key === goal)!.pctPerWeek;
  const kgPerWeek = (est.weightKg * pace) / 100;
  const kcal = Math.min(6000, Math.max(1200, round(est.kcal + (kgPerWeek * KCAL_PER_KG) / 7, 10)));
  const delta = kcal - current.kcal;
  const keep = Math.abs(delta) < 100;
  const carbsG = Math.max(0, round((kcal - current.proteinG * 4 - current.fatG * 9) / 4, 5));
  const r = current.restDay;
  const restDay = r && !keep
    ? (() => {
        const rk = Math.max(1000, r.kcal + delta);
        return { kcal: rk, proteinG: r.proteinG, carbsG: Math.max(0, round((rk - r.proteinG * 4 - r.fatG * 9) / 4, 5)), fatG: r.fatG };
      })()
    : null;
  const moving = Math.abs(est.trendKgPerWeek) < 0.05 ? "holding steady" : `${est.trendKgPerWeek < 0 ? "losing" : "gaining"} ${Math.abs(est.trendKgPerWeek).toFixed(2)} kg a week`;
  const paceWord = goal === "maintain" ? "hold weight steady" : `${goal === "lose" ? "lose" : "gain"} about ${Math.abs(kgPerWeek).toFixed(2)} kg a week`;
  const why = keep
    ? `${name} eats about ${est.avgIntake.toLocaleString("en-GB")} kcal and is ${moving}. The current ${current.kcal.toLocaleString("en-GB")} kcal should already ${paceWord}.`
    : `${name} eats about ${est.avgIntake.toLocaleString("en-GB")} kcal and is ${moving}, so burns about ${est.kcal.toLocaleString("en-GB")}. ${kcal.toLocaleString("en-GB")} kcal a day should ${paceWord}.`;
  return { goal, kcal, proteinG: current.proteinG, carbsG, fatG: current.fatG, delta, keep, restDay, why };
}
