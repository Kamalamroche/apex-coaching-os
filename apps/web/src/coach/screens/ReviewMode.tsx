import { DEMO_CLIENT_ID, HEALTH_BANDS, awaitingReview, draftReviewReply, firstName, newestFirst, reviewMinutes, reviewQueue, type Health, type ReviewEntry, type ReviewInput } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { BackLink, Bar, Label } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { useFormChecks } from "../../data/FormCheckContext";
import { demoRosterHealth, useRosterHealth } from "../../data/health";
import { loadReviewCounts } from "../../data/review";
import { useStore } from "../../data/StoreContext";
import type { CoachLiveProps } from "../CoachApp";
import { useSendToClient } from "../sendToClient";
import { CheckInCard } from "./CheckIns";
import { ClientFormChecks } from "./FormChecks";
import { TwinCard } from "./Twin";

/**
 * Weekly review: every client who needs the coach, one at a time, with their week, their check-in,
 * their form videos and a drafted reply in one place. The coach edits and sends; nothing goes out on its own.
 */
export function ReviewMode({ live, say, onBack, openTwin }: { live?: CoachLiveProps; say: (m: string) => void; onBack: () => void; /** APEX Twin's weekly messages: the second half of the weekly round. */ openTwin?: () => void }) {
  const queue = useReviewQueue(live);
  const [at, setAt] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  if (!queue) return <><BackLink onClick={onBack}>Brief</BackLink><div className="card small">Working out who needs you…</div></>;
  const entry = at !== null ? queue.entries[at] : undefined;
  const finish = (id: string) => setDone((d) => new Set(d).add(id));
  const next = () => setAt((i) => (i === null ? 0 : i + 1));
  // One weekly round: the clients who need you first, then APEX Twin's drafted messages for everyone else.
  const twin = openTwin ? <section className="stack" style={{ gap: 6 }}><h2 className="h3">Then, everyone else</h2><TwinCard onOpen={openTwin} /></section> : null;

  if (at !== null && !entry) {
    return (
      <div className="full stack rv" style={{ gap: 16 }}>
        <BackLink onClick={onBack}>Brief</BackLink>
        <div className="card rv-done">
          <div className="eyebrow">Weekly review</div>
          <h1 className="h1">All clear</h1>
          <p className="small">You went through {queue.entries.length} client{queue.entries.length === 1 ? "" : "s"} and replied to {done.size}. Everyone else is on track.</p>
          {!twin && <button className="btn act block" onClick={onBack}>Back to the Brief</button>}
        </div>
        {twin}
      </div>
    );
  }

  if (at === null || !entry) {
    return (
      <div className="full stack rv" style={{ gap: 16 }}>
        <BackLink onClick={onBack}>Brief</BackLink>
        <div><div className="eyebrow">Weekly review</div><h1 className="h1">{queue.entries.length ? `${queue.entries.length} client${queue.entries.length === 1 ? "" : "s"} · about ${reviewMinutes(queue.entries)} min` : "Nobody needs you"}</h1></div>
        <p className="small">One client at a time: their week, their check-in, any form videos and a drafted reply. You edit and send, then go to the next. Clients on track with nothing waiting are left out.</p>
        {queue.entries.length > 0 && (
          <div className="card flat list">
            {queue.entries.map((e, i) => (
              <button key={e.id} className="li" onClick={() => setAt(i)}>
                <span className="rv-n num">{i + 1}</span>
                <div className="grow"><div className="h3">{e.name}</div><div className="rv-why">{e.why.map((w) => <span key={w} className={`chip ${w === "Needs you" || w === "Slipping" ? "warn" : ""}`}>{w}</span>)}</div></div>
                <span className="tiny num">~{e.minutes} min</span>
              </button>
            ))}
          </div>
        )}
        {queue.entries.length > 0 ? <button className="btn act block" onClick={() => setAt(0)}>Start the review</button> : <button className="btn ghost block" onClick={onBack}>Back to the Brief</button>}
        <p className="tiny">Order: clients who need you most first, then check-ins and form videos waiting. Times are a rough guide.</p>
        {twin}
      </div>
    );
  }

  return (
    <div className="full stack rv" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <BackLink onClick={() => setAt(null)}>All {queue.entries.length}</BackLink>
        <span className="tiny num">{at + 1} of {queue.entries.length}</span>
      </div>
      <Bar pct={((at + 1) / queue.entries.length) * 100} color="var(--act)" />
      <ReviewStep key={entry.id} entry={entry} health={queue.health[entry.id] ?? null} live={live} say={say} onSent={() => finish(entry.id)} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={next}>Skip for now</button>
        <button className="btn act grow" onClick={next}>{at + 1 < queue.entries.length ? `Next: ${firstName(queue.entries[at + 1]!.name)}` : "Finish"}</button>
      </div>
    </div>
  );
}

