import {
  METRIC, formatDistance, formatHeight, formatLength, formatPace, formatWeight, formatWeightDelta, lengthFromCm, metricTextIn, lengthToCm, normaliseLang,
  fromShown, normaliseUnits, shownUnit, toShown, translate, weightFromKg, weightToKg, type Lang, type Sport, type UnitPrefs,
} from "@apex/core";
import { useSyncExternalStore } from "react";

/* Each person's units and language. Kept on the device (so it applies before sign-in finishes) and,
   once signed in, in their account so it follows them to other devices (apps/web/src/data/prefs.ts).
   Stored data is always metric: these only change what's shown and how typed numbers are read. */

export interface Prefs {
  units: UnitPrefs;
  lang: Lang;
}

const KEY = "apex-prefs";

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Prefs>;
      return { units: normaliseUnits(v.units), lang: normaliseLang(v.lang) };
    }
  } catch {
    /* private mode or bad JSON: fall through to the defaults */
  }
  // English and kg until the person picks otherwise, whatever the browser says.
  return { units: METRIC, lang: "en" };
}

let current: Prefs = load();
const listeners = new Set<() => void>();
const changeHooks = new Set<(p: Prefs) => void>();

function applyLang(lang: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en-GB" : lang;
}
applyLang(current.lang);

export const getPrefs = (): Prefs => current;

/** `fromAccount` is true when the change came from the saved account, so it isn't saved straight back. */
export function setPrefs(next: Partial<Prefs>, fromAccount = false) {
  const merged: Prefs = { units: normaliseUnits(next.units ?? current.units), lang: normaliseLang(next.lang ?? current.lang) };
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  current = merged;
  applyLang(current.lang);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* applies for this visit */
  }
  listeners.forEach((l) => l());
  if (!fromAccount) changeHooks.forEach((h) => h(current));
}

/** Called when the person changes a setting (not when one is loaded from their account). */
export function onPrefsChange(hook: (p: Prefs) => void): () => void {
  changeHooks.add(hook);
  return () => changeHooks.delete(hook);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePrefs = (): Prefs => useSyncExternalStore(subscribe, getPrefs, getPrefs);

export interface Units extends UnitPrefs {
  /** kg → number in the person's unit, e.g. for an input box. */
  w: (kg: number, dp?: number) => number;
  /** Number typed in the person's unit → kg. */
  toKg: (value: number) => number;
  /** "100 kg" / "220.5 lb". */
  fw: (kg: number, dp?: number) => string;
  /** "+2.5 kg" / "−1.1 lb". */
  fwd: (kg: number, dp?: number) => string;
  len: (cm: number, dp?: number) => number;
  toCm: (value: number) => number;
  fl: (cm: number, dp?: number) => string;
  height: (cm: number) => string;
  /** Text written in kg and km ("Last time: 80 kg × 8", "5 km run") with its figures in the person's units. */
  kt: (text: string) => string;
  /** Any stored measurement by its metric unit ("kg", "cm", "%"): shown value, shown unit, and back. */
  show: (value: number, metric: string, dp?: number) => number;
  unit: (metric: string) => string;
  store: (value: number, metric: string) => number;
  dist: (metres: number, sport?: Sport) => string;
  pace: (metres: number, seconds: number, sport: Sport) => string;
}

export function unitsFor(u: UnitPrefs): Units {
  return {
    ...u,
    w: (kg, dp) => weightFromKg(kg, u.weight, dp),
    toKg: (v) => weightToKg(v, u.weight),
    fw: (kg, dp) => formatWeight(kg, u.weight, dp),
    fwd: (kg, dp) => formatWeightDelta(kg, u.weight, dp),
    len: (cm, dp) => lengthFromCm(cm, u.length, dp),
    toCm: (v) => lengthToCm(v, u.length),
    fl: (cm, dp) => formatLength(cm, u.length, dp),
    height: (cm) => formatHeight(cm, u.length),
    show: (v, metric, dp) => toShown(v, metric, u, dp),
    unit: (metric) => shownUnit(metric, u),
    store: (v, metric) => fromShown(v, metric, u),
    kt: (text) => metricTextIn(text, u),
    dist: (m, sport) => formatDistance(m, sport, u.distance),
    pace: (m, s, sport) => formatPace(m, s, sport, u.distance),
  };
}

const cache = new WeakMap<UnitPrefs, Units>();

/** The person's units plus ready-made converters and formatters. */
export function useUnits(): Units {
  const { units } = usePrefs();
  let u = cache.get(units);
  if (!u) cache.set(units, (u = unitsFor(units)));
  return u;
}

/** `t("Today")` → "Hoy" in Spanish. Untranslated text falls back to English. */
export function useT(): (text: string, vars?: Record<string, string | number>) => string {
  const { lang } = usePrefs();
  return (text, vars) => translate(lang, text, vars);
}
