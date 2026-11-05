import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
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

/* ---------- Liquid ---------- */

/** A wave strip `w` wide made of whole periods, so sliding it by half its width loops without a seam. */
function wavePath(w: number, h: number, period: number, amp: number): string {
  const mid = h / 2;
  let d = `M0 ${mid}`;
  for (let x = 0; x < w; x += period) d += ` Q${x + period / 4} ${mid - amp} ${x + period / 2} ${mid} T${x + period} ${mid}`;
  return `${d} V${h} H0 Z`;
}
const WAVE_FRONT = wavePath(1600, 24, 400, 9);
const WAVE_BACK = wavePath(1600, 24, 320, 7);

/** Bumps a counter whenever `value` changes after the first render, so a component can replay a one-off motion. */
function useBump(value: number): number {
  const [n, setN] = useState(0);
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value) setN((x) => x + 1);
    last.current = value;
  }, [value]);
  return n;
}

/**
 * A tank of water that rises to `pct` (0–1) with a moving surface. When the level changes the surface sloshes once.
 * `big` is drawn twice: dark above the waterline and white below it, so the number reads the same wherever the water is.
 * `size="mini"` is the small tile used as an icon.
 */
export function LiquidTank({ pct, big, children, size = "full", className = "", label }: {
  pct: number;
  big?: ReactNode;
  children?: ReactNode;
  size?: "full" | "mini";
  className?: string;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, pct));
  // Fills from empty on first show, then follows the value.
  const [lvl, setLvl] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) return setLvl(target);
    const id = requestAnimationFrame(() => setLvl(target));
    return () => cancelAnimationFrame(id);
  }, [target, reduced]);
  const bump = useBump(target);
  // A full tank still shows its surface; an empty one keeps a sliver so it reads as water.
  const shown = size === "mini" ? 0.1 + lvl * 0.78 : 0.035 + lvl * 0.83;
  return (
    <div className={`lq lq-${size} ${className}`} style={{ ["--lvl" as string]: shown }} role={label ? "img" : undefined} aria-label={label}>
      {big !== undefined && <div className="lq-big" aria-hidden="true">{big}</div>}
      <div className="lq-water" aria-hidden="true">
        <div className={`lq-surface ${bump ? "slosh" : ""}`} key={bump}>
          <svg className="lq-wave back" viewBox="0 0 1600 24" preserveAspectRatio="none"><path d={WAVE_BACK} /></svg>
          <svg className="lq-wave front" viewBox="0 0 1600 24" preserveAspectRatio="none"><path d={WAVE_FRONT} /></svg>
        </div>
        <div className="lq-body">
          {size === "full" && [0, 1, 2, 3, 4].map((i) => <i key={i} className="lq-bubble" style={{ left: `${14 + i * 17}%`, animationDelay: `${i * 1.3}s`, ["--s" as string]: `${3 + (i % 3)}px` }} />)}
        </div>
      </div>
      {big !== undefined && <div className="lq-big lq-big-in" aria-hidden="true">{big}</div>}
      {children !== undefined && <div className="lq-content">{children}</div>}
    </div>
  );
}

/** Low to high: red, amber, green, blended so the colour moves smoothly as the value fills. */
export function statusColour(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  return p < 50
    ? `color-mix(in oklab, var(--warn) ${Math.round(p * 2)}%, var(--crit))`
    : `color-mix(in oklab, var(--good) ${Math.round((p - 50) * 2)}%, var(--warn))`;
}

/**
 * A rounded glass pill that fills like liquid, with a moving edge where the liquid is.
 * `colour` is a token such as "var(--viz-1)", or "status" to run red to amber to green with the value.
 */
