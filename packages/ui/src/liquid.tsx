import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/* Liquid, drawn rather than faked: a small physics loop (a spring for the level, decaying slosh energy, the phone's tilt)
   paints water on a canvas and a liquid fill in an SVG pill. Colours come from the theme tokens, read at run time.
   Loops run only while on screen and the tab is visible; with "reduce motion" each part draws its final still frame. */

/* ---------- shared helpers ---------- */

type RGB = [number, number, number];

function parseColour(v: string): RGB | null {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m?.[1]) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m?.[1]) return [...m[1]].map((c) => parseInt(c + c, 16)) as RGB;
  m = s.match(/rgba?\(([^)]+)\)/);
  if (m?.[1]) {
    const p = m[1].split(/[ ,/]+/).map(Number);
    return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
  }
  return null;
}
/** A theme token as RGB, e.g. token(el, "--data"). */
function token(el: Element, name: string, fallback: RGB): RGB {
  return parseColour(getComputedStyle(el).getPropertyValue(name)) ?? fallback;
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const WHITE: RGB = [255, 255, 255];
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Runs `frame(dt)` every animation frame while the element is on screen and the page is visible. */
function useFrameLoop(ref: RefObject<Element | null>, frame: (dt: number, t: number) => void, active = true) {
  const fn = useRef(frame);
  fn.current = frame;
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let raf = 0;
    let last = 0;
    let visible = true;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      fn.current(dt, now / 1000);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) start(); else stop(); }) : null;
    io?.observe(el);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); io?.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [ref, active]);
}

/** A damped spring step. Returns the new [value, velocity]. */
function spring(x: number, v: number, target: number, dt: number, k: number, damping: number): [number, number] {
  const c = 2 * Math.sqrt(k) * damping;
  const a = -k * (x - target) - c * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

/* ---------- tilt ---------- */

let tiltDeg = 0;
let tiltListening = false;
function listenTilt() {
  if (tiltListening || typeof window === "undefined") return;
  tiltListening = true;
  window.addEventListener("deviceorientation", (e) => {
    // gamma: left/right tilt in degrees. Clamp so the water never pours out of the frame.
    if (typeof e.gamma === "number") tiltDeg = Math.max(-28, Math.min(28, e.gamma));
  });
}
/**
 * Lets the water stay level when the phone tilts. iPhones ask once, so call this from a tap (the first drink does it).
 * Elsewhere it just starts listening.
 */
export function enableTilt() {
  const D = typeof DeviceOrientationEvent !== "undefined" ? (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }) : null;
  if (D?.requestPermission) void D.requestPermission().then((r) => { if (r === "granted") listenTilt(); }).catch(() => {});
  else listenTilt();
}

/* ---------- water ---------- */

interface Bubble { x: number; y: number; r: number; v: number; p: number }

/**
 * Water in a tank: the surface rises on a spring (a little overshoot, then settles), sloshes when the level jumps,
 * and leans against the phone's tilt. Three layers (a far wave, the body, a lit surface line), drifting bubbles,
 * and the percentage riding just under the surface: white in the water, faint above it.
 *
 * `size="mini"` is the 36 px tile used as a habit icon (no number, no bubbles).
 */
