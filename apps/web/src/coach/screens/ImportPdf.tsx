import { EXERCISES, appendItems, parseProgramText, programFromImport, spokenToProgramText, type ParsedDay, type ParsedItem, type ParsedProgram, type Program, type Workout } from "@apex/core";
import { Label, Sheet } from "@apex/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { readProgramFromPdf } from "../importPlan";

interface Props {
  /** A PDF to read, or null to paste the program as text (WhatsApp, notes, an email). */
  file: File | null;
  workout: Workout;
  onClose: () => void;
  onApply: (next: Workout, message: string) => void;
  /** Brings in every week and day as the client's programme. */
  onProgram?: (program: Program, message: string) => void;
  /** No programme open yet (a new client): only the whole-programme import makes sense. */
  wholeOnly?: boolean;
}

type Row = ParsedItem & { on: boolean; pick: number | null };

/* The browser's own speech recognition (Chrome, Edge, Safari). No library, nothing to install;
   where it's missing the Speak button simply doesn't show. */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
const speechApi = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const toRows = (day: ParsedDay | undefined): Row[] =>
  (day?.items ?? []).map((it) => ({ ...it, on: it.match !== null, pick: it.match?.exercise.id ?? null }));

/** A dropped PDF read into a draft. Each line shows what was read and the library match; nothing is added until the coach accepts. */
export function ImportPdf({ file, workout, onClose, onApply, onProgram, wholeOnly }: Props) {
  const [plan, setPlan] = useState<ParsedProgram | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dayIx, setDayIx] = useState(0);
  const [all, setAll] = useState<Row[][]>([]);
  const [scope, setScope] = useState<"all" | "day">("all");
  const [progName, setProgName] = useState("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const canSpeak = !file && speechApi() !== null;
  useEffect(() => () => rec.current?.stop(), []);

  const speak = () => {
    if (listening) return rec.current?.stop();
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res) continue;
        if (res.isFinal) {
          const lines = spokenToProgramText(res[0].transcript);
          if (lines) setText((t) => (t.trim() ? `${t.trimEnd()}\n${lines}` : lines));
        } else interim += res[0].transcript;
      }
      setHeard(interim);
    };
    r.onerror = (e) => setMicError(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in the browser and try again." : `Speech stopped (${e.error}).`);
    r.onend = () => { setListening(false); setHeard(""); };
    rec.current = r;
    setMicError(null);
    setListening(true);
    r.start();
  };
  const source = file?.name ?? "pasted text";
  const show = (p: ParsedProgram) => { setPlan(p); setDayIx(0); setAll(p.days.map(toRows)); setProgName(p.name ?? ""); };

  useEffect(() => {
    if (!file) return;
    let live = true;
    readProgramFromPdf(file)
      .then((p) => { if (live) show(p); })
      .catch((e: unknown) => live && setFailed(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [file]);

  const days = plan?.days ?? null;
  const rows = all[dayIx] ?? [];
  const pickDay = (i: number) => setDayIx(i);
  const set = (i: number, patch: Partial<Row>) => setAll((ds) => ds.map((rs, d) => (d !== dayIx ? rs : rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))));
  const chosen = rows.filter((r) => r.on && r.pick !== null);
  const whole = !!onProgram && (wholeOnly || scope === "all");
  const keep = (rs: Row[]) => rs.filter((r) => r.on && r.pick !== null);
  const wholeCount = all.reduce((t, rs) => t + keep(rs).length, 0);
  const daysWith = all.filter((rs) => keep(rs).length > 0).length;
  const weeks = Math.max(1, ...(days ?? []).map((d) => d.week));
  const toCheck = (rs: Row[]) => rs.filter((r) => r.on && r.match && r.pick === r.match.exercise.id && !r.confident).length;
  const options = useMemo(() => [...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)), []);

  const acceptWhole = () => {
    if (!onProgram || !days) return;
    const name = progName.trim() || plan?.name || "Imported programme";
    const program = programFromImport(name, days.map((d, i) => ({
      title: d.title, week: d.week, dayIndex: d.dayIndex,
      drafts: keep(all[i] ?? []).map((r) => ({ exerciseId: r.pick as number, group: r.group, sets: r.sets, reps: r.reps, kg: r.kg, rpe: r.rpe, restSeconds: r.restSeconds })),
    })));
    onProgram(program, `${name}: ${program.days.length} session${program.days.length === 1 ? "" : "s"} over ${program.weeks} week${program.weeks === 1 ? "" : "s"} imported from ${source} · logged as your decision`);
  };
  const accept = () => {
    const drafts = chosen.map((r) => ({ exerciseId: r.pick as number, group: r.group, sets: r.sets, reps: r.reps, kg: r.kg, rpe: r.rpe, restSeconds: r.restSeconds }));
    onApply(appendItems(workout, drafts), `${chosen.length} exercise${chosen.length === 1 ? "" : "s"} imported from ${source} · logged as your decision`);
  };

  return (
    <Sheet onClose={onClose} label={file ? "Import a PDF programme" : "Paste a programme"}>
      <div className="row"><Label kind="ai">AI suggestion</Label><span className="tiny">You review every line before it's added</span></div>
      <div><div className="eyebrow">{source}</div><h2 className="h2">{plan?.name ?? (onProgram ? "Import a programme" : "Import into this workout")}</h2></div>

      {!file && !plan && (
        <>
          <textarea
            className="field"
            rows={8}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Paste from WhatsApp, notes or an email, one exercise per line:\nDay 1 – Lower\nA) Back squat 4 x 6-8 @ 80kg RPE 8, rest 2 min\nB1) RDL 3 sets of 10\nB2) Plank 3x40s"}
            style={{ fontFamily: "var(--num)", fontSize: 13, lineHeight: 1.5, resize: "vertical" }}
          />
          {canSpeak && (
            <div className="voice">
              <button className={`btn ${listening ? "act" : "ghost"} sm`} aria-pressed={listening} onClick={speak}>
                <span className={`voice-dot ${listening ? "on" : ""}`} aria-hidden />{listening ? "Stop" : "Speak the session"}
              </button>
              <span className="tiny">{listening ? heard || "Listening… say each exercise, then “then” for the next" : "e.g. “Squat four by six at eighty kilos, then RDL three sets of ten”"}</span>
            </div>
          )}
          {micError && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{micError}</p>}
          <button className="btn act block" disabled={!text.trim() || listening} onClick={() => show(parseProgramText(text))}>Read programme</button>
        </>
      )}

      {failed && <p className="small" style={{ margin: 0 }}>Couldn't read this PDF: {failed}. If it's a scan or a photo, there's no text to read; type the exercises in or drag them from the library instead.</p>}
      {file && !failed && !days && <p className="small" style={{ margin: 0 }}>Reading the PDF…</p>}

      {days && days.length > 0 && onProgram && !wholeOnly && (
        <div className="chips" role="radiogroup" aria-label="What to import">
          <button className={`chip ${scope === "all" ? "on" : ""}`} role="radio" aria-checked={scope === "all"} onClick={() => setScope("all")}>Whole programme · {days.length} day{days.length === 1 ? "" : "s"}{weeks > 1 ? `, ${weeks} weeks` : ""}</button>
          <button className={`chip ${scope === "day" ? "on" : ""}`} role="radio" aria-checked={scope === "day"} onClick={() => setScope("day")}>Only into “{workout.name}”</button>
        </div>
      )}
      {days && whole && (
        <div className="card flat" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, flexShrink: 0 }}>
          <input className="field" aria-label="Programme name" placeholder="Programme name" value={progName} onChange={(e) => setProgName(e.target.value)} />
          <div className="tiny">{wholeCount} exercises over {daysWith} session{daysWith === 1 ? "" : "s"}{weeks > 1 ? ` and ${weeks} weeks` : ""}. Tap a day below to check its lines. It replaces the current programme; past sessions are kept.</div>
        </div>
      )}
      {days && (days.length > 1 || whole) && (
        <div className="chips">{days.map((d, i) => { const c = toCheck(all[i] ?? []); return <button key={i} className={`chip ${dayIx === i ? "on" : ""}`} onClick={() => pickDay(i)}>{weeks > 1 ? `W${d.week} · ` : ""}{d.title}{whole ? ` · ${keep(all[i] ?? []).length}` : ""}{c ? <span style={{ color: "var(--warn)" }}> · {c} to check</span> : null}</button>; })}</div>
      )}
      {days && rows.length === 0 && <p className="small" style={{ margin: 0 }}>No exercises found{file ? " in this PDF" : ""}. Try one with a line per exercise, such as “Back squat 4 × 6 @ 80 kg”.</p>}
      {rows.length > 0 && (
        <div className="card flat list">
          {rows.map((r, i) => (
            <div key={i} className={`imp-row ${r.on ? "" : "off"}`}>
              <input type="checkbox" checked={r.on} disabled={r.pick === null} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`Include line ${i + 1}`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div className="imp-src">“{r.text}”</div>
                <select value={r.pick ?? ""} onChange={(e) => set(i, { pick: e.target.value ? Number(e.target.value) : null, on: !!e.target.value })} aria-label={`Library match for line ${i + 1}`}>
                  <option value="">No match: skip this line</option>
                  {r.candidates.length > 0 && <optgroup label="Closest matches">{r.candidates.map((c) => <option key={c.exercise.id} value={c.exercise.id}>{c.exercise.name}</option>)}</optgroup>}
                  <optgroup label="All movements">{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                </select>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="grp" style={{ padding: "4px 6px" }}>{r.group}</span>
                  <span className="tiny num">{[`${r.sets} × ${r.reps}`, r.kg ? `${r.kg} kg` : "", r.rpe ? `RPE ${r.rpe}` : "", r.restSeconds ? `rest ${r.restSeconds} s` : ""].filter(Boolean).join(" · ")}</span>
                  {r.match && r.pick === r.match.exercise.id && !r.confident && <Label kind="insight">Check match</Label>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {plan && plan.skipped.length > 0 && (
        <details className="small">
          <summary style={{ cursor: "pointer" }}>{plan.skipped.length} line{plan.skipped.length === 1 ? "" : "s"} not read as exercises</summary>
          <div className="imp-src" style={{ marginTop: 6 }}>{plan.skipped.slice(0, 30).map((l) => <div key={l.line}>{l.text}</div>)}</div>
        </details>
      )}

      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={!file && plan ? () => setPlan(null) : onClose}>{!file && plan ? "Edit text" : "Cancel"}</button>
        {(file || plan) && (whole
          ? <button className="btn act" style={{ flex: 2 }} disabled={wholeCount === 0} onClick={acceptWhole}>Build the programme</button>
          : <button className="btn act" style={{ flex: 2 }} disabled={chosen.length === 0} onClick={accept}>Add {chosen.length} to workout</button>)}
      </div>
    </Sheet>
  );
}
