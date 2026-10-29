/* Weekly check-ins, body measurements and progress photos: types, rules and row converters.
   Mirrors supabase/migrations/20261026120000_check_ins_measurements_photos.sql. Pure, so it is unit tested. */

export type Pose = "front" | "side" | "back";
export const POSES: Pose[] = ["front", "side", "back"];

/** 1–5 answers on the weekly form. */
export type RatingKey = "energy" | "mood" | "stress" | "hunger" | "training" | "nutrition";

export interface CheckIn {
  id: string;
  submittedAt: string;
  weightKg: number | null;
  sleepHours: number | null;
  energy: number | null;
  mood: number | null;
  stress: number | null;
  hunger: number | null;
  training: number | null;
  nutrition: number | null;
  wins: string;
  struggles: string;
  note: string;
  coachReply: string | null;
  reviewedAt: string | null;
}

export type CheckInInput = Omit<CheckIn, "id" | "submittedAt" | "coachReply" | "reviewedAt">;

export type MeasureKey = "weightKg" | "bodyFatPct" | "chestCm" | "waistCm" | "hipsCm" | "armCm" | "thighCm";

export interface Measurement extends Partial<Record<MeasureKey, number | null>> {
  id: string;
  measuredAt: string;
  checkInId: string | null;
}

export type MeasurementInput = Partial<Record<MeasureKey, number | null>>;

export interface ProgressPhoto {
  id: string;
  checkInId: string | null;
  pose: Pose;
  path: string;
  takenAt: string;
  /** Something an <img> can show: a signed URL (live) or a data URL (demo). */
  url: string | null;
}

/** A photo the client picked, ready to save. `preview` is a small data URL, `file` the full image. */
export interface PhotoUpload {
  pose: Pose;
  file: Blob;
  preview: string;
}

export interface ProgressState {
  checkIns: CheckIn[];
  measurements: Measurement[];
  photos: ProgressPhoto[];
  /** 0 = Monday … 6 = Sunday. */
  checkInDay: number;
}

export const emptyProgress = (): ProgressState => ({ checkIns: [], measurements: [], photos: [], checkInDay: 0 });

export const RATINGS: { key: RatingKey; label: string; low: string; high: string }[] = [
  { key: "energy", label: "Energy", low: "Drained", high: "Buzzing" },
  { key: "mood", label: "Mood", low: "Rough", high: "Great" },
  { key: "stress", label: "Stress", low: "Calm", high: "Maxed out" },
  { key: "hunger", label: "Hunger", low: "Never hungry", high: "Starving" },
  { key: "training", label: "Training", low: "Struggled", high: "Smashed it" },
  { key: "nutrition", label: "Nutrition", low: "Off plan", high: "On point" },
];

export const MEASURES: { key: MeasureKey; label: string; unit: string }[] = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "hipsCm", label: "Hips", unit: "cm" },
  { key: "armCm", label: "Arm", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
];

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_MS = 86400000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Monday = 0 … Sunday = 6, the same as workouts.day_index. */
export const weekday = (d: Date): number => (d.getDay() + 6) % 7;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface CheckInDue {
  due: boolean;
  /** The check-in day this is for (start of that day). */
  dueOn: Date;
  /** Whole days since it fell due; 0 on the day itself. */
  daysLate: number;
}

/**
 * Is a check-in waiting? It falls due on the client's check-in day and stays due until they send one.
 * Sending up to a day early counts for that week, so a Sunday-evening check-in covers Monday.
 */
export function checkInDue(lastSubmittedAt: string | null, checkInDay: number, now = new Date()): CheckInDue {
  const today = startOfDay(now);
  const back = (weekday(today) - checkInDay + 7) % 7;
  const dueOn = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  const daysLate = Math.round((today.getTime() - dueOn.getTime()) / DAY_MS);
  if (!lastSubmittedAt) return { due: true, dueOn, daysLate };
  const opens = dueOn.getTime() - DAY_MS;
  return { due: Date.parse(lastSubmittedAt) < opens, dueOn, daysLate };
}

export interface Point {
  at: string;
  value: number;
}

