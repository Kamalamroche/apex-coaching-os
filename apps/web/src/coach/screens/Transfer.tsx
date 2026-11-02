import {
  buildExportFiles, buildReportHtml, defaultChoices, describeClient, detectKind, exerciseById, exerciseNames, hasClientColumn, mergeClient, parseCsv, parseProgramText,
  programFromParsed, readTables, suggestMatches, templateFiles, zipFiles,
  type ExerciseChoices, type ImportBundle, type ParsedProgram, type SourceTable,
} from "@apex/core";
import { Avatar, BackLink, Label } from "@apex/ui";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useAppInfo } from "../../app/AppContext";
import { extractPdfText } from "../../data/pdfText";
import { importBundle, listPendingImports, loadExportData, type ImportResult, type PendingImport } from "../../data/transfer";
import type { CoachLiveProps } from "../CoachApp";

type Source = { name: string; table: SourceTable } | { name: string; pdf: ParsedProgram };
type Way = "file" | "paste" | "link";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const stamp = () => new Date().toISOString().slice(0, 10);

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "https://docs.google.com/spreadsheets/d/<id>/edit#gid=123" → its CSV export address. */
function sheetCsvUrl(link: string): string | null {
  const id = /\/spreadsheets\/d\/([\w-]+)/.exec(link)?.[1];
  if (!id) return null;
  const gid = /[#&?]gid=(\d+)/.exec(link)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/** Bring clients in from other apps, spreadsheets or PDFs, and take everything out again. */
export function Transfer({ live, say, onBack }: { live?: CoachLiveProps; say: (m: string) => void; onBack: () => void }) {
  const [way, setWay] = useState<Way>("file");
  const [sources, setSources] = useState<Source[]>([]);
  const [paste, setPaste] = useState("");
  const [link, setLink] = useState("");
  const [forClient, setForClient] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [choices, setChoices] = useState<ExerciseChoices>({});
  const [showMatched, setShowMatched] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [pending, setPending] = useState<PendingImport[]>([]);

  const refreshPending = () => { if (live) void listPendingImports(live.db, live.coachId).then(setPending).catch(() => setPending([])); };
  useEffect(refreshPending, [live]);

  const { coachName } = useAppInfo();
  const needsClient = sources.some((s) => "pdf" in s || (detectKind(s.table.rows[0] ?? []) !== "clients" && !hasClientColumn(s.table.rows[0] ?? [])));
  const bundle: ImportBundle = useMemo(() => {
    const who = forClient.trim();
    let b = readTables(sources.flatMap((s) => ("table" in s ? [s.table] : [])), who ? { defaultClient: who } : {});
    for (const s of sources) {
      if ("pdf" in s) {
        if (!who) continue;
        b = mergeClient(b, { name: who, program: programFromParsed(s.pdf, s.name.replace(/\.pdf$/i, "")) });
      }
    }
    return b;
  }, [sources, forClient]);

  const names = useMemo(() => exerciseNames(bundle), [bundle]);
  const matches = useMemo(() => suggestMatches(names), [names]);
  useEffect(() => setChoices((cur) => ({ ...defaultChoices(matches), ...cur })), [matches]);
  const unsure = names.filter((n) => !matches[n.toLowerCase()]?.confident);
  const sure = names.filter((n) => matches[n.toLowerCase()]?.confident);
  const existing = new Set((live?.clients ?? []).map((c) => c.name.trim().toLowerCase()));
  const pdfSkipped = sources.flatMap((s) => ("pdf" in s ? s.pdf.skipped.map((l) => `${s.name} line ${l.line}: “${l.text}” not read`) : []));

  const addSources = (next: Source[]) => { setSources((cur) => [...cur, ...next]); setResults(null); };

  async function readFiles(files: FileList | File[]) {
    setBusy("Reading files…");
    try {
      const next: Source[] = [];
      for (const f of Array.from(files)) {
        if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
          const text = await extractPdfText(f);
          const pdf = parseProgramText(text);
          if (!pdf.days.length) say(`${f.name}: no exercises found. Is it a scanned image?`);
          else next.push({ name: f.name, pdf });
          if (!forClient) setForClient(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").replace(/\b(program|programme|plan|workout)s?\b/gi, "").trim());
        } else if (/\.(xlsx|xls|numbers)$/i.test(f.name)) {
          say(`${f.name}: save it as CSV first (File > Download > CSV), or copy the cells and paste them`);
        } else {
          next.push({ name: f.name, table: { name: f.name, rows: parseCsv(await f.text()) } });
        }
      }
      addSources(next);
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(null);
    }
  }

  function readPaste() {
    const text = paste.trim();
    if (!text) return;
    const rows = parseCsv(text);
    // Cells copied from a sheet have columns; anything else is read as program text.
    if (rows.length > 1 && (rows[0]?.length ?? 0) > 1 && detectKind(rows[0]!)) {
      const name = `Pasted table ${sources.length + 1}`;
      addSources([{ name, table: { name, rows } }]);
    }
    else {
      const pdf = parseProgramText(text);
      if (!pdf.days.length) return say("No exercises or table headers found in that text");
      addSources([{ name: `Pasted program ${sources.length + 1}`, pdf }]);
    }
    setPaste("");
  }

  async function readLink() {
    const url = sheetCsvUrl(link);
    if (!url) return say("That doesn't look like a Google Sheets link");
    setBusy("Opening the sheet…");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const text = await res.text();
      if (/^\s*<!doctype html|<html/i.test(text)) throw new Error();
      addSources([{ name: "Google Sheet", table: { name: "Google Sheet", rows: parseCsv(text, ",") } }]);
      setLink("");
    } catch {
      say("Couldn't open that sheet. Share it as “Anyone with the link”, or copy the cells and paste them");
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (!live) return;
    setBusy("Importing…");
    try {
      const r = await importBundle(live.db, live.coachId, bundle, choices, live.clients ?? []);
      setResults(r);
      setSources([]);
      setForClient("");
      live.refreshClients();
      refreshPending();
      const ok = r.filter((x) => x.status !== "failed").length;
      say(`${ok} client${ok === 1 ? "" : "s"} imported`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportZip() {
    if (!live) return;
    setBusy("Gathering your data…");
    try {
      const data = await loadExportData(live.db, live.coachId, coachName);
      download(`apex-export-${stamp()}.zip`, zipFiles(buildExportFiles(data)), "application/zip");
      say(`Exported ${data.clients.length} client${data.clients.length === 1 ? "" : "s"}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportReport() {
    if (!live) return;
    // Open the window during the click, or the browser treats it as a pop-up.
    const w = window.open("", "_blank");
    if (!w) return say("Allow pop-ups for APEX to open the report");
    w.document.write("<p style='font:14px system-ui;padding:24px'>Preparing your report…</p>");
    setBusy("Building the report…");
    try {
      const data = await loadExportData(live.db, live.coachId, coachName);
      w.document.open();
      w.document.write(buildReportHtml(data));
      w.document.close();
      w.focus();
      w.print();
    } catch (e) {
      w.close();
      say(e instanceof Error ? e.message : "Couldn't build the report");
    } finally {
      setBusy(null);
    }
  }

  const copy = async (url: string, name: string) => {
    try { await navigator.clipboard.writeText(url); say(`${name}'s invite link copied`); } catch { say("Copy the link from the box"); }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void readFiles(e.dataTransfer.files);
  };

  const ready = bundle.clients.length > 0 && !(needsClient && !forClient.trim());
  return (
    <>
      <BackLink onClick={onBack}>All clients</BackLink>
      <div><div className="eyebrow">Clients</div><h1 className="h1">Import and export</h1></div>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h2 className="h2">Bring your clients in</h2>
          <p className="small" style={{ margin: "4px 0 0" }}>From another coaching app, a spreadsheet or a PDF program. Nothing is saved until you check it and press Import.</p>
        </div>
        <div className="chips" role="tablist" style={{ flexWrap: "wrap" }}>
          {([["file", "Upload CSV or PDF"], ["paste", "Paste from Google Sheets"], ["link", "Google Sheets link"]] as [Way, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={way === id} className={`chip ${way === id ? "on" : ""}`} onClick={() => setWay(id)}>{label}</button>
          ))}
        </div>
        {way === "file" && (
          <label
            className={`drop ${dragging ? "on" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input type="file" multiple accept=".csv,.tsv,.txt,.pdf,text/csv,application/pdf" onChange={(e) => { if (e.target.files) void readFiles(e.target.files); e.target.value = ""; }} />
            <b>Drop files here or choose files</b>
            <span className="tiny">CSV or TSV exports, or a PDF program. Excel? Save as CSV first.</span>
          </label>
        )}
        {way === "paste" && (
          <>
            <textarea className="field" rows={5} placeholder={"Select the cells in Google Sheets (headers included), copy, and paste here.\nOr paste a program as text: “Back squat 4 x 8 @ 60kg”."} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Pasted cells or program text" />
            <button className="btn ghost" style={{ alignSelf: "flex-start" }} disabled={!paste.trim()} onClick={readPaste}>Read pasted text</button>
          </>
        )}
        {way === "link" && (
          <>
            <input className="field" placeholder="https://docs.google.com/spreadsheets/d/…" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Google Sheets link" />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn ghost" disabled={!link.trim() || !!busy} onClick={() => void readLink()}>Open sheet</button>
              <span className="tiny">Share the sheet as “Anyone with the link can view”. Each tab is read separately: paste the link with that tab open.</span>
            </div>
          </>
        )}
        <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => download("apex-import-template.zip", zipFiles(templateFiles()), "application/zip")}>Download the template (clients, program, history, check-ins)</button>
        {busy && <div className="small" role="status">{busy}</div>}
      </section>

      {sources.length > 0 && (
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="sect" style={{ margin: 0 }}><h2 className="h2">Check before importing</h2><Label kind="data">Data</Label></div>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {sources.map((s, i) => (
              <span key={i} className="chip">
                {s.name} · {"pdf" in s ? `${s.pdf.days.reduce((t, d) => t + d.items.length, 0)} exercises` : bundle.tables.find((t) => t.name === s.table.name)?.kind ?? "not recognised"}
                <button className="x" aria-label={`Remove ${s.name}`} onClick={() => setSources((cur) => cur.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
          </div>
          {needsClient && (
            <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              Who is this for? Some of it has no client column.
              <input className="field" list="transfer-clients" value={forClient} onChange={(e) => setForClient(e.target.value)} placeholder="Client's full name" />
              <datalist id="transfer-clients">{(live?.clients ?? []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </label>
          )}

          {bundle.clients.length > 0 && (
            <div className="card flat list">
              {bundle.clients.map((c) => {
                const mine = existing.has(c.name.trim().toLowerCase());
                return (
                  <div key={c.name} className="li">
                    <Avatar initials={initials(c.name)} tone={mine ? "var(--blue)" : "var(--act)"} />
                    <div className="grow"><div className="h3">{c.name}</div><div className="small">{describeClient(c)}</div></div>
                    <span className="tiny" style={{ textAlign: "right" }}>{mine ? "Adds to your client" : "New · invite link"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {names.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sect" style={{ margin: 0 }}><h3 className="h3">Exercises</h3><Label kind="insight">Suggested matches</Label></div>
              <p className="tiny" style={{ margin: 0 }}>Each name is matched to the APEX library. {unsure.length ? `${unsure.length} need${unsure.length === 1 ? "s" : ""} a look.` : "All matched."} “Leave out” skips that exercise.</p>
              <div className="card flat list">
                {[...unsure, ...(showMatched ? sure : [])].map((n) => {
                  const m = matches[n.toLowerCase()];
                  const value = choices[n.toLowerCase()];
                  const options = m?.candidates.map((c) => c.exercise) ?? [];
                  if (value != null && !options.some((o) => o.id === value)) options.unshift(exerciseById(value));
                  return (
                    <div key={n} className="match">
                      <div className="grow"><div className="h3">{n}</div>{!m?.confident && <div className="tiny" style={{ color: value == null ? "var(--crit)" : "var(--warn)" }}>{value == null ? "No close match" : "Check this one"}</div>}</div>
                      <select className="field" value={value ?? ""} aria-label={`Library exercise for ${n}`} onChange={(e) => setChoices((cur) => ({ ...cur, [n.toLowerCase()]: e.target.value ? Number(e.target.value) : null }))}>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        <option value="">Leave out</option>
                      </select>
                    </div>
                  );
                })}
                {sure.length > 0 && <button className="li small" style={{ minHeight: 44 }} onClick={() => setShowMatched((s) => !s)}>{showMatched ? "Hide" : "Show"} {sure.length} matched automatically</button>}
              </div>
            </div>
          )}

          {(bundle.problems.length > 0 || pdfSkipped.length > 0) && (
            <details className="small">
              <summary>{bundle.problems.length + pdfSkipped.length} line{bundle.problems.length + pdfSkipped.length === 1 ? "" : "s"} left out</summary>
              <ul className="tiny" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{[...bundle.problems, ...pdfSkipped].slice(0, 50).map((p, i) => <li key={i}>{p}</li>)}</ul>
            </details>
          )}

          <button className="btn act block" disabled={!ready || !live || !!busy} onClick={() => void runImport()}>
            Import {bundle.clients.length} client{bundle.clients.length === 1 ? "" : "s"}
          </button>
          {!live && <p className="tiny" style={{ margin: 0 }}>This is the demo. Sign in as a coach to import for real.</p>}
          {live && <p className="tiny" style={{ margin: 0 }}>New clients get an invite link. Their program and history appear in their app as soon as they join.</p>}
        </section>
      )}

      {results && (
        <section className="card flat list" aria-label="Import results">
          {results.map((r) => (
            <div key={r.name} className="li" style={{ flexWrap: "wrap" }}>
              <div className="grow">
                <div className="h3">{r.name}</div>
                <div className="small">
                  {r.status === "added" && `Added to their history${r.keptProgram ? ". Their current program was kept" : ""}`}
                  {r.status === "invited" && "Send them this link. Their data is waiting for them"}
                  {r.status === "failed" && <span style={{ color: "var(--crit)" }}>{r.error}</span>}
                  {r.skipped > 0 && ` · ${r.skipped} exercise${r.skipped === 1 ? "" : "s"} left out`}
                </div>
              </div>
              {r.link && <button className="btn ghost sm" onClick={() => void copy(r.link!, r.name)}>Copy invite link</button>}
            </div>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Waiting to join</h2><span className="tiny">{pending.length}</span></div>
          <div className="card flat list">
            {pending.map((p) => (
              <div key={p.id} className="li">
                <Avatar initials={initials(p.name)} />
                <div className="grow"><div className="h3">{p.name}</div><div className="small">Imported {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · not joined yet</div></div>
                {p.link && <button className="btn ghost sm" onClick={() => void copy(p.link!, p.name)}>Copy link</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h2 className="h2">Take your data with you</h2>
          <p className="small" style={{ margin: "4px 0 0" }}>Every client, their current program, every logged set, check-ins and messages. Your data is yours, whenever you want it.</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn sec" style={{ flex: "1 1 180px" }} disabled={!live || !!busy} onClick={() => void exportZip()}>Download all (CSV)</button>
          <button className="btn ghost" style={{ flex: "1 1 180px" }} disabled={!live || !!busy} onClick={() => void exportReport()}>Client report (PDF)</button>
        </div>
        <p className="tiny" style={{ margin: 0 }}>The CSV files open in Google Sheets (File &gt; Import) or Excel, and import straight back into APEX. The report opens your print dialog: choose “Save as PDF”.</p>
      </section>
    </>
  );
}
