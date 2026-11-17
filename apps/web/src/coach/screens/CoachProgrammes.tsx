import {
  PROGRAMME_COVERS, PROGRAMME_GOALS, PROGRAMME_LEVELS, cleanIncludes, formatPrice, listingFromTemplate, listingProblem, listingStats, parsePrice,
  priceInput, shopTotals, templateSummary, waitingList, weekOutline, type Enrolment, type ProgramTemplate, type ProgrammeListing,
} from "@apex/core";
import { BackLink, CoverPicker, Icons, IncludesList, ProgrammePoster, ShopHero, WeekOutline } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { ProgrammeStatus, posterOf, useProgrammes, useProgrammesApi } from "../../app/ProgrammeParts";
import { liveProgrammes } from "../../data/programmes";
import { demoTemplates, liveTemplates } from "../../data/templates";
import type { CoachLiveProps } from "../CoachApp";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Coach: on-demand programmes. Turn a saved template into a programme, price it, publish it, and unlock paid requests. */
export function CoachProgrammes({ live, onBack, say }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void }) {
  const liveApi = useMemo(() => (live ? liveProgrammes(live.db, { side: "coach", coachId: live.coachId, me: live.coachId }) : null), [live?.db, live?.coachId]);
  const api = useProgrammesApi("coach", liveApi);
  const data = useProgrammes(api);
  const [editing, setEditing] = useState<ProgrammeListing | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  if (picking) return <PickTemplate live={live} onBack={() => setPicking(false)} onPick={(t) => { setPicking(false); setEditing(listingFromTemplate(t)); }} />;
  if (editing) {
    return (
      <Editor
        initial={editing}
        isNew={!data.listings.some((l) => l.id === editing.id)}
        enrolments={data.enrolments.filter((e) => e.listingId === editing.id)}
        onBack={() => setEditing(null)}
        onSave={async (l) => { if (!api) return; await api.save(l); await data.reload(); say(l.status === "live" ? `${l.title} is live` : `${l.title} saved as a draft`); setEditing(null); }}
        onDelete={async (l) => { if (!api) return; await api.remove(l.id); await data.reload(); say(`${l.title} deleted`); setEditing(null); }}
      />
    );
  }

  const totals = shopTotals(data.listings, data.enrolments);
  const waiting = waitingList(data.enrolments);
  const title = (e: Enrolment) => data.listings.find((l) => l.id === e.listingId);
  return (
    <div className="full pg-page">
      <div><BackLink onClick={onBack}>Business</BackLink></div>
      <ShopHero live={totals.live} members={totals.members} revenuePence={totals.revenuePence} waiting={totals.waiting}>
        <button className="pg-cta" onClick={() => setPicking(true)}><Icons.plus width={16} height={16} /> New programme</button>
      </ShopHero>
      <ProgrammeStatus data={data} side="coach" />
      {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}

      {waiting.length > 0 && (
        <section className="pg-sect">
          <span className="pg-eyebrow">Waiting for you</span>
          {waiting.map((e, i) => {
            const l = title(e);
            if (!l) return null;
            return (
              <div key={e.id} className="pg-row req" style={{ ["--i" as string]: i }}>
                <div className="grow">
                  <b>{e.clientName ?? "A client"}</b>
                  <small>Asked for {l.title} · {formatPrice(l.pricePence)} · {shortDate(e.createdAt)}</small>
                </div>
                <div className="btns">
                  <button className="btn ghost sm" disabled={!!busy} onClick={() => void run(e.id, async () => { await api?.answer(e.id, { status: "declined" }); await data.reload(); })}>Decline</button>
                  <button className="btn ghost sm" disabled={!!busy} onClick={() => void run(e.id, async () => { await api?.answer(e.id, { status: "active", paidPence: 0, paidVia: "gift" }); await data.reload(); say(`${l.title} unlocked for ${e.clientName ?? "your client"}, free`); })}>Give free</button>
                  <button className="btn act sm" disabled={!!busy} onClick={() => void run(e.id, async () => { await api?.answer(e.id, { status: "active", paidPence: l.pricePence, paidVia: "manual" }); await data.reload(); say(`Paid · ${l.title} unlocked for ${e.clientName ?? "your client"}`); })}>Paid {formatPrice(l.pricePence)}</button>
                </div>
              </div>
            );
          })}
          <div className="pg-note"><Icons.info width={16} height={16} /><span>Mark it paid once the money has reached you (bank transfer or cash). When card payments are switched on, paid programmes unlock on their own.</span></div>
        </section>
      )}

      <section className="pg-sect">
        <span className="pg-eyebrow">Your programmes</span>
        {data.status === "ready" && data.listings.length === 0 && (
          <div className="card small">Nothing here yet. Tap New programme, pick one of your saved templates, give it a price and publish it. Every client who starts gets their own copy.</div>
        )}
        <div className="pg-grid">
          {data.listings.map((l, i) => {
            const s = listingStats(l.id, data.enrolments);
            return (
              <ProgrammePoster key={l.id} p={posterOf(l)} i={i} onOpen={() => setEditing(l)}
                badge={l.status === "live" ? <span className="gpill caps pg-live">Live</span> : <span className="gpill dim caps">Draft</span>}>
                <div className="gpills">
                  <span className="gpill"><Icons.clients /> {s.members} {s.members === 1 ? "member" : "members"}</span>
                  {s.revenuePence > 0 && <span className="gpill"><Icons.money /> {formatPrice(s.revenuePence)}</span>}
                  {s.waiting > 0 && <span className="gpill pg-wait"><Icons.bell /> {s.waiting} waiting</span>}
                </div>
              </ProgrammePoster>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PickTemplate({ live, onBack, onPick }: { live?: CoachLiveProps; onBack: () => void; onPick: (t: ProgramTemplate) => void }) {
  const lib = useMemo(() => (live ? liveTemplates(live.db) : demoTemplates()), [live?.db]);
  const [list, setList] = useState<ProgramTemplate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => void lib.list().then(setList).catch((e: Error) => setErr(e.message)), [lib]);
  return (
    <div className="full pg-page narrow">
      <div><BackLink onClick={onBack}>Programmes</BackLink></div>
      <div><div className="eyebrow">New programme</div><h1 className="h1">Start from a template</h1><p className="sub" style={{ margin: "4px 0 0" }}>Build the plan in Builder, save it as a template, then pick it here. The programme keeps its own copy, so later edits to the template don't change what people bought.</p></div>
      {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}
      {!list && !err && <div className="card small">Loading templates…</div>}
      <div className="card flat list">
        {list?.map((t) => (
          <button key={t.id} className="li" onClick={() => onPick(t)}>
            <span className="mi c2"><Icons.build /></span>
            <div className="grow"><div className="h3">{t.name}</div><div className="tiny num">{templateSummary(t)}</div></div>
            {t.starter && <span className="chip">APEX</span>}
            <Icons.forward width={18} height={18} style={{ color: "var(--text3)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Editor({ initial, isNew, enrolments, onBack, onSave, onDelete }: {
  initial: ProgrammeListing; isNew: boolean; enrolments: Enrolment[]; onBack: () => void;
  onSave: (l: ProgrammeListing) => Promise<void>; onDelete: (l: ProgrammeListing) => Promise<void>;
}) {
  const [l, setL] = useState(initial);
  const [price, setPrice] = useState(priceInput(initial.pricePence));
  const [includes, setIncludes] = useState(initial.includes.join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const pence = parsePrice(price);
  const draft: ProgrammeListing = { ...l, pricePence: pence ?? l.pricePence, includes: cleanIncludes(includes.split("\n")) };
  const set = <K extends keyof ProgrammeListing>(k: K, v: ProgrammeListing[K]) => setL((p) => ({ ...p, [k]: v }));
  const members = enrolments.filter((e) => e.status === "active");

  const save = async (status: ProgrammeListing["status"]) => {
    if (pence === null) { setErr("That price doesn't look right. Type an amount in pounds, like 29 or 29.50, or leave it empty for free."); return; }
    const next = { ...draft, status };
    const problem = listingProblem(next);
    if (problem) { setErr(problem); return; }
    setBusy(true);
    setErr(null);
    try { await onSave(next); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div className="full pg-page narrow">
      <div><BackLink onClick={onBack}>Programmes</BackLink></div>
      <ProgrammePoster p={posterOf(draft)} tall badge={l.status === "live" ? <span className="gpill caps pg-live">Live</span> : <span className="gpill dim caps">{isNew ? "New" : "Draft"}</span>} />

      <section className="pg-sect">
        <span className="pg-eyebrow">Cover</span>
        <CoverPicker value={l.cover} options={PROGRAMME_COVERS} onChange={(c) => set("cover", c)} />
      </section>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="pg-sect" style={{ gap: 6 }}><span className="h3">Title</span>
          <input className="field" value={l.title} maxLength={60} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Strong in 8" />
        </label>
        <label className="pg-sect" style={{ gap: 6 }}><span className="h3">One-liner</span>
          <input className="field" value={l.tagline} maxLength={90} onChange={(e) => set("tagline", e.target.value)} placeholder="Who it's for and what it does" />
        </label>
        <div className="pg-sect" style={{ gap: 6 }}><span className="h3">Price</span>
          <div className="pg-price-field"><span>£</span><input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Free" aria-label="Price in pounds" /></div>
          <span className="tiny">{pence === null ? "Type an amount like 29 or 29.50" : pence === 0 ? "Free: clients start it straight away" : `${formatPrice(pence)} one-off. Clients ask, you confirm payment, it unlocks`}</span>
        </div>
        <div className="pg-sect" style={{ gap: 6 }}><span className="h3">Level</span>
          <div className="pg-chips">{PROGRAMME_LEVELS.map((v) => <button key={v} type="button" className="pg-chip" aria-pressed={l.level === v} onClick={() => set("level", v)}>{v}</button>)}</div>
        </div>
        <div className="pg-sect" style={{ gap: 6 }}><span className="h3">Goal</span>
          <div className="pg-chips">{PROGRAMME_GOALS.map((v) => <button key={v} type="button" className="pg-chip" aria-pressed={l.goal === v} onClick={() => set("goal", v)}>{v}</button>)}</div>
        </div>
        <label className="pg-sect" style={{ gap: 6 }}><span className="h3">About it</span>
          <textarea className="field" rows={5} maxLength={2000} value={l.description} onChange={(e) => set("description", e.target.value)} placeholder="How it works, who it suits, what they'll get out of it" />
        </label>
        <label className="pg-sect" style={{ gap: 6 }}><span className="h3">What's included</span>
          <textarea className="field" rows={4} value={includes} onChange={(e) => setIncludes(e.target.value)} placeholder="One line each, up to 6" />
        </label>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={l.onPage} onChange={(e) => set("onPage", e.target.checked)} />
          <span className="small" style={{ color: "var(--text)" }}>Show it on my public Train with me page</span>
        </label>
      </div>

      {draft.includes.length > 0 && <section className="pg-sect"><span className="pg-eyebrow">Clients will see</span><IncludesList items={draft.includes} /></section>}
      <section className="pg-sect"><span className="pg-eyebrow">A week of it</span><WeekOutline days={weekOutline(draft)} /></section>

      {enrolments.length > 0 && (
        <section className="pg-sect">
          <span className="pg-eyebrow">{members.length} {members.length === 1 ? "member" : "members"}</span>
          {enrolments.map((e, i) => (
            <div key={e.id} className="pg-row" style={{ ["--i" as string]: i }}>
              <div className="grow"><b>{e.clientName ?? "A client"}</b><small>{e.startedAt ? `Started ${shortDate(e.startedAt)}` : `Asked ${shortDate(e.createdAt)}`}{e.paidPence ? ` · paid ${formatPrice(e.paidPence)}` : e.paidVia === "gift" ? " · given free" : ""}</small></div>
              <span className={`pg-state s-${e.status}`}>{e.status === "active" ? (e.startedAt ? "Training" : "Unlocked") : e.status === "requested" ? "Waiting" : "Declined"}</span>
            </div>
          ))}
        </section>
      )}

      {err && <p className="small" style={{ margin: 0, color: "var(--crit)" }}>{err}</p>}
      <div className="gr-row">
        <button className="btn ghost" disabled={busy} onClick={() => void save("draft")}>{l.status === "live" ? "Unpublish" : "Save draft"}</button>
        <button className="btn act" disabled={busy} onClick={() => void save("live")}>{l.status === "live" ? "Save" : "Publish"}</button>
      </div>
      {!isNew && members.length === 0 && (
        sure ? (
          <div className="gr-row">
            <button className="btn ghost" onClick={() => setSure(false)}>Keep it</button>
            <button className="btn ghost" style={{ color: "var(--crit)" }} disabled={busy} onClick={() => void onDelete(l).catch((e: Error) => setErr(e.message))}>Delete for good</button>
          </div>
        ) : <button className="btn ghost block" onClick={() => setSure(true)}><Icons.trash width={16} height={16} /> Delete programme</button>
      )}
    </div>
  );
}
