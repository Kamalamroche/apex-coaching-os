import type { ReactNode } from "react";

/* Arc gauge for 0–100 scores (readiness and anything like it). A 270° sweep, open at the bottom,
   with optional band markers. Colour comes from the caller as a token, e.g. "var(--good)". */
export function Gauge({ value, size = 200, stroke = 14, color = "var(--act)", marks = [], label, children }: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  /** Values to tick on the track, e.g. band edges [45, 70]. */
  marks?: number[];
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2 - 2;
  const c = size / 2;
  const sweep = 270;
  const len = 2 * Math.PI * r * (sweep / 360);
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  // Starts at the bottom left (135°) and runs clockwise to the bottom right.
  const at = (v: number) => {
    const a = ((135 + (sweep * v) / 100) * Math.PI) / 180;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const [x0, y0] = at(0);
  const [x1, y1] = at(100);
  const arc = `M${x0} ${y0}A${r} ${r} 0 1 1 ${x1} ${y1}`;
  return (
    <div className="gauge" style={{ width: size, height: size, color }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <path d={arc} fill="none" stroke="var(--line)" strokeWidth={stroke} strokeLinecap="round" />
        {value !== null && (
          <path className="gauge-fill" d={arc} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - pct)} />
        )}
        {marks.map((m) => {
          const [mx, my] = at(m);
          return <circle key={m} cx={mx} cy={my} r={stroke / 5} fill="var(--bg)" opacity={0.85} />;
        })}
      </svg>
      <div className="gauge-mid">{children}</div>
    </div>
  );
}

/** Small full ring for a 1–5 answer, with an icon in the middle. */
export function MiniRing({ value, max = 5, size = 52, color, children, label }: { value: number | null; max?: number; size?: number; color: string; children?: ReactNode; label: string }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const pct = value ? value / max : 0;
  return (
    <div className="gauge" style={{ width: size, height: size, color }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle className="gauge-fill" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - pct)} opacity={value ? 1 : 0} />
      </svg>
      <div className="gauge-mid">{children}</div>
    </div>
  );
}
