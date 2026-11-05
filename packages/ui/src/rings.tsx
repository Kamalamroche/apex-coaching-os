import { Icons } from "./icons";
import { CountUp } from "./motion";

/* The day's three rings as one circle cut in three arcs (Train, Move, Fuel), the streak in the middle,
   and a legend beside it. Each arc fills from its start; a closed arc gets a small check at its end. */

export interface RingView {
  key: "train" | "move" | "fuel";
  label: string;
  value: number;
  closed: boolean;
  detail: string;
}

export const RING_COLOURS: Record<RingView["key"], string> = { train: "var(--act)", move: "var(--viz-3)", fuel: "var(--viz-1)" };

const GAP = 16; // degrees between arcs
const polar = (c: number, r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
};
function arc(c: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(c, r, from);
  const [x2, y2] = polar(c, r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function DailyRings({ rings, streak, best, onOpen }: { rings: RingView[]; streak: number; best: number; onOpen?: () => void }) {
  const size = 148;
  const stroke = 12;
  const c = size / 2;
  const r = c - stroke / 2 - 2;
  const span = 360 / rings.length;
  const label = `Today: ${rings.map((x) => `${x.label} ${Math.round(x.value * 100)}%`).join(", ")}. ${streak}-day streak.`;
  return (
    <div className="dr" role="group" aria-label={label}>
      <div className="dr-dial" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
          {rings.map((x, i) => {
            const from = i * span + GAP / 2;
            const to = (i + 1) * span - GAP / 2;
            const d = arc(c, r, from, to);
            const [ex, ey] = polar(c, r, to);
            const colour = RING_COLOURS[x.key];
            return (
              <g key={x.key} style={{ color: colour, ["--i" as string]: i }}>
                <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={stroke} strokeLinecap="round" />
                {x.value > 0.005 && (
                  <path className="dr-fill" d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${x.value} 2`} />
                )}
                {x.closed && (
                  <g className="dr-tick" transform={`translate(${ex.toFixed(2)} ${ey.toFixed(2)})`}>
                    <circle r={stroke / 2 + 1} fill="currentColor" />
                    <path d="M -3 0.2 L -0.9 2.3 L 3.2 -2" fill="none" stroke="var(--bg)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <div className="dr-mid">
          <Icons.flame width={18} height={18} className={`dr-flame ${streak > 0 ? "lit" : ""}`} />
          <b><CountUp value={streak} duration={700} /></b>
          <span>day streak</span>
        </div>
      </div>
      <ul className="dr-legend">
        {rings.map((x, i) => (
          <li key={x.key} style={{ ["--c" as string]: RING_COLOURS[x.key], ["--i" as string]: i }} className={x.closed ? "closed" : ""}>
            <i aria-hidden="true" />
            <span className="grow">
              <b>{x.label}</b>
              <small>{x.detail}</small>
            </span>
            <span className="dr-pct num">{x.closed ? <Icons.check width={14} height={14} /> : `${Math.round(x.value * 100)}%`}</span>
          </li>
        ))}
        <li className="dr-best">
          {onOpen ? <button className="lnk" onClick={onOpen}>Best streak {best} days ›</button> : <span>Best streak {best} days</span>}
        </li>
      </ul>
    </div>
  );
}

/** Seven small dials, one per day, each showing how many rings closed (0 to 3). */
export function RingWeek({ days, labels }: { days: { day: string; closed: number; which: boolean[] }[]; labels: string[] }) {
  return (
    <div className="dr-week" role="list" aria-label="Rings this week">
      {days.map((d, i) => (
        <div key={d.day} role="listitem" className={`dr-day ${d.closed === 3 ? "full" : ""}`} aria-label={`${labels[i]}: ${d.closed} of 3 rings closed`} style={{ ["--i" as string]: i }}>
          <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true">
            {(["train", "move", "fuel"] as const).map((k, j) => (
              <path key={k} d={arc(14, 10.5, j * 120 + 14, (j + 1) * 120 - 14)} fill="none" stroke={RING_COLOURS[k]} strokeOpacity={d.which[j] ? 1 : 0.24} strokeWidth={4} strokeLinecap="round" />
            ))}
          </svg>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}
