import { formatDistance, formatDuration, formatPace, newBests, paceLabel, sportLabel, type Activity } from "@apex/core";
import { HrZones, Label, ProfileChart, RouteMap, RouteThumb, SplitsTable, SportIcon } from "@apex/ui";

/* One activity, the same for the client and the coach: big numbers, the route, the chart,
   splits, heart-rate zones and best efforts. Every number here is Data: measured, not guessed. */

export const SOURCE_LABEL: Record<Activity["source"], string> = { manual: "Logged by hand", file: "From a watch file", strava: "From Strava" };

export const whenLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
};

/** "5.62 km · 5:08 /km · 28:51". */
export const activityLine = (a: Activity): string =>
  [a.metres ? formatDistance(a.metres, a.sport) : null, a.metres ? formatPace(a.metres, a.movingSeconds, a.sport) : null, formatDuration(a.movingSeconds)].filter(Boolean).join(" · ");

export function ActivityRow({ activity, all, onOpen }: { activity: Activity; all: Activity[]; onOpen: () => void }) {
  const pbs = newBests(activity, all);
  return (
    <button className="li" onClick={onOpen}>
      <RouteThumb activity={activity} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="tiny">{whenLabel(activity.startedAt)}</div>
        <div className="h3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.name}</div>
        <div className="small num">{activityLine(activity)}</div>
      </div>
      {pbs.length > 0 && <span className="cx-pb">★ {pbs.length > 1 ? `${pbs.length} PBs` : "PB"}</span>}
      <span className="tiny">›</span>
    </button>
  );
}

/** `showNote` false when the note is being edited below instead. */
export function ActivityView({ activity, all, showNote = true }: { activity: Activity; all: Activity[]; showNote?: boolean }) {
  const a = activity;
  const pbs = newBests(a, all);
  const stats: [string, string, string?][] = [
    [formatDuration(a.movingSeconds), "Moving time"],
    a.metres ? [formatPace(a.metres, a.movingSeconds, a.sport).replace(/ .*$/, ""), paceLabel(a.sport), formatPace(a.metres, a.movingSeconds, a.sport).replace(/^\S+ /, "")] : ["–", "Pace"],
    a.avgHr ? [String(a.avgHr), "Avg heart rate", "bpm"] : a.rpe ? [String(a.rpe), "Effort", "/10"] : ["–", "Avg heart rate"],
  ];
  const extra: [string, string][] = [
    ...(a.elevationGainM ? [[`${a.elevationGainM} m`, "Climbed"] as [string, string]] : []),
    ...(a.maxHr ? [[`${a.maxHr} bpm`, "Max heart rate"] as [string, string]] : []),
    ...(a.calories ? [[`${a.calories} kcal`, "Energy"] as [string, string]] : []),
    ...(a.elapsedSeconds > a.movingSeconds + 30 ? [[formatDuration(a.elapsedSeconds), "Elapsed"] as [string, string]] : []),
    ...(a.detail?.poolLengthM ? [[`${a.detail.poolLengthM} m`, "Pool"] as [string, string]] : []),
    ...(a.rpe && a.avgHr ? [[`${a.rpe}/10`, "How it felt"] as [string, string]] : []),
  ];
  const [dist, unit] = a.sport === "swim" || a.metres < 1000 ? [Math.round(a.metres).toLocaleString("en-GB"), "m"] : [(a.metres / 1000).toFixed(2), "km"];
  return (
    <>
      <div>
        <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}><SportIcon sport={a.sport} size={14} /> {sportLabel(a.sport)} · {whenLabel(a.startedAt)}</div>
        <h1 className="h1">{a.name}</h1>
        <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          <Label kind="data">{SOURCE_LABEL[a.source]}</Label>
          {pbs.map((b) => <span key={b.label} className="cx-pb">★ {b.label} PB</span>)}
        </div>
      </div>
      <div className="cx-hero">
        <div className="big"><b className="num">{a.metres ? dist : formatDuration(a.movingSeconds)}<small>{a.metres ? unit : ""}</small></b><span>{a.metres ? "Distance" : "Time"}</span></div>
        {stats.map(([v, l, u]) => <div key={l}><b className="num">{v}{u && <small>{u}</small>}</b><span>{l}</span></div>)}
      </div>
      <RouteMap activity={a} />
      {extra.length > 0 && (
        <div className="kpis" style={{ gridTemplateColumns: `repeat(${Math.min(3, extra.length)},1fr)` }}>
          {extra.map(([v, l]) => <div key={l} className="kpi"><b style={{ fontSize: 17 }}>{v}</b><small>{l}</small></div>)}
        </div>
      )}
      <ProfileChart activity={a} />
      {a.detail?.splits && (
        <section>
          <div className="sect"><h2 className="h2">Splits</h2><span className="tiny">Quickest in orange</span></div>
          <SplitsTable activity={a} />
        </section>
      )}
      {a.detail?.hrZones && (
        <section>
          <div className="sect"><h2 className="h2">Heart-rate zones</h2><Label kind="data">Data</Label></div>
          <HrZones activity={a} />
        </section>
      )}
      {a.detail?.bests && a.detail.bests.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Best efforts</h2><span className="tiny">Fastest stretch in this {sportLabel(a.sport).toLowerCase()}</span></div>
          <div className="card flat list">
            {a.detail.bests.map((b) => {
              const pb = pbs.find((p) => p.metres === b.metres);
              return (
                <div key={b.label} className="cx-best">
                  <span className="h3">{b.label}</span>
                  <span className="row" style={{ gap: 8 }}>
                    {pb && <span className="cx-pb">★ PB −{formatDuration(pb.previousSeconds - b.seconds)}</span>}
                    <span className="num" style={{ fontWeight: 700 }}>{formatDuration(b.seconds)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {showNote && a.note && <div className="card"><div className="tiny">Note</div><p className="small" style={{ margin: "4px 0 0", color: "var(--text)" }}>{a.note}</p></div>}
    </>
  );
}
