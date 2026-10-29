import { describe, expect, it } from "vitest";
import { activityFromFile, fileKind, parseActivityFile, parseFit, parseGpx, parseTcx, sportFromText } from "./activityFiles";
import { createDemoActivityStore, fromActivityRow, toActivityRow } from "./activityStore";
import { decodePolyline, fromStravaActivity, stravaAuthorizeUrl, stravaSport } from "./strava";

const enc = (s: string) => new TextEncoder().encode(s);

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Some watch" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><name>Thames path &amp; back</name><type>running</type><trkseg>
    <trkpt lat="51.5000" lon="-0.1000"><ele>10</ele><time>2026-10-28T07:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="51.5045" lon="-0.1000"><ele>12</ele><time>2026-10-28T07:02:30Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="51.5090" lon="-0.1000"><ele>14</ele><time>2026-10-28T07:05:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

const TCX = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
 <Activities><Activity Sport="Biking"><Id>2026-10-28T09:00:00Z</Id>
  <Lap StartTime="2026-10-28T09:00:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Calories>150</Calories>
   <MaximumHeartRateBpm><Value>160</Value></MaximumHeartRateBpm>
   <Track>
    <Trackpoint><Time>2026-10-28T09:00:00Z</Time><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
    <Trackpoint><Time>2026-10-28T09:05:00Z</Time><DistanceMeters>2500</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
    <Trackpoint><Time>2026-10-28T09:10:00Z</Time><DistanceMeters>5000</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
   </Track>
  </Lap>
 </Activity></Activities>
