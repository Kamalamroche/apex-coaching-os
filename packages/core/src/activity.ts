/* Cardio: runs, swims, rides, rows, walks and hikes. A client logs one by hand, uploads the file
   their watch saved (activityFiles.ts) or brings it in from Strava (strava.ts). Everything here is
   pure: a list of track points in, distance, pace, splits, elevation, heart-rate zones and best
   efforts out, so the numbers on screen can be checked by a test. */

export type Sport = "run" | "swim" | "ride" | "row" | "walk" | "hike" | "other";
export type ActivitySource = "manual" | "file" | "strava";

export const SPORTS: { id: Sport; label: string; verb: string }[] = [
  { id: "run", label: "Run", verb: "Run" },
  { id: "swim", label: "Swim", verb: "Swim" },
  { id: "ride", label: "Ride", verb: "Ride" },
  { id: "row", label: "Row", verb: "Row" },
  { id: "walk", label: "Walk", verb: "Walk" },
  { id: "hike", label: "Hike", verb: "Hike" },
  { id: "other", label: "Other", verb: "Workout" },
];

export const sportLabel = (s: Sport): string => SPORTS.find((x) => x.id === s)?.label ?? "Other";

/** One reading from a watch or bike computer. Any field can be missing. */
export interface TrackPoint {
  /** Unix time in ms. */
  t?: number;
  lat?: number;
  lon?: number;
  /** Metres above sea level. */
  ele?: number;
  hr?: number;
  /** Distance so far as the device measured it, in metres. Preferred over GPS when present. */
  dist?: number;
}

export interface Split {
  /** 1-based. */
  n: number;
  metres: number;
  seconds: number;
  avgHr?: number;
  /** Climb minus descent over the split. */
  elevationM?: number;
}

/** A point on the charts, sampled evenly by distance. */
export interface ProfilePoint {
  /** Metres from the start. */
  m: number;
  /** Moving seconds from the start. */
  s: number;
  ele?: number;
  hr?: number;
}

export interface BestEffort {
  label: string;
  metres: number;
  seconds: number;
}

export interface ActivityDetail {
  /** [lat, lon], thinned to at most ROUTE_POINTS. Missing for pool swims and treadmill runs. */
  route?: [number, number][];
  profile?: ProfilePoint[];
  splits?: Split[];
  /** Seconds in heart-rate zones 1 to 5. */
  hrZones?: number[];
  /** Max heart rate the zones were worked out from. */
  zonesMaxHr?: number;
  bests?: BestEffort[];
  poolLengthM?: number;
}

export interface Activity {
  id: string;
  sport: Sport;
  name: string;
  /** ISO time. */
  startedAt: string;
  metres: number;
  movingSeconds: number;
  elapsedSeconds: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  /** How hard it felt, 1 to 10. */
  rpe?: number;
  note?: string;
  source: ActivitySource;
  /** The provider's id, so the same activity is never brought in twice. */
  externalId?: string;
  detail?: ActivityDetail;
}

export const ROUTE_POINTS = 400;
export const PROFILE_POINTS = 120;

/** Below this speed (m/s) a gap between two points counts as stopped. */
const MOVING_SPEED: Record<Sport, number> = { run: 1, walk: 0.5, hike: 0.3, ride: 1.5, row: 0.8, swim: 0.2, other: 0.3 };
/** A gap longer than this with no reading is a paused watch, never moving time. */
const MAX_GAP_S = 60;

export const SPLIT_METRES: Record<Sport, number> = { run: 1000, walk: 1000, hike: 1000, ride: 5000, row: 500, swim: 100, other: 1000 };

