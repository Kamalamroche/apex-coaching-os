import { formatDuration, formatPace, HR_ZONES, type Activity, type ProfilePoint, type Sport, type Split } from "@apex/core";
import { useId, useMemo, useState, type PointerEvent } from "react";
import { Icons } from "./icons";

/* Cardio visuals, all plain SVG: the route, the pace / heart rate / elevation chart, splits,
   heart-rate zones and weekly bars. Colours come from the Athletic Tech tokens only:
   cyan (data) for easy, orange (act) for fast and hard. */

export const SportIcon = ({ sport, size = 20 }: { sport: Sport; size?: number }) => {
  const I = sport === "other" ? Icons.pulse : Icons[sport];
  return <I width={size} height={size} />;
};

/** Seconds per metre along the profile, smoothed over a few points so GPS jitter doesn't spike it. */
function paceSeries(profile: ProfilePoint[]): number[] {
  const raw = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)]!;
    const b = profile[Math.min(profile.length - 1, i + 1)]!;
    return b.m > a.m ? (b.s - a.s) / (b.m - a.m) : NaN;
  });
  return raw.map((_, i) => {
    const w = raw.slice(Math.max(0, i - 3), i + 4).filter(Number.isFinite);
    return w.length ? w.reduce((x, y) => x + y, 0) / w.length : NaN;
  });
}

const quantile = (xs: number[], q: number) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : 0;
};

