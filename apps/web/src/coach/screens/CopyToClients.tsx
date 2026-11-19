import { firstName, programChanges, sameProgramme, type Program, type ProgramChange } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Label, Sheet } from "@apex/ui";
import { useEffect, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { insertProgram, latestProgramNames, loadLatestProgram } from "../../data/supabaseStore";
import type { CoachLiveProps } from "../CoachApp";

type Row = { id: string; name: string; mode: string; programName: string | null };

/**
 * Master programmes: share the open programme with other clients.
 * Clients already on a programme with the same name come first, with exactly what would change for each,
 * so the coach fixes one programme and ticks who gets the fix. Everyone else can get a fresh copy too.
 */
export function CopyToClients({ live, say, onClose }: { live: CoachLiveProps; say: (m: string) => void; onClose: () => void }) {
  const store = useStore();
  const { program } = useApexState(store);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [changes, setChanges] = useState<Record<string, ProgramChange[] | "loading" | "error">>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const others = (live.clients ?? []).filter((c) => c.id !== live.activeClientId);
  const ids = others.map((c) => c.id).join(",");

  useEffect(() => {
    let on = true;
    latestProgramNames(live.db, ids ? ids.split(",") : []).then(
      (names) => { if (on) setRows(others.map((c) => ({ id: c.id, name: c.name, mode: c.mode, programName: names[c.id] ?? null }))); },
      () => { if (on) setRows(others.map((c) => ({ id: c.id, name: c.name, mode: c.mode, programName: null }))); },
    );
    return () => { on = false; };
  }, [live.db, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const same = rows ? sameProgramme(rows, program.name) : [];
  const rest = rows ? rows.filter((r) => !same.includes(r)) : [];

  // Work out what changes for each client on the same programme, and tick the ones with something to update.
  const sameIds = same.map((r) => r.id).join(",");
  useEffect(() => {
    if (!sameIds) return;
    let on = true;
    for (const id of sameIds.split(",")) {
      setChanges((c) => ({ ...c, [id]: "loading" }));
      loadLatestProgram(live.db, id).then(
        (theirs: Program | null) => {
          if (!on) return;
          const diff = theirs ? programChanges(theirs, program) : [];
          setChanges((c) => ({ ...c, [id]: diff }));
          if (diff.length) setPicked((s) => new Set(s).add(id));
        },
        () => { if (on) setChanges((c) => ({ ...c, [id]: "error" })); },
      );
    }
    return () => { on = false; };
    // Compare with the programme as it was when the sheet opened.
  }, [live.db, sameIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copy = async () => {
    setBusy(true); setErr(null);
    try {
      const names: string[] = [];
      for (const c of others.filter((x) => picked.has(x.id))) {
        await insertProgram(live.db, { coachId: live.coachId, clientId: c.id, me: live.coachId }, program);
        names.push(firstName(c.name));
      }
      say(`${program.name} sent to ${names.join(", ")}. Each has their own copy to tweak.`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const row = (r: Row, diff?: ProgramChange[] | "loading" | "error") => (
    <div key={r.id} className="ms-row">
      <label className="li" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
        <div className="grow">
          <div className="h3">{r.name}</div>
          <div className="tiny">
            {diff === undefined ? (r.programName ? `On “${r.programName}” · gets a fresh copy` : "No programme yet")
              : diff === "loading" ? "Checking what would change…"
              : diff === "error" ? "Couldn't compare. You can still update."
              : diff.length === 0 ? "Already up to date"
              : `${diff.length} change${diff.length === 1 ? "" : "s"}`}
          </div>
        </div>
        {Array.isArray(diff) && diff.length > 0 && <button className="btn ghost sm" onClick={(e) => { e.preventDefault(); setOpen(open === r.id ? null : r.id); }} aria-expanded={open === r.id}>{open === r.id ? "Hide" : "See changes"}</button>}
      </label>
      {open === r.id && Array.isArray(diff) && (
        <ul className="ms-diff">
          {diff.slice(0, 40).map((c, i) => <li key={i} className={`k-${c.kind}`}>{c.text}</li>)}
          {diff.length > 40 && <li>…and {diff.length - 40} more</li>}
        </ul>
      )}
    </div>
  );

  return (
    <Sheet onClose={onClose} label="Share this programme">
      <div><div className="eyebrow">{program.name} · {program.weeks} week{program.weeks === 1 ? "" : "s"}</div><h2 className="h2">Share this programme</h2></div>
      <div className="small">Fix it once here, then send it to everyone who should have it. Each client gets their own copy, which becomes their current programme. Their training history stays.</div>
      {!rows && <div className="card flat small">Finding who's on {program.name}…</div>}
      {rows && same.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="sect"><h3 className="h3">Also on {program.name}</h3><Label kind="data">Data</Label></div>
          <div className="card flat list">{same.map((r) => row(r, changes[r.id]))}</div>
          <span className="tiny">Untick anyone whose programme you've tailored and want to keep as it is.</span>
        </section>
      )}
      {rows && rest.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <h3 className="h3">{same.length ? "Other clients" : "Clients"}</h3>
          <div className="card flat list">{rest.map((r) => row(r))}</div>
        </section>
      )}
      {rows && others.length === 0 && <div className="card flat small">Invite another client first.</div>}
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn act grow" disabled={busy || picked.size === 0} onClick={() => void copy()}>{busy ? "Sending…" : picked.size ? `Send to ${picked.size} client${picked.size === 1 ? "" : "s"}` : "Pick clients"}</button>
      </div>
    </Sheet>
  );
}
