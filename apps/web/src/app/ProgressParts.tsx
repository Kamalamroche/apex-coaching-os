import {
  MEASURES, POSES, blockDates, changeOver, defaultPair, fortnights, measurementSeries, parseNumber, shortDate, signed,
  type Fortnight, type MeasureKey, type Measurement, type MeasurementInput, type PhotoUpload, type Pose, type ProgressState,
} from "@apex/core";
import { Icons, Label, PhotoFrame, Sheet, Spark } from "@apex/ui";
import { useMemo, useRef, useState, type ReactNode } from "react";
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

type Side = "before" | "after";

const blockLine = (b: Fortnight) => {
  const w = b.latest.weightKg;
  const dw = b.change.weightKg;
  return [w !== undefined ? `${w} kg${dw ? ` (${signed(dw)})` : ""}` : null, blockDates(b)].filter(Boolean).join(" · ");
};

/**
 * Before and after for one pose, by two-week block. Side by side, or one photo over the other with a
 * slider to wipe between them. Starts on the first block and the latest one.
 */
export function BeforeAfter({ blocks, measurements, pick, onPick }: { blocks: Fortnight[]; measurements: Measurement[]; pick: { pose: Pose; before?: number; after?: number }; onPick: (p: { pose: Pose; before?: number; after?: number }) => void }) {
  const [view, setView] = useState<"side" | "slider">("side");
  const [wipe, setWipe] = useState(50);
  const pose = pick.pose;
  const withPose = blocks.filter((b) => b.byPose[pose]);
  const pair = defaultPair(blocks, pose);
  const before = withPose.find((b) => b.index === pick.before) ?? pair?.before;
  const after = withPose.find((b) => b.index === pick.after) ?? pair?.after;
  const options = withPose.map((b) => <option key={b.index} value={b.index}>{b.label} · {blockDates(b)}</option>);
  const choose = (side: Side, index: number) => onPick({ ...pick, [side]: index });
  const weeksApart = before && after ? Math.abs(after.index - before.index) * 2 : 0;
  // The last value on or before each photo, so a block without a weigh-in still compares.
  const valueAt = (k: MeasureKey, iso: string | undefined) => (iso ? measurementSeries(measurements, k).filter((p) => p.at.slice(0, 10) <= iso.slice(0, 10)).at(-1)?.value : undefined);
  const delta = (k: MeasureKey, unit: string) => {
    const a = valueAt(k, before?.byPose[pose]?.takenAt);
    const b = valueAt(k, after?.byPose[pose]?.takenAt);
    return a !== undefined && b !== undefined ? `${MEASURES.find((m) => m.key === k)!.label} ${signed(b - a)} ${unit}` : null;
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div className="chips">{POSES.map((p) => <button key={p} className={`chip ${pose === p ? "on" : ""}`} onClick={() => onPick({ pose: p })}>{POSE_LABEL[p]}</button>)}</div>
        <div className="chips" role="tablist" aria-label="Comparison view">
          <button role="tab" aria-selected={view === "side"} className={`chip ${view === "side" ? "on" : ""}`} onClick={() => setView("side")}>Side by side</button>
          <button role="tab" aria-selected={view === "slider"} className={`chip ${view === "slider" ? "on" : ""}`} onClick={() => setView("slider")}>Slider</button>
        </div>
      </div>
      {!before || !after ? (
        <div className="small">{withPose.length ? `One ${pose} photo so far. The comparison starts with the next one, two weeks from now.` : `No ${pose} photos yet.`}</div>
      ) : (
        <>
          <div className="compare">
            {(["before", "after"] as const).map((side) => (
              <label key={side} className="tiny" style={{ display: "flex", flexDirection: "column", gap: 4, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
                {side === "before" ? "Before" : "After"}
                <select className="field" style={{ padding: "8px 10px", fontSize: 13, textTransform: "none", letterSpacing: 0, fontWeight: 500 }} value={(side === "before" ? before : after).index} onChange={(e) => choose(side, Number(e.target.value))}>{options}</select>
              </label>
            ))}
          </div>
          {view === "side" ? (
            <div className="compare">
              <PhotoFrame url={before.byPose[pose]?.url} label={blockLine(before)} />
              <PhotoFrame url={after.byPose[pose]?.url} label={blockLine(after)} highlight />
            </div>
          ) : (
            <figure style={{ margin: 0 }}>
              <div className="video photo wipe" style={{ maxWidth: 360, margin: "0 auto" }}>
                <img src={before.byPose[pose]?.url ?? ""} alt={`Before, ${before.label}`} />
                <img src={after.byPose[pose]?.url ?? ""} alt={`After, ${after.label}`} style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${wipe}%)` }} />
                <div className="wipe-line" style={{ left: `${wipe}%` }} />
                <span className="tag label l-data" style={{ left: 8 }}>Before</span>
                <span className="tag label l-dec" style={{ left: "auto", right: 8 }}>After</span>
              </div>
              <input type="range" min={0} max={100} value={wipe} onChange={(e) => setWipe(Number(e.target.value))} aria-label="Slide between before and after" style={{ width: "100%", maxWidth: 360, display: "block", margin: "8px auto 0", accentColor: "var(--act)" }} />
              <figcaption className="tiny" style={{ textAlign: "center" }}>{before.label} → {after.label}</figcaption>
            </figure>
          )}
          <div className="small"><Label kind="data">Data</Label> {[`${weeksApart} weeks apart`, delta("weightKg", "kg"), delta("waistCm", "cm"), delta("hipsCm", "cm")].filter(Boolean).join(" · ")}</div>
        </>
      )}
    </div>
  );
}

/**
 * Every photo, grouped in two-week blocks, newest first. Filter by pose; tap a photo to see it large,
 * step through the rest, or send it to the before/after view.
 */
export function PhotoLibrary({ blocks, onCompare, onDelete }: { blocks: Fortnight[]; onCompare: (p: { pose: Pose; side: Side; index: number }) => void; onDelete?: (id: string) => void }) {
  const [pose, setPose] = useState<Pose | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const shown = blocks.map((b) => ({ b, photos: b.photos.filter((p) => pose === "all" || p.pose === pose) })).filter((x) => x.photos.length);
  const flat = shown.flatMap((x) => x.photos.map((p) => ({ p, b: x.b })));
  const at = flat.findIndex((x) => x.p.id === open);
  const current = flat[at];
  const total = blocks.reduce((n, b) => n + b.photos.length, 0);

  if (!total) return <div className="small">No photos yet. Add front, side and back every two weeks to build your library.</div>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div className="chips">{(["all", ...POSES] as const).map((p) => <button key={p} className={`chip ${pose === p ? "on" : ""}`} onClick={() => setPose(p)}>{p === "all" ? "All poses" : POSE_LABEL[p]}</button>)}</div>
        <span className="tiny num">{total} photos · {blocks.filter((b) => b.photos.length).length} blocks</span>
      </div>
      {shown.map(({ b, photos }) => (
        <section key={b.index}>
          <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">{b.label}</h3><span className="tiny num">{blockLine(b)}</span></div>
          <div className="library">
            {photos.map((p) => (
              <button key={p.id} className="thumb" onClick={() => setOpen(p.id)} aria-label={`${POSE_LABEL[p.pose]} photo, ${shortDate(p.takenAt)}`}>
                {p.url ? <img src={p.url} alt="" loading="lazy" /> : <span className="tiny">No preview</span>}
                <span className="cap">{POSE_LABEL[p.pose]} · {new Date(p.takenAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {current && (
        <Sheet onClose={() => setOpen(null)} label="Progress photo">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div><div className="h3">{POSE_LABEL[current.p.pose]} · {shortDate(current.p.takenAt)}</div><div className="tiny">{current.b.label} · {at + 1} of {flat.length}</div></div>
            <button className="iconbtn" onClick={() => setOpen(null)} aria-label="Close"><Icons.close width={16} height={16} /></button>
          </div>
          <div className="video photo" style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>{current.p.url ? <img src={current.p.url} alt={`${POSE_LABEL[current.p.pose]} photo`} /> : null}</div>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} disabled={at <= 0} onClick={() => setOpen(flat[at - 1]!.p.id)}>‹ Newer</button>
            <button className="btn ghost" style={{ flex: 1 }} disabled={at >= flat.length - 1} onClick={() => setOpen(flat[at + 1]!.p.id)}>Older ›</button>
          </div>
          <div className="row">
            <button className="btn sec sm" style={{ flex: 1 }} onClick={() => { onCompare({ pose: current.p.pose, side: "before", index: current.b.index }); setOpen(null); }}>Use as before</button>
            <button className="btn act sm" style={{ flex: 1 }} onClick={() => { onCompare({ pose: current.p.pose, side: "after", index: current.b.index }); setOpen(null); }}>Use as after</button>
          </div>
          {onDelete && <button className="link" style={{ alignSelf: "center", color: "var(--text3)" }} onClick={() => { if (confirm("Delete this photo? This can't be undone.")) { onDelete(current.p.id); setOpen(null); } }}>Delete photo</button>}
        </Sheet>
      )}
    </div>
  );
}

/** One row per two-week block: front photo, weight, waist and how the weeks felt. */
export function FortnightTable({ blocks }: { blocks: Fortnight[] }) {
  if (!blocks.length) return <div className="small">Nothing recorded yet.</div>;
  const cell = (b: Fortnight, k: MeasureKey, unit: string) => {
    const v = b.latest[k];
    const d = b.change[k];
    return v === undefined ? <span className="tiny">–</span> : <span className="num small" style={{ whiteSpace: "nowrap" }}><b style={{ color: "var(--text)" }}>{v}</b> {unit}{d ? <span style={{ color: "var(--data)", marginLeft: 4 }}>{signed(d)}</span> : null}</span>;
  };
  return (
    <div className="list" style={{ margin: "-14px" }}>
      {blocks.map((b) => (
        <div key={b.index} className="li" style={{ alignItems: "flex-start" }}>
          <div className="thumb" style={{ width: 52, flexShrink: 0, cursor: "default" }} aria-hidden="true">
            {b.byPose.front?.url ? <img src={b.byPose.front.url} alt="" loading="lazy" /> : <Icons.figure width={22} height={22} />}
          </div>
          <div className="grow">
            <div className="h3">{b.label}</div>
            <div className="tiny">{blockDates(b)} · {b.checkIns.length} check-in{b.checkIns.length === 1 ? "" : "s"} · {b.photos.length} photo{b.photos.length === 1 ? "" : "s"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", marginTop: 6 }}>
              <span className="tiny">Weight {cell(b, "weightKg", "kg")}</span>
              <span className="tiny">Waist {cell(b, "waistCm", "cm")}</span>
              {b.avgSleep !== null && <span className="tiny">Sleep <span className="num small">{b.avgSleep} h</span></span>}
              {b.avgEnergy !== null && <span className="tiny">Energy <span className="num small">{b.avgEnergy}/5</span></span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type HubView = "compare" | "library" | "blocks";

/** Before/after, the photo library and the two-week summary, behind one set of tabs. Client and coach both use it. */
export function ProgressHub({ progress, onDelete, extra }: { progress: Pick<ProgressState, "checkIns" | "measurements" | "photos">; onDelete?: (id: string) => void; extra?: ReactNode }) {
  const blocks = useMemo(() => fortnights(progress), [progress]);
  const [view, setView] = useState<HubView>("compare");
  const [pick, setPick] = useState<{ pose: Pose; before?: number; after?: number }>({ pose: "front" });
  const tabs: [HubView, string][] = [["compare", "Before & after"], ["library", "Photo library"], ["blocks", "Every 2 weeks"]];
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Progress photos</h2>{extra}</div>
      <div className="chips" role="tablist" aria-label="Progress photos view">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`chip ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <div className="card">
        {view === "compare" && <BeforeAfter blocks={blocks} measurements={progress.measurements} pick={pick} onPick={setPick} />}
        {view === "library" && <PhotoLibrary blocks={blocks} onDelete={onDelete} onCompare={({ pose, side, index }) => { setPick((p) => ({ ...(p.pose === pose ? p : {}), pose, [side]: index })); setView("compare"); }} />}
        {view === "blocks" && <FortnightTable blocks={blocks} />}
      </div>
    </section>
  );
}

type MeasureView = "summary" | "blocks" | "each";

type ProgressData = Pick<ProgressState, "checkIns" | "measurements" | "photos">;

/**
 * One table, one row per two-week block: the front photo, then every measurement with its change since
 * the block before, then how many check-ins came in.
 */
export function EveryTwoWeeks({ progress, photos = true }: { progress: ProgressData; photos?: boolean }) {
  const blocks = useMemo(() => fortnights(progress).filter((b) => Object.keys(b.latest).length || (photos && b.photos.length)), [progress, photos]);
  const taken = MEASURES.filter((m) => measurementSeries(progress.measurements, m.key).length);
  if (!blocks.length) return <div className="card small">Nothing recorded yet.</div>;
  return (
    <div className="card flat" style={{ overflowX: "auto" }}>
      <table className="mtable">
        <thead>
          <tr>
            <th scope="col">Block</th>
            {photos && <th scope="col" style={{ textAlign: "center" }}>Front</th>}
            {taken.map((m) => <th key={m.key} scope="col">{m.label}<small>{m.unit}</small></th>)}
            <th scope="col">Check-ins</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.index}>
              <th scope="row">{b.label}<small>{blockDates(b)}</small></th>
              {photos && (
                <td style={{ textAlign: "center" }}>
                  <div className="thumb" style={{ width: 40, margin: "0 auto", cursor: "default" }} aria-hidden="true">
                    {b.byPose.front?.url ? <img src={b.byPose.front.url} alt="" loading="lazy" /> : <Icons.figure width={16} height={16} />}
                  </div>
                </td>
              )}
              {taken.map((m) => {
                const v = b.latest[m.key];
                const d = b.change[m.key];
                return <td key={m.key}>{v === undefined ? <span className="tiny">–</span> : <><b>{v}</b>{d ? <small style={{ color: "var(--data)" }}>{signed(d)}</small> : null}</>}</td>;
              })}
              <td><b>{b.checkIns.length}</b>{b.avgSleep !== null && <small>sleep {b.avgSleep} h</small>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One measurement at a time: its chart and every entry, grouped by two-week block. */
export function MeasureOneByOne({ progress }: { progress: ProgressData }) {
  const taken = MEASURES.filter((m) => measurementSeries(progress.measurements, m.key).length);
  const [key, setKey] = useState<MeasureKey>("weightKg");
  const active = taken.find((m) => m.key === key) ?? taken[0];
  if (!active) return <div className="card small">No measurements yet.</div>;
  const series = measurementSeries(progress.measurements, active.key);
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <div className="chips">{taken.map((m) => <button key={m.key} className={`chip ${active.key === m.key ? "on" : ""}`} onClick={() => setKey(m.key)}>{m.label}</button>)}</div>
      {series.length > 1 ? <Spark data={series.map((p) => p.value)} unit={active.unit} /> : <div className="small">One entry so far. The trend starts with the next one.</div>}
      <div className="list" style={{ margin: "0 -14px -14px" }}>
        {fortnights(progress).filter((b) => b.latest[active.key] !== undefined).map((b) => {
          const entries = series.filter((p) => { const t = Date.parse(p.at); return t >= b.from.getTime() && t < b.to.getTime() + 86400000; });
          const d = b.change[active.key];
          return (
            <div key={b.index} className="li" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <div className="h3">{b.label}</div>
                <div className="tiny num">{entries.map((p) => `${new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${p.value}`).join(" · ")}</div>
              </div>
              <span className="num small" style={{ whiteSpace: "nowrap" }}><b style={{ color: "var(--text)" }}>{b.latest[active.key]}</b> {active.unit}</span>
              <span className="num small" style={{ minWidth: 44, textAlign: "right", fontWeight: 700, color: "var(--data)" }}>{d ? signed(d) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Every body measurement, three ways: start → now, a table of all measurements by two-week block,
 * and one measurement at a time.
 */
export function MeasurementHub({ progress, extra }: { progress: ProgressData; extra?: ReactNode }) {
  const [view, setView] = useState<MeasureView>("summary");
  const tabs: [MeasureView, string][] = [["summary", "Start → now"], ["blocks", "Every 2 weeks"], ["each", "One by one"]];
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Body measurements</h2>{extra ?? <Label kind="data">Data</Label>}</div>
      <div className="chips" role="tablist" aria-label="Measurements view">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={`chip ${view === k ? "on" : ""}`} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {view === "summary" && <div className="card flat list"><MeasurementTable measurements={progress.measurements} /></div>}
      {view === "blocks" && <EveryTwoWeeks progress={progress} photos={false} />}
      {view === "each" && <MeasureOneByOne progress={progress} />}
    </section>
  );
}

type SectionView = "photos" | "measures" | "blocks";

/**
 * The coach's single Progress section: photos (before & after, library), measurements (start → now,
 * one by one) and one "every 2 weeks" table with the photo and all measurements together.
 */
export function ProgressSection({ progress }: { progress: ProgressData }) {
  const blocks = useMemo(() => fortnights(progress), [progress]);
  const [view, setView] = useState<SectionView>("photos");
  const [photoView, setPhotoView] = useState<"compare" | "library">("compare");
  const [measureView, setMeasureView] = useState<"summary" | "each">("summary");
  const [pick, setPick] = useState<{ pose: Pose; before?: number; after?: number }>({ pose: "front" });
  const tabs: [SectionView, string][] = [["photos", "Photos"], ["measures", "Measurements"], ["blocks", "Every 2 weeks"]];
  const sub = <T extends string>(value: T, set: (v: T) => void, items: [T, string][]) => (
    <div className="chips">{items.map(([k, l]) => <button key={k} className={`chip ${value === k ? "on" : ""}`} onClick={() => set(k)}>{l}</button>)}</div>
  );
  return (
    <section className="stack" style={{ gap: 10 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Progress</h2><Label kind="data">Data</Label></div>
      <div className="seg" role="tablist" aria-label="Progress view">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {view === "photos" && <>
        {sub(photoView, setPhotoView, [["compare", "Before & after"], ["library", "Library"]])}
        <div className="card">
          {photoView === "compare"
            ? <BeforeAfter blocks={blocks} measurements={progress.measurements} pick={pick} onPick={setPick} />
            : <PhotoLibrary blocks={blocks} onCompare={({ pose, side, index }) => { setPick((p) => ({ ...(p.pose === pose ? p : {}), pose, [side]: index })); setPhotoView("compare"); }} />}
        </div>
      </>}
      {view === "measures" && <>
        {sub(measureView, setMeasureView, [["summary", "Start → now"], ["each", "One by one"]])}
        {measureView === "summary" ? <div className="card flat list"><MeasurementTable measurements={progress.measurements} /></div> : <MeasureOneByOne progress={progress} />}
      </>}
      {view === "blocks" && <EveryTwoWeeks progress={progress} />}
    </section>
  );
}
