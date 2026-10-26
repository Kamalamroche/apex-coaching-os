import { changeOver, measurementSeries, newestFirst, shortDate, signed, type MeasureKey, type PhotoUpload } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Bar, Label, Sheet, Spark } from "@apex/ui";
import { useState } from "react";
import { SampleNote, useAppInfo } from "../../app/AppContext";
import { MeasureInputs, MeasurementTable, PhotoCompare, PoseSlots, ProgressNotice, WeightTrend, blankMeasures, parseMeasures } from "../../app/ProgressParts";
import { useStore } from "../../data/StoreContext";

const RECOVERY = [["Sleep", "7 h 24 m", 82, "var(--data)"], ["Resting HR", "58 bpm", 70, "var(--good)"], ["Steps", "8,412", 84, "var(--act)"]] as const;
const WEEK_MS = 7 * 86400000;

export function Progress({ say, openCheckIn }: { say: (m: string) => void; openCheckIn: () => void }) {
  const store = useStore();
  const { coachName } = useAppInfo();
  const { progress } = useApexState(store);
  const [photos, setPhotos] = useState(false);
  const [sheet, setSheet] = useState<"measure" | "photos" | null>(null);
  const { measurements } = progress;
  const checkIns = newestFirst(progress.checkIns);

  const starts = [...measurements.map((m) => m.measuredAt), ...checkIns.map((c) => c.submittedAt)].map(Date.parse).filter(Number.isFinite);
  const weeks = starts.length ? Math.max(1, Math.round((Date.now() - Math.min(...starts)) / WEEK_MS)) : 0;
  const kpi = (key: MeasureKey) => changeOver(measurementSeries(measurements, key));
  const weight = kpi("weightKg");
  const waist = kpi("waistCm");

  return (
    <>
      <div><div className="eyebrow">Progress</div><h1 className="h1">{weeks ? `${weeks} week${weeks === 1 ? "" : "s"} in` : "Your starting point"}</h1></div>
      <ProgressNotice />
      <div className="kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div className="kpi"><b>{weight ? weight.last : "–"}</b><small>Weight, kg</small>{weight && weight.delta !== 0 && <i style={{ color: "var(--data)" }}>{signed(weight.delta)} since start</i>}</div>
        <div className="kpi"><b>{waist ? waist.last : "–"}</b><small>Waist, cm</small>{waist && waist.delta !== 0 && <i style={{ color: "var(--data)" }}>{signed(waist.delta)} since start</i>}</div>
      </div>
      <WeightTrend measurements={measurements} />

      <section>
        <div className="sect"><h2 className="h2">Measurements</h2><button className="link" onClick={() => setSheet("measure")}>+ Log</button></div>
        <div className="card flat list"><MeasurementTable measurements={measurements} /></div>
      </section>

      <button className="card" style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }} onClick={() => setPhotos(!photos)} aria-expanded={photos}>
        <div><div className="h3">Progress photos</div><div className="small">{progress.photos.length ? `${progress.photos.length} photos · compare any two dates` : "Front, side and back, side by side over time"}</div></div>
        <span className="h2">{photos ? "–" : "+"}</span>
      </button>
      {photos && (
        <div className="card stack">
          <PhotoCompare photos={progress.photos} onDelete={(id) => void store.deletePhoto(id).catch((e: unknown) => say(e instanceof Error ? e.message : "Couldn't delete"))} />
          <button className="btn ghost block" onClick={() => setSheet("photos")}>+ Add photos</button>
        </div>
      )}

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
      <section>
        <div className="sect"><h2 className="h2">Recovery</h2><Label kind="data">From Apple Health</Label></div>
        <div className="card flat list">
          {RECOVERY.map(([name, value, pct, color]) => (
            <div key={name} className="li">
              <div className="grow">
                <div className="row" style={{ justifyContent: "space-between" }}><span className="h3">{name}</span><span className="num" style={{ fontWeight: 700 }}>{value}</span></div>
                <div style={{ marginTop: 6 }}><Bar pct={pct} color={color} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {sheet === "measure" && <MeasureSheet onClose={() => setSheet(null)} onSaved={() => { setSheet(null); say("Measurements saved"); }} />}
      {sheet === "photos" && <PhotoSheet onClose={() => setSheet(null)} onSaved={() => { setSheet(null); setPhotos(true); say("Photos saved"); }} />}
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