/** The route, coloured by pace: cyan where it was easiest, orange where it was quickest. */
export function RouteMap({ activity, height = 240 }: { activity: Activity; height?: number }) {
  const id = useId().replace(/:/g, "");
  const route = activity.detail?.route;
  const profile = activity.detail?.profile;
  const drawn = useMemo(() => {
    if (!route || route.length < 2) return null;
    const lat0 = route.reduce((a, p) => a + p[0], 0) / route.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = route.map((p) => p[1] * k);
    const ys = route.map((p) => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 600;
    // Drawn for a box about 1.6 times wider than tall; "meet" keeps any route in view.
    const H = 375;
    const pad = 28;
    const span = Math.max(maxX - minX, ((maxY - minY) * W) / H, 1e-6);
    const scale = (W - pad * 2) / span;
    const offX = (W - (maxX - minX) * scale) / 2;
    const offY = (H - (maxY - minY) * scale) / 2;
    const pts = route.map((_, i) => [offX + (xs[i]! - minX) * scale, offY + (ys[i]! - minY) * scale] as const);
    // Pace for each route point: route and profile are both spread evenly by distance.
    const pace = profile && profile.length > 2 ? paceSeries(profile) : null;
    const fast = pace ? quantile(pace, 0.1) : 0;
    const slow = pace ? quantile(pace, 0.9) : 0;
    const heat = (i: number) => {
      if (!pace || slow <= fast) return 70;
      const v = pace[Math.round((i / (pts.length - 1)) * (pace.length - 1))]!;
      return Math.round(Math.min(1, Math.max(0, (slow - v) / (slow - fast))) * 100);
    };
    // Group neighbouring points of a similar colour into one path, so a long route stays light to draw.
    const segs: { d: string; heat: number }[] = [];
    let cur: { d: string; heat: number } | null = null;
    for (let i = 1; i < pts.length; i++) {
      const h = Math.round(heat(i) / 10) * 10;
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      if (!cur || cur.heat !== h) {
        cur = { d: `M${x0.toFixed(1)} ${y0.toFixed(1)}`, heat: h };
        segs.push(cur);
      }
      cur.d += `L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const full = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
    // A marker every km (every 500 m on a short route), placed by share of distance.
    const every = activity.sport === "ride" ? 5000 : activity.metres > 3000 ? 1000 : 500;
    const marks = Array.from({ length: Math.floor(activity.metres / every) }, (_, j) => {
      const f = ((j + 1) * every) / activity.metres;
      const p = pts[Math.min(pts.length - 1, Math.round(f * (pts.length - 1)))]!;
      return { x: p[0], y: p[1], label: String(((j + 1) * every) / 1000) };
    }).filter((_, j, all) => all.length <= 12 || (j + 1) % Math.ceil(all.length / 12) === 0);
    const loop = Math.hypot(pts[0]![0] - pts.at(-1)![0], pts[0]![1] - pts.at(-1)![1]) < 14;
    return { W, H, segs, full, start: pts[0]!, end: pts.at(-1)!, marks, loop, hasPace: !!pace };
  }, [route, profile, activity.metres, activity.sport]);

  if (!drawn) return null;
  const { W, H, segs, full, start, end, marks, loop, hasPace } = drawn;
  return (
    <div className="cx-map" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Route of ${activity.name}`}>
        <defs>
          <pattern id={`g${id}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--line)" strokeWidth="1" /></pattern>
          <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width={W} height={H} fill={`url(#g${id})`} />
        <path d={full} fill="none" stroke="var(--act)" strokeOpacity=".35" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" filter={`url(#f${id})`} />
        <path d={full} fill="none" stroke="var(--bg)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={`color-mix(in srgb, var(--act) ${s.heat}%, var(--data))`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {marks.map((m) => (
          <g key={m.label} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`}>
            <circle r="9" fill="var(--card)" stroke="var(--line2)" />
            <text textAnchor="middle" dy="3.5" fontSize="9" fontWeight="700" fill="var(--text2)" fontFamily="var(--num)">{m.label}</text>
          </g>
        ))}
        {!loop && <circle cx={end[0]} cy={end[1]} r="7" fill="var(--crit)" stroke="var(--bg)" strokeWidth="3" />}
        <circle cx={start[0]} cy={start[1]} r="7" fill="var(--good)" stroke="var(--bg)" strokeWidth="3" />
      </svg>
      <div className="cx-map-key">
        <span><i style={{ background: "var(--good)" }} />Start{loop ? " / finish" : ""}</span>
        {!loop && <span><i style={{ background: "var(--crit)" }} />Finish</span>}
        {hasPace && <span className="cx-heat"><i />Easier → quicker</span>}
      </div>
    </div>
  );
}

type Metric = "pace" | "hr" | "ele";

/** Pace, heart rate or elevation against distance. Drag a finger or the mouse along it to read a point. */
export function ProfileChart({ activity }: { activity: Activity }) {
  const profile = activity.detail?.profile ?? [];
  const has: Record<Metric, boolean> = {
    pace: profile.length > 2,
    hr: profile.filter((p) => p.hr).length > profile.length / 2,
    ele: activity.sport !== "swim" && profile.filter((p) => p.ele !== undefined).length > profile.length / 2,
  };
  const options = (["pace", "hr", "ele"] as Metric[]).filter((m) => has[m]);
  const [metric, setMetric] = useState<Metric>(options[0] ?? "pace");
  const [at, setAt] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const series = useMemo(() => {
    if (metric === "pace") {
      const spm = paceSeries(profile);
      // Shown as speed so "up" always means "quicker"; the readout still says pace.
      return spm.map((v) => (Number.isFinite(v) && v > 0 ? 1 / v : NaN));
    }
    return profile.map((p) => (metric === "hr" ? p.hr ?? NaN : p.ele ?? NaN));
  }, [profile, metric]);
  if (!options.length) return null;

  const W = 600, H = 170, top = 14, bottom = 22;
  const vals = series.filter(Number.isFinite);
  let lo = metric === "pace" ? quantile(vals, 0.02) : Math.min(...vals);
  let hi = metric === "pace" ? quantile(vals, 0.98) : Math.max(...vals);
  if (hi - lo < (metric === "ele" ? 10 : metric === "hr" ? 10 : 0.1)) { const mid = (hi + lo) / 2; lo = mid - (metric === "pace" ? 0.1 : 5); hi = mid + (metric === "pace" ? 0.1 : 5); }
  const total = profile.at(-1)?.m || 1;
  const x = (m: number) => (m / total) * W;
  const y = (v: number) => top + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - top - bottom);
  const pts = profile.map((p, i) => (Number.isFinite(series[i]!) ? [x(p.m), y(series[i]!)] as const : null)).filter((p): p is readonly [number, number] => !!p);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join("");
  const area = pts.length ? `${line}L${pts.at(-1)![0].toFixed(1)} ${H - bottom}L${pts[0]![0].toFixed(1)} ${H - bottom}Z` : "";
  const colour = metric === "pace" ? "var(--act)" : metric === "hr" ? "var(--crit)" : "var(--data)";
  const ticks = Array.from({ length: 5 }, (_, k) => (total * k) / 4);
  const p = at !== null ? profile[at] : null;
  const fmt = (i: number) => {
    const v = series[i]!;
    if (!Number.isFinite(v)) return "–";
    if (metric === "pace") return activity.sport === "ride" ? `${(v * 3.6).toFixed(1)} km/h` : formatPace(1000, 1000 / v, activity.sport);
    return metric === "hr" ? `${Math.round(v)} bpm` : `${Math.round(v)} m`;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setAt(Math.round(f * (profile.length - 1)));
  };
  const avgLabel = metric === "pace" ? formatPace(activity.metres, activity.movingSeconds, activity.sport) : metric === "hr" ? (activity.avgHr ? `${activity.avgHr} bpm avg` : "") : `${activity.elevationGainM ?? 0} m climbed`;
  return (
    <div className="card cx-chart">
      <div className="sect" style={{ marginBottom: 6 }}>
        <div className="chips">
          {options.map((m) => <button key={m} className={`chip ${metric === m ? "on" : ""}`} onClick={() => setMetric(m)}>{m === "pace" ? (activity.sport === "ride" ? "Speed" : "Pace") : m === "hr" ? "Heart rate" : "Elevation"}</button>)}
        </div>
        <span className="num small" style={{ color: colour, fontWeight: 700 }}>{p ? `${fmt(at!)} · ${(p.m / 1000).toFixed(2)} km` : avgLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setAt(null)} role="img" aria-label={`${metric === "pace" ? "Pace" : metric === "hr" ? "Heart rate" : "Elevation"} over the distance`}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colour} stopOpacity=".35" /><stop offset="1" stopColor={colour} stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={top + f * (H - top - bottom)} y2={top + f * (H - top - bottom)} stroke="var(--line)" strokeDasharray="3 5" />)}
        <path d={area} fill={`url(#a${id})`} />
        <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((m, k) => <text key={k} x={Math.min(W - 2, Math.max(2, x(m)))} y={H - 6} fontSize="11" fill="var(--text3)" textAnchor={k === 0 ? "start" : k === 4 ? "end" : "middle"} fontFamily="var(--num)">{(m / 1000).toFixed(m < 10000 ? 1 : 0)} km</text>)}
        {p && Number.isFinite(series[at!]!) && (
          <g>
            <line x1={x(p.m)} x2={x(p.m)} y1={top - 6} y2={H - bottom} stroke="var(--text2)" strokeWidth="1" />
            <circle cx={x(p.m)} cy={y(series[at!]!)} r="5" fill={colour} stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** One row per split; the bar is longer the quicker it was, and the quickest is picked out. */
export function SplitsTable({ activity }: { activity: Activity }) {
  const splits: Split[] = activity.detail?.splits ?? [];
  if (!splits.length) return null;
  const per = (s: Split) => s.seconds / Math.max(1, s.metres);
  const full = splits.filter((s) => s.metres >= (splits[0]?.metres ?? 0) * 0.9);
  const best = full.length ? Math.min(...full.map(per)) : 0;
  const worst = full.length ? Math.max(...full.map(per)) : 0;
  const unit = activity.sport === "swim" ? "100 m" : activity.sport === "row" ? "500 m" : activity.sport === "ride" ? "5 km" : "km";
  const ele = splits.some((s) => s.elevationM !== undefined);
  return (
    <div className={`card flat cx-splits ${ele ? "" : "no-ele"}`}>
      <div className="cx-split cx-split-head"><span>{unit === "km" ? "Km" : unit}</span><span>{activity.sport === "ride" ? "Speed" : "Pace"}</span><span /><span>HR</span>{ele && <span>Elev</span>}</div>
      {splits.map((s) => {
        const quickest = per(s) === best && s.metres >= (splits[0]?.metres ?? 0) * 0.9;
        const w = worst > best ? 35 + 65 * ((worst - per(s)) / (worst - best)) : 100;
        return (
          <div key={s.n} className={`cx-split ${quickest ? "best" : ""}`}>
            <span className="num">{s.metres < (splits[0]?.metres ?? 0) * 0.9 ? (activity.sport === "swim" || activity.sport === "row" ? `${s.metres} m` : (s.metres / 1000).toFixed(2)) : s.n}</span>
            <span className="num">{formatPace(s.metres, s.seconds, activity.sport).replace(/ \/.*$/, "")}</span>
            <span className="cx-split-bar"><i style={{ width: `${Math.max(8, Math.min(100, w))}%` }} /></span>
            <span className="num">{s.avgHr ?? "–"}</span>
            {ele && <span className="num">{s.elevationM === undefined ? "–" : `${s.elevationM > 0 ? "+" : ""}${s.elevationM}`}</span>}
          </div>
        );
      })}
    </div>
  );
}

export const ZONE_COLOURS = ["var(--text3)", "var(--data)", "var(--good)", "var(--warn)", "var(--crit)"];

export function HrZones({ activity }: { activity: Activity }) {
  const z = activity.detail?.hrZones;
  if (!z) return null;
  const total = z.reduce((a, b) => a + b, 0) || 1;
  const maxZ = Math.max(...z);
  return (
    <div className="card cx-zones">
      <div className="cx-zone-strip">{z.map((s, i) => s > 0 && <i key={i} style={{ flexGrow: s, background: ZONE_COLOURS[i] }} />)}</div>
      {[...z].map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
        <div key={i} className="cx-zone">
          <span className="cx-zone-name"><b style={{ color: ZONE_COLOURS[i] }}>Z{i + 1}</b> {HR_ZONES[i]}</span>
          <span className="cx-zone-bar"><i style={{ width: `${(s / (maxZ || 1)) * 100}%`, background: ZONE_COLOURS[i] }} /></span>
          <span className="num small">{formatDuration(s)}</span>
          <span className="num tiny" style={{ width: 34, textAlign: "right" }}>{Math.round((s / total) * 100)}%</span>
        </div>
      ))}
      {activity.detail?.zonesMaxHr && <div className="tiny" style={{ marginTop: 8 }}>Zones from a max heart rate of {activity.detail.zonesMaxHr} bpm.</div>}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Distance per week, this week in orange. Bars are labelled with the Monday; the month shows where it changes. */
export function WeekBars({ weeks, unit = "km" }: { weeks: { week: Date; metres: number }[]; unit?: "km" | "m" }) {
  const max = Math.max(1, ...weeks.map((w) => w.metres));
  const label = (m: number) => (unit === "m" ? `${Math.round(m).toLocaleString("en-GB")}` : m >= 100000 ? (m / 1000).toFixed(0) : (m / 1000).toFixed(1));
  return (
    <div className="cx-weeks" role="img" aria-label={`Distance per week, last ${weeks.length} weeks`}>
      {weeks.map((w, i) => {
        const now = i === weeks.length - 1;
        return (
          <div key={w.week.toISOString()} className={`cx-week ${now ? "now" : ""}`}>
            <span className="num tiny">{w.metres ? label(w.metres) : ""}</span>
            <i style={{ height: `${Math.max(w.metres ? 6 : 2, (w.metres / max) * 100)}%` }} />
            <span className="tiny" style={{ whiteSpace: "nowrap" }}>{now ? "Now" : i === 0 || w.week.getDate() <= 7 ? `${w.week.getDate()} ${MONTHS[w.week.getMonth()]}` : w.week.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A small route outline for list rows. */
export function RouteThumb({ activity, size = 48 }: { activity: Activity; size?: number }) {
  const route = activity.detail?.route;
  if (!route || route.length < 2) {
    return <div className={`cx-thumb s-${activity.sport}`} style={{ width: size, height: size }}><SportIcon sport={activity.sport} size={size * 0.46} /></div>;
  }
  const k = Math.cos((route[0]![0] * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-9);
  const s = 40 / span;
  const ox = (48 - (Math.max(...xs) - minX) * s) / 2;
  const oy = (48 - (Math.max(...ys) - minY) * s) / 2;
  const d = route.map((_, i) => `${i ? "L" : "M"}${(ox + (xs[i]! - minX) * s).toFixed(1)} ${(oy + (ys[i]! - minY) * s).toFixed(1)}`).join("");
  return (
    <div className={`cx-thumb s-${activity.sport}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size}><path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}