export function LiquidPill({ value, max = 100, colour = "status", label, size = "md", scale = false, children }: {
  value: number | null;
  max?: number;
  colour?: string;
  label: string;
  size?: "sm" | "md" | "lg";
  /** Show 0, half and max above the pill. */
  scale?: boolean;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const pct = value === null || !max ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const [shown, setShown] = useState(reduced ? pct : 0);
  useEffect(() => {
    if (reduced) return setShown(pct);
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, reduced]);
  const bump = useBump(pct);
  const tint = colour === "status" ? statusColour(pct) : colour;
  const half = max / 2;
  return (
    <div className={`lpill lpill-${size}`}>
      {scale && <div className="lpill-scale num" aria-hidden="true"><span>0</span><span>{Number.isInteger(half) ? half : half.toFixed(1)}</span><span>{max}</span></div>}
      <div className="lpill-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value ?? undefined}>
        <div className={`lpill-fill ${shown >= 99.5 ? "full" : ""}`} style={{ width: `${shown}%`, color: tint }}>
          {shown > 0 && shown < 99.5 && (
            <svg className={`lpill-edge ${bump ? "slosh" : ""}`} key={bump} viewBox="0 0 10 160" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0 H4 Q10 10 4 20 T4 40 T4 60 T4 80 T4 100 T4 120 T4 140 T4 160 H0 Z" />
            </svg>
          )}
        </div>
        {children && <div className="lpill-text">{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Number wheel ---------- */

const ITEM = 42;
const ROWS = 7;
const STEP_DEG = 21;
const RADIUS = ITEM / ((STEP_DEG * Math.PI) / 180);

/**
 * A 3D wheel of numbers, like a drum seen side on: flick it, it snaps to a value, the middle one is the pick.
 * Uses the browser's own scrolling (so momentum feels native on phones) and moves the rows itself without re-rendering.
 * Arrow keys step by one, Page Up and Page Down by ten.
 */
export function Wheel({ values, index, onIndex, format = String, label, width = 92, align = "center" }: {
  values: number[];
  index: number;
  onIndex: (i: number) => void;
  format?: (v: number) => string;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
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
      row.style.transform = reduced ? "" : `translateY(${y.toFixed(2)}px) rotateX(${(-a).toFixed(2)}deg) scale(${(1 + near * 0.14).toFixed(3)})`;
      row.style.opacity = (reduced ? (Math.abs(d) < 0.5 ? 1 : 0.4) : Math.max(0.08, Math.pow(Math.cos(rad), 2.2))).toFixed(3);
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
  }, [values.length, reduced]);

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
      <div className="wheel-lens" aria-hidden="true" style={{ top: (ITEM * (ROWS - 1)) / 2, height: ITEM }} />
      <div ref={box} className="wheel-scroll" tabIndex={0} onScroll={onScroll} onKeyDown={onKey}
        role="spinbutton" aria-label={label} aria-valuenow={values[live]} aria-valuetext={format(values[live] ?? 0)} aria-valuemin={values[0]} aria-valuemax={values.at(-1)}
        style={{ paddingBlock: (ITEM * (ROWS - 1)) / 2 }}>
        {values.map((v, i) => (
          <div key={i} ref={(r) => { rows.current[i] = r; }} className="wheel-i num" style={{ height: ITEM }} onClick={() => go(i)}>{format(v)}</div>
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
 * A bottom sheet with a number wheel and a Confirm button. Steps under 1 (kg in quarters, body weight in tenths)
 * get a second wheel for the part after the point. "Type it" swaps to the keyboard for anyone who prefers it.
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
  const split = step < 1;
  const whole = split ? range(Math.floor(min), Math.floor(max), 1) : range(min, max, step);
  const parts = split ? range(0, 1 - step / 2, step) : [0];
  const start = value === null || !Number.isFinite(value) ? min : Math.max(min, Math.min(max, value));
  const [wi, setWi] = useState(() => nearest(whole, split ? Math.floor(start + 1e-9) : start));
  const [pi, setPi] = useState(() => (split ? nearest(parts, start - Math.floor(start + 1e-9)) : 0));
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState(value === null ? "" : trimNum(start));
  const picked = Math.max(min, Math.min(max, Number(((whole[wi] ?? min) + (parts[pi] ?? 0)).toFixed(4))));
  const confirm = () => {
    if (typing) {
      const n = Number(typed.replace(",", "."));
      if (Number.isFinite(n) && typed.trim()) onConfirm(Math.max(min, Math.min(max, n)));
      else onClose();
      return;
    }
    onConfirm(picked);
  };
  const fracText = (f: number) => {
    const s = f.toFixed(step < 0.1 ? 2 : step % 0.5 === 0 ? 1 : 2).slice(1);
    return s === ".0" || s === ".00" ? ".0" : s.replace(/0$/, "");
  };
  return (
    <Sheet onClose={onClose} label={title}>
      <div className="nsheet">
        <div className="nsheet-head">
          <span className="eyebrow">{title}</span>
          <b className="num">{typing ? (typed || "–") : trimNum(picked)}{unit && <small> {unit}</small>}</b>
        </div>
        {typing ? (
          <input className="field num nsheet-type" inputMode="decimal" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirm()} aria-label={title} />
        ) : (
          <div className="nsheet-wheels">
            <Wheel values={whole} index={wi} onIndex={setWi} label={split ? `${title}, whole ${unit ?? ""}` : title} format={(v) => String(v)} width={split ? 96 : 120} align={split ? "right" : "center"} />
            {split && <Wheel values={parts} index={pi} onIndex={setPi} label={`${title}, after the point`} format={fracText} width={72} align="left" />}
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
