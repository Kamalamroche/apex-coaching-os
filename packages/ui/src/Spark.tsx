export function Spark({ data, unit }: { data: number[]; unit: string }) {
  const w = 300;
  const h = 70;
  const first = data[0] ?? 0;
  const last = data.at(-1) ?? 0;
  const mn = Math.min(...data) - 2;
  const mx = Math.max(...data) + 2;
  const pts = data.map((v, i) => [i * (w / Math.max(1, data.length - 1)), h - ((v - mn) / (mx - mn)) * h] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const end = pts.at(-1) ?? [0, 0];
  return (
    <div>
      <svg viewBox={`-4 -6 ${w + 8} ${h + 12}`} style={{ width: "100%", height: 80, display: "block" }} role="img" aria-label={`Trend from ${first} to ${last} ${unit}`}>
        <path d={`${d}L${w} ${h}L0 ${h}Z`} fill="var(--data-soft)" />
        <path d={d} fill="none" stroke="var(--data)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={end[0]} cy={end[1]} r="4.5" fill="var(--act)" />
      </svg>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="tiny num">{first} {unit}</span>
        <span className="num" style={{ fontWeight: 700, color: "var(--act)" }}>{last} {unit} (+{last - first})</span>
      </div>
    </div>
  );
}