export function LiquidTank({ pct, size = "full", className = "", label, showNumber = true, children, top = 0.12, bottom = 0.04, numberTop = 0, numberBottom = 0 }: {
  /** 0–1 of the goal. Over 1 shows full. */
  pct: number;
  size?: "full" | "mini";
  className?: string;
  label?: string;
  showNumber?: boolean;
  children?: ReactNode;
  /** Share of the height left above the water when full. */
  top?: number;
  /** Share of the height the water fills when empty (anything laid over the bottom of the tank). */
  bottom?: number;
  /** The number never rides higher than this many px from the top (keeps it clear of the header). */
  numberTop?: number;
  /** Px kept clear above the covered bottom, e.g. for buttons over the water. */
  numberBottom?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = reducedMotion();
  const target = Math.max(0, Math.min(1, pct));
  const sim = useRef({ lvl: reduced ? target : 0, v: 0, energy: 0, tilt: 0, tiltV: 0, target, bubbles: [] as Bubble[], spawn: 0, colours: null as null | { a: RGB; b: RGB; deep: RGB; ink: RGB }, frames: 0, w: 0, h: 0, dpr: 1 });
  const mini = size === "mini";

  // A jump in level: kick the surface and send up a few bubbles.
  useEffect(() => {
    const s = sim.current;
    const jump = target - s.target;
    s.target = target;
    if (jump > 0.001) {
      s.energy = Math.min(1.6, s.energy + 0.55 + jump * 4);
      if (!mini) for (let i = 0; i < 9; i++) s.bubbles.push(newBubble(s.w, s.h, true));
    } else if (jump < -0.001) s.energy = Math.min(1.2, s.energy + 0.35);
  }, [target, mini]);

  const draw = (dt: number, t: number) => {
    const c = canvas.current;
    const el = box.current;
    if (!c || !el) return;
    const s = sim.current;
    // Size the backing store to the element, sharp on retina.
    const w = el.clientWidth;
    const h = el.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== s.w || h !== s.h || dpr !== s.dpr) {
      s.w = w; s.h = h; s.dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    if (!s.colours || s.frames++ % 90 === 0) {
      const data = token(el, "--data", [56, 189, 248]);
      const blue = token(el, "--blue", [90, 115, 214]);
      s.colours = { a: mix(data, WHITE, 0.18), b: mix(data, blue, 0.45), deep: mix(blue, [6, 14, 40], 0.45), ink: WHITE };
    }
    const col = s.colours;

    // Physics.
    if (reduced) { s.lvl = s.target; s.energy = 0; s.tilt = 0; }
    else {
      [s.lvl, s.v] = spring(s.lvl, s.v, s.target, dt, 26, 0.42);
      [s.tilt, s.tiltV] = spring(s.tilt, s.tiltV, -tiltDeg, dt, 30, 0.5);
      s.energy *= Math.exp(-dt * 1.15);
    }
    const lvl = Math.max(-0.02, Math.min(1.04, s.lvl));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const fill = bottom + lvl * (1 - top - bottom);
    const base = h * (1 - fill);
    const slope = Math.tan((s.tilt * Math.PI) / 180);
    const e = s.energy;
    const amp = mini ? 1.4 : Math.max(3, h * 0.008);
    const L = Math.max(160, w);
    // The surface: two slow swells, a quicker ripple, and slosh energy as a standing wave.
    const surface = (x: number, phase = 0) =>
      base + slope * (x - w / 2)
      + amp * Math.sin((x / L) * Math.PI * 2 * 1.1 + t * 1.25 + phase)
      + amp * 0.6 * Math.sin((x / L) * Math.PI * 2 * 2.3 - t * 1.9 + 1.7 + phase)
      + e * amp * 3.2 * Math.sin((x / L) * Math.PI * 2 * 0.9 - t * 2.4) * Math.cos(t * 3.1)
      + (s.v * 18 * (x / w - 0.5)) * (mini ? 0.2 : 1);
    const step = mini ? 3 : 6;
    const path = (phase: number, lift: number) => {
      const p = new Path2D();
      p.moveTo(0, h + 2);
      for (let x = 0; x <= w + step; x += step) p.lineTo(x, surface(x, phase) - lift);
      p.lineTo(w, h + 2);
      p.closePath();
      return p;
    };

    // Far wave: lighter, behind, out of step with the front.
    const back = path(2.4, mini ? 1.5 : amp * 1.6);
    ctx.fillStyle = rgba(col.a, 0.34);
    ctx.fill(back);

    // Body: light at the surface, deep at the bottom.
    const front = path(0, 0);
    const g = ctx.createLinearGradient(0, base - amp * 2, 0, h);
    g.addColorStop(0, rgba(col.a, 0.92));
    g.addColorStop(0.35, rgba(col.b, 0.94));
    g.addColorStop(1, rgba(col.deep, 0.98));
    ctx.fillStyle = g;
    ctx.fill(front);

    if (!mini) {
      ctx.save();
      ctx.clip(front);
      // Light falling through the water: two soft slanted bands drifting slowly.
      for (let i = 0; i < 2; i++) {
        const x0 = ((t * 14 + i * w * 0.55) % (w * 1.6)) - w * 0.3;
        const lg = ctx.createLinearGradient(x0, 0, x0 + w * 0.22, 0);
        lg.addColorStop(0, "rgba(255,255,255,0)");
        lg.addColorStop(0.5, "rgba(255,255,255,0.07)");
        lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(x0, base - 20);
        ctx.lineTo(x0 + w * 0.22, base - 20);
        ctx.lineTo(x0 + w * 0.05, h);
        ctx.lineTo(x0 - w * 0.17, h);
        ctx.fill();
      }
      // Bubbles drifting up and fading at the surface.
      s.spawn += dt;
      if (!reduced && s.spawn > 0.55 && s.bubbles.length < 26) { s.spawn = 0; s.bubbles.push(newBubble(w, h, false)); }
      s.bubbles = s.bubbles.filter((b) => {
        if (!reduced) { b.y -= b.v * dt; b.p += dt * 2.2; }
        const top = surface(b.x);
        if (b.y < top + 4) return false;
        const fade = Math.min(1, (b.y - top) / 40);
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(b.p) * 2.2, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.26 * fade})`;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * fade})`;
        ctx.stroke();
        return true;
      });
      ctx.restore();
    }

    // The lit surface line, and a faint second one under it for thickness.
    ctx.beginPath();
    for (let x = 0; x <= w + step; x += step) { const y = surface(x); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.lineWidth = mini ? 1 : 1.6;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
    if (!mini) {
      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) { const y = surface(x) + 5; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.stroke();
    }

    // The number rides just under the surface: faint where it sticks out, solid in the water.
    if (!mini && showNumber) {
      const shown = Math.max(0, Math.round(Math.max(0, s.lvl) * 100));
      const fs = Math.round(Math.min(w * 0.3, 112));
      const text = `${shown}%`;
      ctx.font = `200 ${fs}px Archivo, system-ui, sans-serif`;
      ctx.textBaseline = "alphabetic";
      const tx = Math.max(20, w * 0.07);
      const floor = h * (1 - bottom) - 6 - numberBottom;
      const ty = Math.min(floor, Math.max(numberTop + fs * 0.82, base + fs * 0.9));
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillText(text, tx, ty);
      ctx.save();
      ctx.clip(front);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }
  };

  // Redraw once fonts land, so the canvas number uses Archivo.
  const [, setFontsReady] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontsReady(1)); }, []);
  useFrameLoop(box, draw, !reduced);
  useEffect(() => { if (reduced) requestAnimationFrame(() => draw(0, 0)); });

  return (
    <div ref={box} className={`lq lq-${size} ${className}`} role={label ? "img" : undefined} aria-label={label}>
      <canvas ref={canvas} className="lq-canvas" aria-hidden="true" />
      {children !== undefined && <div className="lq-content">{children}</div>}
    </div>
  );
}