</TrainingCenterDatabase>`;

/* A tiny FIT writer: just enough to build the files a watch saves. */
type Field = [num: number, type: number, value: number];
const SIZE: Record<number, number> = { 0x00: 1, 0x02: 1, 0x84: 2, 0x85: 4, 0x86: 4 };
function fit(messages: { local: number; global: number; fields: Field[]; defineOnly?: boolean }[], compressed: { local: number; offset: number; fields: Field[] }[] = []): Uint8Array {
  const body: number[] = [];
  const defined = new Set<number>();
  const write = (type: number, v: number) => {
    const b = new Uint8Array(SIZE[type]!);
    const dv = new DataView(b.buffer);
    if (type === 0x84) dv.setUint16(0, v, true);
    else if (type === 0x85) dv.setInt32(0, v, true);
    else if (type === 0x86) dv.setUint32(0, v, true);
    else dv.setUint8(0, v);
    body.push(...b);
  };
  for (const m of messages) {
    if (!defined.has(m.local)) {
      body.push(0x40 | m.local, 0, 0, m.global & 0xff, m.global >> 8, m.fields.length);
      for (const [n, t] of m.fields) body.push(n, SIZE[t]!, t);
      defined.add(m.local);
    }
    if (m.defineOnly) continue;
    body.push(m.local);
    for (const [, t, v] of m.fields) write(t, v);
  }
  for (const c of compressed) {
    body.push(0x80 | (c.local << 5) | c.offset);
    for (const [, t, v] of c.fields) write(t, v);
  }
  const head = new Uint8Array(14);
  const hv = new DataView(head.buffer);
  hv.setUint8(0, 14);
  hv.setUint8(1, 0x20);
  hv.setUint16(2, 2132, true);
  hv.setUint32(4, body.length, true);
  head.set(enc(".FIT"), 8);
  const out = new Uint8Array(14 + body.length + 2);
  out.set(head);
  out.set(body, 14);
  return out;
}

const FIT_EPOCH = 631065600;
const ts = (iso: string) => Date.parse(iso) / 1000 - FIT_EPOCH;
const semi = (deg: number) => Math.round((deg * 2 ** 31) / 180);

describe("file kind", () => {
  it("knows a file by what's in it, not only its name", () => {
    expect(fileKind("a.xml", enc(GPX))).toBe("gpx");
    expect(fileKind("a.xml", enc(TCX))).toBe("tcx");
    expect(fileKind("a.bin", fit([]))).toBe("fit");
    expect(fileKind("notes.txt", enc("hello"))).toBeNull();
  });

  it("explains a file it can't read", () => {
    expect(() => parseActivityFile("notes.txt", enc("hello"))).toThrow(/GPX, TCX or FIT/);
  });

  it("reads the sport from the words apps use", () => {
    expect(sportFromText("running")).toBe("run");
    expect(sportFromText("Biking")).toBe("ride");
    expect(sportFromText("open water swimming")).toBe("swim");
    expect(sportFromText("indoor_rowing")).toBe("row");
    expect(sportFromText("")).toBeNull();
  });
});

describe("GPX", () => {
  it("reads points, height, time and heart rate", () => {
    const t = parseGpx(GPX);
    expect(t.name).toBe("Thames path & back");
    expect(t.sport).toBe("run");
    expect(t.points).toHaveLength(3);
    expect(t.points[1]).toMatchObject({ lat: 51.5045, lon: -0.1, ele: 12, hr: 150 });
  });

  it("becomes a 1 km run at 5:00 /km", () => {
    const a = activityFromFile("run.gpx", enc(GPX), "g");
    expect(a.metres).toBeCloseTo(1001, -1);
    expect(a.movingSeconds).toBe(300);
    expect(a.elevationGainM).toBeDefined();
    expect(a.source).toBe("file");
  });
});

describe("TCX", () => {
  it("reads the sport, distance per point and lap totals", () => {
    const t = parseTcx(TCX);
    expect(t.sport).toBe("ride");
    expect(t.points.map((p) => p.dist)).toEqual([0, 2500, 5000]);
    expect(t.totals).toMatchObject({ calories: 150, maxHr: 160, startedAt: "2026-10-28T09:00:00.000Z" });
    const a = activityFromFile("ride.tcx", enc(TCX), "t");
    expect(a.metres).toBe(5000);
    expect(a.movingSeconds).toBe(600);
  });
});

describe("FIT", () => {
  const start = ts("2026-10-28T07:00:00Z");
  const record = (s: number, lat: number, dist: number, hr: number) => ({
    local: 0, global: 20,
    fields: [[253, 0x86, start + s], [0, 0x85, semi(lat)], [1, 0x85, semi(-0.1)], [5, 0x86, dist * 100], [3, 0x02, hr], [2, 0x84, (20 + 500) * 5]] as Field[],
  });
  const session = {
    local: 1, global: 18,
    fields: [[2, 0x86, start], [5, 0x00, 1], [6, 0x00, 0], [9, 0x86, 300000], [8, 0x86, 900000], [7, 0x86, 960000], [16, 0x02, 152], [17, 0x02, 171], [11, 0x84, 210], [22, 0x84, 35]] as Field[],
  };

  it("reads records and the session", () => {
    const t = parseFit(fit([record(0, 51.5, 0, 140), record(450, 51.5135, 1500, 150), record(900, 51.527, 3000, 160), session]));
    expect(t.sport).toBe("run");
    expect(t.points).toHaveLength(3);
    expect(t.points[1]!.lat).toBeCloseTo(51.5135, 5);
    expect(t.points[1]).toMatchObject({ dist: 1500, hr: 150, ele: 20 });
    expect(t.totals).toMatchObject({ metres: 3000, movingSeconds: 900, elapsedSeconds: 960, avgHr: 152, maxHr: 171, calories: 210, elevationGainM: 35 });
  });

  it("follows compressed timestamps", () => {
    const first = record(0, 51.5, 0, 140);
    // Compressed records use a definition without the timestamp field.
    const noTime = { local: 1, global: 20, fields: first.fields.slice(1), defineOnly: true };
    const t = parseFit(fit([first, noTime], [{ local: 1, offset: (start + 5) & 0x1f, fields: first.fields.slice(1) }]));
    expect(t.points[1]!.t! - t.points[0]!.t!).toBe(5000);
  });

  it("counts pool lengths when the session has no distance", () => {
    const swim = { local: 1, global: 18, fields: [[2, 0x86, start], [5, 0x00, 5], [6, 0x00, 17], [44, 0x84, 2500], [8, 0x86, 1800000]] as Field[] };
    const length = { local: 2, global: 101, fields: [[253, 0x86, start]] as Field[] };
    const t = parseFit(fit([swim, ...Array.from({ length: 40 }, () => length)]));
    expect(t.sport).toBe("swim");
    expect(t.poolLengthM).toBe(25);
    expect(t.totals.metres).toBe(1000);
  });

  it("stops cleanly on a damaged file", () => {
    const bad = fit([record(0, 51.5, 0, 140)]);
    bad[14] = 0x05; // a data message for a definition that never came
    expect(() => parseFit(bad)).toThrow(/damaged/);
  });
});

describe("Strava", () => {
  it("decodes Google's polyline example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  });

  it("maps sports, including the newer sport types", () => {
    expect(stravaSport({ sport_type: "TrailRun" })).toBe("run");
    expect(stravaSport({ sport_type: "GravelRide" })).toBe("ride");
    expect(stravaSport({ type: "Swim" })).toBe("swim");
    expect(stravaSport({ sport_type: "Yoga" })).toBe("other");
  });

  it("turns a Strava activity into an APEX one", () => {
    const a = fromStravaActivity({
      id: 123, name: "Lunch Run", sport_type: "Run", start_date: "2026-10-28T12:00:00Z", distance: 8012.4, moving_time: 2400, elapsed_time: 2500,
      total_elevation_gain: 41.2, average_heartrate: 151.3, max_heartrate: 176, map: { summary_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
      splits_metric: [{ split: 1, distance: 1000, moving_time: 300, elapsed_time: 305, average_heartrate: 145 }, { split: 9, distance: 12, moving_time: 4, elapsed_time: 4 }],
    }, "id-1");
    expect(a).toMatchObject({ id: "id-1", sport: "run", metres: 8012, movingSeconds: 2400, elevationGainM: 41, avgHr: 151, maxHr: 176, source: "strava", externalId: "123" });
    expect(a.detail?.route).toHaveLength(3);
    expect(a.detail?.splits).toEqual([{ n: 1, metres: 1000, seconds: 300, avgHr: 145 }]);
  });

  it("builds the sign-in link with read-only scopes", () => {
    const u = new URL(stravaAuthorizeUrl("42", "https://example.com/client/", "abc"));
    expect(u.searchParams.get("scope")).toBe("read,activity:read_all");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("redirect_uri")).toBe("https://example.com/client/");
  });
});

describe("activity store", () => {
  it("round-trips through a database row", () => {
    const a = activityFromFile("run.gpx", enc(GPX), "11111111-1111-1111-1111-111111111111");
    const row = toActivityRow({ ...a, rpe: 6, note: "Windy" }, "client");
    expect(fromActivityRow(row)).toEqual({ ...a, rpe: 6, note: "Windy" });
  });

  it("starts the demo with sample activities and keeps changes", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = createDemoActivityStore(storage);
    expect(s.get().activities.length).toBeGreaterThan(3);
    const first = s.get().activities[0]!;
    s.remove(first.id);
    s.setConnection({ provider: "strava", connectedAt: "2026-10-28T10:00:00Z", athleteName: "Priya" });
    const again = createDemoActivityStore(storage);
    expect(again.get().activities.some((a) => a.id === first.id)).toBe(false);
    expect(again.get().connections.find((c) => c.provider === "strava")?.athleteName).toBe("Priya");
  });
});
