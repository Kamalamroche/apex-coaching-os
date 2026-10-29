/* Sample cardio for the demo: made-up tracks drawn by formula (no one's real route), dated relative
   to today so the week totals and the 8-week bars always have something in them. */

import { activityFromTrack, type Activity, type Sport, type TrackPoint } from "../activity";

const M_PER_DEG = 111195;

interface Loop {
  sport: Sport;
  centre: [number, number];
  /** Radii in metres, north-south and east-west. */
  radius: [number, number];
  laps: number;
  /** Metres per second, and how much it swings over a lap. */
  speed: number;
  swing: number;
  /** Second wobble so the route isn't a perfect oval. */
  lobes: number;
  baseEle: number;
  hills: number;
  hr: [number, number];
}

function loopTrack(l: Loop, start: number): TrackPoint[] {
  const pts: TrackPoint[] = [];
  const cosLat = Math.cos((l.centre[0] * Math.PI) / 180);
  let th = 0;
  let t = start;
  const dt = 4;
  const end = l.laps * 2 * Math.PI;
  for (let k = 0; th <= end; k++) {
    const r = 1 + 0.12 * Math.sin(l.lobes * th);
    const lat = l.centre[0] + (l.radius[0] * r * Math.cos(th)) / M_PER_DEG;
    const lon = l.centre[1] + (l.radius[1] * r * Math.sin(th)) / (M_PER_DEG * cosLat);
    const warm = Math.min(1, k / 150);
    const hr = Math.round(l.hr[0] + (l.hr[1] - l.hr[0]) * warm + 6 * Math.sin(th * 3));
    pts.push({ t: t * 1000, lat, lon, ele: l.baseEle + l.hills * Math.sin(2 * th) + 0.4 * Math.sin(17 * th), hr });
    const v = l.speed * (1 + l.swing * Math.sin(2 * th + 1));
    // Arc length of the oval at this angle, to step forward v·dt metres.
    const ds = Math.hypot(l.radius[0] * r * Math.sin(th), l.radius[1] * r * Math.cos(th));
    th += (v * dt) / ds;
    t += dt;
  }
  return pts;
}

/** A pool swim has no GPS: the watch counts lengths, so the points carry distance and time only. */
function poolTrack(start: number, lengths: number, pool: number, secondsPer100: number): TrackPoint[] {
  const pts: TrackPoint[] = [];
  let t = start;
  for (let i = 0; i <= lengths; i++) {
    const pace = secondsPer100 * (1 + 0.05 * Math.sin(i / 3)) * (pool / 100);
    pts.push({ t: t * 1000, dist: i * pool, hr: Math.round(128 + Math.min(14, i / 4) + 4 * Math.sin(i)) });
    // 20 s on the wall every 400 m.
    if (i && i % 16 === 0) { t += 20; pts.push({ t: t * 1000, dist: i * pool }); }
    t += pace;
  }
  return pts;
}

const REGENTS: Omit<Loop, "laps" | "speed"> = { sport: "run", centre: [51.5273, -0.154], radius: [720, 760], swing: 0.05, lobes: 3, baseEle: 36, hills: 5, hr: [128, 158] };
const RICHMOND: Omit<Loop, "laps" | "speed"> = { sport: "ride", centre: [51.4429, -0.275], radius: [1650, 1500], swing: 0.15, lobes: 2, baseEle: 30, hills: 22, hr: [118, 146] };

const at = (now: Date, daysAgo: number, hour: number): number => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 12, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

export function sampleActivities(now = new Date()): Activity[] {
  const run = (id: string, daysAgo: number, laps: number, speed: number, name?: string) =>
    activityFromTrack(loopTrack({ ...REGENTS, laps, speed }, at(now, daysAgo, 7)), { id, sport: "run", name, source: "file", maxHr: 186 });
  const list: Activity[] = [
    { ...run("sample-run-1", 0, 1.2, 3.25, "Regent's Park tempo"), rpe: 7, note: "Legs felt good after Thursday's lower session." },
    { ...activityFromTrack(poolTrack(at(now, 2, 18), 80, 25, 118), { id: "sample-swim-1", sport: "swim", name: "Pool, 2 km steady", source: "file", poolLengthM: 25, maxHr: 186 }), rpe: 5 },
    { ...activityFromTrack(loopTrack({ ...RICHMOND, laps: 3, speed: 7.6 }, at(now, 4, 9)), { id: "sample-ride-1", sport: "ride", name: "Richmond Park laps", source: "file", maxHr: 186 }), rpe: 6 },
    run("sample-run-2", 7, 1, 3.05),
    run("sample-run-3", 10, 1.5, 2.95, "Long easy loop"),
    run("sample-run-4", 14, 1, 3.1),
    run("sample-run-5", 21, 1.2, 3.0),
    run("sample-run-6", 28, 1, 2.9),
    run("sample-run-7", 12, 1.2, 3.0),
    run("sample-run-8", 17, 1, 3.05),
    run("sample-run-9", 19, 1.5, 2.95, "Long easy loop"),
    run("sample-run-10", 24, 1.2, 3.1),
    run("sample-run-11", 26, 1, 3.0),
    activityFromTrack(poolTrack(at(now, 16, 18), 64, 25, 124), { id: "sample-swim-2", sport: "swim", name: "Pool, 1.6 km", source: "file", poolLengthM: 25, maxHr: 186 }),
  ];
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
