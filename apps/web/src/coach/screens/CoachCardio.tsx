import { firstName, formatDistance, formatDuration, sportLabel, weekTotals } from "@apex/core";
import { Label, Sheet } from "@apex/ui";
import { useState } from "react";
import { ActivityRow, ActivityView } from "../../app/ActivityView";
import { useAppInfo } from "../../app/AppContext";
import { useActivities } from "../../data/ActivityContext";

/** The client's runs, swims and rides on the coach's Brief. Read-only: the client owns their cardio. */
export function CoachCardio() {
  const { activities, connections, status } = useActivities();
  const { clientName } = useAppInfo();
  const [open, setOpen] = useState<string | null>(null);
  const first = firstName(clientName) || "Your client";
  if (status === "needs-update") {
    return (
      <section>
        <div className="sect"><h2 className="h2">Cardio</h2></div>
        <div className="card small">Runs, swims and rides need a one-off database update. The SQL is in the pull request that added Cardio.</div>
      </section>
    );
  }
  if (status !== "ready") return null;
  const week = weekTotals(activities);
  const shown = activities.find((a) => a.id === open);
  const strava = connections.some((c) => c.provider === "strava");
  return (
    <section>
      <div className="sect"><h2 className="h2">{first}'s cardio</h2><span className="row" style={{ gap: 6 }}>{strava && <span className="tiny">Strava connected</span>}<Label kind="data">Data</Label></span></div>
      <div className="card flat list">
        <div className="li">
          <div className="grow">
            <div className="tiny">This week</div>
            <div className="h3 num">{week.length ? week.map((w) => `${sportLabel(w.sport)} ${w.metres ? formatDistance(w.metres, w.sport) : formatDuration(w.seconds)}`).join(" · ") : "Nothing logged yet"}</div>
          </div>
        </div>
        {activities.slice(0, 4).map((a) => <ActivityRow key={a.id} activity={a} all={activities} onOpen={() => setOpen(a.id)} />)}
        {activities.length === 0 && <div className="li small">When {first} logs a run, uploads a watch file or connects Strava, it shows up here.</div>}
      </div>
      {shown && (
        <Sheet onClose={() => setOpen(null)} label={shown.name}>
          <ActivityView activity={shown} all={activities} />
          {shown.rpe && <div className="small">{first} rated it <b className="num">{shown.rpe}/10</b>.</div>}
          <button className="btn ghost block" onClick={() => setOpen(null)}>Close</button>
        </Sheet>
      )}
    </section>
  );
}