/** One client's review. Live: points the shared store at this client so their check-ins and videos load. */
function ReviewStep({ entry, health, live, say, onSent }: { entry: ReviewEntry; health: Health | null; live?: CoachLiveProps; say: (m: string) => void; onSent: () => void }) {
  const { coachName } = useAppInfo();
  const store = useStore();
  const { progress } = useApexState(store);
  const { status } = useStoreStatus();
  const checks = useFormChecks();
  const send = useSendToClient(live);
  const first = firstName(entry.name);
  // In the demo only Priya has a real store; the other sample clients get the summary and a message.
  const hasStore = live ? live.activeClientId === entry.id : entry.id === String(DEMO_CLIENT_ID);
  useEffect(() => { if (live && live.activeClientId !== entry.id) live.setActiveClientId(entry.id); }, [live, entry.id]);
  const loaded = hasStore && (status === "ready" || status === "no-program");
  const checkIns = loaded ? newestFirst(progress.checkIns) : [];
  const waiting = checkIns.find((c) => !c.reviewedAt) ?? null;
  const previous = waiting ? checkIns[checkIns.indexOf(waiting) + 1] ?? null : null;
  const videos = loaded ? awaitingReview(checks.checks).length : 0;
  const draft = useMemo(() => draftReviewReply({ name: entry.name, coach: coachName, health, checkIn: waiting, previous, reasons: entry.reasons }), [entry, coachName, health, waiting, previous]);
  const [text, setText] = useState(draft);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (!sent) setText(draft); }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="row">
        <div className="grow"><h1 className="h1" style={{ fontSize: 24 }}>{entry.name}</h1><div className="rv-why">{entry.why.map((w) => <span key={w} className={`chip ${w === "Needs you" || w === "Slipping" ? "warn" : ""}`}>{w}</span>)}</div></div>
        {health?.score != null && <div className="rv-score"><b className="num">{health.score}</b><span className="tiny">{HEALTH_BANDS[health.band]}</span></div>}
      </div>

      {health && (
        <section className="card">
          <div className="sect"><h2 className="h3">{first}'s week</h2><Label kind="data">Data</Label></div>
          <div className="rv-parts">
            {health.parts.map((p) => (
              <div key={p.key} className="rv-part">
                <div className="row" style={{ justifyContent: "space-between" }}><span className="small"><b>{p.label}</b></span><span className="tiny num">{Math.round(p.score * 100)}%</span></div>
                <Bar pct={p.score * 100} color={p.score >= 0.8 ? "var(--good)" : p.score >= 0.5 ? "var(--warn)" : "var(--crit)"} />
                <span className="tiny">{p.note}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasStore && !loaded && <div className="card small">Loading {first}'s check-ins and videos…</div>}

      {waiting && (
        <section className="stack" style={{ gap: 10 }}>
          <div className="sect"><h2 className="h3">Check-in</h2><span className="tiny">Reply and it's marked reviewed</span></div>
          <CheckInCard checkIn={waiting} previous={previous ?? undefined} photos={progress.photos.filter((p) => p.checkInId === waiting.id)} first={first} say={say} startOpen draft={draft} onSent={() => { setSent(true); onSent(); }} />
        </section>
      )}

      {videos > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <div className="sect"><h2 className="h3">Form video{videos === 1 ? "" : "s"}</h2><span className="tiny">{videos} waiting</span></div>
          <ClientFormChecks clientName={entry.name} say={say} />
        </section>
      )}

      {!waiting && (
        <section className="card stack" style={{ gap: 10 }}>
          <div className="sect"><h2 className="h3">Message {first}</h2><Label kind="ai">AI suggestion</Label></div>
          <span className="tiny">Drafted from {first}'s week. Edit it, then send. Nothing goes out until you press Send.</span>
          <textarea className="field" rows={7} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Message to ${first}`} disabled={sent} />
          <button className="btn act block" disabled={sent || !text.trim()} onClick={() => {
            send(entry.id, text.trim()).then(() => { setSent(true); onSent(); say(`Sent to ${first}`); }, (e: unknown) => say(e instanceof Error ? e.message : "Couldn't send"));
          }}>{sent ? `Sent to ${first}` : `Send to ${first}`}</button>
          {!live && entry.id !== String(DEMO_CLIENT_ID) && <span className="tiny">Sample client: in the demo only Priya's chat is real.</span>}
        </section>
      )}
    </>
  );
}

/** Who is in this week's review, with their health. Null while loading. */
function useReviewQueue(live?: CoachLiveProps): { entries: ReviewEntry[]; health: Record<string, Health> } | null {
  const store = useStore();
  const { progress } = useApexState(store);
  const checks = useFormChecks();
  const liveRows = useRosterHealth(live?.db, live?.coachId, live?.clients);
  const [counts, setCounts] = useState<Record<string, { checkIns: number; videos: number }> | null>(null);
  const ids = (live?.clients ?? []).map((c) => c.id).join(",");
  useEffect(() => {
    if (!live) return;
    let on = true;
    loadReviewCounts(live.db, ids ? ids.split(",") : []).then((c) => { if (on) setCounts(c); }, () => { if (on) setCounts({}); });
    return () => { on = false; };
  }, [live?.db, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fixed when the review opens, so finishing a client doesn't reshuffle the list under the coach.
  const [frozen, setFrozen] = useState<{ entries: ReviewEntry[]; health: Record<string, Health> } | null>(null);
  const demoRows = useMemo(() => (live ? null : demoRosterHealth()), [live]);
  useEffect(() => {
    if (frozen) return;
    let inputs: ReviewInput[] | null = null;
    if (live) {
      if (!liveRows || !counts) return;
      inputs = liveRows.map((r) => ({ id: r.client.id, name: r.client.name, health: r.health, trend: r.trend, checkInsWaiting: counts[r.client.id]?.checkIns ?? 0, videosWaiting: counts[r.client.id]?.videos ?? 0 }));
    } else if (demoRows) {
      const mine = String(DEMO_CLIENT_ID);
      inputs = demoRows.map((r) => ({
        id: r.client.id, name: r.client.name, health: r.health, trend: r.trend,
        checkInsWaiting: r.client.id === mine ? progress.checkIns.filter((c) => !c.reviewedAt).length : 0,
        videosWaiting: r.client.id === mine ? awaitingReview(checks.checks).length : 0,
      }));
    }
    if (!inputs) return;
    const health = Object.fromEntries(inputs.flatMap((i) => (i.health ? [[i.id, i.health] as const] : [])));
    setFrozen({ entries: reviewQueue(inputs), health });
  }, [live, liveRows, counts, demoRows, progress.checkIns, checks.checks, frozen]);
  return frozen;
}
