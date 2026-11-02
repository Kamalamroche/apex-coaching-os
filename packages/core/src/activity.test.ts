import { describe, expect, it } from "vitest";
import {
  activityFromTrack, activityLoad, loadVsUsual, bestEfforts, cumulativeMetres, cumulativeMoving, defaultName, elevationGain, formatDistance, formatDuration, formatPace, haversine,
  hrZoneOf, manualActivity, mergeActivities, newBests, splitsFor, thin, weekStart, weekTotals, weeklyMetres, type Activity, type TrackPoint,
} from "./activity";
import { sampleActivities } from "./data/activities";

/** A straight line north at a steady speed: one point every `dt` seconds. */
function line(metres: number, speed: number, dt = 5, from = Date.UTC(2026, 9, 28, 7)): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let s = 0; s * speed <= metres; s += dt) pts.push({ t: from + s * 1000, lat: 51.5 + (s * speed) / 111195, lon: -0.1, ele: 20, hr: 150 });
  return pts;
}

describe("distance and time", () => {
  it("measures a degree of latitude at about 111 km", () => {
    expect(haversine([51, 0], [52, 0])).toBeCloseTo(111195, -2);
  });

  it("adds up GPS distance, or uses the device's own when it has one", () => {
    expect(cumulativeMetres(line(1005, 3)).at(-1)).toBeCloseTo(1005, -1);
    expect(cumulativeMetres([{ dist: 0 }, { dist: 25 }, { dist: 50 }]).at(-1)).toBe(50);
  });

  it("leaves stops and a paused watch out of moving time", () => {
    const pts = line(500, 2.5, 5);
    const last = pts.at(-1)!;
    // Stand still for 30 s, then pause the watch for 10 minutes.
    pts.push({ ...last, t: last.t! + 30000 }, { ...last, t: last.t! + 630000 });
    const m = cumulativeMetres(pts);
    expect(cumulativeMoving(pts, m, "run").at(-1)).toBe(200);
  });

  it("ignores GPS wobble when adding up the climb", () => {
    expect(elevationGain([10, 10.5, 10, 10.6, 10, 10.4])).toBe(0);
    // Up 20 m, down 10, up 10 again: 30 m climbed, a little less once smoothed.
    const hill = [...Array.from({ length: 41 }, (_, i) => i / 2), ...Array.from({ length: 20 }, (_, i) => 19.5 - i / 2), ...Array.from({ length: 21 }, (_, i) => 10 + i / 2)];
    expect(elevationGain(hill)).toBeGreaterThanOrEqual(25);
    expect(elevationGain(hill)).toBeLessThanOrEqual(30);
  });
});

describe("splits and best efforts", () => {
  const pts = line(5200, 3.333, 3);
  const m = cumulativeMetres(pts);
  const mv = cumulativeMoving(pts, m, "run");

  it("gives one split per km and a short last one", () => {
    const s = splitsFor(pts, m, mv, 1000);
    expect(s.map((x) => x.metres)).toEqual([1000, 1000, 1000, 1000, 1000, expect.any(Number)]);
    expect(s[0]!.seconds).toBeCloseTo(300, -1);
    expect(s[0]!.avgHr).toBe(150);
  });

  it("finds the fastest 1 km and 5 km", () => {
    const b = bestEfforts(m, mv, "run");
    expect(b.map((x) => x.label)).toEqual(["400 m", "1 km", "1 mile", "5 km"]);
    expect(b.find((x) => x.label === "5 km")!.seconds).toBeCloseTo(1500, -1);
  });

  it("puts heart rate in zones by % of max", () => {
    expect(hrZoneOf(100, 200)).toBe(0);
    expect(hrZoneOf(130, 200)).toBe(1);
    expect(hrZoneOf(185, 200)).toBe(4);
  });
});

describe("activityFromTrack", () => {
  it("fills in distance, pace, splits, route and zones", () => {
    const a = activityFromTrack(line(3000, 3, 4), { id: "a", sport: "run", source: "file", maxHr: 190 });
    expect(a.metres).toBeCloseTo(3000, -1);
    expect(a.movingSeconds).toBeCloseTo(1000, -1);
    expect(a.avgHr).toBe(150);
    expect(a.detail?.splits).toHaveLength(3);
    expect(a.detail?.route!.length).toBeLessThanOrEqual(400);
    expect(a.detail?.profile).toHaveLength(120);
    expect(a.detail?.hrZones![2]).toBeGreaterThan(900);
  });

  it("lets the device's own totals win", () => {
    const a = activityFromTrack(line(1000, 3), { id: "a", sport: "run", source: "file", totals: { metres: 1234, calories: 80 } });
    expect(a.metres).toBe(1234);
    expect(a.calories).toBe(80);
  });

  it("names an unnamed activity by time of day", () => {
    expect(defaultName("run", new Date(2026, 9, 28, 7).toISOString())).toBe("Morning run");
    expect(defaultName("swim", new Date(2026, 9, 28, 19).toISOString())).toBe("Evening swim");
  });
});

describe("formatting", () => {
  it("talks about pace the way each sport does", () => {
    expect(formatPace(5000, 1500, "run")).toBe("5:00 /km");
    expect(formatPace(2000, 2400, "swim")).toBe("2:00 /100 m");
    expect(formatPace(2000, 480, "row")).toBe("2:00 /500 m");
    expect(formatPace(30000, 3600, "ride")).toBe("30.0 km/h");
  });

  it("formats distance and time", () => {
    expect(formatDistance(5023)).toBe("5.02 km");
    expect(formatDistance(1500, "swim")).toBe("1,500 m");
    expect(formatDuration(2530)).toBe("42:10");
    expect(formatDuration(3735)).toBe("1:02:15");
  });
});

