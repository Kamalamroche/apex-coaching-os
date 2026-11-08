import type { CSSProperties } from "react";

/* Week views for nutrition, shared by the client's food log and the coach's panel. Plain SVG and tokens. */

const dayLetter = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "narrow" });

/**
 * Seven bars, Monday to Sunday: calories eaten each day against a dashed goal line. The chosen day is solid;
 * tap a bar to choose it. Days with nothing logged show a short empty stub. Bars rise when it opens.
 */
export function WeekFuel({ days, goal, selected, onSelect }: {
  days: { day: string; kcal: number; logged: boolean }[];
  goal: number | null;
  selected?: string;
  onSelect?: (day: string) => void;
}) {
  const W = 320, H = 150, top = 22, bottom = 22;
  const max = Math.max(goal ?? 0, ...days.map((d) => d.kcal), 1) * 1.12;
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const col = W / days.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cx-chart-svg wf" role="img" aria-label={`Calories each day this week${goal ? ` against a ${goal} kcal goal` : ""}`}>
      {days.map((d, i) => {
        const on = d.day === selected;
        const h = d.logged ? Math.max(4, H - bottom - y(d.kcal)) : 3;
        const x = i * col + col * 0.24;
        return (
          <g key={d.day} onClick={() => onSelect?.(d.day)} style={{ cursor: onSelect ? "pointer" : undefined }}>
            <rect x={i * col} y="0" width={col} height={H} fill="transparent" />
            <rect className="wf-bar" style={{ animationDelay: `${i * 50}ms` } as CSSProperties} x={x} width={col * 0.52} y={H - bottom - h} height={h} rx={Math.min(6, h / 2)}
              fill={d.logged ? "var(--act)" : "var(--line2)"} opacity={on || !selected ? 1 : 0.45} />
            {on && d.logged && <text x={x + col * 0.26} y={H - bottom - h - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="var(--num)" fill="var(--text)">{Math.round(d.kcal).toLocaleString("en-GB")}</text>}
            <text x={i * col + col / 2} y={H - 6} textAnchor="middle" fontSize="11" fontWeight={on ? 700 : 500} fill={on ? "var(--text)" : "var(--text3)"}>{dayLetter(d.day)}</text>
          </g>
        );
      })}
      {goal !== null && (
        <g>
          <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--text2)" strokeDasharray="4 4" strokeWidth="1" />
          <text x={W} y={y(goal) - 5} textAnchor="end" fontSize="10" fill="var(--text2)" fontFamily="var(--num)">{goal.toLocaleString("en-GB")} kcal goal</text>
        </g>
      )}
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
    </svg>
  );
}

/** Average a day, the week's total and the goal for each macro, in one small table. */
export function MacroTable({ avg, total, goal }: {
  avg: { proteinG: number; carbsG: number; fatG: number };
  total: { proteinG: number; carbsG: number; fatG: number };
  goal: { proteinG: number; carbsG: number; fatG: number } | null;
}) {
  const rows = [["Protein", "proteinG", "var(--viz-1)"], ["Carbs", "carbsG", "var(--act)"], ["Fat", "fatG", "var(--viz-3)"]] as const;
  return (
    <table className="mtab">
      <thead><tr><th /><th>Avg a day</th><th>Week</th><th>Goal</th></tr></thead>
      <tbody>
        {rows.map(([label, k, c]) => (
          <tr key={k}>
            <th scope="row"><i style={{ background: c }} />{label}</th>
            <td className="num">{Math.round(avg[k])} g</td>
            <td className="num">{Math.round(total[k]).toLocaleString("en-GB")} g</td>
            <td className="num">{goal ? `${goal[k]} g` : "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
