import { useEffect, useState } from "react";

/**
 * Moving habit icons, the same 36 px tile as the water tank (`LiquidTank size="mini"`).
 * StepsTile: a ring that winds up to the day's steps while two footprints walk inside it.
 * NightTile: a small night sky, moon rocking and stars twinkling; once the person was in bed on time it sleeps (Zz).
 */
export function StepsTile({ pct, label }: { pct: number; label?: string }) {
  const target = Math.max(0, Math.min(1, pct));
  // Start empty, then wind up, so the ring visibly fills when the screen opens.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const C = 2 * Math.PI * 14;
  return (
    <span className={`ht-tile ht-steps${target >= 1 ? " done" : ""}`} role="img" aria-label={label}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r="14" className="ht-track" />
        <circle cx="18" cy="18" r="14" className="ht-arc" strokeDasharray={C} strokeDashoffset={C * (1 - shown)} transform="rotate(-90 18 18)" />
        {/* Shoe prints: forefoot and heel, the right one a step ahead. */}
        <g transform="rotate(-8 14 20)"><g className="ht-foot l"><ellipse cx="14" cy="17.4" rx="2.5" ry="3.6" /><ellipse cx="14.2" cy="23.6" rx="1.9" ry="2.1" /></g></g>
        <g transform="rotate(8 22 15)"><g className="ht-foot r"><ellipse cx="22" cy="12.6" rx="2.5" ry="3.6" /><ellipse cx="21.8" cy="18.8" rx="1.9" ry="2.1" /></g></g>
      </svg>
    </span>
  );
}

export function NightTile({ done, label }: { done: boolean; label?: string }) {
  return (
    <span className={`ht-tile ht-night${done ? " done" : ""}`} role="img" aria-label={label}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <g className="ht-moon"><path d="M21.5 9.5a8.5 8.5 0 1 0 6.4 13.9A7 7 0 0 1 21.5 9.5z" /></g>
        <circle className="ht-star s1" cx="9" cy="9" r="1" />
        <circle className="ht-star s2" cx="28.5" cy="8" r=".8" />
        <circle className="ht-star s3" cx="7" cy="24" r=".7" />
        {done && <><text className="ht-z z1" x="24" y="15">z</text><text className="ht-z z2" x="27" y="11">z</text></>}
      </svg>
    </span>
  );
}