/** One measurement over time, oldest first, skipping entries where it wasn't taken. */
export function measurementSeries(measurements: Measurement[], key: MeasureKey): Point[] {
  return measurements
    .flatMap((m) => {
      const v = m[key];
      return v === null || v === undefined ? [] : [{ at: m.measuredAt, value: Number(v) }];
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface Change {
  first: number;
  last: number;
  /** last − first, to one decimal. */
  delta: number;
}

export function changeOver(series: Point[]): Change | null {
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) return null;
  return { first: first.value, last: last.value, delta: round1(last.value - first.value) };
}

/** "+1.2", "−0.8", "0". Uses a real minus sign. */
export const signed = (n: number): string => (n > 0 ? `+${round1(n)}` : n < 0 ? `−${round1(-n)}` : "0");

/** Check-ins newest first. */
export const newestFirst = (checkIns: CheckIn[]): CheckIn[] =>
  [...checkIns].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

export interface Flag {
  severity: "crit" | "warn";
  text: string;
}

/**
 * Rule-based flags a coach should look at. No AI: each one names the rule that fired,
 * so the UI labels them "Insight".
 */
export function checkInFlags(current: CheckIn, previous?: CheckIn): Flag[] {
  const flags: Flag[] = [];
  if (current.sleepHours !== null && current.sleepHours < 6) flags.push({ severity: "warn", text: `Sleeping ${current.sleepHours} h a night (under 6 h)` });
  if (current.stress !== null && current.stress >= 4) flags.push({ severity: current.stress === 5 ? "crit" : "warn", text: `Stress ${current.stress}/5` });
  if (current.energy !== null && previous?.energy != null && previous.energy - current.energy >= 2) {
    flags.push({ severity: "warn", text: `Energy dropped from ${previous.energy} to ${current.energy}` });
  }
  if (current.mood !== null && current.mood <= 2) flags.push({ severity: current.mood === 1 ? "crit" : "warn", text: `Mood ${current.mood}/5` });
  if (current.training !== null && current.training <= 2) flags.push({ severity: "warn", text: `Rated training ${current.training}/5` });
  if (current.hunger !== null && current.hunger >= 5) flags.push({ severity: "warn", text: "Hungry all the time" });
  if (current.weightKg !== null && previous?.weightKg != null && previous.weightKg > 0) {
    const pct = ((current.weightKg - previous.weightKg) / previous.weightKg) * 100;
    if (Math.abs(pct) >= 1.5) flags.push({ severity: "warn", text: `Weight ${signed(current.weightKg - previous.weightKg)} kg since last check-in (${signed(pct)}%)` });
  }
  return flags;
}

/** Side-by-side numbers against the previous check-in, for the coach's review. */
export function compareCheckIns(current: CheckIn, previous?: CheckIn): { label: string; now: string; change: string | null }[] {
  const rows: { label: string; now: string; change: string | null }[] = [];
  const add = (label: string, a: number | null, b: number | null | undefined, unit = "") => {
    if (a === null) return;
    rows.push({ label, now: `${a}${unit}`, change: b === null || b === undefined ? null : signed(a - b) });
  };
  add("Weight", current.weightKg, previous?.weightKg, " kg");
  add("Sleep", current.sleepHours, previous?.sleepHours, " h");
  for (const r of RATINGS) add(r.label, current[r.key], previous?.[r.key], "/5");
  return rows;
}

export interface PhotoSet {
  /** The check-in, or the day, the photos were taken. */
  key: string;
  takenAt: string;
  byPose: Partial<Record<Pose, ProgressPhoto>>;
}

/** Group photos by check-in (or by day for photos added on their own), oldest first. */
export function photoSets(photos: ProgressPhoto[]): PhotoSet[] {
  const sets = new Map<string, PhotoSet>();
  for (const p of [...photos].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))) {
    const key = p.checkInId ?? p.takenAt.slice(0, 10);
    const set = sets.get(key) ?? { key, takenAt: p.takenAt, byPose: {} };
    set.byPose[p.pose] = p;
    sets.set(key, set);
  }
  return [...sets.values()];
}

/** Storage path for a photo: the client's id first, so storage policies can tell whose it is. */
export const photoPath = (clientId: string, pose: Pose, id: string): string => `${clientId}/${id}-${pose}.jpg`;