describe("manual entry", () => {
  it("reads km for most sports and metres for a swim", () => {
    expect(manualActivity({ id: "m", sport: "run", startedAt: "2026-10-28T07:00:00Z", distance: 5, seconds: 1500 }).metres).toBe(5000);
    expect(manualActivity({ id: "m", sport: "swim", startedAt: "2026-10-28T07:00:00Z", distance: 1500, seconds: 1800 }).metres).toBe(1500);
  });
});

describe("weeks, bests and merging", () => {
  const now = new Date(2026, 9, 29, 12); // a Thursday
  const act = (id: string, daysAgo: number, metres: number, extra: Partial<Activity> = {}): Activity => ({
    id, sport: "run", name: id, startedAt: new Date(now.getTime() - daysAgo * 86400000).toISOString(), metres, movingSeconds: metres / 3, elapsedSeconds: metres / 3, source: "manual", ...extra,
  });

  it("starts the week on Monday", () => {
    expect(weekStart(now).getDay()).toBe(1);
    expect(weekStart(now).getDate()).toBe(26);
  });

  it("totals this week only", () => {
    const w = weekTotals([act("a", 0, 5000), act("b", 2, 3000), act("c", 8, 10000)], now);
    expect(w).toEqual([{ sport: "run", count: 2, metres: 8000, seconds: expect.closeTo(8000 / 3) }]);
  });

  it("buckets distance into weeks, oldest first", () => {
    const w = weeklyMetres([act("a", 0, 5000), act("c", 8, 10000)], "all", 4, now);
    expect(w.map((x) => x.metres)).toEqual([0, 0, 10000, 5000]);
  });

  it("flags a best effort that beats every earlier one", () => {
    const old = act("old", 7, 5000, { detail: { bests: [{ label: "5 km", metres: 5000, seconds: 1600 }] } });
    const fast = act("new", 0, 5000, { detail: { bests: [{ label: "5 km", metres: 5000, seconds: 1550 }, { label: "10 km", metres: 10000, seconds: 3300 }] } });
    // The 10 km is a first: nothing to beat, so not a PB yet.
    expect(newBests(fast, [old, fast])).toEqual([{ label: "5 km", metres: 5000, seconds: 1550, previousSeconds: 1600 }]);
    expect(newBests(old, [old, fast])).toEqual([]);
    const slow = act("slow", 3, 5000, { detail: { bests: [{ label: "5 km", metres: 5000, seconds: 1700 }] } });
    expect(newBests(slow, [old, slow])).toEqual([]);
  });

  it("never brings the same Strava activity in twice, and keeps what the client added", () => {
    const first = act("x", 1, 5000, { source: "strava", externalId: "99", rpe: 7 });
    const again = act("y", 1, 5100, { source: "strava", externalId: "99" });
    const merged = mergeActivities([first], [again]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "x", metres: 5100, rpe: 7 });
  });

  it("thins a long track but keeps both ends", () => {
    const t = thin(Array.from({ length: 1000 }, (_, i) => i), 10);
    expect(t).toHaveLength(10);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBe(999);
  });
});

describe("sample data", () => {
  it("has a run, a swim and a ride this week with believable numbers", () => {
    const list = sampleActivities(new Date(2026, 9, 29, 12));
    const run = list.find((a) => a.id === "sample-run-1")!;
    expect(run.metres / 1000).toBeGreaterThan(4.5);
    expect(run.metres / 1000).toBeLessThan(7);
    expect(run.movingSeconds / (run.metres / 1000)).toBeGreaterThan(270); // slower than 4:30 /km
    expect(run.movingSeconds / (run.metres / 1000)).toBeLessThan(360);
    const swim = list.find((a) => a.id === "sample-swim-1")!;
    expect(swim.metres).toBe(2000);
    expect(swim.detail?.splits).toHaveLength(20);
    expect(swim.detail?.route).toBeUndefined();
    const ride = list.find((a) => a.id === "sample-ride-1")!;
    expect(ride.metres / ride.movingSeconds * 3.6).toBeGreaterThan(20);
    expect(ride.elevationGainM).toBeGreaterThan(50);
  });
});

describe("session load", () => {
  const base = { sport: "run" as const, name: "Run", metres: 5000, elapsedSeconds: 1800, source: "manual" as const };
  it("is minutes × effort, five when not given", () => {
    expect(activityLoad({ ...base, id: "a", startedAt: "2026-10-28T07:00:00Z", movingSeconds: 1800, rpe: 7 })).toBe(210);
    expect(activityLoad({ ...base, id: "b", startedAt: "2026-10-28T07:00:00Z", movingSeconds: 1800 })).toBe(150);
  });
  it("compares with the same sport over the eight weeks before", () => {
    const list = [
      { ...base, id: "now", startedAt: "2026-10-28T07:00:00Z", movingSeconds: 2400, rpe: 6 },
      { ...base, id: "p1", startedAt: "2026-10-21T07:00:00Z", movingSeconds: 1800, rpe: 6 },
      { ...base, id: "p2", startedAt: "2026-10-14T07:00:00Z", movingSeconds: 1800, rpe: 6 },
      { ...base, id: "old", startedAt: "2026-07-01T07:00:00Z", movingSeconds: 9000, rpe: 9 },
      { ...base, id: "ride", sport: "ride" as const, startedAt: "2026-10-20T07:00:00Z", movingSeconds: 9000, rpe: 9 },
    ];
    expect(loadVsUsual(list[0]!, list)).toEqual({ load: 240, usual: 180, pct: 33 });
    expect(loadVsUsual(list[1]!, list)).toBeNull();
  });
});
