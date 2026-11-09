import { HEADLINE_MAX, BIO_MAX, MODE_LABEL, SPECIALTY_IDEAS, SPECIALTY_MAX, pageLink, pageProblem, slugProblem, slugify, stageCounts, trainWithMeText, winRate, followUpsDue, sortLeads, type CoachPage, type Lead, type LeadStage, type TrainingModeName } from "@apex/core";
import { BackLink, CoachPageView, GrowHero, Icons, LeadCard, PipelineStrip, Sheet } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { GROWTH_NEEDS_UPDATE, LEADS_NEEDS_UPDATE, LEADS_SQL, openedForLeads, useGrowthApi } from "../../data/growth";
import { demoPageExtras, livePageExtras, useGrowApi, type PageExtras } from "../../data/grow";
import { isDemo, supabase } from "../../data/supabase";
import type { CoachLiveProps } from "../CoachApp";
import { clientNames, useSendToClient } from "../sendToClient";
import { GrowRewards } from "./GrowRewards";
import { AddLeadSheet, EnquiryForm, LeadSheet, copyText, inviteLead, localToday } from "./CoachLeads";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: CoachPage; leads: Lead[] };
type View = "leads" | "form" | "page" | "rewards";
type Filter = LeadStage | "open" | "all";

/** Coach: my leads (pipeline), my enquiry form and welcome email, and my public page with its Train with me link. */
export function CoachGrow({ live, onBack, say }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void }) {
  const api = useGrowthApi();
  const grow = useGrowApi();
  const send = useSendToClient(live);
  const [extras, setExtras] = useState<PageExtras | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [draft, setDraft] = useState<CoachPage | null>(null);
  const [view, setView] = useState<View>("leads");
  const [filter, setFilter] = useState<Filter>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [page, leads] = await Promise.all([api.page(), api.requests()]);
      const p = page as CoachPage;
      setLoad({ status: "ready", page: p, leads });
      setDraft((d) => d ?? p);
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { if (openedForLeads()) setView("leads"); }, []);
  const loadExtras = useCallback(() => {
    if (!grow) return;
    if (!grow.live) { setExtras(demoPageExtras()); return; }
    if (supabase && !isDemo() && load.status === "ready" && load.page.published) void livePageExtras(supabase, load.page.slug).then(setExtras);
  }, [grow, load]);
  useEffect(() => { loadExtras(); }, [loadExtras]);
  if (!api) return null;

  if (load.status !== "ready" || !draft) {
    return (
      <>
        <BackLink onClick={onBack}>Messages</BackLink>
        {load.status === "error" ? (
          <div className="card small">{load.message === GROWTH_NEEDS_UPDATE ? "Your page needs a database update first: run 20261110090000_growth.sql in Supabase." : load.message}</div>
        ) : <div className="card small">Loading your page…</div>}
      </>
    );
  }
  const today = localToday();
  const saved = load.page;
  const link = pageLink(location.origin, saved.slug);
  const leads = sortLeads(load.leads, today);
  const counts = stageCounts(leads);
  const due = followUpsDue(leads, today);
  const shown = leads.filter((l) => (filter === "all" ? true : filter === "open" ? l.stage !== "client" && l.stage !== "lost" : l.stage === filter));
  const opened = leads.find((l) => l.id === openId) ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const problem = draft.published ? pageProblem(draft) : slugProblem(draft.slug);
  const set = (patch: Partial<CoachPage>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const fail = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    say(m === LEADS_NEEDS_UPDATE ? `Lead tools need a database update: run ${LEADS_SQL} in Supabase` : m);
  };

  const save = async (next = draft) => {
    setBusy(true);
    try { await api.savePage(next); say(next.published ? "Your page is live" : "Saved as a draft"); setDraft(next); await reload(); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  const share = async () => {
    const text = trainWithMeText(link);
    if (navigator.share) {
      try { await navigator.share({ title: "Train with me", text, url: link }); return; } catch { /* closed: fall back to copy */ }
    }
    if (await copyText(text)) say("Link copied · paste it in your bio or a message");
  };
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) say(done); } catch (e) { fail(e); }
    await reload();
  };

  return (
    <>
      <BackLink onClick={onBack}>Messages</BackLink>
      <GrowHero page={saved} fresh={counts.new} joined={counts.client}>
        {saved.published ? (
          <div className="gr-row">
            <button className="gr-cta" onClick={() => void share()}><Icons.share width={15} height={15} /> Share my link</button>
            <a className="gr-cta glass" href={link} target="_blank" rel="noreferrer"><Icons.globe width={15} height={15} /> Open</a>
          </div>
        ) : (
          <button className="gr-cta" onClick={() => setView("page")}>Set up my page</button>
        )}
      </GrowHero>

      <div className="seg" role="tablist" aria-label="Train with me">
        {([["leads", `Leads${counts.new ? ` ${counts.new}` : ""}`], ["form", "Form"], ["page", "Page"], ...(grow ? [["rewards", "Rewards"]] : [])] as [View, string][]).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>

      {view === "leads" && (
        <>
          <PipelineStrip counts={counts} active={filter === "open" || filter === "all" ? null : filter} onPick={(s) => setFilter(s ?? "open")} winRate={winRate(leads)} />
          {due.length > 0 && (
            <button className="card flat li" style={{ width: "100%", textAlign: "left", borderColor: "var(--warn)" }} onClick={() => setOpenId(due[0]?.id ?? null)}>
              <Icons.clock width={18} height={18} style={{ color: "var(--warn)" }} />
              <div className="grow"><div className="h3">{due.length === 1 ? "1 follow-up due" : `${due.length} follow-ups due`}</div><div className="tiny">{due.slice(0, 3).map((l) => l.name.split(" ")[0]).join(", ")}{due.length > 3 ? "…" : ""}</div></div>
              <span className="tiny">›</span>
            </button>
          )}
          <div className="sect" style={{ marginBottom: 0 }}>
            <div className="chips" role="tablist" aria-label="Show">
              <button className={`chip${filter === "open" ? " on" : ""}`} onClick={() => setFilter("open")}>Open</button>
              <button className={`chip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All {leads.length}</button>
            </div>
            <button className="btn act sm" onClick={() => setAdding(true)}><Icons.plus width={14} height={14} /> Add a lead</button>
          </div>
          {shown.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {shown.map((l, i) => (
                <LeadCard key={l.id} lead={l} today={today} i={i} onOpen={() => setOpenId(l.id)}>
                  {l.stage === "new" && l.email && <button className="btn act sm" onClick={() => void run(() => inviteLead(api, l, say))}><Icons.mail width={14} height={14} /> Invite</button>}
                  {l.stage === "new" && <button className="btn ghost sm" onClick={() => void run(() => api.setStage(l.id, "contacted"), `${l.name.split(" ")[0]} moved to contacted`)}>Mark contacted</button>}
                  {l.stage === "lost" && <button className="btn ghost sm" onClick={() => void run(() => api.setStage(l.id, "new"), "Back in the pipeline")}>Undo</button>}
                </LeadCard>
              ))}
            </div>
          ) : (
            <div className="card small">{leads.length ? "Nobody on this stage right now." : "No leads yet. Share your enquiry form and they'll land here, with where they came from."}</div>
          )}
        </>
      )}

      {view === "rewards" && grow && <GrowRewards api={grow} names={clientNames(live)} send={send} say={say} onChanged={loadExtras} />}

      {view === "form" && <EnquiryForm page={saved} say={say} fail={fail} onSetUp={() => setView("page")} />}

      {view === "page" && (
        <section id="gr-edit" className="card stack" style={{ gap: 14 }}>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Your page</h2><button className="btn ghost sm" onClick={() => setPreview(true)}>Preview</button></div>
          {saved.published && (
            <div className="gr-link">
              <Icons.link width={16} height={16} style={{ color: "var(--act)", flex: "none" }} />
              <code>{link.replace(/^https?:\/\//, "")}</code>
              <button className="btn ghost sm" onClick={() => void copyText(link).then((ok) => ok && say("Link copied"))}><Icons.copy width={14} height={14} /> Copy</button>
            </div>
          )}
          <label className="stack" style={{ gap: 6 }}>
            <span className="tiny">Address</span>
            <div className="gr-link" style={{ padding: "4px 4px 4px 12px" }}>
              <span className="tiny num" style={{ flex: "none" }}>{location.host}/c/</span>
              <input className="field" style={{ border: 0, background: "none", padding: "8px 4px" }} value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) || e.target.value.toLowerCase() })} aria-label="Page address" />
            </div>
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="tiny">Headline <span className="num">{HEADLINE_MAX - draft.headline.trim().length}</span></span>
            <input className="field" maxLength={HEADLINE_MAX} placeholder="Strength coaching that fits your life" value={draft.headline} onChange={(e) => set({ headline: e.target.value })} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="tiny">Your story <span className="num">{BIO_MAX - draft.bio.trim().length}</span></span>
            <textarea className="field" rows={4} maxLength={BIO_MAX} placeholder="Who you coach, how you work, what they get." value={draft.bio} onChange={(e) => set({ bio: e.target.value })} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="tiny">City (optional)</span>
            <input className="field" maxLength={60} value={draft.city} onChange={(e) => set({ city: e.target.value })} />
          </label>
          <div className="stack" style={{ gap: 6 }}>
            <span className="tiny">Specialties · up to {SPECIALTY_MAX}</span>
            <div className="gr-chips">
              {SPECIALTY_IDEAS.map((s) => {
                const on = draft.specialties.includes(s);
                return <button key={s} type="button" className="gr-chip" aria-pressed={on} disabled={!on && draft.specialties.length >= SPECIALTY_MAX} onClick={() => set({ specialties: on ? draft.specialties.filter((x) => x !== s) : [...draft.specialties, s] })}>{s}</button>;
              })}
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="tiny">How you coach</span>
            <div className="gr-chips">
              {(Object.keys(MODE_LABEL) as TrainingModeName[]).map((m) => {
                const on = draft.modes.includes(m);
                return <button key={m} type="button" className="gr-chip" aria-pressed={on} onClick={() => set({ modes: on ? draft.modes.filter((x) => x !== m) : [...draft.modes, m] })}>{MODE_LABEL[m]}</button>;
              })}
            </div>
          </div>
          <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <input type="checkbox" role="switch" checked={draft.clients !== null} onChange={(e) => set({ clients: e.target.checked ? (saved.clients ?? 0) : null })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
            <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Show how many clients I coach</b><br /><span className="tiny">Just the number. Never names.</span></span>
          </label>
          <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <input type="checkbox" role="switch" checked={draft.published} onChange={(e) => set({ published: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
            <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Page is live</b><br /><span className="tiny">Anyone with the link can see it and ask to train with you.</span></span>
          </label>
          {problem && dirty && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{problem}</p>}
          <button className="btn act block" disabled={busy || !dirty || !!problem} onClick={() => void save()}>{draft.published ? "Save and publish" : "Save draft"}</button>
        </section>
      )}

      {preview && (
        <Sheet label="Preview" onClose={() => setPreview(false)}>
          <div className="sect"><h2 className="h3">What people see</h2><button className="btn ghost sm" onClick={() => setPreview(false)}>Close</button></div>
          <CoachPageView page={draft} preview extras={extras} action={<span className="gr-cta">Train with {draft.name.split(" ")[0]}</span>} />
        </Sheet>
      )}
      {opened && <LeadSheet lead={opened} api={api} today={today} say={say} fail={fail} onChanged={reload} onClose={() => setOpenId(null)} />}
      {adding && <AddLeadSheet api={api} say={say} fail={fail} onDone={() => { setAdding(false); setFilter("open"); void reload(); }} onClose={() => setAdding(false)} />}
    </>
  );
}