/** Scale (w, h) down to fit inside a max × max box, keeping the shape. Never scales up. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** "Sun 26 Oct". */
export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// ───────────── database rows ─────────────

export interface CheckInRow {
  id: string;
  client_id: string;
  submitted_at: string;
  weight_kg: number | string | null;
  sleep_hours: number | string | null;
  energy: number | null;
  mood: number | null;
  stress: number | null;
  hunger: number | null;
  training: number | null;
  nutrition: number | null;
  wins: string | null;
  struggles: string | null;
  note: string | null;
  coach_reply: string | null;
  reviewed_at: string | null;
}

export interface MeasurementRow {
  id: string;
  client_id: string;
  check_in_id: string | null;
  measured_at: string;
  weight_kg: number | string | null;
  body_fat_pct: number | string | null;
  chest_cm: number | string | null;
  waist_cm: number | string | null;
  hips_cm: number | string | null;
  arm_cm: number | string | null;
  thigh_cm: number | string | null;
}

export interface PhotoRow {
  id: string;
  client_id: string;
  check_in_id: string | null;
  pose: Pose;
  storage_path: string;
  taken_at: string;
}

/* numeric columns come back from PostgREST as strings */
const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const text = (v: string | null | undefined) => (v ?? "").trim();
const textOrNull = (v: string) => (v.trim() ? v.trim() : null);

export const toCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id,
  submittedAt: r.submitted_at,
  weightKg: num(r.weight_kg),
  sleepHours: num(r.sleep_hours),
  energy: r.energy,
  mood: r.mood,
  stress: r.stress,
  hunger: r.hunger,
  training: r.training,
  nutrition: r.nutrition,
  wins: text(r.wins),
  struggles: text(r.struggles),
  note: text(r.note),
  coachReply: r.coach_reply,
  reviewedAt: r.reviewed_at,
});

export const toCheckInRow = (c: CheckInInput, clientId: string, id: string): Omit<CheckInRow, "submitted_at" | "coach_reply" | "reviewed_at"> => ({
  id,
  client_id: clientId,
  weight_kg: c.weightKg,
  sleep_hours: c.sleepHours,
  energy: c.energy,
  mood: c.mood,
  stress: c.stress,
  hunger: c.hunger,
  training: c.training,
  nutrition: c.nutrition,
  wins: textOrNull(c.wins),
  struggles: textOrNull(c.struggles),
  note: textOrNull(c.note),
});

const COLUMNS: Record<MeasureKey, keyof MeasurementRow> = {
  weightKg: "weight_kg", bodyFatPct: "body_fat_pct", chestCm: "chest_cm", waistCm: "waist_cm", hipsCm: "hips_cm", armCm: "arm_cm", thighCm: "thigh_cm",
};

export function toMeasurement(r: MeasurementRow): Measurement {
  const m: Measurement = { id: r.id, measuredAt: r.measured_at, checkInId: r.check_in_id };
  for (const { key } of MEASURES) m[key] = num(r[COLUMNS[key]] as number | string | null);
  return m;
}

export function toMeasurementRow(m: MeasurementInput, clientId: string, id: string, checkInId: string | null): Omit<MeasurementRow, "measured_at"> {
  const row = { id, client_id: clientId, check_in_id: checkInId } as Omit<MeasurementRow, "measured_at">;
  for (const { key } of MEASURES) (row as unknown as Record<string, number | null>)[COLUMNS[key]] = m[key] ?? null;
  return row;
}

/** True when at least one measurement was filled in. */
export const hasMeasurements = (m: MeasurementInput): boolean => MEASURES.some(({ key }) => m[key] !== null && m[key] !== undefined);

export const toPhoto = (r: PhotoRow, url: string | null = null): ProgressPhoto => ({
  id: r.id, checkInId: r.check_in_id, pose: r.pose, path: r.storage_path, takenAt: r.taken_at, url,
});

