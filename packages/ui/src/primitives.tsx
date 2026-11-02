import { clamp, type Tone } from "@apex/core";
import type { ReactNode } from "react";

export const Bar = ({ pct, color = "var(--act)" }: { pct: number; color?: string }) => (
  <div className="bar">
    <div style={{ width: `${clamp(pct, 0, 100)}%`, background: color }} />
  </div>
);

/** Evidence labels. Every AI or data-driven line says what it is: Data, Insight, AI suggestion or Coach decision. */
export type LabelKind = "data" | "insight" | "ai" | "dec" | "crit";
export const Label = ({ kind, children }: { kind: LabelKind; children: ReactNode }) => (
  <span className={`label l-${kind}`}>{children}</span>
);

export const Avatar = ({ initials, size = 40, tone }: { initials: string; size?: number; tone?: string }) => (
  <div
    className="ava"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.36,
      ...(tone ? { background: `color-mix(in srgb,${tone} 16%,transparent)`, color: tone } : {}),
    }}
  >
    {initials}
  </div>
);

export const BackLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button className="link" onClick={onClick} style={{ alignSelf: "flex-start" }}>
    ← {children}
  </button>
);

export const riskColor = (risk: "high" | "medium" | "low"): string =>
  ({ high: "var(--crit)", medium: "var(--warn)", low: "var(--good)" })[risk];

const TONE: Record<Tone, string> = { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", muted: "var(--text3)" };

/** A small status pill, e.g. "Renews 2 December" or "Payment failed". */
export const StatusChip = ({ text, tone }: { text: string; tone: Tone }) => (
  <span className="chip" style={{ color: TONE[tone], borderColor: `color-mix(in srgb,${TONE[tone]} 40%,transparent)` }}>{text}</span>
);

/** "£120 a month": the amount in the number face, the period in plain text. */
export const Price = ({ amount, per, size = 18 }: { amount: string; per?: string; size?: number }) => (
  <span style={{ whiteSpace: "nowrap" }}>
    <span className="num" style={{ fontWeight: 800, fontSize: size }}>{amount}</span>
    {per && <span className="small"> a {per}</span>}
  </span>
);
