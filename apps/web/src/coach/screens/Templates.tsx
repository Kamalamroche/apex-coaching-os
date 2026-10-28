import { firstName, fromTemplate, templateSummary, toTemplate, type ProgramTemplate } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import { insertProgram } from "../../data/supabaseStore";
import { demoTemplates, liveTemplates } from "../../data/templates";
import type { CoachLiveProps } from "../CoachApp";

/** The template library: save the open program, start a client from a template, or give one template to many clients.
    Every client gets their own copy, so editing one never changes another. */
export function Templates({ live, onClose, say }: { live?: CoachLiveProps; onClose: () => void; say: (m: string) => void }) {
  const store = useStore();
  const { program } = useApexState(store);
  const { clientName } = useAppInfo();
  const lib = useMemo(() => (live ? liveTemplates(live.db) : demoTemplates()), [live]);
  const [list, setList] = useState<ProgramTemplate[] | null>(null);
  const [name, setName] = useState(program.name);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const first = firstName(clientName) || "this client";

  const refresh = () => void lib.list().then(setList).catch((e: Error) => setErr(e.message));
  useEffect(refresh, [lib]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    await lib.save(toTemplate(program, name.trim() || program.name));
    say(`Saved “${name.trim() || program.name}” to your templates`);
    refresh();
  });

  const useFor = (t: ProgramTemplate) => {
    store.startProgram(fromTemplate(t));
    say(`${first} is now on ${t.name}`);
    onClose();
  };

  const assign = (t: ProgramTemplate) => run(async () => {
    if (!live) return;
    const ids = [...picked];
    for (const clientId of ids) {
      if (clientId === live.activeClientId) store.startProgram(fromTemplate(t));
      else await insertProgram(live.db, { coachId: live.coachId, clientId, me: live.coachId }, fromTemplate(t));
    }
    say(`${t.name} assigned to ${ids.length} client${ids.length === 1 ? "" : "s"}, each with their own copy`);
    onClose();
  });

  return (
    <Sheet onClose={onClose} label="Templates">
      <div><div className="eyebrow">Program library</div><h2 className="h2">Templates</h2></div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="h3">Save {first}'s program as a template</div>
        <div className="row" style={{ gap: 8 }}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Template name" />
          <button className="btn act" disabled={busy} onClick={() => void save()}>Save</button>
        </div>
        <span className="tiny">{program.days.length} day{program.days.length === 1 ? "" : "s"} over {program.weeks} week{program.weeks === 1 ? "" : "s"}. Loads and set plans are kept; history isn't.</span>
      </div>

      {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}
      {!list && <p className="small" style={{ margin: 0 }}>Loading templates…</p>}

      <div className="card flat list">
        {list?.map((t) => (
          <div key={t.id} className="tpl">
            <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <div className="grow">
                <div className="h3">{t.name}</div>
                <div className="tiny num" style={{ marginTop: 2 }}>{templateSummary(t)}</div>
                {t.note && <div className="small" style={{ marginTop: 4 }}>{t.note}</div>}
              </div>
              {t.starter ? <span className="chip">APEX</span> : <button className="iconbtn" aria-label={`Delete ${t.name}`} onClick={() => void run(async () => { await lib.remove(t.id); refresh(); })}>×</button>}
            </div>
            {confirm === t.id ? (
              <div className="tpl-confirm">
                <span className="small">Replaces {first}'s current program. The old one stays in their history.</span>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="btn act sm" onClick={() => useFor(t)}>Start {first} on it</button>
                </div>
              </div>
            ) : assigning === t.id && live ? (
              <div className="tpl-confirm">
                <span className="small">Each client gets their own copy to adjust.</span>
                <div className="tpl-clients">
                  {(live.clients ?? []).map((c) => (
                    <label key={c.id} className="row" style={{ gap: 8 }}>
                      <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                      <span className="small" style={{ color: "var(--text)" }}>{c.name}</span>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => setAssigning(null)}>Cancel</button>
                  <button className="btn act sm" disabled={busy || picked.size === 0} onClick={() => void assign(t)}>Assign to {picked.size}</button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost sm" onClick={() => setConfirm(t.id)}>Use for {first}</button>
                {live && (live.clients?.length ?? 0) > 1 && <button className="btn ghost sm" onClick={() => { setAssigning(t.id); setPicked(new Set()); }}>Assign to clients…</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn ghost block" onClick={onClose}>Done</button>
    </Sheet>
  );
}
