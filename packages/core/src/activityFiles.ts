/* Reads the files watches and bike computers save, without a library:
   - GPX (Strava, Apple Watch apps, Komoot, most phones): track points with time, height and heart rate;
   - TCX (Garmin, Polar, Wahoo exports): track points plus the device's own distance and lap totals;
   - FIT (the native format of Garmin, Coros, Wahoo, Suunto, Zwift): binary records, sessions and pool lengths.
   Each gives track points and the device's own totals, which activityFromTrack turns into an activity. */

import { activityFromTrack, type Activity, type Sport, type TrackMeta, type TrackPoint } from "./activity";

export interface ParsedTrack {
  sport: Sport;
  name?: string;
  points: TrackPoint[];
  totals: NonNullable<TrackMeta["totals"]>;
  poolLengthM?: number;
}

export type ActivityFileKind = "gpx" | "tcx" | "fit";

export function fileKind(name: string, bytes: Uint8Array): ActivityFileKind | null {
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(8, 12)) === ".FIT") return "fit";
  const head = new TextDecoder().decode(bytes.subarray(0, 2000)).toLowerCase();
  if (head.includes("<gpx")) return "gpx";
  if (head.includes("<trainingcenterdatabase")) return "tcx";
  const ext = name.toLowerCase().split(".").pop();
  return ext === "gpx" || ext === "tcx" || ext === "fit" ? ext : null;
}

/** Reads any supported file. Throws a message the client can read when it can't. */
export function parseActivityFile(name: string, bytes: Uint8Array): ParsedTrack {
  const kind = fileKind(name, bytes);
  if (!kind) throw new Error("That isn't a GPX, TCX or FIT file. Export the activity from your watch app and try again.");
  const track = kind === "fit" ? parseFit(bytes) : kind === "gpx" ? parseGpx(new TextDecoder().decode(bytes)) : parseTcx(new TextDecoder().decode(bytes));
  if (!track.points.length && !track.totals.metres && !track.totals.movingSeconds) throw new Error("The file has no track or totals in it.");
  return track;
}

export function activityFromFile(name: string, bytes: Uint8Array, id: string, opts: { sport?: Sport; maxHr?: number } = {}): Activity {
  const t = parseActivityFile(name, bytes);
  return activityFromTrack(t.points, { id, sport: opts.sport ?? t.sport, name: t.name, source: "file", totals: t.totals, poolLengthM: t.poolLengthM, maxHr: opts.maxHr });
}

/* ---------- GPX and TCX ---------- */

const num = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
};
const tag = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i").exec(xml);
  return m?.[1];
};
const attr = (open: string, name: string): string | undefined => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(open)?.[1];
const unescape = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
const time = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? t : undefined;
};

/** Sport from the words apps put in <type> or Sport="…". */
export function sportFromText(s: string | undefined): Sport | null {
  const v = (s ?? "").toLowerCase();
  if (!v) return null;
  if (/swim/.test(v)) return "swim";
  if (/row/.test(v)) return "row";
  if (/hik/.test(v)) return "hike";
  if (/walk/.test(v)) return "walk";
  if (/run|jog/.test(v)) return "run";
  if (/bik|cycl|ride|biking/.test(v)) return "ride";
  return null;
}

export function parseGpx(xml: string): ParsedTrack {
  const trk = tag(xml, "trk") ?? xml;
  const name = tag(trk, "name");
  const points: TrackPoint[] = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?trkpt>)/gi)) {
    const open = m[1] ?? "";
    const body = m[2] ?? "";
    const p: TrackPoint = {};
    const lat = num(attr(open, "lat"));
    const lon = num(attr(open, "lon"));
    if (lat !== undefined && lon !== undefined) { p.lat = lat; p.lon = lon; }
    const ele = num(tag(body, "ele"));
    if (ele !== undefined) p.ele = ele;
    const t = time(tag(body, "time"));
    if (t !== undefined) p.t = t;
    // Garmin's TrackPointExtension, and the plain <hr> some apps write.
    const hr = num(tag(body, "hr")) ?? num(tag(body, "heartrate"));
    if (hr) p.hr = hr;
    points.push(p);
  }
  return { sport: sportFromText(tag(trk, "type")) ?? sportFromText(name) ?? "run", name: name ? unescape(name) : undefined, points, totals: {} };
}

