import { DEMO_BOOKING_CLIENT, DEMO_CLIENT_ID, firstName, sessionPrep } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, Label, Sheet } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useStoreStatus } from "../../app/AppContext";
import { useNotesApi } from "../../data/clientNotes";
import { demoRosterHealth, useRosterHealth } from "../../data/health";
import { useLifestyle } from "../../data/LifestyleContext";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Before-session card: one page for the 30 seconds before a client walks in. Watch-outs first
 * (health answers, injuries, pinned notes, low readiness), then last time, today's plan and their goal.
 */
export function SessionPrep({ clientId, name, startsAt, live, onClose, onOpenClient }: { clientId: string; name: string; startsAt: string; live?: CoachLiveProps; onClose: () => void; onOpenClient?: () => void }) {
  const store = useStore();
  const { workout, history } = useApexState(store);
  const { status } = useStoreStatus();
  const life = useLifestyle();
  const notes = useNotesApi();
  const [pinned, setPinned] = useState<string[]>([]);
  // Live: point the shared store at this client so their plan and intake load. Demo: only Priya has real data.
  const noteId = live ? clientId : clientId === DEMO_BOOKING_CLIENT ? String(DEMO_CLIENT_ID) : clientId;
  const hasStore = live ? live.activeClientId === clientId : clientId === DEMO_BOOKING_CLIENT || clientId === String(DEMO_CLIENT_ID);
  useEffect(() => { if (live && live.activeClientId !== clientId) live.setActiveClientId(clientId); }, [live, clientId]);
  useEffect(() => {
    let on = true;
    notes?.notes(noteId).then((list) => { if (on) setPinned(list.filter((n) => n.pinned).map((n) => n.body)); }, () => undefined);
    return () => { on = false; };
  }, [notes, noteId]);
  const liveRows = useRosterHealth(live?.db, live?.coachId, live?.clients);
  const rows = useMemo(() => (live ? liveRows : demoRosterHealth()), [live, liveRows]);
  const health = rows?.find((r) => r.client.id === noteId)?.health ?? null;
  const loaded = hasStore && (status === "ready" || status === "no-program");
  const prep = sessionPrep({
    name,
    workout: loaded ? workout : null,
    previous: loaded ? history.previous : null,
    intake: hasStore && life.intake ? life.intake.answers : null,
    pinned,
    healthReasons: health && health.band !== "good" && health.band !== "new" ? health.reasons : [],
    readiness: loaded ? history.readiness?.at(-1)?.score ?? null : null,
  });
  const first = firstName(name);
  return (
    <Sheet onClose={onClose} label={`Before your session with ${first}`}>
      <div><div className="eyebrow">Before your session · {time(startsAt)}</div><h2 className="h2">{name}</h2></div>
      {hasStore && !loaded && <div className="small">Loading {first}'s plan…</div>}
      <section className="prep-block prep-watch">
        <div className="sect"><h3 className="h3"><Icons.info width={16} height={16} aria-hidden="true" /> Watch out for</h3><Label kind="data">Data</Label></div>
        {prep.watch.length ? <ul>{prep.watch.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="small">Nothing flagged. No health answers, injuries or pinned notes.</p>}
      </section>
      {prep.lastTime && <section className="prep-block"><h3 className="h3">Last time</h3><p className="small">{prep.lastTime}</p></section>}
      <section className="prep-block">
        <h3 className="h3">Today's plan</h3>
        {prep.plan ? <><p className="small"><b>{prep.plan.title}</b></p><ul className="prep-plan">{prep.plan.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></> : <p className="small">{hasStore ? `${first} has no session planned yet.` : "Sample client: in the demo only Priya's plan is real."}</p>}
      </section>
      {prep.goal && <section className="prep-block"><h3 className="h3">Their goal</h3><p className="small">“{prep.goal}”</p></section>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={onClose}>Close</button>
        {onOpenClient && <button className="btn act grow" onClick={onOpenClient}>Open {first}</button>}
      </div>
    </Sheet>
  );
}