const BEST_DISTANCES: Partial<Record<Sport, [string, number][]>> = {
  run: [["400 m", 400], ["1 km", 1000], ["1 mile", 1609.34], ["5 km", 5000], ["10 km", 10000], ["Half marathon", 21097.5], ["Marathon", 42195]],
  ride: [["10 km", 10000], ["20 km", 20000], ["40 km", 40000], ["100 km", 100000]],
  row: [["500 m", 500], ["2 km", 2000], ["5 km", 5000]],
  swim: [["100 m", 100], ["400 m", 400], ["1 km", 1000], ["1,500 m", 1500]],
};

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two points on the Earth. */
export function haversine(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const hasPos = (p: TrackPoint): p is TrackPoint & { lat: number; lon: number } => p.lat !== undefined && p.lon !== undefined;

/** Cumulative metres per point: the device's own distance when it has one, else GPS. */
export function cumulativeMetres(points: TrackPoint[]): number[] {
  const useDevice = points.filter((p) => p.dist !== undefined).length >= points.length * 0.5;
  const out: number[] = [];
  let total = 0;
  let lastPos: [number, number] | null = null;
  let lastDevice = 0;
  for (const p of points) {
    if (useDevice) {
      if (p.dist !== undefined && p.dist >= lastDevice) lastDevice = p.dist;
      total = lastDevice;
    } else if (hasPos(p)) {
      if (lastPos) total += haversine(lastPos, [p.lat, p.lon]);
      lastPos = [p.lat, p.lon];
    }
    out.push(total);
  }
  return out;
}

/** Moving seconds so far per point. Stops and paused-watch gaps don't count. */
export function cumulativeMoving(points: TrackPoint[], metres: number[], sport: Sport): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.t;
    const b = points[i]!.t;
    const dt = a !== undefined && b !== undefined ? (b - a) / 1000 : 0;
    const dm = metres[i]! - metres[i - 1]!;
    const moving = dt > 0 && dt <= MAX_GAP_S && dm / dt >= MOVING_SPEED[sport];
    out.push(out[i - 1]! + (moving ? dt : 0));
  }
  return out;
}

/** Height climbed, ignoring GPS wobble: smoothed over 5 points, then only rises of 2 m or more count. */
export function elevationGain(eles: number[]): number {
  if (eles.length < 2) return 0;
  const smooth = eles.map((_, i) => {
    const w = eles.slice(Math.max(0, i - 2), i + 3);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let gain = 0;
  let base = smooth[0]!;
  for (const e of smooth) {
    if (e - base >= 2) {
      gain += e - base;
      base = e;
    } else if (e < base) base = e;
  }
  return Math.round(gain);
}

/** Linear look-up: the y at x along increasing xs. */
function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]!) return ys[0]!;
  let lo = 0;
  let hi = xs.length - 1;
  if (x >= xs[hi]!) return ys[hi]!;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi]! - xs[lo]!;
  return span === 0 ? ys[lo]! : ys[lo]! + ((ys[hi]! - ys[lo]!) * (x - xs[lo]!)) / span;
}

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

export function splitsFor(points: TrackPoint[], metres: number[], moving: number[], every: number): Split[] {
  const total = metres.at(-1) ?? 0;
  if (total < every * 0.5) return [];
  const out: Split[] = [];
  let i = 0;
  for (let n = 1, from = 0; from < total - 1; n++, from += every) {
    const to = Math.min(total, from + every);
    // A last bit under 10% of a split is too short to read as a pace.
    if (to - from < every * 0.1 && out.length) break;
    const seconds = interp(metres, moving, to) - interp(metres, moving, from);
    const hrs: number[] = [];
    let eFrom: number | undefined;
    let eTo: number | undefined;
    for (; i < points.length && metres[i]! <= to; i++) {
      const p = points[i]!;
      if (p.hr) hrs.push(p.hr);
      if (p.ele !== undefined) { eFrom ??= p.ele; eTo = p.ele; }
    }
    out.push({
      n, metres: Math.round(to - from), seconds: Math.round(seconds),
      ...(hrs.length ? { avgHr: Math.round(avg(hrs)) } : {}),
      ...(eFrom !== undefined && eTo !== undefined ? { elevationM: Math.round(eTo - eFrom) } : {}),
    });
  }
  return out;
}