export function parseTcx(xml: string): ParsedTrack {
  const act = /<Activity\b([^>]*)>/i.exec(xml);
  const sport = sportFromText(attr(act?.[1] ?? "", "Sport")) ?? "run";
  const points: TrackPoint[] = [];
  for (const m of xml.matchAll(/<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi)) {
    const b = m[1] ?? "";
    const p: TrackPoint = {};
    const t = time(tag(b, "Time"));
    if (t !== undefined) p.t = t;
    const lat = num(tag(b, "LatitudeDegrees"));
    const lon = num(tag(b, "LongitudeDegrees"));
    if (lat !== undefined && lon !== undefined) { p.lat = lat; p.lon = lon; }
    const ele = num(tag(b, "AltitudeMeters"));
    if (ele !== undefined) p.ele = ele;
    const dist = num(tag(b, "DistanceMeters"));
    if (dist !== undefined) p.dist = dist;
    const hrBlock = tag(b, "HeartRateBpm");
    const hr = hrBlock ? num(tag(hrBlock, "Value")) : undefined;
    if (hr) p.hr = hr;
    points.push(p);
  }
  // Lap totals: what the device itself counted, which beats re-adding GPS on a treadmill or in a pool.
  let metres = 0;
  let seconds = 0;
  let calories = 0;
  let laps = 0;
  let maxHr = 0;
  for (const m of xml.matchAll(/<Lap\b[^>]*>([\s\S]*?)<\/Lap>/gi)) {
    const b = (m[1] ?? "").replace(/<Track\b[\s\S]*?<\/Track>/gi, "");
    metres += num(tag(b, "DistanceMeters")) ?? 0;
    seconds += num(tag(b, "TotalTimeSeconds")) ?? 0;
    calories += num(tag(b, "Calories")) ?? 0;
    const mx = tag(b, "MaximumHeartRateBpm");
    maxHr = Math.max(maxHr, (mx ? num(tag(mx, "Value")) : 0) ?? 0);
    laps++;
  }
  const start = time(attr(/<Lap\b([^>]*)>/i.exec(xml)?.[1] ?? "", "StartTime"));
  const noTrack = !points.some((p) => p.lat !== undefined || p.dist !== undefined);
  const totals: ParsedTrack["totals"] = {
    ...(laps && calories ? { calories: Math.round(calories) } : {}),
    ...(laps && maxHr ? { maxHr } : {}),
    ...(start !== undefined ? { startedAt: new Date(start).toISOString() } : {}),
    // With no distance per point, only the laps know how far it went.
    ...(laps && noTrack && metres ? { metres } : {}),
    ...(laps && noTrack && seconds ? { movingSeconds: seconds, elapsedSeconds: seconds } : {}),
  };
  const notes = tag(xml, "Notes");
  return { sport, name: notes ? unescape(notes).split("\n")[0] : undefined, points, totals };
}

/* ---------- FIT ---------- */

/** Seconds between the Unix epoch and FIT's (31 Dec 1989 UTC). */
const FIT_EPOCH = 631065600;
const SEMICIRCLE = 180 / 2 ** 31;

interface FitField {
  num: number;
  size: number;
  type: number;
}
interface FitDef {
  global: number;
  little: boolean;
  fields: FitField[];
  devBytes: number;
}

const BASE_SIZE: Record<number, number> = { 0x00: 1, 0x01: 1, 0x02: 1, 0x0a: 1, 0x0d: 1, 0x83: 2, 0x84: 2, 0x8b: 2, 0x85: 4, 0x86: 4, 0x8c: 4, 0x88: 4, 0x89: 8, 0x8e: 8, 0x8f: 8, 0x90: 8 };

function readValue(v: DataView, at: number, f: FitField, little: boolean): number | undefined {
  const size = BASE_SIZE[f.type & 0xff];
  if (!size || size !== f.size) return undefined;
  let n: number;
  switch (f.type & 0xff) {
    case 0x00: case 0x02: n = v.getUint8(at); return n === 0xff ? undefined : n;
    case 0x0a: case 0x0d: n = v.getUint8(at); return n === 0 ? undefined : n;
    case 0x01: n = v.getInt8(at); return n === 0x7f ? undefined : n;
    case 0x83: n = v.getInt16(at, little); return n === 0x7fff ? undefined : n;
    case 0x84: n = v.getUint16(at, little); return n === 0xffff ? undefined : n;
    case 0x8b: n = v.getUint16(at, little); return n === 0 ? undefined : n;
    case 0x85: n = v.getInt32(at, little); return n === 0x7fffffff ? undefined : n;
    case 0x86: n = v.getUint32(at, little); return n === 0xffffffff ? undefined : n;
    case 0x8c: n = v.getUint32(at, little); return n === 0 ? undefined : n;
    case 0x88: n = v.getFloat32(at, little); return Number.isFinite(n) ? n : undefined;
    case 0x89: n = v.getFloat64(at, little); return Number.isFinite(n) ? n : undefined;
    default: return undefined; // 64-bit integers: no field we read uses them
  }
}

