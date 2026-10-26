import { exerciseFor, formatRest } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, BackLink } from "@apex/ui";
import { useState } from "react";
import { useStoreStatus } from "../../app/AppContext";
import { createInviteLink } from "../../data/coach";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";
import { ClientCheckIns } from "./CheckIns";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const ago = (iso: string | null) => {
  if (!iso) return "No sessions yet";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return days <= 0 ? "Trained today" : days === 1 ? "Trained yesterday" : `Trained ${days} days ago`;
};

/** The coach's real clients, invite links, and the selected client's program. */
export function LiveClients({ live, say, goBuild }: { live: CoachLiveProps; say: (m: string) => void; goBuild: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const clients = live.clients;

  const invite = async () => {
    try {
      const url = await createInviteLink(live.db, live.coachId);
      setLink(url);
      try { await navigator.clipboard.writeText(url); say("Invite link copied"); } catch { say("Invite link ready"); }
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn't create an invite");
    }
  };

  const selected = clients?.find((c) => c.id === open);
  if (selected) {
    return <LiveProfile name={selected.name} mode={selected.mode} lastSession={selected.lastSession} onBack={() => setOpen(null)} goBuild={goBuild} say={say} />;
  }

  const list = (clients ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div><div className="eyebrow">Clients</div><h1 className="h1">{clients ? `${clients.length} active` : "Loading…"}</h1></div>
      {clients && clients.length > 0 && <input id="clientsearch" className="field" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="card flat list">
        {clients?.length === 0 && <div className="li"><div className="small">No clients yet. Create an invite link and send it to your first client.</div></div>}
        {list.map((c) => (
          <button key={c.id} className="li" onClick={() => { live.setActiveClientId(c.id); setOpen(c.id); }}>
            <Avatar initials={initials(c.name)} tone={c.id === live.activeClientId ? "var(--act)" : undefined} />
            <div className="grow"><div className="h3">{c.name}</div><div className="small">{c.mode} · {ago(c.lastSession)}</div></div>
            <span className="tiny">›</span>
          </button>
        ))}
      </div>
      <button className="btn act block" onClick={() => void invite()}>+ Invite a client</button>
      {link && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="h3">Send this link to your client</div>
          <input className="field num" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <div className="tiny">It works once. They sign in with their email and land straight in their app, linked to you.</div>
          <button className="link" style={{ alignSelf: "flex-start" }} onClick={live.refreshClients}>They've joined? Refresh the list</button>
        </div>
      )}
    </>
  );
}

function LiveProfile({ name, mode, lastSession, onBack, goBuild, say }: { name: string; mode: string; lastSession: string | null; onBack: () => void; goBuild: () => void; say: (m: string) => void }) {
  const store = useStore();
  const { workout, progress } = useApexState(store);
  const { status } = useStoreStatus();
  const [tab, setTab] = useState<"Program" | "Check-ins">("Program");
  const unreviewed = progress.checkIns.filter((c) => !c.reviewedAt).length;
  return (
    <>
      <BackLink onClick={onBack}>All clients</BackLink>
      <div className="row">
        <Avatar initials={initials(name)} size={56} tone="var(--act)" />
        <div className="grow"><h1 className="h1" style={{ fontSize: 22 }}>{name}</h1><div className="small">{mode} · {ago(lastSession).toLowerCase()}</div></div>
      </div>
      <div className="chips">
        {(["Program", "Check-ins"] as const).map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}{t === "Check-ins" && unreviewed ? ` · ${unreviewed} new` : ""}</button>)}
      </div>
      {tab === "Check-ins" && <ClientCheckIns clientName={name} say={say} />}
      {tab === "Program" && <>
      <section>
        <div className="sect"><h2 className="h2">Program</h2></div>
        {status === "ready" ? (
          <div className="card flat list">
            {workout.items.map((it) => (
              <div key={it.key} className="ex">
                <span className="grp">{it.group}</span>
                <div className="grow"><div className="h3">{exerciseFor(it).name}</div><div className="small num">{it.sets}×{it.reps}{it.kg ? ` · ${it.kg} kg` : ""} · RPE {it.rpe}</div></div>
                <span className="tiny num">{it.restSeconds ? formatRest(it.restSeconds) : "→"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card small">{status === "loading" ? "Loading…" : status === "no-program" ? "No program yet." : "Couldn't load the program."}</div>
        )}
      </section>
      <button className="btn act block" onClick={() => { if (status === "no-program") void (store as { createProgram?: () => Promise<void> }).createProgram?.(); goBuild(); }}>{status === "no-program" ? "Create program" : "Edit program"}</button>
      </>}
    </>
  );
}