/** Fastest stretch of each standard distance the activity covers, by moving time. */
export function bestEfforts(metres: number[], moving: number[], sport: Sport): BestEffort[] {
  const total = metres.at(-1) ?? 0;
  const out: BestEffort[] = [];
  for (const [label, d] of BEST_DISTANCES[sport] ?? []) {
    if (total < d) continue;
    let best = Infinity;
    let j = 0;
    for (let i = 0; i < metres.length; i++) {
      // The earliest start j where the stretch j → i still covers d.
      while (j + 1 <= i && metres[i]! - metres[j + 1]! >= d) j++;
      if (metres[i]! - metres[j]! < d) continue;
      // Trim the overshoot so a long gap between points doesn't flatter or punish the effort.
      const startAt = metres[i]! - d;
      const s = moving[i]! - interp(metres, moving, startAt);
      if (s > 0 && s < best) best = s;
    }
    if (best < Infinity) out.push({ label, metres: d, seconds: Math.round(best) });
  }
  return out;
}

/** Zone 1 below 60% of max heart rate, then 70, 80, 90%: zone 5 is 90% and over. */
export function hrZoneOf(hr: number, maxHr: number): number {
  const pct = hr / maxHr;
  return pct < 0.6 ? 0 : pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.9 ? 3 : 4;
}

export const HR_ZONES = ["Easy", "Aerobic", "Tempo", "Threshold", "Max"] as const;

export function hrZoneSeconds(points: TrackPoint[], moving: number[], maxHr: number): number[] {
  const z = [0, 0, 0, 0, 0];
  for (let i = 1; i < points.length; i++) {
    const hr = points[i]!.hr;
    const dt = moving[i]! - moving[i - 1]!;
    if (hr && dt > 0) z[hrZoneOf(hr, maxHr)]! += dt;
  }
  return z.map(Math.round);
}

/** Every nth point, always keeping the last, so a long ride still draws quickly. */
export function thin<T>(xs: T[], max: number): T[] {
  if (xs.length <= max) return xs;
  const step = (xs.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, k) => xs[Math.round(k * step)]!);
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export interface TrackMeta {
  id: string;
  sport: Sport;
  name?: string;
  source: ActivitySource;
  /** Max heart rate for the zones. Missing: the higher of the activity's own max and 185. */
  maxHr?: number;
  /** Totals the device worked out itself (a FIT session, a TCX lap). Used where the track can't say. */
  totals?: Partial<Pick<Activity, "metres" | "movingSeconds" | "elapsedSeconds" | "elevationGainM" | "avgHr" | "maxHr" | "calories" | "startedAt">>;
  poolLengthM?: number;
  externalId?: string;
}

