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

/** Poster title: a handwritten word in HELIX orange resting on a bold condensed line. Screen readers hear one plain heading. */
export function ScriptTitle({ script, children, as: Tag = "h1", className = "" }: { script: string; children: ReactNode; as?: "h1" | "h2"; className?: string }) {
  return (
    <Tag className={`stitle ${className}`}>
      <span className="s">{script}</span>{" "}
      <span className="b">{children}</span>
    </Tag>
  );
}

/** A campaign photo with a big poster word set behind the athlete (photo, then word, then the athlete cut-out on top). */
export function HeroBackdrop({ art, word, focus }: { art: { src: string; cut?: string; focus: string; word: string; ink: "light" | "act" }; word?: string | null; focus?: string }) {
  const text = word === null ? "" : (word ?? art.word).toUpperCase();
  const pos = { objectPosition: focus ?? art.focus };
  return (
    <>
      <img className="hero-img" src={art.src} alt="" style={pos} />
      {text && <span className={`hero-word ink-${art.ink}`} aria-hidden="true" style={{ ["--n" as string]: Math.max(text.length, 3) }}>{text}</span>}
      {text && art.cut && <img className="hero-cut" src={art.cut} alt="" style={pos} />}
    </>
  );
}
