import type { CheckInTimeline } from "@apex/core";
import { Label } from "./primitives";
import "./checkInTimeline.css";

/* Coach: every check-in answer side by side, oldest to newest, so slides and streaks stand out. */
export function CheckInTimelineCard({ t, first }: { t: CheckInTimeline; first: string }) {
  if (t.weeks.length < 2) return null;
  const streaks = t.rows.map((r) => r.streak).filter((s): s is string => !!s);
  // Newest first, so this week is the first column the coach sees on a phone.
  const order = t.weeks.map((_, i) => i).reverse();
  return (
    <section className="card stack cit">
      <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">Side by side</h3><Label kind="data">Data</Label></div>
      <div className="tiny">{first}'s last {t.weeks.length} check-ins. Newest first. Green is better than the week before, red is worse.</div>
      {streaks.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {streaks.map((s) => <div key={s} className="row" style={{ gap: 8 }}><Label kind="insight">Insight</Label><span className="small">{s}</span></div>)}
        </div>
      )}
      <div className="cit-scroll" tabIndex={0} aria-label="Check-in answers by week">
        <table className="cit-table">
          <thead>
            <tr><th scope="col" className="cit-q">Question</th>{order.map((i) => <th key={t.weeks[i]!.id} scope="col">{i === t.weeks.length - 1 ? `Latest · ${t.weeks[i]!.label}` : t.weeks[i]!.label}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.label} className={r.kind}>
                <th scope="row" className="cit-q">{r.label}</th>
                {order.map((i) => r.cells[i]!).map((c, j) => (
                  <td key={t.weeks[order[j]!]!.id} className={c.tone ?? ""} title={r.kind === "text" ? c.text : undefined}>
                    {c.text ? <span className={r.kind === "number" ? "num" : ""}>{c.text}</span> : <span className="cit-none">–</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
