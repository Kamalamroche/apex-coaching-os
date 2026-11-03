import { firstName, shortDate } from "@apex/core";
import { useState } from "react";
import { FormVideo } from "../../app/FormVideo";
import { useFormCheckStore, useFormChecks } from "../../data/FormCheckContext";

/** Coach: the client's technique videos, newest first, with a reply box on each one still waiting. */
export function ClientFormChecks({ clientName, say }: { clientName: string; say: (m: string) => void }) {
  const store = useFormCheckStore();
  const { checks, status, error } = useFormChecks();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const name = firstName(clientName) || "Your client";
  if (status === "loading") return <div className="card small">Loading…</div>;
  if (status === "needs-update") return <div className="card small">This needs a quick database update first. Run the form checks SQL in Supabase, then reload.</div>;
  if (status === "error") return <div className="card small">Couldn't load videos: {error}</div>;
  if (!checks.length) return <div className="card small">No videos yet. {name} can film a set from any exercise in their workout with "Film my form".</div>;

  const send = async (id: string) => {
    setBusy(id);
    try {
      await store.reply(id, drafts[id] ?? "");
      say(`Reply sent · ${name} sees it now`);
      setDrafts((d) => ({ ...d, [id]: "" }));
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't send the reply");
    }
    setBusy(null);
  };
  return (
    <>
      {checks.map((c) => (
        <section key={c.id} className="card stack" style={{ gap: 10, ...(c.reviewedAt ? {} : { borderColor: "color-mix(in srgb,var(--blue) 45%,var(--line))" }) }}>
          <div className="sect" style={{ marginBottom: 0 }}><h3 className="h3">{c.exercise}</h3><span className="tiny">{c.reviewedAt ? "" : "New · "}{shortDate(c.createdAt)}</span></div>
          <FormVideo check={c} />
          {c.note && <div className="small" style={{ color: "var(--text)" }}>{name}: “{c.note}”</div>}
          {c.reviewedAt ? (
            c.coachReply && <div className="fc-reply"><div className="tiny">Your reply</div><div className="small" style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{c.coachReply}</div></div>
          ) : (
            <>
              <textarea id={`fc-reply-${c.id}`} className="field" rows={3} maxLength={4000} placeholder="What's good, the one thing to fix, and a cue to try next set" value={drafts[c.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} />
              <button className="btn act block" disabled={!(drafts[c.id] ?? "").trim() || busy === c.id} onClick={() => void send(c.id)}>{busy === c.id ? "Sending…" : `Send to ${name}`}</button>
            </>
          )}
        </section>
      ))}
    </>
  );
}
