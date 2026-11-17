import { HEALTH_BANDS, type Health, type RosterRow } from "@apex/core";
import { HealthBadge, HealthBandPill, HealthParts, HealthTrend, Label } from "@apex/ui";
import type { HealthClient } from "../../data/health";

/** Brief card: the clients whose health score says they need the coach most, with the reasons in plain words. */
export function ClientHealthCard<T extends HealthClient>({ rows, open, max = 4 }: { rows: RosterRow<T>[] | null; open: (c: T) => void; max?: number }) {
  if (!rows) return null;
  const scored = rows.filter((r) => r.health.score !== null);
  const need = scored.filter((r) => r.health.band !== "good").slice(0, max);
  const good = scored.filter((r) => r.health.band === "good").length;
  return (
    <section>
      <div className="sect"><h2 className="h2">Client health</h2><Label kind="insight">Insight</Label></div>
      <div className="card flat list">
        {scored.length === 0 && <div className="li"><div className="small">Scores show once clients have been with you a week. They come from training, check-ins, habits, food logging and messages.</div></div>}
        {scored.length > 0 && need.length === 0 && <div className="li"><div className="grow"><div className="h3">Everyone's on track</div><div className="small">All {good} scored clients are at 75 or above.</div></div></div>}
        {need.map((r) => (
          <button key={r.client.id} className="li" onClick={() => open(r.client)}>
            <HealthBadge score={r.health.score} band={r.health.band} />
            <div className="grow">
              <div className="h3" style={{ display: "flex", alignItems: "center", gap: 8 }}>{r.client.name} <HealthTrend trend={r.trend} /></div>
              <span className="ch-row-why">{HEALTH_BANDS[r.health.band]} · {r.health.reasons.join(" · ")}</span>
            </div>
            <span className="tiny">›</span>
          </button>
        ))}
        {need.length > 0 && good > 0 && <div className="li"><div className="tiny">{good} more on track.</div></div>}
      </div>
    </section>
  );
}

/** Profile panel: the score, its band and trend, and what each part is made of. */
export function ClientHealthPanel({ health, trend }: { health: Health; trend: number | null }) {
  return (
    <div className="card">
      <div className="sect"><h3 className="h3">Health score</h3><Label kind="insight">Insight</Label></div>
      <div className="row" style={{ alignItems: "center", gap: 14 }}>
        <HealthBadge score={health.score} band={health.band} size={64} />
        <div className="grow">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><HealthBandPill band={health.band} /><HealthTrend trend={trend} /></div>
          <div className="small" style={{ marginTop: 6 }}>{health.score === null ? "Scores start after the first week." : health.reasons.join(" · ")}</div>
        </div>
      </div>
      {health.parts.length > 0 && <div style={{ marginTop: 14 }}><HealthParts parts={health.parts} /></div>}
      <p className="tiny" style={{ marginTop: 12 }}>Worked out from the last two weeks of training, check-ins, habits, food logging and messages. Only you see it.</p>
    </div>
  );
}
