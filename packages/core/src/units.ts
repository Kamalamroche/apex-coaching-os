/* Units. Everything is stored metric (kg, cm, metres); these turn it into what each person reads and
   types, and back again. kg, cm and km are the default. */

export type WeightUnit = "kg" | "lb";
export type LengthUnit = "cm" | "in";
export type DistanceUnit = "km" | "mi";

export interface UnitPrefs {
  weight: WeightUnit;
  length: LengthUnit;
  distance: DistanceUnit;
}

export const METRIC: UnitPrefs = { weight: "kg", length: "cm", distance: "km" };
export const IMPERIAL: UnitPrefs = { weight: "lb", length: "in", distance: "mi" };

export const LB_PER_KG = 2.20462262;
export const CM_PER_IN = 2.54;
export const M_PER_MI = 1609.344;

/** Rounds to `dp` places and drops trailing zeros: 220.50 → 220.5, 100.0 → 100. */
export const trim = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Accepts "72,5" as well as "72.5". NaN when it isn't a number. */
export const parseDecimal = (raw: string | number): number => (typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", ".")));

/** Fills in anything missing or unknown with the metric default. */
export function normaliseUnits(v: unknown): UnitPrefs {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof UnitPrefs, unknown>>;
  return {
    weight: o.weight === "lb" ? "lb" : "kg",
    length: o.length === "in" ? "in" : "cm",
    distance: o.distance === "mi" ? "mi" : "km",
  };
}

/* ---------- Weight ---------- */

/** kg → the person's unit, rounded for reading: kg keeps its two places (1.25 kg plates), lb gets one. */
export const weightFromKg = (kg: number, unit: WeightUnit, dp?: number): number => trim(unit === "lb" ? kg * LB_PER_KG : kg, dp ?? (unit === "lb" ? 1 : 2));

/** What the person typed, in their unit → kg for storage (two places, like the database). */
export const weightToKg = (value: number, unit: WeightUnit): number => trim(unit === "lb" ? value / LB_PER_KG : value, 2);

/** "100 kg" or "220.5 lb". */
export const formatWeight = (kg: number, unit: WeightUnit, dp?: number): string => `${weightFromKg(kg, unit, dp).toLocaleString("en-GB")} ${unit}`;

/** A change in weight with its sign: "+2.5 kg", "−1.1 lb". */
export function formatWeightDelta(kg: number, unit: WeightUnit, dp?: number): string {
  const v = weightFromKg(kg, unit, dp);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-GB")} ${unit}`;
}

/** Plates and bars for each unit, heaviest first. UK gyms load in kg; US gyms in lb. */
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5] as const;
/** Bars in lb. The value sits in `kg` only so it shares BarOption's shape: read it as lb. */
export const BARS_LB = [
  { kg: 45, label: "Olympic bar" },
  { kg: 35, label: "35 lb bar" },
  { kg: 15, label: "Technique bar" },
  { kg: 55, label: "Trap bar" },
];

/* ---------- Body measurements ---------- */

export const lengthFromCm = (cm: number, unit: LengthUnit, dp = 1): number => trim(unit === "in" ? cm / CM_PER_IN : cm, dp);
export const lengthToCm = (value: number, unit: LengthUnit): number => trim(unit === "in" ? value * CM_PER_IN : value, 1);
export const formatLength = (cm: number, unit: LengthUnit, dp = 1): string => `${lengthFromCm(cm, unit, dp).toLocaleString("en-GB")} ${unit}`;

/** Height in feet and inches: 180 cm → { ft: 5, in: 11 }. */
export function feetInches(cm: number): { ft: number; in: number } {
  let total = Math.round(cm / CM_PER_IN);
  const ft = Math.floor(total / 12);
  total -= ft * 12;
  return { ft, in: total };
}

export const fromFeetInches = (ft: number, inches: number): number => trim(((ft || 0) * 12 + (inches || 0)) * CM_PER_IN, 1);

/** "180 cm" or "5 ft 11 in". */
export function formatHeight(cm: number, unit: LengthUnit): string {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  const h = feetInches(cm);
  return `${h.ft} ft ${h.in} in`;
}

/* ---------- Distance and pace ---------- */

