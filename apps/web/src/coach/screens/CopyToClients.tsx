import { firstName } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Sheet } from "@apex/ui";
import { useState } from "react";
import { useStore } from "../../data/StoreContext";
import { insertProgram } from "../../data/supabaseStore";
import type { CoachLiveProps } from "../CoachApp";

/**
 * Copy the open programme straight to other clients, each with their own copy to edit
 * (TrueCoach / Everfit style copy and paste, without saving a template first).
 */
export function CopyToClients({ live, say, onClose }: { live: CoachLiveProps; say: (m: string) => void; onClose: () => void }) {
  const store = useStore();
  const { program } = useApexState(store);
  const others = (live.clients ?? []).filter((c) => c.id !== live.activeClientId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copy = async () => {
    setBusy(true); setErr(null);
    try {
      const names: string[] = [];
      for (const c of others.filter((x) => picked.has(x.id))) {
        await insertProgram(live.db, { coachId: live.coachId, clientId: c.id, me: live.coachId }, program);
        names.push(firstName(c.name));
      }
      say(`${program.name} copied to ${names.join(", ")}. Each has their own copy to tweak.`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} label="Copy to other clients">
      <div><div className="eyebrow">{program.name} · {program.weeks} week{program.weeks === 1 ? "" : "s"}</div><h2 className="h2">Copy to other clients</h2></div>
      <div className="small">Each client gets their own copy, which becomes their current programme. Edit any copy afterwards without touching the others.</div>
      {others.length === 0 ? <div className="card flat small">Invite another client first.</div> : (
        <div className="card flat list">
          {others.map((c) => (
            <label key={c.id} className="li" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              <div className="grow"><div className="h3">{c.name}</div><div className="tiny">{c.mode}</div></div>
            </label>
          ))}
        </div>
      )}
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn act grow" disabled={busy || picked.size === 0} onClick={() => void copy()}>{busy ? "Copying…" : `Copy to ${picked.size || ""} client${picked.size === 1 ? "" : "s"}`.replace("  ", " ")}</button>
      </div>
    </Sheet>
  );
}
