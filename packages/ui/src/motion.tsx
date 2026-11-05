import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Sheet } from "./Sheet";

/* APEX motion: the moving parts shared across the apps. Original pieces on our tokens:
   a rising liquid tank, a liquid progress pill, a 3D number wheel, and numbers that count to their value.
   Everything settles to a still state, and with "reduce motion" switched on it simply shows the end result. */

const media = (q: string) => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q) : null);

function useMedia(q: string): boolean {
  const [on, setOn] = useState(() => !!media(q)?.matches);
  useEffect(() => {
    const m = media(q);
    if (!m) return;
    const f = () => setOn(m.matches);
    f();
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, [q]);
  return on;
}

/** True when the person has asked their device for less motion. */
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
/** True on touch screens, where a wheel is quicker than the keyboard. */
export const useCoarsePointer = () => useMedia("(pointer: coarse)");

const easeOut = (k: number) => 1 - Math.pow(1 - k, 4);

/** A number that counts from where it was (0 the first time) to its value. Screen readers hear only the final value. */
export function CountUp({ value, decimals = 0, duration = 900, format, className, style }: {
  value: number;
  decimals?: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const v = a + (value - a) * easeOut(k);
      from.current = v;
      setShown(k < 1 ? v : value);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, duration]);
  const text = (v: number) => (format ? format(v) : v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return (
    <span className={className} style={style}>
      <span aria-hidden="true">{text(shown)}</span>
      <span className="sr-only">{text(value)}</span>
    </span>
  );
}

/**
 * Text whose digits roll like an odometer when they change (timers, counters). Each digit is a strip of 0 to 9 that
 * slides to its value; other characters stay put. Digits keep their place counted from the right, so 1:00 to 59 rolls cleanly.
 */
export function Rolling({ text, className }: { text: string; className?: string }) {
  const chars = [...text];
  return (
    <span className={`roll ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => {
        const key = chars.length - i;
        if (!/[0-9]/.test(ch)) return <span key={key} className="roll-c" aria-hidden="true">{ch}</span>;
        return (
          <span key={key} className="roll-d" aria-hidden="true">
            <span className="roll-s" style={{ translate: `0 ${-Number(ch)}em` }}>
              {DIGITS.map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; wob: number };

/**
 * A short burst of paper confetti in the token colours when something is achieved (a finished workout, a personal best).
 * Plays once for about two and a half seconds, never blocks taps, and is skipped entirely with "reduce motion".
 */
export function Celebrate({ big = false }: { big?: boolean }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const cv = ref.current;
    if (reduced || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colours = ["--act", "--blue", "--good", "--warn", "--data"].map((n) => css.getPropertyValue(n).trim() || "#FF6A1A");
    const n = big ? 130 : 70;
    const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const a = (fromLeft ? -Math.PI / 3 : -Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.9;
      const sp = 9 + Math.random() * (big ? 9 : 6);
      return {
        x: fromLeft ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.2),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        w: 5 + Math.random() * 5, h: 8 + Math.random() * 7,
        c: colours[i % colours.length]!, wob: Math.random() * 10,
      };
    });
    try { navigator.vibrate?.(big ? [40, 60, 40, 60, 90] : 40); } catch { /* not supported */ }
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const frame = (t: number) => {
      const dt = Math.min(2, (t - last) / 16.7);
      last = t;
      const age = (t - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      const fade = age > 1.9 ? Math.max(0, 1 - (age - 1.9) / 0.6) : 1;
      for (const p of pieces) {
        p.vy += 0.32 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy = Math.min(p.vy, 4.5 + Math.sin(age * 6 + p.wob));
        p.x += (p.vx + Math.sin(age * 5 + p.wob) * 0.8) * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.scale(1, Math.cos(age * 9 + p.wob));
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (age < 2.5) raf = requestAnimationFrame(frame);
      else setDone(true);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced, big]);
  if (reduced || done) return null;
  return createPortal(<canvas ref={ref} className="celebrate" aria-hidden="true" />, document.body);
}

/** Low to high: red, amber, green, blended so the colour moves smoothly as the value fills. */
export function statusColour(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  return p < 50
    ? `color-mix(in oklab, var(--warn) ${Math.round(p * 2)}%, var(--crit))`
    : `color-mix(in oklab, var(--good) ${Math.round((p - 50) * 2)}%, var(--warn))`;
}

/* ---------- Number wheel ---------- */

const ITEM = 44;
const ROWS = 7;
const STEP_DEG = 19;
/** How far rows bow sideways at the ends of the wheel, like numbers printed round a dial. */
const ARC = 64;
const RADIUS = ITEM / ((STEP_DEG * Math.PI) / 180);

/**
 * A 3D wheel of numbers, like a drum seen side on: flick it, it snaps to a value, the middle one is the pick.
 * Uses the browser's own scrolling (so momentum feels native on phones) and moves the rows itself without re-rendering.
 * Arrow keys step by one, Page Up and Page Down by ten.
 */
export function Wheel({ values, index, onIndex, format = String, label, width = 92, align = "center", curve = "left" }: {
  values: number[];
  index: number;
  onIndex: (i: number) => void;
  format?: (v: number) => string;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
  /** Which way the dial bows. A pair of wheels bow away from each other. */
  curve?: "left" | "right" | "none";
}) {
  const box = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const painted = useRef(new Set<number>());
  const current = useRef(index);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useReducedMotion();
  const [live, setLive] = useState(index);

  const paint = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const c = el.scrollTop / ITEM;
    const next = new Set<number>();
    for (let i = Math.max(0, Math.floor(c) - 5); i <= Math.min(values.length - 1, Math.ceil(c) + 5); i++) {
      const row = rows.current[i];
      if (!row) continue;
      const d = i - c;
      const a = d * STEP_DEG;
      if (Math.abs(a) >= 88) continue;
      const rad = (a * Math.PI) / 180;
      const y = RADIUS * Math.sin(rad) - d * ITEM;
      const near = Math.max(0, 1 - Math.abs(d));
      const side = curve === "left" ? -1 : curve === "right" ? 1 : 0;
      const x = side * ARC * (1 - Math.cos(rad));
      const turn = -side * a * 0.42;
      row.style.transform = reduced ? "" : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateX(${(-a).toFixed(2)}deg) rotate(${turn.toFixed(2)}deg) scale(${(1 + near * 0.22).toFixed(3)})`;
      row.style.opacity = (reduced ? (Math.abs(d) < 0.5 ? 1 : 0.4) : Math.max(0.06, Math.pow(Math.cos(rad), 3))).toFixed(3);
      row.classList.toggle("on", Math.abs(d) < 0.5);
      next.add(i);
    }
    for (const i of painted.current) if (!next.has(i)) { const row = rows.current[i]; if (row) row.style.opacity = "0"; }
    painted.current = next;
    const n = Math.max(0, Math.min(values.length - 1, Math.round(c)));
    if (n !== current.current) {
      current.current = n;
      setLive(n);
      // A tiny tick on phones that support it, like a detent.
      if (!reduced) navigator.vibrate?.(3);
    }
  }, [values.length, reduced, curve]);

  // Follow the value from outside (first show, or the other wheel of a pair).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
    current.current = index;
    setLive(index);
    paint();
  }, [index, paint]);

  const onScroll = () => {
    requestAnimationFrame(paint);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (current.current !== index) onIndex(current.current);
    }, 110);
  };
  useEffect(() => () => clearTimeout(settle.current), []);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(values.length - 1, i));
    box.current?.scrollTo({ top: n * ITEM, behavior: reduced ? "auto" : "smooth" });
    if (reduced) onIndex(n);
  };
  const onKey = (e: KeyboardEvent) => {
    const jump: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 };
    const by = jump[e.key];
    if (by !== undefined) { e.preventDefault(); go(current.current + by); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(values.length - 1); }
  };

  return (
    <div className={`wheel wheel-${align}`} style={{ width, height: ITEM * ROWS }}>
      <div ref={box} className="wheel-scroll" tabIndex={0} onScroll={onScroll} onKeyDown={onKey}
        role="spinbutton" aria-label={label} aria-valuenow={values[live]} aria-valuetext={format(values[live] ?? 0)} aria-valuemin={values[0]} aria-valuemax={values.at(-1)}
        style={{ paddingBlock: (ITEM * (ROWS - 1)) / 2 }}>
        {values.map((v, i) => (
          <div key={i} ref={(r) => { rows.current[i] = r; }} className="wheel-i" style={{ height: ITEM }} onClick={() => go(i)}>{format(v)}</div>
        ))}
      </div>
    </div>
  );
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let k = 0; from + k * step <= to + 1e-9; k++) out.push(Number((from + k * step).toFixed(4)));
  return out;
};
const nearest = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs((list[best] ?? 0) - v) ? i : best), 0);
const trimNum = (v: number) => String(Number(v.toFixed(2)));