const FIT_SPORT: Record<number, Sport> = { 1: "run", 2: "ride", 5: "swim", 11: "walk", 15: "row", 17: "hike" };
/** Sub-sports that say more than the sport: indoor rowing, treadmill, indoor cycling, lap swimming. */
const FIT_SUB_SPORT: Record<number, Sport> = { 1: "run", 6: "ride", 14: "row", 17: "swim", 18: "swim" };

/** Parses a FIT activity file. Only the messages APEX uses: record (20), lap (19), session (18), length (101). */
export function parseFit(bytes: Uint8Array): ParsedTrack {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14) throw new Error("This FIT file is empty or cut short.");
  const headerSize = v.getUint8(0);
  const dataSize = v.getUint32(4, true);
  const end = Math.min(bytes.length, headerSize + dataSize);
  const defs = new Map<number, FitDef>();
  const points: TrackPoint[] = [];
  const sessions: Record<number, number>[] = [];
  let lengths = 0;
  let lastTs = 0;
  let pos = headerSize;
  while (pos < end) {
    const h = v.getUint8(pos++);
    if (h & 0x80) {
      // Compressed timestamp header: a data message whose time is an offset from the last full timestamp.
      const def = defs.get((h >> 5) & 0x03);
      if (!def) throw new Error("This FIT file is damaged.");
      const offset = h & 0x1f;
      let ts = (lastTs & ~0x1f) + offset;
      if (offset < (lastTs & 0x1f)) ts += 0x20;
      lastTs = ts;
      pos = readMessage(v, pos, def, ts);
      continue;
    }
    const local = h & 0x0f;
    if (h & 0x40) {
      const little = v.getUint8(pos + 1) === 0;
      const global = v.getUint16(pos + 2, little);
      const count = v.getUint8(pos + 4);
      pos += 5;
      const fields: FitField[] = [];
      for (let i = 0; i < count; i++, pos += 3) fields.push({ num: v.getUint8(pos), size: v.getUint8(pos + 1), type: v.getUint8(pos + 2) });
      let devBytes = 0;
      if (h & 0x20) {
        const dev = v.getUint8(pos++);
        for (let i = 0; i < dev; i++, pos += 3) devBytes += v.getUint8(pos + 1);
      }
      defs.set(local, { global, little, fields, devBytes });
      continue;
    }
    const def = defs.get(local);
    if (!def) throw new Error("This FIT file is damaged.");
    pos = readMessage(v, pos, def, undefined);
  }

  function readMessage(view: DataView, at: number, def: FitDef, compressedTs: number | undefined): number {
    const f: Record<number, number> = {};
    for (const field of def.fields) {
      if (at + field.size > view.byteLength) throw new Error("This FIT file is cut short.");
      const val = readValue(view, at, field, def.little);
      if (val !== undefined) f[field.num] = val;
      at += field.size;
    }
    at += def.devBytes;
    if (f[253] !== undefined) lastTs = f[253];
    const ts = f[253] ?? compressedTs;
    if (def.global === 20) {
      const p: TrackPoint = {};
      if (ts !== undefined) p.t = (ts + FIT_EPOCH) * 1000;
      if (f[0] !== undefined && f[1] !== undefined) { p.lat = f[0] * SEMICIRCLE; p.lon = f[1] * SEMICIRCLE; }
      const alt = f[78] ?? f[2];
      if (alt !== undefined) p.ele = alt / 5 - 500;
      if (f[3]) p.hr = f[3];
      if (f[5] !== undefined) p.dist = f[5] / 100;
      points.push(p);
    } else if (def.global === 18) {
      sessions.push(f);
    } else if (def.global === 101) {
      lengths++;
    }
    return at;
  }

  // Multisport files have a session each; the first is the main one.
  const s = sessions[0] ?? {};
  const sport = FIT_SUB_SPORT[s[6] ?? -1] ?? FIT_SPORT[s[5] ?? -1] ?? "other";
  const poolLengthM = s[44] ? s[44] / 100 : undefined;
  const totals: ParsedTrack["totals"] = {
    ...(s[2] !== undefined ? { startedAt: new Date((s[2] + FIT_EPOCH) * 1000).toISOString() } : {}),
    ...(s[9] !== undefined ? { metres: s[9] / 100 } : poolLengthM && lengths ? { metres: poolLengthM * lengths } : {}),
    ...(s[8] !== undefined ? { movingSeconds: s[8] / 1000 } : {}),
    ...(s[7] !== undefined ? { elapsedSeconds: s[7] / 1000 } : {}),
    ...(s[22] !== undefined ? { elevationGainM: s[22] } : {}),
    ...(s[16] ? { avgHr: s[16] } : {}),
    ...(s[17] ? { maxHr: s[17] } : {}),
    ...(s[11] ? { calories: s[11] } : {}),
  };
  return { sport, points, totals, ...(poolLengthM ? { poolLengthM } : {}) };
}
