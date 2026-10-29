import { fitView, formatDuration, formatPace, HR_ZONES, TILE, tilesFor, viewPx, type Activity, type ProfilePoint, type Sport, type Split, type TileRef } from "@apex/core";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { niceTicks } from "./chartKit";
import { Icons } from "./icons";

/* Cardio visuals: the route on a street map, the pace / heart rate / elevation analysis, splits,
   heart-rate zones and weekly bars. Plain SVG over map tiles; colours from the --viz tokens. */

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

/** True while the app shows its dark theme: the <html data-theme> override, else the OS setting. */
export function useDarkTheme(): boolean {
  const read = () => {
    if (typeof document === "undefined") return true;
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : !window.matchMedia?.("(prefers-color-scheme: light)").matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    mq?.addEventListener?.("change", update);
    return () => { mo.disconnect(); mq?.removeEventListener?.("change", update); };
  }, []);
  return dark;
}

/** The width an element is drawn at, kept up to date as it resizes. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Map tiles. Defaults to CARTO's OpenStreetMap basemaps (light and dark), which are free for light use
 * with attribution; set VITE_MAP_TILES to another provider's template ({s}, {z}, {x}, {y}, {theme}) for
 * production volumes.
 */
const TILE_URL: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MAP_TILES
  || "https://{s}.basemaps.cartocdn.com/{theme}/{z}/{x}/{y}@2x.png";
const TILE_CREDIT = "© OpenStreetMap contributors © CARTO";
const tileSrc = (t: TileRef, dark: boolean) =>
  TILE_URL.replace("{s}", "abcd"[(t.x + t.y) % 4]!).replace("{theme}", dark ? "dark_all" : "light_all").replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));

/**
 * The route on a real street map, coloured by pace (blue where it was easiest, orange where it was
 * quickest), with distance markers, start and finish. `at` (0–1 of the distance) shows a dot that
 * follows the charts below.
 */
