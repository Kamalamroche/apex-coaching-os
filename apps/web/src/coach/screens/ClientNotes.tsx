import { TAG_SUGGESTIONS, MAX_TAGS, cleanTags, firstName, hasTag, shortDate, sortNotes, tagsInUse, type ClientNote } from "@apex/core";
import { Icons } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { NOTES_NEED_UPDATE, useNotesApi } from "../../data/clientNotes";

/** Every client's tags, for the list and its filter. */
export function useClientTags() {
  const api = useNotesApi();
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const reload = useCallback(async () => {
    if (!api) return;
    try { setTags(await api.tags()); } catch { /* list still works without tags */ }
  }, [api]);
  useEffect(() => void reload(), [reload]);
  return { tags, reload };
}

/** Filter chips for the client list. Hidden until a tag is in use. */
export function TagFilter({ tags, value, onChange }: { tags: Record<string, string[]>; value: string | null; onChange: (t: string | null) => void }) {
  const used = tagsInUse(tags);
  if (!used.length) return null;
  return (
    <div className="chips" style={{ flexWrap: "wrap" }} aria-label="Filter by tag">
      {used.map(({ tag, count }) => <button key={tag} className={`chip ${value && hasTag([value], tag) ? "on" : ""}`} aria-pressed={!!value && hasTag([value], tag)} onClick={() => onChange(value && hasTag([value], tag) ? null : tag)}>{tag} <span className="num" style={{ opacity: 0.6 }}>{count}</span></button>)}
    </div>
  );
}

export const TagList = ({ tags }: { tags?: string[] }) => (tags?.length ? <div className="row" style={{ gap: 4, flexWrap: "wrap", marginTop: 4 }}>{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div> : null);

/** Coach: private tags and notes on one client. The client never sees any of it. */
export function ClientNotes({ clientId, clientName, say }: { clientId: string; clientName: string; say: (m: string) => void }) {
  const api = useNotesApi();
  const name = firstName(clientName) || "this client";
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "needs-update" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [tagText, setTagText] = useState("");
  const load = useCallback(async () => {
    if (!api) return;
    try {
      const [n, t] = await Promise.all([api.notes(clientId), api.tags()]);
      setNotes(n);
      setTags(t[clientId] ?? []);
      setStatus("ready");
    } catch (e) {
      setStatus(e instanceof Error && e.message === NOTES_NEED_UPDATE ? "needs-update" : "error");
    }
  }, [api, clientId]);
  useEffect(() => void load(), [load]);
  if (!api) return null;
  if (status === "loading") return <div className="card small">Loading…</div>;
  if (status === "needs-update") return <div className="card small">Notes and tags need a quick database update. Run the resources and notes SQL in Supabase, then reload.</div>;
  if (status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load notes. Reload to try again.</div>;

  const act = async (fn: () => Promise<void>, done?: string) => {
    try {
      await fn();
      if (done) say(done);
    } catch (e) {
      say(e instanceof Error ? e.message : String(e));
    }
    await load();
  };
  const saveTags = (next: string[]) => void act(() => api.setTags(clientId, cleanTags(next)));
  const addTag = (t: string) => { if (t.trim() && tags.length < MAX_TAGS) saveTags([...tags, t]); setTagText(""); };
  const suggestions = TAG_SUGGESTIONS.filter((t) => !hasTag(tags, t));

  return (
    <>
      <div className="row tiny" style={{ gap: 6 }}><Icons.note width={14} height={14} /> Only you can see notes and tags. {name} never does.</div>
      <section className="card stack">
        <h3 className="h3">Tags</h3>
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {tags.length === 0 && <span className="tiny">No tags yet.</span>}
          {tags.map((t) => <span key={t} className="chip on">{t}<button className="x" style={{ color: "inherit" }} aria-label={`Remove tag ${t}`} onClick={() => saveTags(tags.filter((x) => x !== t))}>×</button></span>)}
        </div>
        {tags.length < MAX_TAGS && (
          <>
            <div className="chips" style={{ flexWrap: "wrap" }}>{suggestions.slice(0, 6).map((t) => <button key={t} className="chip" onClick={() => addTag(t)}><Icons.plus width={11} height={11} /> {t}</button>)}</div>
            <div className="row" style={{ gap: 8 }}>
              <input className="field" style={{ flex: 1, minWidth: 0 }} maxLength={24} placeholder="Your own tag" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTag(tagText); }} />
              <button className="btn ghost" disabled={!tagText.trim()} onClick={() => addTag(tagText)}>Add</button>
            </div>
          </>
        )}
      </section>
      <section className="card stack">
        <h3 className="h3">Notes</h3>
        <textarea className="field" rows={3} maxLength={4000} placeholder={`Injuries, life stuff, what motivates ${name}…`} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn act" style={{ alignSelf: "flex-end" }} disabled={!draft.trim()} onClick={() => void act(async () => { await api.add(clientId, draft); setDraft(""); }, "Note saved")}>Save note</button>
      </section>
      {notes.length > 0 && (
        <div className="card flat list">
          {sortNotes(notes).map((n) => (
            <div key={n.id} className={`note ${n.pinned ? "pinned" : ""}`}>
              <div className="grow stack" style={{ gap: 4 }}>
                <p>{n.body}</p>
                <span className="tiny">{n.pinned ? "Pinned · " : ""}{shortDate(n.createdAt)}</span>
              </div>
              <button className="iconbtn" aria-pressed={n.pinned} onClick={() => void act(() => api.pin(n.id, !n.pinned))}>{n.pinned ? "Unpin" : "Pin"}</button>
              <button className="iconbtn" aria-label="Delete note" onClick={() => void act(() => api.remove(n.id), "Note deleted")}><Icons.trash width={14} height={14} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