function newBubble(w: number, h: number, burst: boolean): Bubble {
  return { x: 12 + Math.random() * Math.max(10, w - 24), y: h - (burst ? Math.random() * h * 0.25 : 0) + 6, r: 1.2 + Math.random() * (burst ? 3.2 : 2.4), v: 26 + Math.random() * 46, p: Math.random() * 6 };
}

/* ---------- liquid pill ---------- */

/* Orange to amber to green: the dark-theme values of --act, --warn and --good. Fixed, because the pill sits on a dark
   glass track on both themes and the light-theme amber turns muddy when blended. */
const STATUS: RGB[] = [[255, 106, 26], [245, 158, 11], [34, 197, 94]];

/**
 * A glass pill that fills like liquid. The fill moves on a spring; its edge is a live S-curve with a lit rim that
 * wobbles when the level changes and ripples gently at rest. With `colour="status"` the liquid runs red, amber,
 * green as it fills (continuously, as it moves), otherwise it uses the token given.
 */
export function LiquidPill({ value, max = 100, colour = "status", label, size = "md", scale = false, children }: {
  value: number | null;
  max?: number;
  colour?: string;
  label: string;
  size?: "sm" | "md" | "lg";
  scale?: boolean;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const liquid = useRef<SVGPathElement>(null);
  const rim = useRef<SVGPathElement>(null);
  const reduced = reducedMotion();
  const target = value === null || !max ? 0 : Math.max(0, Math.min(1, value / max));
  const sim = useRef({ x: reduced ? target : 0, v: 0, energy: 0, target, w: 0, h: 0, palette: null as null | RGB[], fixed: null as RGB | null, frames: 0 });

  useEffect(() => {
    const s = sim.current;
    if (Math.abs(target - s.target) > 0.001) s.energy = Math.min(1.5, s.energy + 0.6 + Math.abs(target - s.target) * 2);
    s.target = target;
  }, [target]);

  const draw = (dt: number, t: number) => {
    const el = box.current;
    const lp = liquid.current;
    const rp = rim.current;
    if (!el || !lp || !rp) return;
    const s = sim.current;
    const svg = lp.ownerSVGElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w !== s.w || h !== s.h) { s.w = w; s.h = h; svg?.setAttribute("viewBox", `0 0 ${w} ${h}`); }
    if (!s.palette || s.frames++ % 90 === 0) {
      s.palette = STATUS;
      s.fixed = colour === "status" ? null : parseColour(getComputedStyle(el).getPropertyValue("--lp-fixed")) ?? null;
    }
    if (reduced) { s.x = s.target; s.energy = 0; }
    else {
      [s.x, s.v] = spring(s.x, s.v, s.target, dt, 22, 0.5);
      s.energy *= Math.exp(-dt * 1.6);
    }
    const f = Math.max(0, Math.min(1.02, s.x));
    const ex = f * w;
    // Edge: an S-curve. Rest ripple + wobble energy + lean from the fill's own speed.
    // A rounded meniscus that bulges forward, a slow ripple through it, wobble after a change, and a lean while it moves.
    const bulge = h * 0.16;
    const rest = reduced ? 0 : h * 0.13 * Math.sin(t * 1.9);
    const wob = s.energy * h * 0.34 * Math.sin(t * 8.5);
    const lean = Math.max(-h * 0.45, Math.min(h * 0.45, s.v * w * 0.05));
    const k1 = bulge + rest + wob + lean;
    const k2 = bulge - rest * 0.9 - wob * 0.8 + lean;
    const empty = f <= 0.002;
    const full = f >= 0.995;
    const edge = full ? w + h : ex;
    const d = empty ? "" : `M0 0 H${edge} C${edge + k1} ${h * 0.33} ${edge + k2} ${h * 0.67} ${edge} ${h} H0 Z`;
    lp.setAttribute("d", d);
    rp.setAttribute("d", empty || full ? "" : `M${edge} 0 C${edge + k1} ${h * 0.33} ${edge + k2} ${h * 0.67} ${edge} ${h}`);
    // Colour follows the live fill.
    let c: RGB;
    if (s.fixed) c = s.fixed;
    else {
      const p = s.palette;
      const q = Math.max(0, Math.min(1, f));
      c = q < 0.5 ? mix(p[0]!, p[1]!, q * 2) : mix(p[1]!, p[2]!, (q - 0.5) * 2);
    }
    lp.style.fill = rgba(c);
    rp.style.stroke = rgba(mix(c, WHITE, 0.55), 0.95);
  };
  useFrameLoop(box, draw, true);

  const half = max / 2;
  return (
    <div className={`lpill lpill-${size}`} style={colour !== "status" ? { ["--lp-fixed" as string]: colour } : undefined}>
      {scale && <div className="lpill-scale" aria-hidden="true"><span>0</span><span>{Number.isInteger(half) ? half : half.toFixed(1)}</span><span>{max}</span></div>}
      <div ref={box} className="lpill-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined}>
        <svg className="lpill-svg" preserveAspectRatio="none" aria-hidden="true">
          <path ref={liquid} className="lpill-liquid" />
          <path ref={rim} className="lpill-rim" fill="none" />
        </svg>
        {children && <div className="lpill-text">{children}</div>}
      </div>
    </div>
  );
}

/** The pill on a dark rounded tile with a title, like a control-centre tile. */
export function LiquidTile({ title, sub, ...pill }: Parameters<typeof LiquidPill>[0] & { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="lp-tile">
      <div className="lp-tile-head"><b>{title}</b>{sub && <span>{sub}</span>}</div>
      <LiquidPill {...pill} size="lg" scale />
    </div>
  );
}
