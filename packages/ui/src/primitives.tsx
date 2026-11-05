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

/** Classic Roman-capital title for photos and big headings: tall high-contrast serif capitals, widely spaced, one
 * short phrase per line, with an optional tiny spaced caption underneath ("VENI / VIDI / VICI", "I came. I saw."). Text after
 * " · " becomes the caption when none is given. */
export function EditorialTitle({ text, caption, as: Tag = "h2", className = "" }: { text: string; caption?: string; as?: "h1" | "h2" | "h3"; className?: string }) {
  const t = text.trim();
  const dot = t.indexOf(" · ");
  const main = dot > 0 ? t.slice(0, dot) : t;
  const cap = caption ?? (dot > 0 ? t.slice(dot + 3) : "");
  const words = main.split(/\s+/);
  // Short words share a line ("LOWER A"), so lines stay balanced like the poster.
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (w.length <= 2 || last.length <= 2)) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return (
    <Tag className={`ed-title ${className}`} aria-label={cap ? `${main}. ${cap}` : main}>
      {lines.map((l, k) => <span key={k} className="ed-line" aria-hidden="true" style={{ ["--k" as string]: k }}>{l}</span>)}
      {cap && <small className="ed-cap" aria-hidden="true">{cap}</small>}
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