/** Parse a typed number ("62,4" works too). Empty or nonsense gives null. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ───────────── two-week blocks ─────────────

const FORTNIGHT_MS = 14 * DAY_MS;

export interface Fortnight {
  /** 0 for the first two weeks. */
  index: number;
  /** "Weeks 1–2". */
  label: string;
  from: Date;
  /** Last day of the block (inclusive). */
  to: Date;
  /** Every photo taken in the block, oldest first. */
  photos: ProgressPhoto[];
  /** The latest photo of each pose in the block: the one the block is compared by. */
  byPose: Partial<Record<Pose, ProgressPhoto>>;
  checkIns: CheckIn[];
  /** Latest value of each measurement taken in the block. */
  latest: Partial<Record<MeasureKey, number>>;
  /** Change in each measurement against the latest earlier value, to one decimal. */
  change: Partial<Record<MeasureKey, number>>;
  avgSleep: number | null;
  avgEnergy: number | null;
}

/** The first day anything was recorded, at the start of that day. Null when there is nothing yet. */
export function progressStart(p: Pick<ProgressState, "checkIns" | "measurements" | "photos">): Date | null {
  const times = [...p.checkIns.map((c) => c.submittedAt), ...p.measurements.map((m) => m.measuredAt), ...p.photos.map((x) => x.takenAt)]
    .map(Date.parse)
    .filter(Number.isFinite);
  return times.length ? startOfDay(new Date(Math.min(...times))) : null;
}

const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/**
 * Everything the client recorded, in two-week blocks counted from their first record, newest first.
 * Blocks with nothing in them are left out. Each block carries its photos, check-ins and measurements,
 * and how the measurements moved since the block before.
 */
export function fortnights(p: Pick<ProgressState, "checkIns" | "measurements" | "photos">): Fortnight[] {
  const start = progressStart(p);
  if (!start) return [];
  const indexOf = (iso: string) => Math.max(0, Math.floor((Date.parse(iso) - start.getTime()) / FORTNIGHT_MS));
  const blocks = new Map<number, Fortnight>();
  const block = (i: number): Fortnight => {
    let b = blocks.get(i);
    if (!b) {
      const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 14);
      const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 14 + 13);
      b = { index: i, label: `Weeks ${i * 2 + 1}–${i * 2 + 2}`, from, to, photos: [], byPose: {}, checkIns: [], latest: {}, change: {}, avgSleep: null, avgEnergy: null };
      blocks.set(i, b);
    }
    return b;
  };
  for (const ph of [...p.photos].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))) {
    const b = block(indexOf(ph.takenAt));
    b.photos.push(ph);
    b.byPose[ph.pose] = ph;
  }
  for (const c of p.checkIns) block(indexOf(c.submittedAt)).checkIns.push(c);
  for (const { key } of MEASURES) {
    for (const pt of measurementSeries(p.measurements, key)) block(indexOf(pt.at)).latest[key] = pt.value;
  }
  const ordered = [...blocks.values()].sort((a, b) => a.index - b.index);
  const lastSeen: Partial<Record<MeasureKey, number>> = {};
  for (const b of ordered) {
    b.checkIns.sort((x, y) => Date.parse(y.submittedAt) - Date.parse(x.submittedAt));
    b.avgSleep = avg(b.checkIns.map((c) => c.sleepHours));
    b.avgEnergy = avg(b.checkIns.map((c) => c.energy));
    for (const { key } of MEASURES) {
      const v = b.latest[key];
      if (v === undefined) continue;
      const before = lastSeen[key];
      if (before !== undefined) b.change[key] = round1(v - before);
      lastSeen[key] = v;
    }
  }
  return ordered.reverse();
}

/** "12 Oct – 25 Oct". */
export const blockDates = (b: Pick<Fortnight, "from" | "to">): string => {
  const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${f(b.from)} – ${f(b.to)}`;
};

/**
 * The default before/after pair for a pose: the first block that has that pose, and the latest one.
 * Null when fewer than two blocks have it.
 */
export function defaultPair(blocks: Fortnight[], pose: Pose): { before: Fortnight; after: Fortnight } | null {
  const withPose = blocks.filter((b) => b.byPose[pose]);
  const after = withPose[0];
  const before = withPose.at(-1);
  return after && before && after !== before ? { before, after } : null;
}
