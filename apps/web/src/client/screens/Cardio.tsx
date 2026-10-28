import { activityFromFile, formatDistance, formatDuration, manualActivity, newKey, SPORTS, weeklyMetres, weekTotals, type Activity, type Sport } from "@apex/core";
import { BackLink, Icons, Label, Sheet, SportIcon, WeekBars } from "@apex/ui";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ActivityRow, ActivityView } from "../../app/ActivityView";
import { useAppInfo } from "../../app/AppContext";
import { useActivities, useActivityContext } from "../../data/ActivityContext";
import { ConnectedApps } from "./ConnectedApps";

/** Re-sync Strava on open if the last sync is older than this. */
const STALE_MS = 15 * 60 * 1000;
const FILTERS: ("all" | Sport)[] = ["all", "run", "swim", "ride", "row", "walk"];

export function Cardio({ say }: { say: (m: string) => void }) {
  const { store, strava } = useActivityContext();
  const { activities, connections, status } = useActivities();
  const { coachName } = useAppInfo();
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "apps">("list");
  const [logging, setLogging] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const strv = connections.find((c) => c.provider === "strava");

  // Bring in anything new from Strava when the screen opens.
  useEffect(() => {
    if (!strava || !strv || status !== "ready") return;
    if (strv.lastSyncAt && Date.now() - new Date(strv.lastSyncAt).getTime() < STALE_MS) return;
    void strava.sync().catch(() => { /* shown on Connected apps; the list still works */ });
    // Only when the connection first appears, not on every sync time change.
  }, [strava, !!strv, status]);

  const upload = async (files: FileList | File[] | null) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setBusy(true);
    const added: Activity[] = [];
    const failed: string[] = [];
    for (const f of list) {
      try {
        added.push(activityFromFile(f.name, new Uint8Array(await f.arrayBuffer()), newKey()));
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof Error ? e.message : "couldn't read it"}`);
      }
    }
    setBusy(false);
    if (added.length) {
      store.save(added);
      say(added.length === 1 ? `${added[0]!.name} saved · ${coachName} can see it` : `${added.length} activities saved`);
      if (added.length === 1) setOpen(added[0]!.id);
    }
    if (failed.length) alert(failed.join("\n"));
  };

  const shown = activities.find((a) => a.id === open);
  if (shown) return <Detail activity={shown} all={activities} onBack={() => setOpen(null)} say={say} />;
  if (view === "apps") return <><BackLink onClick={() => setView("list")}>Cardio</BackLink><ConnectedApps say={say} /></>;

  const week = weekTotals(activities);
  const weekSeconds = week.reduce((a, w) => a + w.seconds, 0);
  const weekMetres = week.reduce((a, w) => a + w.metres, 0);
  const list = filter === "all" ? activities : activities.filter((a) => a.sport === filter);
  const filters = FILTERS.filter((f) => f === "all" || activities.some((a) => a.sport === f));
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void upload([...e.dataTransfer.files]); };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} style={{ display: "contents" }}>
      <div>
        <div className="eyebrow">Cardio · this week</div>
        <h1 className="h1"><span className="num">{formatDuration(weekSeconds)}</span>{weekMetres > 0 && <> · <span className="num">{formatDistance(weekMetres)}</span></>}</h1>
      </div>
      {status === "needs-update" && <div className="card small" style={{ borderColor: "var(--warn)" }}>Cardio needs a one-off database update before it can save. Ask {coachName} to run it.</div>}
      {week.length > 0 && (
        <div className="cx-sport">
          {week.slice(0, 4).map((w) => (
            <div key={w.sport} className="kpi">
              <SportIcon sport={w.sport} size={18} />
              <b style={{ fontSize: 18 }}>{w.metres ? formatDistance(w.metres, w.sport) : formatDuration(w.seconds)}</b>
              <small>{w.count} {SPORTS.find((s) => s.id === w.sport)?.label.toLowerCase()}{w.count > 1 ? "s" : ""} · {formatDuration(w.seconds)}</small>
            </div>
          ))}
        </div>
      )}
      <div className="cx-actions">
        <button className="btn act" onClick={() => setLogging(true)}><Icons.plus width={18} height={18} /> Log activity</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}><Icons.upload width={18} height={18} /> {busy ? "Reading…" : "Upload file"}</button>
        <input ref={fileRef} type="file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        <button className="btn ghost wide" onClick={() => setView("apps")}>
          <Icons.link width={18} height={18} /> {strv ? `Strava connected${strv.lastSyncAt ? ` · synced ${new Date(strv.lastSyncAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Connect Strava, Garmin and other apps"}
        </button>
      </div>
      {drag && <div className="cx-drop over"><Icons.upload width={28} height={28} />Drop GPX, TCX or FIT files to add them</div>}
      <section>
        <div className="sect"><h2 className="h2">Last 8 weeks</h2><Label kind="data">Data</Label></div>
        <div className="card">
          <div className="chips" style={{ marginBottom: 12 }}>
            {filters.map((f) => <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "All" : SPORTS.find((s) => s.id === f)?.label}</button>)}
          </div>
          <WeekBars weeks={weeklyMetres(activities, filter)} unit={filter === "swim" ? "m" : "km"} />
        </div>
      </section>
      <section>
        <div className="sect"><h2 className="h2">Activities</h2><span className="tiny num">{list.length}</span></div>
        <div className="card flat list">
          {status === "loading" && <div className="li small">Loading…</div>}
          {status !== "loading" && list.length === 0 && (
            <div className="li"><div className="grow"><div className="h3">Nothing here yet</div><div className="small">Log a run or swim by hand, upload the file your watch saved, or connect Strava.</div></div></div>
          )}
          {list.slice(0, 40).map((a) => <ActivityRow key={a.id} activity={a} all={activities} onOpen={() => setOpen(a.id)} />)}
        </div>
      </section>
      {logging && <LogSheet onClose={() => setLogging(false)} onSave={(a) => { store.save([a]); setLogging(false); say(`${a.name} saved · ${coachName} can see it`); }} />}
    </div>
  );
}

function Detail({ activity, all, onBack, say }: { activity: Activity; all: Activity[]; onBack: () => void; say: (m: string) => void }) {
  const { store, editable } = useActivityContext();
  const [note, setNote] = useState(activity.note ?? "");
  const update = (patch: Partial<Activity>) => store.save([{ ...activity, ...patch }]);
  return (
    <>
      <BackLink onClick={onBack}>Cardio</BackLink>
      <ActivityView activity={activity} all={all} showNote={!editable} />
      {editable && (
        <section>
          <div className="sect"><h2 className="h2">How did it feel?</h2><span className="tiny">1 easy · 10 all out</span></div>
          <div className="cx-feel">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} className={activity.rpe === n ? "on" : ""} onClick={() => update({ rpe: n })} aria-pressed={activity.rpe === n}>{n}</button>)}
          </div>
          <textarea className="field" rows={2} placeholder="A note for your coach (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (activity.note ?? "") && update({ note: note.trim() || undefined })} style={{ marginTop: 10, resize: "vertical", fontFamily: "inherit" }} />
          <button className="link" style={{ color: "var(--crit)", marginTop: 14 }} onClick={() => { if (confirm(`Delete “${activity.name}”?`)) { store.remove(activity.id); onBack(); say("Activity deleted"); } }}>Delete activity</button>
        </section>
      )}
    </>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function LogSheet({ onClose, onSave }: { onClose: () => void; onSave: (a: Activity) => void }) {
  const [sport, setSport] = useState<Sport>("run");
  const [distance, setDistance] = useState("");
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const [hr, setHr] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [when, setWhen] = useState(localNow);
  const [name, setName] = useState("");
  const seconds = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  const dist = Number(distance.replace(",", "."));
  const valid = seconds > 0 && (sport === "other" || dist > 0);
  const save = () => {
    if (!valid) return;
    onSave(manualActivity({ id: newKey(), sport, name, startedAt: new Date(when).toISOString(), distance: dist || 0, seconds, avgHr: Number(hr) || undefined, rpe: rpe ?? undefined }));
  };
  return (
    <Sheet onClose={onClose} label="Log activity">
      <h2 className="h2" style={{ marginBottom: 12 }}>Log activity</h2>
      <div className="chips" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {SPORTS.map((x) => <button key={x.id} className={`chip ${sport === x.id ? "on" : ""}`} onClick={() => setSport(x.id)}><SportIcon sport={x.id} size={14} /> {x.label}</button>)}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label className="small">Distance ({sport === "swim" ? "metres" : "km"})
          <input className="field num" inputMode="decimal" placeholder={sport === "swim" ? "1500" : "5.0"} value={distance} onChange={(e) => setDistance(e.target.value)} />
        </label>
        <div className="small">Time
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 4 }}>
            <input className="field num" inputMode="numeric" placeholder="h" aria-label="Hours" value={h} onChange={(e) => setH(e.target.value)} />
            <input className="field num" inputMode="numeric" placeholder="min" aria-label="Minutes" value={m} onChange={(e) => setM(e.target.value)} />
            <input className="field num" inputMode="numeric" placeholder="s" aria-label="Seconds" value={s} onChange={(e) => setS(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label className="small">Avg heart rate (optional)<input className="field num" inputMode="numeric" placeholder="bpm" value={hr} onChange={(e) => setHr(e.target.value)} /></label>
          <label className="small">When<input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        </div>
        <label className="small">Name (optional)<input className="field" placeholder="e.g. Parkrun" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="small">How did it feel?
          <div className="cx-feel" style={{ marginTop: 4 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} className={rpe === n ? "on" : ""} onClick={() => setRpe(n)} aria-pressed={rpe === n}>{n}</button>)}
          </div>
        </div>
        <button className="btn act block" disabled={!valid} onClick={save}>Save {SPORTS.find((x) => x.id === sport)?.verb.toLowerCase()}</button>
      </div>
    </Sheet>
  );
}
