import { exerciseFor, formatRest } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, BackLink, useUnits } from "@apex/ui";
import { useState } from "react";
import { useStoreStatus } from "../../app/AppContext";
import { createInviteLink } from "../../data/coach";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";
import { ClientCheckIns } from "./CheckIns";
import { CoachHabits, CoachNutritionPanel, IntakeView } from "./Lifestyle";
import { ClientFormChecks } from "./FormChecks";
import { ClientGoals } from "./Goals";
import { ClientNotes, TagFilter, TagList, useClientTags } from "./ClientNotes";
import { hasTag } from "@apex/core";
import { useFormChecks } from "../../data/FormCheckContext";
import { awaitingReview } from "@apex/core";
import { useLifestyle } from "../../data/LifestyleContext";
import { Transfer } from "./Transfer";

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
  const [transfer, setTransfer] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const { tags, reload: reloadTags } = useClientTags();
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

  if (transfer) return <Transfer live={live} say={say} onBack={() => setTransfer(false)} />;
  const selected = clients?.find((c) => c.id === open);
  if (selected) {
    return <LiveProfile clientId={selected.id} name={selected.name} mode={selected.mode} lastSession={selected.lastSession} onBack={() => { setOpen(null); void reloadTags(); }} goBuild={goBuild} say={say} />;
  }

  const list = (clients ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) && (!tag || hasTag(tags[c.id], tag)));
  return (
    <>
      <div><div className="eyebrow">Clients</div><h1 className="h1">{clients ? `${clients.length} active` : "Loading…"}</h1></div>
      {clients && clients.length > 0 && <input id="clientsearch" className="field" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />}
      <TagFilter tags={tags} value={tag} onChange={setTag} />
      <div className="card flat list">
        {clients?.length === 0 && <div className="li"><div className="small">No clients yet. Create an invite link and send it to your first client, or import the clients you already coach.</div></div>}
        {list.map((c) => (
          <button key={c.id} className="li" onClick={() => { live.setActiveClientId(c.id); setOpen(c.id); }}>
            <Avatar initials={initials(c.name)} tone={c.id === live.activeClientId ? "var(--act)" : undefined} />
            <div className="grow"><div className="h3">{c.name}</div><div className="small">{c.mode} · {ago(c.lastSession)}</div><TagList tags={tags[c.id]} /></div>
            <span className="tiny">›</span>
          </button>
        ))}
      </div>
      <button className="btn act block" onClick={() => void invite()}>+ Invite a client</button>
      <button className="btn ghost block" onClick={() => setTransfer(true)}>Import or export clients</button>
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

function LiveProfile({ clientId, name, mode, lastSession, onBack, goBuild, say }: { clientId: string; name: string; mode: string; lastSession: string | null; onBack: () => void; goBuild: () => void; say: (m: string) => void }) {
  const u = useUnits();
  const store = useStore();
  const { workout, progress } = useApexState(store);
  const { status } = useStoreStatus();
  const [tab, setTab] = useState<"Program" | "Check-ins" | "Form checks" | "Goals" | "Habits" | "Nutrition" | "About" | "Notes">("Program");
  const unreviewed = progress.checkIns.filter((c) => !c.reviewedAt).length;
  const life = useLifestyle();
  const newVideos = awaitingReview(useFormChecks().checks).length;
  const flags = life.intake ? Object.values(life.intake.answers.health).filter(Boolean).length : 0;
  return (
    <>
      <BackLink onClick={onBack}>All clients</BackLink>
      <div className="row">
        <Avatar initials={initials(name)} size={56} tone="var(--act)" />
        <div className="grow"><h1 className="h1" style={{ fontSize: 22 }}>{name}</h1><div className="small">{mode} · {ago(lastSession).toLowerCase()}</div></div>
      </div>
      <div className="chips" style={{ flexWrap: "wrap" }}>
        {(["Program", "Check-ins", "Form checks", "Goals", "Habits", "Nutrition", "About", "Notes"] as const).map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}{t === "Check-ins" && unreviewed ? ` · ${unreviewed} new` : ""}{t === "About" && flags ? ` · ${flags} health` : ""}{t === "Form checks" && newVideos ? ` · ${newVideos} new` : ""}</button>)}
      </div>
      {tab === "Check-ins" && <ClientCheckIns clientName={name} say={say} />}
      {tab === "Form checks" && <ClientFormChecks clientName={name} say={say} />}
      {tab === "Goals" && <ClientGoals clientName={name} say={say} />}
      {tab === "Habits" && <CoachHabits clientName={name} say={say} />}
      {tab === "Nutrition" && <CoachNutritionPanel clientName={name} say={say} />}
      {tab === "About" && <IntakeView clientName={name} />}
      {tab === "Notes" && <ClientNotes clientId={clientId} clientName={name} say={say} />}
      {tab === "Program" && <>
      <section>
        <div className="sect"><h2 className="h2">Program</h2></div>
        {status === "ready" ? (
          <div className="card flat list">
            {workout.items.map((it) => (
              <div key={it.key} className="ex">
                <span className="grp">{it.group}</span>
                <div className="grow"><div className="h3">{exerciseFor(it).name}</div><div className="small num">{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""} · RPE {it.rpe}</div></div>
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