/**
 * A bottom sheet with a curved number dial and a Confirm button. "Type it instead" swaps to the keyboard for anyone who prefers it.
 */
export function NumberSheet({ title, value, min, max, step, unit, onConfirm, onClose }: {
  title: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onConfirm: (v: number) => void;
  onClose: () => void;
}) {
  // One dial for every step (kg in quarters, body weight in tenths): like the reference, a single curved column.
  const values = range(min, max, step);
  const start = value === null || !Number.isFinite(value) ? min : Math.max(min, Math.min(max, value));
  const [wi, setWi] = useState(() => nearest(values, start));
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState(value === null ? "" : trimNum(start));
  const picked = values[wi] ?? min;
  const confirm = () => {
    if (typing) {
      const n = Number(typed.replace(",", "."));
      if (Number.isFinite(n) && typed.trim()) onConfirm(Math.max(min, Math.min(max, n)));
      else onClose();
      return;
    }
    onConfirm(picked);
  };
  return (
    <Sheet onClose={onClose} label={title}>
      <div className="nsheet">
        <div className="nsheet-head">
          <span className="eyebrow">{title}</span>
          <b>{typing ? (typed || "–") : trimNum(picked)}{unit && <small> {unit}</small>}</b>
        </div>
        {typing ? (
          <input className="field nsheet-type" inputMode="decimal" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirm()} aria-label={title} />
        ) : (
          <div className="nsheet-wheels">
            <Wheel values={values} index={wi} onIndex={setWi} label={title} format={trimNum} width={170} align="center" curve="left" />
            {unit && <span className="nsheet-unit">{unit}</span>}
          </div>
        )}
        <button className="btn act block nsheet-ok" onClick={confirm}>Confirm</button>
        <button className="link" style={{ alignSelf: "center" }} onClick={() => setTyping(!typing)}>{typing ? "Use the wheel" : "Type it instead"}</button>
      </div>
    </Sheet>
  );
}

