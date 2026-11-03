import { CLIENTS, RESOURCE_CATEGORIES, blankResource, groupResources, resourceProblem, type Resource } from "@apex/core";
import { BackLink, Icons } from "@apex/ui";
import { useState } from "react";
import { ResourceIcon, ResourceStatus, resourceMeta, useResources } from "../../app/ResourceParts";
import { useResourceApi } from "../../data/resources";
import type { CoachLiveProps } from "../CoachApp";

/** Coach: write guides and share links, for every client or one. */
export function CoachResources({ live, onBack, say }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void }) {
  const api = useResourceApi();
  const data = useResources(api);
  const [edit, setEdit] = useState<Resource | null>(null);
  const people = live ? (live.clients ?? []).map((c) => ({ id: c.id, name: c.name })) : CLIENTS.map((c) => ({ id: String(c.id), name: c.name }));
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? "One client" : null);
  if (!api) return null;

  if (edit) {
    return <Editor initial={edit} isNew={!data.list.some((r) => r.id === edit.id)} people={people} onBack={() => setEdit(null)}
      onSave={async (r) => { await api.save(r); setEdit(null); say(r.clientId ? `Shared with ${nameOf(r.clientId)}` : "Shared with all your clients"); await data.reload(); }}
      onRemove={async (id) => { await api.remove(id); setEdit(null); say("Removed"); await data.reload(); }} />;
  }
  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <div><div className="eyebrow">Resource library</div><h1 className="h1">Guides and links</h1></div>
      <div className="small">Write a guide once and every client can read it in More → Resources. Share videos, PDFs or articles as links.</div>
      <ResourceStatus data={data} />
      {data.status === "ready" && <button className="btn act block" onClick={() => setEdit(blankResource())}><Icons.plus width={15} height={15} /> Add a guide or link</button>}
      {groupResources(data.list).map((g) => (
        <section key={g.category}>
          <div className="sect"><h2 className="h3">{g.category}</h2><span className="tiny">{g.items.length}</span></div>
          <div className="card flat list">
            {g.items.map((r) => (
              <button key={r.id} className="li" onClick={() => setEdit(r)}>
                <ResourceIcon r={r} />
                <div className="grow"><div className="h3">{r.title}</div><div className="tiny">{resourceMeta(r)} · {nameOf(r.clientId) ?? "Everyone"}</div></div>
                <span className="tiny">Edit</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Editor({ initial, isNew, people, onSave, onRemove, onBack }: {
  initial: Resource; isNew: boolean; people: { id: string; name: string }[];
  onSave: (r: Resource) => Promise<void>; onRemove: (id: string) => Promise<void>; onBack: () => void;
}) {
  const [r, setR] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const save = () => {
    const problem = resourceProblem(r);
    if (problem) return setError(problem);
    void run(() => onSave(r));
  };
  return (
    <>
      <BackLink onClick={onBack}>Resource library</BackLink>
      <section className="card stack">
        <h2 className="h2">{isNew ? "New guide or link" : "Edit"}</h2>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Title<input className="field" maxLength={120} placeholder="e.g. Protein made simple" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></label>
        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>Topic</div>
          <div className="chips" style={{ flexWrap: "wrap" }}>{RESOURCE_CATEGORIES.map((c) => <button key={c} type="button" className={`chip ${r.category === c ? "on" : ""}`} aria-pressed={r.category === c} onClick={() => setR({ ...r, category: c })}>{c}</button>)}</div>
        </div>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Guide<textarea className="field" rows={8} maxLength={8000} placeholder="Write it the way you'd explain it in the gym. Short paragraphs read best on a phone." value={r.body} onChange={(e) => setR({ ...r, body: e.target.value })} /></label>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Link (optional)<input className="field" inputMode="url" placeholder="https://… a video, PDF or article" value={r.url} onChange={(e) => setR({ ...r, url: e.target.value })} /></label>
        <label className="small" style={{ display: "flex", flexDirection: "column", gap: 6 }}>Who sees it
          <select className="field" value={r.clientId ?? ""} onChange={(e) => setR({ ...r, clientId: e.target.value || null })}>
            <option value="">All my clients</option>
            {people.map((p) => <option key={p.id} value={p.id}>Only {p.name}</option>)}
          </select>
        </label>
        <div className="tiny">Share only your own material, or links to the original.</div>
        {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onBack} disabled={busy}>Cancel</button>
          <button className="btn act grow" onClick={save} disabled={busy}>{busy ? "Saving…" : isNew ? "Share" : "Save"}</button>
        </div>
        {!isNew && <button className="btn ghost block" style={{ color: "var(--crit)" }} disabled={busy} onClick={() => void run(() => onRemove(r.id))}><Icons.trash width={15} height={15} /> Remove</button>}
      </section>
    </>
  );
}
