import { cleanTags, fillMessage, firstName, fromTemplate, type ProgramTemplate } from "@apex/core";
import { Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useNotesApi } from "../../data/clientNotes";
import { insertProgram } from "../../data/supabaseStore";
import { demoTemplates, liveTemplates } from "../../data/templates";
import type { CoachLiveProps } from "../CoachApp";
import { useSendToClient } from "../sendToClient";

type Action = "message" | "programme" | "tag";

/**
 * Bulk actions: pick clients (the list as filtered, or tick by hand), then do one job for all of them:
 * send a message, give a programme from your templates, or add a tag. The coach sees the count before anything happens.
 */
export function BulkActions({ clients, live, say, onClose, onDone }: { clients: { id: string; name: string }[]; live?: CoachLiveProps; say: (m: string) => void; onClose: () => void; onDone?: () => void }) {
  const { coachName } = useAppInfo();
  const send = useSendToClient(live);
  const notes = useNotesApi();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(clients.map((c) => c.id)));
  const [action, setAction] = useState<Action>("message");
  const [text, setText] = useState("Hi {first_name}, ");
  const [tag, setTag] = useState("");
  const [templates, setTemplates] = useState<ProgramTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lib = useMemo(() => (live ? liveTemplates(live.db) : demoTemplates()), [live]);
  useEffect(() => { if (action === "programme" && !templates) lib.list().then(setTemplates, () => setTemplates([])); }, [action, templates, lib]);

  const chosen = clients.filter((c) => picked.has(c.id));
  const n = chosen.length;
  const all = n === clients.length;
  const toggle = (id: string) => setPicked((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const coach = firstName(coachName) || "Your coach";
  const preview = fillMessage(text, { firstName: firstName(chosen[0]?.name ?? "Sam"), coach });
  const ready = n > 0 && (action === "message" ? text.replace("{first_name}", "").replace(/^Hi\s*,?\s*/i, "").trim().length > 0 : action === "programme" ? !!templateId && !!live : cleanTags([tag]).length > 0 && !!notes);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      if (action === "message") {
        for (const c of chosen) await send(c.id, fillMessage(text.trim(), { firstName: firstName(c.name), coach }));
        say(`Message sent to ${n} client${n === 1 ? "" : "s"}, each with their own name`);
      } else if (action === "programme" && live) {
        const t = templates?.find((x) => x.id === templateId);
        if (!t) throw new Error("Pick a template");
        for (const c of chosen) await insertProgram(live.db, { coachId: live.coachId, clientId: c.id, me: live.coachId }, fromTemplate(t));
        say(`${t.name} given to ${n} client${n === 1 ? "" : "s"}, each with their own copy`);
      } else if (action === "tag" && notes) {
        const [clean] = cleanTags([tag]);
        const now = await notes.tags();
        for (const c of chosen) await notes.setTags(c.id, cleanTags([...(now[c.id] ?? []), clean!]));
        say(`Tagged ${n} client${n === 1 ? "" : "s"} “${clean}”`);
      }
      onDone?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} label="Do it for several clients">
      <div><div className="eyebrow">{n} of {clients.length} selected</div><h2 className="h2">Do it for several clients</h2></div>
      <div className="chips" role="radiogroup" aria-label="What to do">
        {([["message", "Send a message"], ["programme", "Give a programme"], ["tag", "Add a tag"]] as const).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={action === k} className={`chip ${action === k ? "on" : ""}`} onClick={() => setAction(k)}>{label}</button>
        ))}
      </div>

      {action === "message" && (
        <label className="small stack" style={{ gap: 6 }}>Message · {"{first_name}"} becomes each client's name
          <textarea className="field" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
          {n > 0 && <span className="tiny">{firstName(chosen[0]!.name)} sees: “{preview.trim()}”</span>}
        </label>
      )}
      {action === "programme" && (
        live ? (
          <label className="small stack" style={{ gap: 6 }}>Template · each client gets their own copy, which becomes their current programme
            <select className="field" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">{templates ? "Pick a template" : "Loading templates…"}</option>
              {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.starter ? " (APEX)" : ""}</option>)}
            </select>
          </label>
        ) : <div className="card flat small">In the demo only Priya has a real programme. Signed in, this gives every ticked client their own copy.</div>
      )}
      {action === "tag" && (
        notes ? (
          <label className="small stack" style={{ gap: 6 }}>Tag · private to you, used to filter the list
            <input className="field" value={tag} maxLength={24} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Wedding 2027, Online, Return to run" />
          </label>
        ) : <div className="card flat small">Tags need the client notes update in Supabase.</div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small"><b>Clients</b></span>
        <button className="btn ghost sm" onClick={() => setPicked(all ? new Set() : new Set(clients.map((c) => c.id)))}>{all ? "Clear all" : "Select all"}</button>
      </div>
      <div className="card flat list" style={{ maxHeight: 260, overflow: "auto" }}>
        {clients.map((c) => (
          <label key={c.id} className="li" style={{ cursor: "pointer", minHeight: 48 }}>
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
            <span className="grow h3" style={{ fontSize: 15 }}>{c.name}</span>
          </label>
        ))}
      </div>
      {!live && action === "message" && <span className="tiny">Demo: only Priya's chat is real.</span>}
      {err && <div className="small" style={{ color: "var(--crit)" }}>{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={onClose}>Cancel</button>
        <button className="btn act grow" disabled={busy || !ready} onClick={() => void run()}>{busy ? "Working…" : action === "message" ? `Send to ${n}` : action === "programme" ? `Give to ${n}` : `Tag ${n}`}</button>
      </div>
    </Sheet>
  );
}