/** Turns a recorded track into an activity with its splits, charts, zones and best efforts. */
export function activityFromTrack(points: TrackPoint[], meta: TrackMeta): Activity {
  const pts = points.filter((p) => p.t === undefined || Number.isFinite(p.t));
  const metres = cumulativeMetres(pts);
  const moving = cumulativeMoving(pts, metres, meta.sport);
  const times = pts.map((p) => p.t).filter((t): t is number => t !== undefined);
  const hrs = pts.map((p) => p.hr).filter((h): h is number => !!h && h > 30 && h < 240);
  const eles = pts.map((p) => p.ele).filter((e): e is number => e !== undefined && Number.isFinite(e));
  const t = meta.totals ?? {};
  const trackMetres = metres.at(-1) ?? 0;
  const trackMoving = moving.at(-1) ?? 0;
  const elapsed = times.length > 1 ? (times.at(-1)! - times[0]!) / 1000 : 0;
  const maxHr = hrs.length ? Math.max(...hrs) : undefined;
  const zonesMaxHr = meta.maxHr ?? Math.max(maxHr ?? 0, 185);
  const route = pts.filter(hasPos).map((p) => [round5(p.lat), round5(p.lon)] as [number, number]);
  const profile: ProfilePoint[] = [];
  if (trackMetres > 0) {
    let i = 0;
    for (let k = 0; k < PROFILE_POINTS; k++) {
      const m = (trackMetres * k) / (PROFILE_POINTS - 1);
      while (i < pts.length - 1 && metres[i + 1]! <= m) i++;
      const p = pts[i]!;
      profile.push({ m: Math.round(m), s: Math.round(interp(metres, moving, m)), ...(p.ele !== undefined ? { ele: Math.round(p.ele * 10) / 10 } : {}), ...(p.hr ? { hr: p.hr } : {}) });
    }
  }
  const startedAt = t.startedAt ?? (times.length ? new Date(times[0]!).toISOString() : new Date().toISOString());
  const splits = trackMetres > 0 && trackMoving > 0 ? splitsFor(pts, metres, moving, SPLIT_METRES[meta.sport]) : [];
  const bests = trackMoving > 0 ? bestEfforts(metres, moving, meta.sport) : [];
  const detail: ActivityDetail = {
    ...(route.length > 1 ? { route: thin(route, ROUTE_POINTS) } : {}),
    ...(profile.length && trackMoving > 0 ? { profile } : {}),
    ...(splits.length ? { splits } : {}),
    ...(hrs.length && trackMoving > 0 ? { hrZones: hrZoneSeconds(pts, moving, zonesMaxHr), zonesMaxHr } : {}),
    ...(bests.length ? { bests } : {}),
    ...(meta.poolLengthM ? { poolLengthM: meta.poolLengthM } : {}),
  };
  const avgHr = t.avgHr ?? (hrs.length ? Math.round(avg(hrs)) : undefined);
  const gain = t.elevationGainM ?? (eles.length > 1 ? elevationGain(eles) : undefined);
  return {
    id: meta.id,
    sport: meta.sport,
    name: meta.name?.trim() || defaultName(meta.sport, startedAt),
    startedAt,
    metres: Math.round(t.metres ?? trackMetres),
    movingSeconds: Math.round(t.movingSeconds ?? (trackMoving || elapsed)),
    elapsedSeconds: Math.round(t.elapsedSeconds ?? elapsed),
    ...(gain !== undefined ? { elevationGainM: gain } : {}),
    ...(avgHr ? { avgHr } : {}),
    ...((t.maxHr ?? maxHr) ? { maxHr: t.maxHr ?? maxHr } : {}),
    ...(t.calories ? { calories: t.calories } : {}),
    source: meta.source,
    ...(meta.externalId ? { externalId: meta.externalId } : {}),
    ...(Object.keys(detail).length ? { detail } : {}),
  };
}

/** "Morning run", "Evening swim", by the local hour it started. */
export function defaultName(sport: Sport, startedAt: string): string {
  const h = new Date(startedAt).getHours();
  const part = h < 5 ? "Night" : h < 12 ? "Morning" : h < 14 ? "Lunch" : h < 18 ? "Afternoon" : h < 22 ? "Evening" : "Night";
  const what = sport === "other" ? "workout" : sportLabel(sport).toLowerCase();
  return `${part} ${what}`;
}

export interface ManualActivityInput {
  id: string;
  sport: Sport;
  name?: string;
  startedAt: string;
  /** Kilometres, or metres for a swim. */
  distance: number;
  seconds: number;
  avgHr?: number;
  rpe?: number;
  note?: string;
}

export function manualActivity(i: ManualActivityInput): Activity {
  const metres = i.sport === "swim" ? i.distance : i.distance * 1000;
  return {
    id: i.id, sport: i.sport, name: i.name?.trim() || defaultName(i.sport, i.startedAt), startedAt: i.startedAt,
    metres: Math.max(0, Math.round(metres)), movingSeconds: Math.max(0, Math.round(i.seconds)), elapsedSeconds: Math.max(0, Math.round(i.seconds)),
    ...(i.avgHr ? { avgHr: Math.round(i.avgHr) } : {}),
    ...(i.rpe ? { rpe: i.rpe } : {}),
    ...(i.note?.trim() ? { note: i.note.trim() } : {}),
    source: "manual",
  };
}

/* ---------- Formatting ---------- */

/** 42:10, or 1:02:15 from an hour. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "5.02 km" or "1,500 m" for a swim and anything under a kilometre. */
export function formatDistance(metres: number, sport?: Sport): string {
  if (sport === "swim" || metres < 1000) return `${Math.round(metres).toLocaleString("en-GB")} m`;
  const km = metres / 1000;
  return `${km >= 100 ? km.toFixed(0) : km.toFixed(2)} km`;
}

