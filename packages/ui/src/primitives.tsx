import { clamp } from "@apex/core";
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