export function RouteMap({ activity, height = 260, at = null }: { activity: Activity; height?: number; at?: number | null }) {
  const route = activity.detail?.route;
  const profile = activity.detail?.profile;
  const dark = useDarkTheme();
  const [box, width] = useWidth<HTMLDivElement>();
  const [failed, setFailed] = useState(0);
  const drawn = useMemo(() => {
    if (!route || route.length < 2 || width < 40) return null;
    const view = fitView(route, width, height, 30);
    const pts = route.map(([la, ln]) => viewPx(view, la, ln));
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
    // A marker every km (every 500 m on a short route, 5 km on a ride), placed by share of distance.
    const every = activity.sport === "ride" ? 5000 : activity.sport === "swim" ? 500 : activity.metres > 3000 ? 1000 : 500;
    const marks = Array.from({ length: Math.floor(activity.metres / every) }, (_, j) => {
      const f = ((j + 1) * every) / activity.metres;
      const p = pts[Math.min(pts.length - 1, Math.round(f * (pts.length - 1)))]!;
      return { x: p[0], y: p[1], label: String(((j + 1) * every) / 1000) };
    }).filter((_, j, all) => all.length <= 10 || (j + 1) % Math.ceil(all.length / 10) === 0);
    const loop = Math.hypot(pts[0]![0] - pts.at(-1)![0], pts[0]![1] - pts.at(-1)![1]) < 14;
    return { view, pts, tiles: tilesFor(view), segs, full, start: pts[0]!, end: pts.at(-1)!, marks, loop, hasPace: !!pace };
  }, [route, profile, activity.metres, activity.sport, width, height]);

  const dot = drawn && at !== null ? drawn.pts[Math.round(Math.min(1, Math.max(0, at)) * (drawn.pts.length - 1))] : null;
  const showTiles = drawn && failed < 3;
  return (
    <div ref={box} className={`cx-map ${showTiles ? "tiles" : ""}`} style={{ height }}>
      {drawn && (
        <>
          {showTiles && (
            <div className="cx-tiles" aria-hidden>
              {drawn.tiles.map((t) => (
                <img key={`${dark}-${t.z}-${t.x}-${t.y}-${t.left}`} src={tileSrc(t, dark)} alt="" width={TILE} height={TILE} loading="lazy" decoding="async" draggable={false}
                  style={{ left: t.left, top: t.top }} onError={() => setFailed((n) => n + 1)} />
              ))}
            </div>
          )}
          <svg width={drawn.view.width} height={drawn.view.height} viewBox={`0 0 ${drawn.view.width} ${drawn.view.height}`} role="img" aria-label={`Route of ${activity.name}`}>
            <path d={drawn.full} fill="none" stroke={dark ? "#0B1020" : "#FFFFFF"} strokeOpacity=".9" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            {drawn.segs.map((s, i) => (
              <path key={i} d={s.d} fill="none" stroke={`color-mix(in srgb, var(--viz-2) ${s.heat}%, var(--viz-1))`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {drawn.marks.map((m) => (
              <g key={m.label} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`}>
                <circle r="9" fill="var(--card)" stroke="var(--line2)" />
                <text textAnchor="middle" dy="3.5" fontSize="9" fontWeight="700" fill="var(--text)" fontFamily="var(--num)">{m.label}</text>
              </g>
            ))}
            {!drawn.loop && <circle cx={drawn.end[0]} cy={drawn.end[1]} r="7" fill="var(--crit)" stroke="var(--card)" strokeWidth="3" />}
            <circle cx={drawn.start[0]} cy={drawn.start[1]} r="7" fill="var(--good)" stroke="var(--card)" strokeWidth="3" />
            {dot && (
              <g transform={`translate(${dot[0].toFixed(1)} ${dot[1].toFixed(1)})`}>
                <circle r="13" fill="var(--text)" fillOpacity=".12" />
                <circle r="6.5" fill="var(--text)" stroke="var(--card)" strokeWidth="2.5" />
              </g>
            )}
          </svg>
        </>
      )}
      <div className="cx-map-key">
        <span><i style={{ background: "var(--good)" }} />Start{drawn?.loop ? " / finish" : ""}</span>
        {drawn && !drawn.loop && <span><i style={{ background: "var(--crit)" }} />Finish</span>}
        {drawn?.hasPace && <span className="cx-heat"><i />Easier → quicker</span>}
      </div>
      {showTiles && <span className="cx-credit">{TILE_CREDIT}</span>}
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
  const colour = metric === "pace" ? "var(--viz-1)" : metric === "hr" ? "var(--viz-2)" : "var(--viz-3)";
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
        <span className="num small" style={{ fontWeight: 700 }}>{p ? `${fmt(at!)} · ${(p.m / 1000).toFixed(2)} km` : avgLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setAt(null)} role="img" aria-label={`${metric === "pace" ? "Pace" : metric === "hr" ? "Heart rate" : "Elevation"} over the distance`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={top + f * (H - top - bottom)} y2={top + f * (H - top - bottom)} stroke="var(--line)" strokeDasharray="3 5" />)}
        <path d={area} fill={colour} fillOpacity=".1" />
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

type Panel = { key: Metric; label: string; colour: string; h: number; series: number[]; lo: number; hi: number; ticks: number[]; fmt: (v: number) => string; avg?: number; avgLabel?: string };


/**
 * The whole activity on one scrubbable sheet: pace (quicker is up), heart rate over its zones, and
 * elevation, stacked on the same distance line with real axes and the average marked. One finger moves a
 * crosshair through all three, reads every number at that point and moves the dot on the map (`onAt`).
 */
export function RunAnalysis({ activity, onAt }: { activity: Activity; onAt?: (f: number | null) => void }) {
  const profile = activity.detail?.profile ?? [];
  const [at, setAtRaw] = useState<number | null>(null);
  const setAt = (i: number | null) => { setAtRaw(i); onAt?.(i === null ? null : i / Math.max(1, profile.length - 1)); };
  const ride = activity.sport === "ride";
  const panels = useMemo((): Panel[] => {
    if (profile.length < 3) return [];
    const out: Panel[] = [];
    const spm = paceSeries(profile);
    // Speed in m/s, so a quicker stretch draws higher; the axis and readout still say pace.
    const speed = spm.map((v) => (Number.isFinite(v) && v > 0 ? 1 / v : NaN));
    const sv = speed.filter(Number.isFinite);
    if (sv.length > 2) {
      let lo = quantile(sv, 0.03), hi = quantile(sv, 0.98);
      if (hi - lo < 0.2) { lo -= 0.1; hi += 0.1; }
      const pad = (hi - lo) * 0.12;
      const avg = activity.movingSeconds ? activity.metres / activity.movingSeconds : undefined;
      const fmt = (v: number) => (ride ? `${(v * 3.6).toFixed(1)}` : formatPace(1000, 1000 / v, activity.sport).replace(/ \/.*$/, ""));
      // Ticks on round paces (every 10, 15, 30 or 60 s per km), or round speeds on a ride.
      const per = activity.sport === "swim" ? 100 : 1000;
      const ticks = ride ? niceTicks((lo - pad) * 3.6, (hi + pad) * 3.6, 3).map((v) => v / 3.6) : (() => {
        const slowS = per / (lo - pad), fastS = per / (hi + pad);
        const step = [10, 15, 30, 60, 120].find((k) => (slowS - fastS) / k <= 3.5) ?? 300;
        const out: number[] = [];
        for (let t = Math.ceil(fastS / step) * step; t <= slowS; t += step) out.push(per / t);
        return out;
      })();
      out.push({ key: "pace", label: ride ? "Speed km/h" : `Pace ${activity.sport === "swim" ? "/100 m" : "/km"}`, colour: "var(--viz-1)", h: 96, series: speed, lo: lo - pad, hi: hi + pad, ticks, fmt, avg, avgLabel: avg ? `avg ${fmt(avg)}` : undefined });
    }
    const hr = profile.map((p) => p.hr ?? NaN);
    const hv = hr.filter(Number.isFinite);
    if (hv.length > profile.length / 2) {
      const lo = Math.floor((Math.min(...hv) - 6) / 10) * 10, hi = Math.ceil((Math.max(...hv) + 4) / 10) * 10;
      out.push({ key: "hr", label: "Heart rate bpm", colour: "var(--viz-2)", h: 96, series: hr, lo, hi, ticks: niceTicks(lo, hi, 3), fmt: (v) => String(Math.round(v)), avg: activity.avgHr, avgLabel: activity.avgHr ? `avg ${activity.avgHr}` : undefined });
    }
    const ele = profile.map((p) => p.ele ?? NaN);
    const ev = ele.filter(Number.isFinite);
    if (activity.sport !== "swim" && ev.length > profile.length / 2) {
      const mn = Math.min(...ev), mx = Math.max(...ev);
      const span = Math.max(20, mx - mn);
      const lo = Math.floor((mn - span * 0.15) / 5) * 5, hi = Math.ceil((mn + span * 1.1) / 5) * 5;
      out.push({ key: "ele", label: "Elevation m", colour: "var(--viz-3)", h: 70, series: ele, lo, hi, ticks: niceTicks(lo, hi, 2), fmt: (v) => String(Math.round(v)) });
    }
    return out;
  }, [profile, activity, ride]);
  if (!panels.length) return null;

  const W = 340, left = 2, right = 34, gap = 22, head = 16, axis = 18;
  const total = profile.at(-1)?.m || 1;
  const x = (m: number) => left + (m / total) * (W - left - right);
  const tops: number[] = [];
  let yAt = 0;
  for (const pn of panels) { tops.push(yAt + head); yAt += head + pn.h + gap; }
  const H = yAt - gap + axis;
  const yOf = (pn: Panel, top: number, v: number) => top + (1 - (Math.min(pn.hi, Math.max(pn.lo, v)) - pn.lo) / (pn.hi - pn.lo)) * pn.h;
  const p = at !== null ? profile[at] : null;
  const kmStep = ride ? 5000 : activity.sport === "swim" ? 100 : total > 15000 ? 5000 : total > 6000 ? 2000 : 1000;
  const kms = Array.from({ length: Math.floor(total / kmStep) }, (_, k) => (k + 1) * kmStep).filter((m) => m < total - kmStep * 0.3);
  const maxHr = activity.detail?.zonesMaxHr;
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const m = Math.min(1, Math.max(0, (fx - left) / (W - left - right))) * total;
    let i = 0;
    while (i < profile.length - 1 && profile[i + 1]!.m <= m) i++;
    setAt(i);
  };
  const readout = (pn: Panel) => (p && Number.isFinite(pn.series[at!]!) ? pn.fmt(pn.series[at!]!) : "–");
  return (
    <div className="card cx-analysis">
      <div className="cx-readout">
        <div><span>Dist</span><b className="num">{p ? (activity.sport === "swim" ? `${Math.round(p.m)} m` : `${(p.m / 1000).toFixed(2)} km`) : "–"}</b></div>
        <div><span>Time</span><b className="num">{p ? formatDuration(p.s) : "–"}</b></div>
        {panels.map((pn) => <div key={pn.key}><span>{pn.key === "pace" ? (ride ? "Speed" : "Pace") : pn.key === "hr" ? "HR" : "Elev"}</span><b className="num" style={{ color: p ? undefined : "var(--text3)" }}>{readout(pn)}</b></div>)}
      </div>
      {!p && <div className="tiny" style={{ marginTop: -2 }}>Drag across the charts to read any point. The dot on the map follows.</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setAt(null)} role="img"
        aria-label={`${panels.map((pn) => pn.label.split(" ")[0]).join(", ")} over the distance`}>
        {panels.map((pn, k) => {
          const top = tops[k]!;
          const pts = profile.map((q, i) => (Number.isFinite(pn.series[i]!) ? [x(q.m), yOf(pn, top, pn.series[i]!)] as const : null)).filter((q): q is readonly [number, number] => !!q);
          const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join("");
          const base = top + pn.h;
          const area = pts.length ? `${line}L${pts.at(-1)![0].toFixed(1)} ${base}L${pts[0]![0].toFixed(1)} ${base}Z` : "";
          const ticks = pn.ticks;
          return (
            <g key={pn.key}>
              <text x={left} y={top - 5} fontSize="11" fontWeight="600" fill="var(--text2)">{pn.label}</text>
              {pn.avgLabel && <text x={W - right} y={top - 5} fontSize="10.5" fill="var(--text3)" textAnchor="end" fontFamily="var(--num)">{pn.avgLabel}</text>}
              {pn.key === "hr" && maxHr && [0.6, 0.7, 0.8, 0.9].map((f, z) => {
                const yHi = yOf(pn, top, maxHr * (z === 3 ? 1.2 : f + 0.1)), yLo = yOf(pn, top, maxHr * f);
                return yLo - yHi > 1 ? (
                  <g key={z}>
                    <rect x={left} width={W - left - right} y={yHi} height={yLo - yHi} fill={ZONE_COLOURS[z + 1]} opacity=".1" />
                    {yLo - yHi > 14 && <text x={left + 3} y={yLo - 3} fontSize="9" fill="var(--text3)" fontFamily="var(--num)">Z{z + 2}</text>}
                  </g>
                ) : null;
              })}
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={left} x2={W - right} y1={yOf(pn, top, v)} y2={yOf(pn, top, v)} stroke="var(--line)" />
                  <text x={W - right + 4} y={yOf(pn, top, v) + 3.5} fontSize="10" fill="var(--text3)" fontFamily="var(--num)">{pn.key === "pace" ? pn.fmt(v) : Math.round(v)}</text>
                </g>
              ))}
              {kms.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={top} y2={base} stroke="var(--line)" strokeDasharray="2 3" />)}
              <path d={area} fill={pn.colour} fillOpacity={pn.key === "ele" ? 0.22 : 0.08} />
              <path d={line} fill="none" stroke={pn.colour} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
              {pn.avg !== undefined && <line x1={left} x2={W - right} y1={yOf(pn, top, pn.avg)} y2={yOf(pn, top, pn.avg)} stroke="var(--text2)" strokeDasharray="4 4" strokeWidth="1" />}
              <line x1={left} x2={W - right} y1={base} y2={base} stroke="var(--line2)" />
              {p && Number.isFinite(pn.series[at!]!) && <circle cx={x(p.m)} cy={yOf(pn, top, pn.series[at!]!)} r="4.5" fill={pn.colour} stroke="var(--card)" strokeWidth="2" />}
            </g>
          );
        })}
        {[0, ...kms.filter((m) => m < total - kmStep * 0.9), total].map((m, k, all) => (
          <text key={k} x={x(m)} y={H - 4} fontSize="10" fill="var(--text3)" textAnchor={k === 0 ? "start" : k === all.length - 1 ? "end" : "middle"} fontFamily="var(--num)">
            {k === all.length - 1 ? (activity.sport === "swim" ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`) : activity.sport === "swim" ? Math.round(m) : m / 1000}
          </text>
        ))}
        {p && <line x1={x(p.m)} x2={x(p.m)} y1={tops[0]! - 4} y2={H - axis} stroke="var(--text)" strokeWidth="1" opacity=".6" />}
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

/** Easy to max: a single-hue light-to-dark ramp, since zones are ordered intensity, not categories. */
export const ZONE_COLOURS = ["color-mix(in srgb, var(--viz-2) 25%, var(--bg2))", "color-mix(in srgb, var(--viz-2) 45%, var(--bg2))", "color-mix(in srgb, var(--viz-2) 65%, var(--bg2))", "color-mix(in srgb, var(--viz-2) 85%, var(--bg2))", "var(--viz-2)"];

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
          <span className="cx-zone-name"><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 6, background: ZONE_COLOURS[i] }} /><b style={{ color: "var(--text)" }}>Z{i + 1}</b> {HR_ZONES[i]}</span>
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
