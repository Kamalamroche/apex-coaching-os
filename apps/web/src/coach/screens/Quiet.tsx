import { CLIENTS, DEMO_CLIENT_ID, firstName, goingQuiet, quietNudge, type QuietClient } from "@apex/core";
import { Avatar, Label } from "@apex/ui";
import { useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Demo: "4 days ago" in the sample clients becomes a date. */
function demoClients(now: Date) {
  return CLIENTS.map((c) => {
    const m = /(\d+) days? ago/.exec(c.lastSeen);
    const days = m ? Number(m[1]) : c.lastSeen === "Yesterday" ? 1 : 0;
    return { id: String(c.id), name: c.name, startedAt: "2026-08-01T09:00:00Z", lastSession: new Date(now.getTime() - days * 864e5).toISOString() };
  });
}

/** Brief: clients with no session for a few days, each with a ready-to-edit message. Shows nothing when everyone is training. */
export function GoingQuiet({ live, say }: { live?: CoachLiveProps; say: (m: string) => void }) {
  const store = useStore();
  const now = useMemo(() => new Date(), []);
  const list = useMemo(() => goingQuiet(live ? (live.clients ?? []) : demoClients(now), now), [live, now]);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const shown = list.filter((c) => !sent[c.id]);
  if (!shown.length) return null;
  return (
    <section aria-label="Going quiet">
      <div className="sect"><h2 className="h2">Going quiet</h2><Label kind="insight">Insight</Label></div>
      <div className="card flat list">
        {shown.slice(0, 6).map((c) => (
          <QuietRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onSent={() => setSent((s) => ({ ...s, [c.id]: true }))}
            send={async (body) => {
              if (live) {
                const { error } = await live.db.from("messages").insert({ coach_id: live.coachId, client_id: c.id, sender_id: live.coachId, body });
                if (error) throw new Error(error.message);
              } else if (c.id === String(DEMO_CLIENT_ID)) store.sendMessage("coach", body);
              say(`Sent to ${firstName(c.name)}`);
            }} />
        ))}
      </div>
      <div className="tiny" style={{ marginTop: 6 }}>No session for 4 days or more. New clients get a week to start.</div>
    </section>
  );
}

function QuietRow({ c, open, onToggle, onSent, send }: { c: QuietClient; open: boolean; onToggle: () => void; onSent: () => void; send: (body: string) => Promise<void> }) {
  const [body, setBody] = useState(() => quietNudge(firstName(c.name), c.days, c.never));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await send(body.trim());
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: 0 }}>
      <div className="li">
        <Avatar initials={initials(c.name)} size={32} tone={c.days >= 10 ? "var(--crit)" : "var(--warn)"} />
        <div className="grow"><div className="h3">{c.name}</div><div className="tiny">{c.never ? `Joined ${c.days} days ago, no session yet` : `No session for ${c.days} days`}</div></div>
        <button className="btn sm ghost" aria-expanded={open} onClick={onToggle}>{open ? "Close" : "Nudge"}</button>
      </div>
      {open && (
        <div className="stack" style={{ padding: "0 14px 14px", gap: 8 }}>
          <div className="row" style={{ gap: 8 }}><Label kind="ai">AI suggestion</Label><span className="tiny">A rule-based draft. Edit it, then send.</span></div>
          <textarea className="field" rows={3} maxLength={4000} aria-label={`Message to ${firstName(c.name)}`} value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
          <button className="btn act sm" disabled={busy || !body.trim()} onClick={() => void go()}>{busy ? "Sending…" : `Send to ${firstName(c.name)}`}</button>
        </div>
      )}
    </div>
  );
}