/** Metres → km or miles. */
export const distanceFrom = (metres: number, unit: DistanceUnit): number => (unit === "mi" ? metres / M_PER_MI : metres / 1000);
export const distanceToMetres = (value: number, unit: DistanceUnit): number => (unit === "mi" ? value * M_PER_MI : value * 1000);

/** One km or one mile in metres: the length a pace, a split or a chart tick is measured over. */
export const metresPer = (unit: DistanceUnit): number => (unit === "mi" ? M_PER_MI : 1000);

/** "km/h" or "mph". */
export const speedUnit = (unit: DistanceUnit): string => (unit === "mi" ? "mph" : "km/h");

/** Metres per second → km/h or mph. */
export const speedFrom = (metresPerSecond: number, unit: DistanceUnit): number => (metresPerSecond * 3600) / metresPer(unit);

/**
 * Rewrites the kg figures inside text that was written in kg, such as a "Last time: 80 kg × 8" line
 * or a saved summary, into lb. Leaves the text alone in kg.
 */
export function kgTextIn(text: string, unit: WeightUnit): string {
  if (unit === "kg") return text;
  return text.replace(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?)kg\b/g, (_m, n: string, sp: string) => {
    const kg = Number(n.replace(/,/g, ""));
    const big = kg >= 1000;
    return `${weightFromKg(kg, "lb", big ? 0 : 1).toLocaleString("en-GB")}${sp}lb`;
  });
}

/* ---------- Any measurement by its metric unit ---------- */

/** The unit to show for something stored in `metric` ("kg", "cm", or anything else, which stays as it is). */
export const shownUnit = (metric: string, p: UnitPrefs): string => (metric === "kg" ? p.weight : metric === "cm" ? p.length : metric);

/** A stored value → the person's unit. */
export const toShown = (value: number, metric: string, p: UnitPrefs, dp?: number): number =>
  metric === "kg" ? weightFromKg(value, p.weight, dp) : metric === "cm" ? lengthFromCm(value, p.length, dp ?? 1) : value;

/** A value typed in the person's unit → the stored metric value. */
export const fromShown = (value: number, metric: string, p: UnitPrefs): number =>
  metric === "kg" ? weightToKg(value, p.weight) : metric === "cm" ? lengthToCm(value, p.length) : value;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * The same for kilometres, paces and speeds: "12.4 km run · 5:08 /km · 24.1 km/h" → miles, /mi, mph.
 * Swims and rows in metres are left alone.
 */
export function kmTextIn(text: string, unit: DistanceUnit): string {
  if (unit === "km") return text;
  return text
    .replace(/(\d+(?:\.\d+)?)(\s?)km\/h\b/g, (_m, n: string, sp: string) => `${trim(Number(n) / 1.609344)}${sp}mph`)
    .replace(/(\d+):(\d{2})(\s?)\/km\b/g, (_m, mm: string, ss: string, sp: string) => {
      const s = Math.round((Number(mm) * 60 + Number(ss)) * 1.609344);
      return `${mmss(s === 0 ? 0 : s)}${sp}/mi`;
    })
    .replace(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s?)km\b(?!\/)/g, (_m, n: string, sp: string) => {
      const mi = Number(n.replace(/,/g, "")) / 1.609344;
      return `${(mi >= 100 ? Math.round(mi) : trim(mi, 1)).toLocaleString("en-GB")}${sp}mi`;
    });
}

/** Weights and distances in saved text, in the person's units. */
export const metricTextIn = (text: string, p: UnitPrefs): string => kmTextIn(kgTextIn(text, p.weight), p.distance);

/* ---------- Food amounts ---------- */

export const G_PER_OZ = 28.3495;
export const ML_PER_FL_OZ = 29.5735;

/** Food amounts follow the weight setting: grams and ml with kg, ounces and fl oz with lb. */
export function foodAmount(amount: number, metric: "g" | "ml", weight: WeightUnit): { value: number; unit: string } {
  if (weight === "kg") return { value: Math.round(amount), unit: metric };
  return metric === "g" ? { value: trim(amount / G_PER_OZ), unit: "oz" } : { value: trim(amount / ML_PER_FL_OZ), unit: "fl oz" };
}

/** An amount typed in oz or fl oz (or g and ml) → grams or ml. */
export const foodAmountToMetric = (value: number, metric: "g" | "ml", weight: WeightUnit): number =>
  weight === "kg" ? value : value * (metric === "g" ? G_PER_OZ : ML_PER_FL_OZ);
