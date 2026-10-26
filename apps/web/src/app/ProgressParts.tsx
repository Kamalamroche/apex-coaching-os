import {
  MEASURES, POSES, changeOver, measurementSeries, parseNumber, photoSets, shortDate, signed,
  type MeasureKey, type Measurement, type MeasurementInput, type PhotoUpload, type Pose, type ProgressPhoto,
} from "@apex/core";
import { Label, PhotoFrame, Spark } from "@apex/ui";
import { useEffect, useRef, useState } from "react";
import { preparePhoto } from "../data/photos";
import { useProgressError } from "./AppContext";

/* Pieces of the progress screens shared by the client app and the coach's client view. */

export const POSE_LABEL: Record<Pose, string> = { front: "Front", side: "Side", back: "Back" };

/** Shown when the live database doesn't have the check-in tables yet. */
export function ProgressNotice() {
  const err = useProgressError();
  if (!err) return null;
  return (
    <div className="card" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
      <div className="h3">Check-ins aren't switched on yet</div>
      <div className="small">The database update for check-ins, measurements and photos hasn't been run. Everything else works as normal.</div>
      <div className="tiny num" style={{ marginTop: 4 }}>{err}</div>
    </div>
  );
}

export function WeightTrend({ measurements }: { measurements: Measurement[] }) {
  const series = measurementSeries(measurements, "weightKg");
  if (series.length < 2) return null;
  return (
    <div className="card">
      <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">Weight</h3><Label kind="data">Data</Label></div>
      <Spark data={series.map((p) => p.value)} unit="kg" />
    </div>
  );
}

/** Start, latest and change for every measurement that has been taken at least once. */
export function MeasurementTable({ measurements }: { measurements: Measurement[] }) {
  const rows = MEASURES.flatMap((m) => {
    const series = measurementSeries(measurements, m.key);
    const c = changeOver(series);
    return c ? [{ ...m, ...c, since: series[0]!.at, count: series.length }] : [];
  });
  if (!rows.length) return <div className="li small">No measurements yet.</div>;
  return (
    <>
      {rows.map((r) => (
        <div key={r.key} className="li">
          <div className="grow"><div className="h3">{r.label}</div><div className="tiny">{r.count > 1 ? `Since ${shortDate(r.since)}` : `Taken ${shortDate(r.since)}`}</div></div>
          <span className="num small">{r.count > 1 ? `${r.first} → ` : ""}<b style={{ color: "var(--text)" }}>{r.last}</b> {r.unit}</span>
          {r.count > 1 && <span className="num small" style={{ minWidth: 48, textAlign: "right", fontWeight: 700, color: "var(--data)" }}>{signed(r.delta)}</span>}
        </div>
      ))}
    </>
  );
}

/** Text inputs for each measurement. Shows the last value as a hint. */
export function MeasureInputs({ value, onChange, last, skip = [] }: { value: Record<MeasureKey, string>; onChange: (v: Record<MeasureKey, string>) => void; last: Measurement[]; skip?: MeasureKey[] }) {
  return (
    <div className="measures">
      {MEASURES.filter((m) => !skip.includes(m.key)).map((m) => {
        const prev = measurementSeries(last, m.key).at(-1)?.value;
        return (
          <label key={m.key}>
            {m.label}, {m.unit}
            <input className="cell" inputMode="decimal" placeholder={prev !== undefined ? String(prev) : "–"} value={value[m.key]} onChange={(e) => onChange({ ...value, [m.key]: e.target.value })} />
          </label>
        );
      })}
    </div>
  );
}

export const blankMeasures = (): Record<MeasureKey, string> =>
  Object.fromEntries(MEASURES.map((m) => [m.key, ""])) as Record<MeasureKey, string>;

export const parseMeasures = (v: Record<MeasureKey, string>): MeasurementInput =>
  Object.fromEntries(MEASURES.map((m) => [m.key, parseNumber(v[m.key])])) as MeasurementInput;

/** Front, side and back slots. Tapping one opens the camera on a phone, or the file picker elsewhere. */
export function PoseSlots({ value, onChange }: { value: PhotoUpload[]; onChange: (v: PhotoUpload[]) => void }) {
  const [busy, setBusy] = useState<Pose | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<Pose, HTMLInputElement | null>>>({});
  const pick = async (pose: Pose, file: File | undefined) => {
    if (!file) return;
    setBusy(pose);
    setErr(null);
    try {
      const photo = await preparePhoto(file, pose);
      onChange([...value.filter((p) => p.pose !== pose), photo]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that photo");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="poses">
        {POSES.map((pose) => {
          const photo = value.find((p) => p.pose === pose);
          return (
            <div key={pose} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button type="button" onClick={() => inputs.current[pose]?.click()} style={{ background: "none", border: 0, padding: 0 }} aria-label={`${photo ? "Retake" : "Add"} ${POSE_LABEL[pose].toLowerCase()} photo`}>
                <PhotoFrame url={photo?.preview} label={busy === pose ? "Preparing…" : POSE_LABEL[pose]} highlight={!!photo}>
                  {!photo && <span className="tag label l-data">+ Add</span>}
                </PhotoFrame>
              </button>
              {photo && <button type="button" className="link" style={{ fontSize: 12 }} onClick={() => onChange(value.filter((p) => p.pose !== pose))}>Remove</button>}
              <input ref={(el) => { inputs.current[pose] = el; }} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pick(pose, e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          );
        })}
      </div>
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="tiny">Same spot, same light, same time of day each week makes the comparison fair. Only you and your coach can see these.</div>
    </div>
  );
}

/** Two dates side by side for one pose. Defaults to the first and the latest set. */
export function PhotoCompare({ photos, onDelete }: { photos: ProgressPhoto[]; onDelete?: (id: string) => void }) {
  const sets = photoSets(photos);
  const [pose, setPose] = useState<Pose>("front");
  const [fromKey, setFromKey] = useState<string | null>(null);
  const [toKey, setToKey] = useState<string | null>(null);
  const keys = sets.map((s) => s.key).join(",");
  useEffect(() => { setFromKey(null); setToKey(null); }, [keys]);
  if (!sets.length) return <div className="small">No photos yet.</div>;
  const from = sets.find((s) => s.key === fromKey) ?? sets[0]!;
  const to = sets.find((s) => s.key === toKey) ?? sets.at(-1)!;
  const options = sets.map((s) => <option key={s.key} value={s.key}>{shortDate(s.takenAt)}</option>);
  const side = (set: typeof from, which: "from" | "to") => {
    const photo = set.byPose[pose];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <select className="field" style={{ padding: "8px 10px", fontSize: 13 }} aria-label={which === "from" ? "Compare from" : "Compare to"} value={set.key} onChange={(e) => (which === "from" ? setFromKey : setToKey)(e.target.value)}>{options}</select>
        <PhotoFrame url={photo?.url} label={photo ? shortDate(photo.takenAt) : `No ${pose} photo`} highlight={which === "to" && !!photo} />
        {onDelete && photo && <button type="button" className="link" style={{ fontSize: 12, color: "var(--text3)" }} onClick={() => { if (confirm("Delete this photo? This can't be undone.")) onDelete(photo.id); }}>Delete</button>}
      </div>
    );
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="chips">{POSES.map((p) => <button key={p} className={`chip ${pose === p ? "on" : ""}`} onClick={() => setPose(p)}>{POSE_LABEL[p]}</button>)}</div>
      <div className="compare">{side(from, "from")}{side(to, "to")}</div>
      <div className="tiny">{sets.length} photo {sets.length === 1 ? "day" : "days"} · links to the photos expire after an hour, reopen to refresh</div>
    </div>
  );
}
