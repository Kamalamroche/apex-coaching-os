import { type ReactNode } from "react";
import { LiquidTank } from "./liquid";

/**
 * Moving habit icons, the same 36 px liquid tile as the water habit, so all three move the same way:
 * StepsTile fills orange with the day's steps, two footprints walking in it.
 * NightTile fills deep indigo as the evening runs towards bedtime, with a rocking moon and twinkling stars; once the
 * person was in bed on time it is full and sleeps (Zz).
 * The glyph sits over the liquid twice: in ink above the surface and in white below it, so it reads on both.
 */
const FULL_TOP = 0.12;
const FULL_BOTTOM = 0.04;

function Glyph({ pct, children, className }: { pct: number; children: ReactNode; className: string }) {
  // Where the surface sits at rest, as a share of the tile from the top (matches LiquidTank's mini fill).
  const fill = FULL_BOTTOM + Math.max(0, Math.min(1, pct)) * (1 - FULL_TOP - FULL_BOTTOM);
  const cut = `${Math.round((1 - fill) * 100)}%`;
  return (
    <span className={`ht-glyph ${className}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" width="36" height="36" className="ht-ink">{children}</svg>
      <svg viewBox="0 0 36 36" width="36" height="36" className="ht-lit" style={{ clipPath: `inset(${cut} 0 0 0)` }}>{children}</svg>
    </span>
  );
}

export function StepsTile({ pct, label }: { pct: number; label?: string }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <LiquidTank size="mini" tone="energy" pct={p} label={label} showNumber={false} className={`ht-tile ht-steps${p >= 1 ? " done" : ""}`}>
      <Glyph pct={p} className="ht-steps-glyph">
        {/* Shoe prints: forefoot and heel, the right one a step ahead. */}
        <g transform="rotate(-8 14 20)"><g className="ht-foot l"><ellipse cx="14" cy="17.4" rx="2.5" ry="3.6" /><ellipse cx="14.2" cy="23.6" rx="1.9" ry="2.1" /></g></g>
        <g transform="rotate(8 22 15)"><g className="ht-foot r"><ellipse cx="22" cy="12.6" rx="2.5" ry="3.6" /><ellipse cx="21.8" cy="18.8" rx="1.9" ry="2.1" /></g></g>
      </Glyph>
    </LiquidTank>
  );
}

/** `pct`: how far the evening has run towards bedtime (0 at 6 pm). Done shows full. */
export function NightTile({ done, label, pct = 0 }: { done: boolean; label?: string; pct?: number }) {
  const p = done ? 1 : Math.max(0, Math.min(1, pct));
  return (
    <LiquidTank size="mini" tone="night" pct={p} label={label} showNumber={false} className={`ht-tile ht-night${done ? " done" : ""}`}>
      <Glyph pct={p} className="ht-night-glyph">
        <g className="ht-moon"><path d="M21.5 9.5a8.5 8.5 0 1 0 6.4 13.9A7 7 0 0 1 21.5 9.5z" /></g>
        <circle className="ht-star s1" cx="9" cy="9" r="1" />
        <circle className="ht-star s2" cx="28.5" cy="8" r=".8" />
        <circle className="ht-star s3" cx="7" cy="24" r=".7" />
        {done && <><text className="ht-z z1" x="24" y="15">z</text><text className="ht-z z2" x="27" y="11">z</text></>}
      </Glyph>
    </LiquidTank>
  );
}
