import { localDate, WEARABLES, type RecoveryDay, type WearableProvider } from "@apex/core";
import { Sheet } from "@apex/ui";
import { useEffect, useState } from "react";
import { RecoveryView } from "../../app/RecoveryView";
import { useAppInfo } from "../../app/AppContext";
import { useActivities, useActivityContext } from "../../data/ActivityContext";

/** Re-sync a connected watch on open if the last sync is older than this. */
const STALE_MS = 30 * 60 * 1000;

/** The client's recovery: what their watch or ring measured, or what they typed in. */
export function Recovery({ say, openApps }: { say: (m: string) => void; openApps: () => void }) {
  const { store, wearables } = useActivityContext();
  const { recovery, activities, connections, status } = useActivities();
  const { coachName } = useAppInfo();
  const [adding, setAdding] = useState(false);
  const linked = connections.filter((c): c is typeof c & { provider: WearableProvider } => c.provider in WEARABLES);

  useEffect(() => {
    if (!wearables || status !== "ready") return;
    for (const c of linked) {
      if (c.lastSyncAt && Date.now() - new Date(c.lastSyncAt).getTime() < STALE_MS) continue;
      void wearables.sync(c.provider).catch(() => { /* shown on Connected apps */ });
    }
    // Once per open, not on every sync time change.
  }, [wearables, status, linked.length]);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><div className="eyebrow">Recovery</div><h1 className="h1">How you slept</h1></div>
        <button className="btn ghost sm" onClick={() => setAdding(true)}>Add numbers</button>
      </div>
      {status === "needs-update" && <div className="card small" style={{ borderColor: "var(--warn)" }}>Recovery needs a one-off database update before it can save. Ask {coachName} to run it.</div>}
      {recovery.length ? <RecoveryView recovery={recovery} activities={activities} /> : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="h3">No recovery data yet</div>
          <div className="small">Connect your watch or ring and your sleep, HRV and resting heart rate arrive each morning. They also fill in your readiness check before a session.</div>
          <button className="btn act" onClick={openApps}>Connect a watch or ring</button>
          <button className="btn ghost" onClick={() => setAdding(true)}>Type in this morning's numbers</button>
        </div>
      )}
      {recovery.length > 0 && linked.length === 0 && <button className="btn ghost block" onClick={openApps}>Connect a watch or ring</button>}
      {adding && <AddSheet onClose={() => setAdding(false)} onSave={(d) => { store.saveRecovery([d]); setAdding(false); say("Saved · it'll show in your readiness check"); }} />}
    </>
  );
}

function AddSheet({ onClose, onSave }: { onClose: () => void; onSave: (d: RecoveryDay) => void }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [hrv, setHrv] = useState("");
  const [rhr, setRhr] = useState("");
  const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  const ok = minutes > 0 || Number(hrv) > 0 || Number(rhr) > 0;
  const save = () => onSave(Object.fromEntries(Object.entries({
    date: localDate(new Date()), source: "manual", sleepMinutes: minutes || undefined, hrvMs: Number(hrv) || undefined, restingHr: Number(rhr) || undefined,
  }).filter(([, v]) => v !== undefined)) as unknown as RecoveryDay);
  return (
    <Sheet onClose={onClose} label="This morning's numbers">
      <h2 className="h2">This morning's numbers</h2>
      <div className="small">From any watch or ring app. Leave out what you don't have.</div>
      <div className="small">Sleep
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <input className="field num" inputMode="numeric" placeholder="hours" aria-label="Hours asleep" value={h} onChange={(e) => setH(e.target.value)} />
          <input className="field num" inputMode="numeric" placeholder="minutes" aria-label="Minutes asleep" value={m} onChange={(e) => setM(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label className="small">HRV (ms)<input className="field num" inputMode="decimal" placeholder="e.g. 55" value={hrv} onChange={(e) => setHrv(e.target.value)} /></label>
        <label className="small">Resting HR (bpm)<input className="field num" inputMode="numeric" placeholder="e.g. 54" value={rhr} onChange={(e) => setRhr(e.target.value)} /></label>
      </div>
      <button className="btn act block" disabled={!ok} onClick={save}>Save</button>
    </Sheet>
  );
}
