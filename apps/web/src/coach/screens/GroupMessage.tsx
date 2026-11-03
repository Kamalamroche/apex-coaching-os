import { CLIENTS, PLACEHOLDERS, fillMessage, firstName } from "@apex/core";
import { BackLink } from "@apex/ui";
import { useState } from "react";
import { useAppInfo } from "../../app/AppContext";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";

/** Coach: one message to every client, each in their own thread, with their first name filled in. */
export function GroupMessage({ live, onBack, say }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void }) {
  const { coachName } = useAppInfo();
  const store = useStore();
  const people = live ? (live.clients ?? []).map((c) => ({ id: c.id, name: c.name })) : CLIENTS.map((c) => ({ id: String(c.id), name: c.name }));
  const [body, setBody] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sample = firstName(people[0]?.name ?? "Priya") || "Priya";
  const ok = body.trim().length > 0 && body.length <= 4000 && people.length > 0;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      if (live) {
        const rows = people.map((p) => ({ coach_id: live.coachId, client_id: p.id, sender_id: live.coachId, body: fillMessage(body.trim(), { firstName: firstName(p.name), coach: coachName }) }));
        const { error: e } = await live.db.from("messages").insert(rows);
        if (e) throw new Error(e.message);
      } else {
        // Demo: only Priya's thread is real, so that's where it shows.
        store.sendMessage("coach", fillMessage(body.trim(), { firstName: "Priya", coach: coachName }));
      }
      say(`Sent to ${people.length} client${people.length === 1 ? "" : "s"}`);
      setBody("");
      setSure(false);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <div><div className="eyebrow">Group message</div><h1 className="h1">Message everyone</h1></div>
      <section className="card stack">
        <div className="small">Goes to each of your {people.length} client{people.length === 1 ? "" : "s"} in their own chat with you, so replies stay private.</div>
        <textarea className="field" rows={5} maxLength={4000} aria-label="Message" placeholder="e.g. Hi {first_name}, the gym is closed on Monday. Swap Monday's session for a 30-minute walk." value={body} onChange={(e) => { setBody(e.target.value); setSure(false); }} />
        <div className="chips" style={{ flexWrap: "wrap" }}>
          {PLACEHOLDERS.filter((p) => p.key !== "{days}").map((p) => <button key={p.key} type="button" className="chip" onClick={() => setBody((b) => `${b}${p.key}`)} title={p.meaning}>{p.key}</button>)}
        </div>
        {body.trim() && (
          <div>
            <div className="tiny" style={{ marginBottom: 6 }}>{sample} sees</div>
            <div className="gm-preview">{fillMessage(body.trim(), { firstName: sample, coach: coachName })}</div>
          </div>
        )}
        {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
        {!sure ? (
          <button className="btn act block" disabled={!ok} onClick={() => setSure(true)}>Send to {people.length} client{people.length === 1 ? "" : "s"}</button>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => setSure(false)} disabled={busy}>Not yet</button>
            <button className="btn act grow" onClick={() => void send()} disabled={busy}>{busy ? "Sending…" : `Yes, send to all ${people.length}`}</button>
          </div>
        )}
      </section>
    </>
  );
}
