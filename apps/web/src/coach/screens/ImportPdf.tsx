import { EXERCISES, exerciseById, insertExercise, updateItem, type Workout } from "@apex/core";
import { Label, Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { readPlanFromPdf, type PlanDay, type PlanLine } from "../importPlan";

interface Props {
  file: File;
  workout: Workout;
  onClose: () => void;
  onApply: (next: Workout, message: string) => void;
}

type Row = PlanLine & { on: boolean; pick: number | null };

const toRows = (day: PlanDay | undefined): Row[] => (day?.lines ?? []).map((l) => ({ ...l, on: l.exerciseId !== null, pick: l.exerciseId }));

/** A dropped PDF read into a draft. Each line shows what was read and the library match; nothing is added until the coach accepts. */
export function ImportPdf({ file, workout, onClose, onApply }: Props) {
  const [days, setDays] = useState<PlanDay[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dayIx, setDayIx] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let live = true;
    readPlanFromPdf(file)
      .then((d) => { if (live) { setDays(d); setRows(toRows(d[0])); } })
      .catch((e: unknown) => live && setFailed(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [file]);

  const pickDay = (i: number) => { setDayIx(i); setRows(toRows(days?.[i])); };
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.on && r.pick !== null);
  const options = useMemo(() => [...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)), []);

  const accept = () => {
    let next = workout;
    for (const r of chosen) {
      next = insertExercise(next, exerciseById(r.pick as number), next.items.length);
      const key = next.items.at(-1)?.key as string;
      next = updateItem(next, key, {
        ...(r.sets ? { sets: r.sets } : {}),
        ...(r.reps ? { reps: r.reps } : {}),
        ...(r.kg ? { kg: r.kg } : {}),
        ...(r.rpe ? { rpe: r.rpe } : {}),
        ...(r.restSeconds ? { restSeconds: r.restSeconds } : {}),
      });
    }
    onApply(next, `${chosen.length} exercise${chosen.length === 1 ? "" : "s"} imported from ${file.name} · logged as your decision`);
  };

  return (
    <Sheet onClose={onClose} label="Import a PDF program">
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You review every line before it's added</span></div>
      <div><div className="eyebrow">{file.name}</div><h2 className="h2">Import into this workout</h2></div>

      {failed && <p className="small" style={{ margin: 0 }}>Couldn't read this PDF: {failed}. If it's a scan or a photo, there's no text to read; type the exercises in or drag them from the library instead.</p>}
      {!failed && !days && <p className="small" style={{ margin: 0 }}>Reading the PDF…</p>}

      {days && days.length > 1 && (
        <div className="chips">{days.map((d, i) => <button key={i} className={`chip ${dayIx === i ? "on" : ""}`} onClick={() => pickDay(i)}>{d.title}</button>)}</div>
      )}
      {days && rows.length === 0 && <p className="small" style={{ margin: 0 }}>No exercises found in this PDF. Try one with a line per exercise, such as “Back squat 4 × 6 @ 80 kg”.</p>}
      {rows.length > 0 && (
        <div className="card flat list">
          {rows.map((r, i) => (
            <div key={i} className={`imp-row ${r.on ? "" : "off"}`}>
              <input type="checkbox" checked={r.on} disabled={r.pick === null} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`Include line ${i + 1}`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div className="imp-src">“{r.source}”</div>
                <select value={r.pick ?? ""} onChange={(e) => set(i, { pick: e.target.value ? Number(e.target.value) : null, on: !!e.target.value })} aria-label={`Library match for line ${i + 1}`}>
                  <option value="">No match: skip this line</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="tiny num">{[r.sets && r.reps ? `${r.sets} × ${r.reps}` : r.reps, r.kg ? `${r.kg} kg` : "", r.rpe ? `RPE ${r.rpe}` : "", r.restSeconds ? `rest ${r.restSeconds} s` : ""].filter(Boolean).join(" · ") || "Sets and reps not found: defaults used"}</span>
                  {r.exerciseId !== null && r.pick === r.exerciseId && r.confidence < 0.75 && <Label kind="insight">Check match</Label>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className="btn act" style={{ flex: 2 }} disabled={chosen.length === 0} onClick={accept}>Add {chosen.length} to workout</button>
      </div>
    </Sheet>
  );
}
