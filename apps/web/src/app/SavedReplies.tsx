import { fillReply, REPLY_BODY_MAX, REPLY_IDEAS, REPLY_TITLE_MAX, searchReplies, type SavedReply } from "@apex/core";
import { Icons, Label, Sheet } from "@apex/ui";
import { useEffect, useState } from "react";
import type { RepliesApi } from "../data/savedReplies";

/** The coach's saved replies: tap one to drop it in the message box with the client's name filled in, or add and edit them. */
export function SavedReplies({ api, firstName, onPick, onClose, say }: { api: RepliesApi; firstName: string; onPick: (text: string) => void; onClose: () => void; say: (m: string) => void }) {
  const [list, setList] = useState<SavedReply[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<SavedReply | Omit<SavedReply, "id"> | null>(null);
  const reload = () => api.list().then(setList, (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load saved replies"));
  useEffect(() => { void reload(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!edit) return;
    try {
      if ("id" in edit) await api.update(edit);
      else await api.add(edit);
      setEdit(null);
      await reload();
      say("Reply saved");
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't save the reply");
    }
  };
  const remove = async (r: SavedReply) => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try { await api.remove(r.id); await reload(); } catch (e) { say(e instanceof Error ? e.message : "Couldn't delete the reply"); }
  };
  const addStarters = async () => {
    try {
      for (const r of REPLY_IDEAS) await api.add(r);
      await reload();
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't add the starters");
    }
  };

  if (edit) {
    return (
      <Sheet label={"id" in edit ? "Edit saved reply" : "New saved reply"} onClose={() => setEdit(null)}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="sect" style={{ margin: 0 }}><h2 className="h2">{"id" in edit ? "Edit reply" : "New reply"}</h2><Label kind="dec">Coach decision</Label></div>
          <input className="field" placeholder="Short name, e.g. Great session" maxLength={REPLY_TITLE_MAX} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="Reply name" />
          <textarea className="field" rows={5} placeholder="Write it once, use it any time. {name} becomes the client's first name." maxLength={REPLY_BODY_MAX} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label="Reply text" />
          <div className="tiny">Type <b>{"{name}"}</b> where the client's first name should go.</div>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn act" style={{ flex: 1 }} onClick={() => void save()}>Save</button>
          </div>
        </div>
      </Sheet>
    );
  }

  const shown = list ? searchReplies(list, q) : [];
  return (
    <Sheet label="Saved replies" onClose={onClose}>
      <div className="stack" style={{ gap: 10 }}>
        <div className="sect" style={{ margin: 0 }}><h2 className="h2">Saved replies</h2><button className="iconbtn" onClick={onClose}>Close</button></div>
        {error && <div className="card small">{error}</div>}
        {list && list.length > 4 && <input className="field" placeholder="Search replies" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search saved replies" />}
        {list && list.length === 0 && (
          <div className="card small">
            No saved replies yet. Save the messages you send again and again, then send them in two taps.
            <div style={{ marginTop: 10 }}><button className="btn ghost" onClick={() => void addStarters()}>Add {REPLY_IDEAS.length} starter replies</button></div>
          </div>
        )}
        {list && list.length > 0 && (
          <ul className="sr-list">
            {shown.map((r) => (
              <li key={r.id} className="sr-item">
                <button className="sr-use" onClick={() => onPick(fillReply(r.body, firstName))}><b>{r.title}</b><span>{fillReply(r.body, firstName)}</span></button>
                <div className="sr-tools">
                  <button className="iconbtn" aria-label={`Edit ${r.title}`} onClick={() => setEdit(r)}><Icons.edit width={15} height={15} /></button>
                  <button className="iconbtn" aria-label={`Delete ${r.title}`} onClick={() => void remove(r)}><Icons.trash width={15} height={15} /></button>
                </div>
              </li>
            ))}
            {shown.length === 0 && <li className="small">No replies match.</li>}
          </ul>
        )}
        {!error && <button className="btn act block" onClick={() => setEdit({ title: "", body: "" })}><Icons.plus width={16} height={16} /> New saved reply</button>}
      </div>
    </Sheet>
  );
}
