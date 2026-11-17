import type { GymMember } from "@apex/core";
import { Icons, TeamBubble } from "@apex/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_MESSAGE_MAX, useGymApi, type TeamMessage } from "../../data/gym";

/** The gym's team inbox: one shared chat for every trainer, for cover, handovers and notices. Clients never see it. */
export function TeamInbox({ gymId, members, say }: { gymId: string; members: GymMember[]; say: (m: string) => void }) {
  const api = useGymApi();
  const [list, setList] = useState<TeamMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const reload = useCallback(async () => {
    if (!api) return;
    try { setList(await api.chat.list(gymId)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [api, gymId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => (api ? api.chat.watch(gymId, () => void reload()) : undefined), [api, gymId, reload]);
  useEffect(() => { const f = feed.current; if (f) f.scrollTop = f.scrollHeight; }, [list?.length]);
  if (!api) return null;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "A trainer who left";
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await api.chat.send(gymId, text); setText(""); await reload(); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const remove = async (m: TeamMessage) => {
    if (!confirm("Delete this message for everyone?")) return;
    try { await api.chat.remove(m.id); await reload(); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Team inbox</h2><span className="tiny">Trainers only</span></div>
      <div className="card stack" style={{ gap: 10 }}>
        {error && <div className="small">{error}</div>}
        {!list && !error && <div className="small">Loading…</div>}
        {list && list.length === 0 && <div className="small">No messages yet. Use this for cover, handovers and notices for the whole team.</div>}
        {list && list.length > 0 && (
          <div className="xt-feed" ref={feed}>
            {list.map((m) => (
              <TeamBubble key={m.id} who={name(m.senderId)} body={m.body} at={m.at} mine={m.senderId === api.me}
                tools={m.senderId === api.me ? <button className="iconbtn" style={{ color: "inherit", marginLeft: 6, padding: 0, minHeight: 0 }} aria-label="Delete message" onClick={() => void remove(m)}><Icons.trash width={12} height={12} /></button> : null} />
            ))}
          </div>
        )}
        {!error && (
          <div className="row">
            <input className="field" aria-label="Message the team" placeholder="Message the team" maxLength={TEAM_MESSAGE_MAX} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
            <button className="btn act" disabled={!text.trim() || busy} onClick={() => void send()} aria-label="Send to the team"><Icons.send width={16} height={16} /></button>
          </div>
        )}
      </div>
    </>
  );
}
