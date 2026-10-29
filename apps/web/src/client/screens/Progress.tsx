import { bestPerDay, changeOver, formatSleep, measurementSeries, newestFirst, shortDate, signed, type MeasureKey, type PhotoUpload } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, Sheet, Spark } from "@apex/ui";
import { useState } from "react";
import { SampleNote, useAppInfo } from "../../app/AppContext";
import { MeasureInputs, MeasurementTable, PoseSlots, ProgressHub, ProgressNotice, WeightTrend, blankMeasures, parseMeasures } from "../../app/ProgressParts";
import { useActivities } from "../../data/ActivityContext";
import { useStore } from "../../data/StoreContext";
import { ConnectedApps } from "./ConnectedApps";
import { Recovery } from "./Recovery";

const WEEK_MS = 7 * 86400000;

export function Progress({ say, openCheckIn }: { say: (m: string) => void; openCheckIn: () => void }) {
  const store = useStore();
  const { coachName } = useAppInfo();
  const { progress } = useApexState(store);
  const [sheet, setSheet] = useState<"measure" | "photos" | null>(null);
  const [mode, setMode] = useState<"body" | "recovery" | "apps">("body");
  const { recovery } = useActivities();
  const last = bestPerDay(recovery)[0];
  const { measurements } = progress;
  const checkIns = newestFirst(progress.checkIns);
  const starts = [...measurements.map((m) => m.measuredAt), ...checkIns.map((c) => c.submittedAt), ...progress.photos.map((p) => p.takenAt)].map(Date.parse).filter(Number.isFinite);
  const weeks = starts.length ? Math.max(1, Math.round((Date.now() - Math.min(...starts)) / WEEK_MS)) : 0;
  const kpi = (key: MeasureKey) => changeOver(measurementSeries(measurements, key));
  const weight = kpi("weightKg");
  const waist = kpi("waistCm");
  const modes = (
    <div className="chips" role="tablist" aria-label="Progress view">
      <button role="tab" aria-selected={mode === "body"} className={`chip ${mode === "body" ? "on" : ""}`} onClick={() => setMode("body")}>Body and strength</button>
      <button role="tab" aria-selected={mode !== "body"} className={`chip ${mode !== "body" ? "on" : ""}`} onClick={() => setMode("recovery")}>Recovery</button>
    </div>
  );
  if (mode === "apps") return <>{modes}<BackLink onClick={() => setMode("recovery")}>Recovery</BackLink><ConnectedApps say={say} /></>;
  if (mode === "recovery") return <>{modes}<Recovery say={say} openApps={() => setMode("apps")} /></>;
  return (
    <>
      {modes}
      <div><div className="eyebrow">Progress</div><h1 className="h1">{weeks ? `${weeks} week${weeks === 1 ? "" : "s"} in` : "Your starting point"}</h1></div>
      <ProgressNotice />
      <div className="kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="kpi"><b>{weight ? weight.last : "–"}</b><small>Weight, kg</small>{weight && weight.delta !== 0 && <i style={{ color: "var(--data)" }}>{signed(weight.delta)} since start</i>}</div>
        <div className="kpi"><b>{waist ? waist.last : "–"}</b><small>Waist, cm</small>{waist && waist.delta !== 0 && <i style={{ color: "var(--data)" }}>{signed(waist.delta)} since start</i>}</div>
      </div>

      <ProgressHub progress={progress} onDelete={(id) => void store.deletePhoto(id).catch((e: unknown) => say(e instanceof Error ? e.message : "Couldn't delete"))} extra={<button className="link" onClick={() => setSheet("photos")}>+ Add photos</button>} />

      <WeightTrend measurements={measurements} />
      <section>
        <div className="sect"><h2 className="h2">Measurements</h2><button className="link" onClick={() => setSheet("measure")}>+ Log</button></div>
        <div className="card flat list"><MeasurementTable measurements={measurements} /></div>
      </section>

      <section>
        <div className="sect"><h2 className="h2">Check-ins</h2><button className="link" onClick={openCheckIn}>+ New check-in</button></div>
        <div className="card flat list">
          {checkIns.length === 0 && <div className="li small">Your weekly check-ins and {coachName}'s replies appear here.</div>}
          {checkIns.slice(0, 6).map((c) => (
            <div key={c.id} className="li" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="h3">{shortDate(c.submittedAt)}{c.weightKg !== null && <> · <span className="num">{c.weightKg} kg</span></>}</div>
                <div className="small">{[c.energy && `Energy ${c.energy}/5`, c.sleepHours !== null && `sleep ${c.sleepHours} h`, c.training && `training ${c.training}/5`].filter(Boolean).join(" · ") || "No ratings"}</div>
                {c.coachReply ? (
                  <div className="small" style={{ marginTop: 6, color: "var(--text)" }}><b>{coachName}:</b> {c.coachReply}</div>
                ) : (
                  <div className="tiny" style={{ marginTop: 4 }}>{c.reviewedAt ? `Seen by ${coachName}` : `Waiting for ${coachName}`}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SampleNote />
      <div className="card">
        <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Trap bar deadlift, top set</h3></div>
        <Spark data={[55, 57.5, 60, 62.5, 62.5, 65, 67.5, 70]} unit="kg" />
      </div>
      <button className="card" style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }} onClick={() => setMode("recovery")}>
        <div><div className="h3">Recovery</div><div className="small num">{last ? [last.sleepMinutes ? `${formatSleep(last.sleepMinutes)} sleep` : null, last.hrvMs ? `HRV ${Math.round(last.hrvMs)} ms` : null, last.restingHr ? `${last.restingHr} bpm resting` : null].filter(Boolean).join(" · ") : "Sleep, HRV and resting heart rate from your watch"}</div></div>
        <span className="tiny">›</span>
      </button>
      {sheet === "measure" && <MeasureSheet onClose={() => setSheet(null)} onSaved={() => { setSheet(null); say("Measurements saved"); }} />}
      {sheet === "photos" && <PhotoSheet onClose={() => setSheet(null)} onSaved={() => { setSheet(null); say("Photos saved"); }} />}
    </>
  );
}

function MeasureSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const store = useStore();
  const { progress } = useApexState(store);
  const [value, setValue] = useState(blankMeasures);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const parsed = parseMeasures(value);
  const any = Object.values(parsed).some((v) => v !== null);
  const save = async () => {
    setBusy(true);
    try { await store.logMeasurements(parsed); onSaved(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save"); setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} label="Log measurements">
      <h2 className="h2">Log measurements</h2>
      <div className="tiny">Measure first thing in the morning, before food. Fill in only what you measured.</div>
      <MeasureInputs value={value} onChange={setValue} last={progress.measurements} />
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row"><button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button><button className="btn act" style={{ flex: 2 }} disabled={!any || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button></div>
    </Sheet>
  );
}

function PhotoSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const store = useStore();
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    try { await store.addPhotos(photos); onSaved(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't upload"); setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} label="Add progress photos">
      <h2 className="h2">Add progress photos</h2>
      <PoseSlots value={photos} onChange={setPhotos} />
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row"><button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button><button className="btn act" style={{ flex: 2 }} disabled={!photos.length || busy} onClick={() => void save()}>{busy ? "Uploading…" : "Save photos"}</button></div>
    </Sheet>
  );
}