/**
 * A number box that types like any input on a computer, and opens the wheel sheet on a phone.
 * `value` and `onChange` are strings, like the input it replaces.
 */
export function WheelInput({ value, onChange, title, min, max, step, unit, fallback, className = "field num", id, style, placeholder, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Where the wheel starts when the box is empty, e.g. last time's weight. */
  fallback?: number;
  className?: string;
  id?: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState(false);
  const n = Number(value.replace(",", "."));
  const start = value.trim() && Number.isFinite(n) ? n : fallback ?? null;
  return (
    <>
      <input id={id} className={className} style={style} placeholder={placeholder} aria-label={ariaLabel ?? title} value={value}
        inputMode={coarse ? "none" : step < 1 ? "decimal" : "numeric"} readOnly={coarse}
        onClick={() => coarse && setOpen(true)} onKeyDown={(e) => coarse && (e.key === "Enter" || e.key === " ") && setOpen(true)}
        onChange={(e) => onChange(e.target.value)} />
      {/* In a portal, so a wrapping <label> can't re-open it when Confirm is tapped. */}
      {open && typeof document !== "undefined" && createPortal(<NumberSheet title={title} value={start} min={min} max={max} step={step} unit={unit} onClose={() => setOpen(false)} onConfirm={(v) => { onChange(trimNum(v)); setOpen(false); }} />, document.body)}
    </>
  );
}