/** The way each sport talks about speed: /km for running, /100 m for swimming, /500 m for rowing, km/h on a bike. */
export function formatPace(metres: number, seconds: number, sport: Sport): string {
  if (metres <= 0 || seconds <= 0) return "–";
  if (sport === "ride") return `${((metres / seconds) * 3.6).toFixed(1)} km/h`;
  const per = sport === "swim" ? 100 : sport === "row" ? 500 : 1000;
  const unit = sport === "swim" ? "/100 m" : sport === "row" ? "/500 m" : "/km";
  return `${formatDuration((seconds / metres) * per)} ${unit}`;
}

export const paceLabel = (sport: Sport): string => (sport === "ride" ? "Speed" : "Pace");

/* ---------- Weeks and records ---------- */

/** Monday 00:00 local time of the week `date` is in. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export interface SportWeek {
  sport: Sport;
  count: number;
  metres: number;
  seconds: number;
}

/** This week's totals per sport, busiest first. */
export function weekTotals(list: Activity[], now = new Date()): SportWeek[] {
  const from = weekStart(now).getTime();
  const by = new Map<Sport, SportWeek>();
  for (const a of list) {
    const t = new Date(a.startedAt).getTime();
    if (t < from || t > now.getTime() + 86400000) continue;
    const w = by.get(a.sport) ?? { sport: a.sport, count: 0, metres: 0, seconds: 0 };
    by.set(a.sport, { ...w, count: w.count + 1, metres: w.metres + a.metres, seconds: w.seconds + a.movingSeconds });
  }
  return [...by.values()].sort((a, b) => b.seconds - a.seconds);
}

/** Distance per week for the last `weeks` weeks, oldest first: the bars on the Cardio screen. */
export function weeklyMetres(list: Activity[], sport: Sport | "all", weeks = 8, now = new Date()): { week: Date; metres: number }[] {
  const start = weekStart(now);
  const out = Array.from({ length: weeks }, (_, k) => {
    const w = new Date(start);
    w.setDate(w.getDate() - 7 * (weeks - 1 - k));
    return { week: w, metres: 0 };
  });
  for (const a of list) {
    if (sport !== "all" && a.sport !== sport) continue;
    const ws = weekStart(new Date(a.startedAt)).getTime();
    const slot = out.find((o) => o.week.getTime() === ws);
    if (slot) slot.metres += a.metres;
  }
  return out;
}

export interface NewBest extends BestEffort {
  /** The time it beat. */
  previousSeconds: number;
}

/** Best efforts in `a` that beat every earlier effort at that distance. A first-ever effort isn't a PB yet: there's nothing to beat. */
export function newBests(a: Activity, list: Activity[]): NewBest[] {
  const earlier = list.filter((x) => x.id !== a.id && x.sport === a.sport && x.startedAt < a.startedAt);
  return (a.detail?.bests ?? []).flatMap((b) => {
    const prev = earlier.flatMap((x) => x.detail?.bests ?? []).filter((y) => y.metres === b.metres).map((y) => y.seconds);
    const previous = prev.length ? Math.min(...prev) : undefined;
    if (previous === undefined || b.seconds >= previous) return [];
    return [{ ...b, previousSeconds: previous }];
  });
}

/** Newest first. Same external id from the same source counts once. */
export function mergeActivities(list: Activity[], incoming: Activity[]): Activity[] {
  const key = (a: Activity) => (a.externalId ? `${a.source}:${a.externalId}` : `id:${a.id}`);
  const by = new Map(list.map((a) => [key(a), a]));
  for (const a of incoming) {
    const old = by.get(key(a));
    // Keep the id, how-it-felt and note the client gave it if it comes in again.
    by.set(key(a), old ? { ...a, id: old.id, ...(old.rpe ? { rpe: old.rpe } : {}), ...(old.note ? { note: old.note } : {}) } : a);
  }
  return [...by.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
