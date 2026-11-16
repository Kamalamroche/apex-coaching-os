import {
  CAMPAIGN_TEXT_MAX, CAMPAIGN_TITLE_MAX, SPOTS_MAX, campaignCaption, campaignEndsText, campaignLive, campaignProblem, formLink, funnel, growthPlan,
  happinessScore, happinessVerdict, latestAnswers, proofCaption, proofLines, reviewCaption, reviewScore, rewardText, sampleBusiness, spotsCaption,
  spotsLeft, spotsProblem, spotsText, type Campaign, type CoachPage, type GrowOffer, type HappinessAnswer, type Lead, type MarketingSettings,
  type PageVisits, type PlanAction, type ProofNumbers, type ReferralJoin, type Review,
} from "@apex/core";
import { BackLink, FunnelView, HappinessGauge, HappinessRow, Icons, Label, MarketingHero, PlanItem, PlanProgress, ProofTiles, drawMarketingCard, loadStoryFonts, type MarketingCardData, type MarketingCardTheme } from "@apex/ui";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { shareCards } from "../../app/shareImage";
import { loadBusiness } from "../../data/business";
import { useGrowApi } from "../../data/grow";
import { useGrowthApi } from "../../data/growth";
import { MARKETING_NEEDS_UPDATE, MARKETING_SQL, useMarketingApi } from "../../data/marketing";
import type { CoachLiveProps } from "../CoachApp";
import { downloadQr, printPoster, qrSvg } from "../poster";
import { useSendToClient } from "../sendToClient";
import type { GrowView } from "./CoachGrow";
import { copyText, localToday } from "./CoachLeads";

/* Loaded when first opened, so the app starts faster. */
const CoachGrow = lazy(() => import("./CoachGrow").then((m) => ({ default: m.CoachGrow })));

type Tab = "plan" | "posts" | "boost" | "numbers";

interface Data {
  page: CoachPage | null;
  leads: Lead[];
  offer: GrowOffer | null;
  reviews: Review[];
  joins: ReferralJoin[];
  settings: MarketingSettings | null;
  answers: HappinessAnswer[];
  visits: PageVisits[];
  proof: ProofNumbers | null;
  joined: number;
  ended: { id: string; name: string; endedAt: string | null }[];
  current: string[];
  /** The marketing SQL hasn't run: places, offers, visits and happiness are off until it does. */
  needsSql: boolean;
}

const DONE_KEY = "apex-plan-done";
const readDone = (): string[] => { try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as string[]; } catch { return []; } };
const writeDone = (ids: string[]) => { try { localStorage.setItem(DONE_KEY, JSON.stringify(ids.slice(-60))); } catch { /* this visit only */ } };

const settle = async <T,>(p: Promise<T> | undefined, fallback: T, onMissing?: () => void): Promise<T> => {
  if (!p) return fallback;
  try { return await p; } catch (e) { if (e instanceof Error && e.message === MARKETING_NEEDS_UPDATE) onMissing?.(); return fallback; }
};

/** Coach: marketing. This week's plan from real data, posts to share, places and offers for the page, a QR poster, and the numbers. */
export function CoachMarketing({ live, onBack, say, coachName }: { live?: CoachLiveProps; onBack: () => void; say: (m: string) => void; coachName: string }) {
  const growth = useGrowthApi();
  const grow = useGrowApi();
  const mk = useMarketingApi();
  const send = useSendToClient(live);
  const [tab, setTab] = useState<Tab>("plan");
  const [grow2, setGrow2] = useState<GrowView | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [done, setDone] = useState<string[]>(readDone);

  const reload = useCallback(async () => {
    let needsSql = false;
    const missing = () => { needsSql = true; };
    const biz = live ? loadBusiness(live.db, live.coachId).then((r) => r.input) : Promise.resolve(sampleBusiness(new Date()));
    const [page, leads, offer, reviews, joins, settings, answers, visits, proof, joined, bizInput] = await Promise.all([
      settle(growth?.page(), null), settle(growth?.requests(), [] as Lead[]),
      settle(grow?.offer(), null), settle(grow?.reviews(), [] as Review[]), settle(grow?.referralJoins(), [] as ReferralJoin[]),
      settle(mk?.settings(), null, missing), settle(mk?.happiness(), [] as HappinessAnswer[], missing), settle(mk?.visits(30), [] as PageVisits[], missing),
      settle(mk?.proof(30), null, missing), settle(mk?.joinedThisMonth(), 0, missing), settle(biz, null),
    ]);
    const clients = bizInput?.clients ?? [];
    setData({
      page, leads, offer, reviews, joins, settings, answers, visits, proof, joined, needsSql,
      ended: clients.filter((c) => c.status === "ended").map((c) => ({ id: c.id, name: c.name, endedAt: c.endedAt })),
      current: clients.filter((c) => c.status === "active" || c.status === "paused").map((c) => c.id),
    });
  }, [growth, grow, mk, live]);
  useEffect(() => { void reload(); }, [reload]);

  if (grow2) return <Suspense fallback={<div className="card"><div className="small">Loading…</div></div>}><CoachGrow live={live} startView={grow2} backLabel="Marketing" onBack={() => { setGrow2(null); void reload(); }} say={say} /></Suspense>;
  if (!data) return <><BackLink onClick={onBack}>Business</BackLink><div className="card small">Loading your marketing…</div></>;

  const now = new Date();
  const page = data.page;
  const link = page?.published ? formLink(location.origin, page.slug) : null;
  const reward = data.offer ? rewardText(data.offer, coachName) : null;
  const plan = growthPlan({
    coach: coachName, now, done,
    leads: data.leads.map((l) => ({ id: l.id, name: l.name, email: l.email, stage: l.stage, at: l.at, followUp: l.followUp })),
    answers: data.answers, reviewed: data.reviews.map((r) => r.clientId), referred: data.joins.map((j) => j.referrerId),
    ended: data.ended, current: data.current, proof: data.proof,
    published: !!page?.published, googleReviewUrl: !!data.offer?.googleReviewUrl, spotsSet: data.settings?.spots != null,
    rewardLine: reward ? reward.replace(/^Bring a friend to [^:]+: /, "").replace(/^./, (c) => c.toUpperCase()) : null,
  });
  const score = happinessScore(data.answers);
  const spots = data.settings ? spotsText(data.settings.spots, data.joined, now) : null;
  const toggle = (id: string) => setDone((d) => { const next = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]; writeDone(next); return next; });
  const pills = [
    `${plan.actions.length} ${plan.actions.length === 1 ? "thing" : "things"} this week`,
    ...(score ? [`Happiness ${score.score > 0 ? "+" : ""}${score.score}`] : []),
    ...(spots ? [spots] : []),
  ];

  const act = async (a: PlanAction) => {
    if (!a.message || !a.to) return;
    if (a.to.kind === "client") {
      try { await send(a.to.id, a.message); toggle(a.id); say(`Sent to ${a.to.name.split(" ")[0]}`); }
      catch (e) { say(e instanceof Error ? e.message : String(e)); }
    }
  };
  const open = (a: PlanAction) => {
    if (a.kind === "reply" || a.kind === "follow") setGrow2("leads");
    else if (a.kind === "post") setTab("posts");
    else if (a.kind === "setup") { if (a.id.endsWith("page")) setGrow2("page"); else if (a.id.endsWith("google")) setGrow2("rewards"); else setTab("boost"); }
  };

  return (
    <>
      <BackLink onClick={onBack}>Business</BackLink>
      <MarketingHero title="Grow your business" caption={`Week ${plan.week.slice(-2)} · built from your own records`} pills={pills}>
        {link
          ? <button className="gr-cta" onClick={() => void copyText(link).then((ok) => ok && say("Page link copied"))}><Icons.copy width={15} height={15} /> Copy my page link</button>
          : <button className="gr-cta" onClick={() => setGrow2("page")}>Set up my page</button>}
      </MarketingHero>
      {data.needsSql && <div className="card small" style={{ borderColor: "var(--warn)" }}>One step left: run {MARKETING_SQL} in Supabase to switch on places, offers, page visits and the happiness check. The plan below already uses your leads and reviews.</div>}

      <div className="seg" role="tablist" aria-label="Marketing">
        {([["plan", "This week"], ["posts", "Posts"], ["boost", "Offers"], ["numbers", "Numbers"]] as [Tab, string][]).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}>{label}</button>
        ))}
      </div>

      {tab === "plan" && (
        <section className="stack" style={{ gap: 12 }}>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Your growth plan</h2><Label kind="insight">Insight</Label></div>
          {plan.actions.length ? (
            <>
              <PlanProgress done={plan.doneCount} total={plan.actions.length} />
              <ul className="mk-plan">
                {plan.actions.map((a, i) => (
                  <PlanItem key={a.id} kind={a.kind} title={a.title} why={a.why} done={done.includes(a.id)} i={i} onToggle={() => toggle(a.id)}>
                    {a.message && a.to?.kind === "client" && <button className="btn act sm" onClick={() => void act(a)}><Icons.send width={14} height={14} /> Send in chat</button>}
                    {a.message && a.to?.kind === "lead" && a.to.email && <a className="btn act sm" href={`mailto:${a.to.email}?subject=${encodeURIComponent(`Training with ${coachName}`)}&body=${encodeURIComponent(a.message)}`} onClick={() => toggle(a.id)}><Icons.mail width={14} height={14} /> Email</a>}
                    {a.message && <button className="btn ghost sm" onClick={() => void copyText(a.message!).then((ok) => ok && say("Message copied"))}><Icons.copy width={14} height={14} /> Copy</button>}
                    {!a.message && <button className="btn act sm" onClick={() => open(a)}>Open <Icons.arrow width={14} height={14} /></button>}
                  </PlanItem>
                ))}
              </ul>
              <p className="tiny" style={{ margin: 0 }}>Messages are drafts in your voice: read them first. Nothing is sent until you tap Send. A fresh plan comes every Monday.</p>
            </>
          ) : (
            <div className="card small">Nothing urgent this week. A good time to post one of your proof cards and ask a happy client for a friend.</div>
          )}
        </section>
      )}

      {tab === "posts" && <MarketingPosts coach={coachName} page={page} reviews={data.reviews} proof={data.proof} settings={data.settings} joined={data.joined} say={say} />}

      {tab === "boost" && (
        mk && page ? <PageBoosts api={mk} page={page} offer={data.offer} settings={data.settings} joined={data.joined} needsSql={data.needsSql} say={say} onSaved={reload} onSetUp={() => setGrow2("page")} />
          : <div className="card small">Set up your page first, then places, offers and your QR poster live here. <button className="btn ghost sm" onClick={() => setGrow2("page")}>Set up my page</button></div>
      )}

      {tab === "numbers" && <Numbers data={data} now={now} />}
    </>
  );
}

/* ---------- Numbers ---------- */

function Numbers({ data, now }: { data: Data; now: Date }) {
  const f = funnel(data.visits, data.leads.map((l) => ({ createdAt: l.at, stage: l.stage, source: l.source })), now, 30);
  const score = happinessScore(data.answers);
  const latest = latestAnswers(data.answers);
  const lines = data.proof ? proofLines(data.proof) : [];
  const stars = reviewScore(data.reviews);
  const ago = (iso: string) => { const d = Math.floor((now.getTime() - Date.parse(iso)) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  return (
    <>
      <section className="card">
        <div className="sect"><h2 className="h3">Last 30 days, page to client</h2><Label kind="data">Data</Label></div>
        <FunnelView funnel={f} />
        <p className="bz-note" style={{ marginTop: 10 }}>{f.best ? `${f.best.label} brings you the most ${f.best.clients ? "clients" : "enquiries"}. Put your link there more often.` : "Share your link with a source tag (Messages → Train with me → Form) to see which channel works."} Visits are counted without cookies or names.</p>
      </section>
      <section className="card">
        <div className="sect"><h2 className="h3">Client happiness</h2><Label kind="data">Data</Label></div>
        {score ? (
          <>
            <HappinessGauge score={score} />
            <p className="small" style={{ margin: "12px 0" }}><Label kind="insight">Insight</Label> {happinessVerdict(score)}</p>
            <ul className="mk-answers">{latest.slice(0, 8).map((a) => <HappinessRow key={a.id} name={a.name} score={a.score} comment={a.comment} when={ago(a.at)} />)}</ul>
          </>
        ) : <p className="small" style={{ margin: 0 }}>Clients get one quick question on their Today screen three weeks in, then every three months: how likely they'd recommend you, 0 to 10. Answers show here.</p>}
      </section>
      {lines.length > 0 && (
        <section className="card">
          <div className="sect"><h2 className="h3">Your clients, last 30 days</h2><Label kind="data">Data</Label></div>
          <ProofTiles lines={lines} />
        </section>
      )}
      {stars && <div className="card small">Reviews on your page: <b className="num">{stars.average.toFixed(1)}</b> stars on average, from {stars.count} {stars.count === 1 ? "review" : "reviews"}.</div>}
    </>
  );
}

/* ---------- Posts ---------- */

interface PostChoice { key: string; label: string; card: MarketingCardData; caption: string }

function MarketingPosts({ coach, page, reviews, proof, settings, joined, say }: { coach: string; page: CoachPage | null; reviews: Review[]; proof: ProofNumbers | null; settings: MarketingSettings | null; joined: number; say: (m: string) => void }) {
  const today = localToday();
  const now = new Date();
  const link = page?.published ? formLink(location.origin, page.slug, "instagram") : `${location.origin}/c/`;
  const site = page?.published ? `${location.host}/c/${page.slug}` : location.host;
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  const choices = useMemo<PostChoice[]>(() => {
    const out: PostChoice[] = [];
    if (proof && proofLines(proof).length) out.push({ key: "proof", label: "Proof in numbers", card: { kind: "proof", days: proof.days, lines: proofLines(proof) }, caption: proofCaption(proof, link) });
    for (const r of reviews.filter((x) => x.approved).slice(0, 4)) out.push({ key: `review-${r.id}`, label: `Review · ${r.name ?? "A client"}`, card: { kind: "review", body: r.body, stars: r.stars, name: r.name }, caption: reviewCaption(r.name, link) });
    if (settings?.spots != null) {
      const left = spotsLeft(settings.spots, joined);
      out.push({ key: "spots", label: "Places left", card: { kind: "spots", left, month }, caption: spotsCaption(spotsText(settings.spots, joined, now) ?? "", link) });
    }
    if (campaignLive(settings?.campaign ?? null, today)) {
      const c = settings!.campaign!;
      out.push({ key: "offer", label: c.title, card: { kind: "offer", title: c.title, text: c.text, ends: campaignEndsText(c.ends, today) }, caption: campaignCaption(c, campaignEndsText(c.ends, today), link) });
    }
    return out;
  }, [proof, reviews, settings, joined, link, month, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState(0);
  const [format, setFormat] = useState<"post" | "story">("post");
  const [theme, setTheme] = useState<MarketingCardTheme>("night");
  const [caption, setCaption] = useState("");
  const [ready, setReady] = useState(false);
  const big = useRef<HTMLCanvasElement>(null);
  const choice = choices[Math.min(pick, choices.length - 1)];
  useEffect(() => { void loadStoryFonts().then(() => setReady(true)); }, []);
  useEffect(() => { setCaption(choice?.caption ?? ""); }, [choice?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (choice && big.current) drawMarketingCard(big.current, { card: choice.card, format, theme, coach, site });
  }, [choice, format, theme, coach, site, ready]);

  if (!choices.length) return <div className="card small">Your posts appear here once you have something real to show: approved reviews, clients' training numbers, places or an offer.</div>;
  const save = async () => {
    if (!big.current) return;
    const m = await shareCards([big.current], `apex-${choice!.key}`, caption);
    if (m) say(m);
  };
  return (
    <section className="card stack" style={{ gap: 14 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Ready to post</h2><Label kind="data">Your real numbers</Label></div>
      <div className="chips" role="tablist" aria-label="Which post">
        {choices.map((c, i) => <button key={c.key} className={`chip${i === pick ? " on" : ""}`} onClick={() => setPick(i)}>{c.label}</button>)}
      </div>
      <canvas ref={big} className="mk-canvas" aria-label={`${choice!.label} post preview`} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <div className="seg" style={{ flex: "1 1 160px" }}>
          {(["post", "story"] as const).map((f) => <button key={f} className={format === f ? "on" : ""} aria-pressed={format === f} onClick={() => setFormat(f)}>{f === "post" ? "Post 4:5" : "Story 9:16"}</button>)}
        </div>
        <div className="seg" style={{ flex: "1 1 160px" }}>
          {(["night", "day"] as const).map((t) => <button key={t} className={theme === t ? "on" : ""} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === "night" ? "Night" : "Daylight"}</button>)}
        </div>
      </div>
      <label className="stack" style={{ gap: 6 }}>
        <span className="tiny row" style={{ gap: 8 }}>Caption <Label kind="ai">AI suggestion</Label></span>
        <textarea className="field mk-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn act grow" onClick={() => void save()}><Icons.share width={15} height={15} /> Share or save</button>
        <button className="btn ghost" onClick={() => void copyText(caption).then((ok) => ok && say("Caption copied"))}><Icons.copy width={15} height={15} /> Caption</button>
      </div>
      <p className="tiny" style={{ margin: 0 }}>Reviews only appear once you've approved them, and names only when the client allowed it. Numbers are totals, never one client's data.</p>
    </section>
  );
}

/* ---------- Page boosts: places, offer, QR poster ---------- */

function PageBoosts({ api, page, offer, settings, joined, needsSql, say, onSaved, onSetUp }: {
  api: NonNullable<ReturnType<typeof useMarketingApi>>; page: CoachPage; offer: GrowOffer | null; settings: MarketingSettings | null; joined: number; needsSql: boolean;
  say: (m: string) => void; onSaved: () => Promise<void>; onSetUp: () => void;
}) {
  const today = localToday();
  const initial = settings ?? { spots: null, campaign: null };
  const [spots, setSpots] = useState<number | null>(initial.spots);
  const [campaign, setCampaign] = useState<Campaign | null>(initial.campaign);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const qrLink = formLink(location.origin, page.slug, "flyer");
  const qr = useMemo(() => qrSvg(qrLink), [qrLink]);
  const draft: MarketingSettings = { spots, campaign };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const problem = spotsProblem(spots) ?? campaignProblem(campaign, today);
  const setC = (patch: Partial<Campaign>) => setCampaign((c) => ({ ...(c ?? { title: "", text: "", ends: "" }), ...patch }));
  const save = async () => {
    setBusy(true);
    try { await api.saveSettings(draft, today); say("Saved · your page shows it now"); await onSaved(); }
    catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const poster = () => {
    const ok = printPoster({
      name: page.name, headline: page.headline, specialties: page.specialties, link: qrLink,
      spots: spotsText(spots, joined, now),
      offer: campaignLive(campaign, today) ? campaign.title : offer?.introOffer ? "First session free" : null,
    });
    if (!ok) say("Your browser blocked the new tab. Allow pop-ups for APEX and try again.");
  };
  return (
    <>
      {!page.published && <div className="card small">Your page is a draft. Places and offers show once it's live. <button className="btn ghost sm" onClick={onSetUp}>Open my page</button></div>}
      <section className="card stack" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Places this month</h2><Label kind="dec">Coach decision</Label></div>
        <p className="small" style={{ margin: 0 }}>Say how many new clients you can take. Your page counts down as people start, so it's always true.</p>
        <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" role="switch" checked={spots !== null} disabled={needsSql} onChange={(e) => setSpots(e.target.checked ? 3 : null)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
          <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Show places left on my page</b><br /><span className="tiny">{spots !== null ? spotsText(spots, joined, now) : "Off"}</span></span>
        </label>
        {spots !== null && (
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button className="btn ghost sm" aria-label="One fewer" disabled={spots <= 0} onClick={() => setSpots(spots - 1)}>−</button>
            <b className="num" style={{ minWidth: 30, textAlign: "center", fontSize: 20 }}>{spots}</b>
            <button className="btn ghost sm" aria-label="One more" disabled={spots >= SPOTS_MAX} onClick={() => setSpots(spots + 1)}>+</button>
            <span className="tiny">new clients in {now.toLocaleDateString("en-GB", { month: "long" })} · {joined} started so far</span>
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Limited-time offer</h2><Label kind="dec">Coach decision</Label></div>
        <p className="small" style={{ margin: 0 }}>A real offer with a real end date, shown on your page and ready to post. It disappears by itself after the last day.</p>
        <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" role="switch" checked={campaign !== null} disabled={needsSql} onChange={(e) => setCampaign(e.target.checked ? { title: "", text: "", ends: "" } : null)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
          <span className="grow"><b className="small" style={{ color: "var(--text)" }}>Run an offer</b><br /><span className="tiny">{campaignLive(campaign, today) ? campaignEndsText(campaign.ends, today) : "Off"}</span></span>
        </label>
        {campaign && (
          <>
            <label className="stack" style={{ gap: 6 }}><span className="tiny">Name <span className="num">{CAMPAIGN_TITLE_MAX - campaign.title.trim().length}</span></span><input className="field" maxLength={CAMPAIGN_TITLE_MAX} placeholder="New Year start" value={campaign.title} onChange={(e) => setC({ title: e.target.value })} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="tiny">What people get <span className="num">{CAMPAIGN_TEXT_MAX - campaign.text.trim().length}</span></span><textarea className="field" rows={2} maxLength={CAMPAIGN_TEXT_MAX} placeholder="Start before 31 January and your first two weeks are free." value={campaign.text} onChange={(e) => setC({ text: e.target.value })} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="tiny">Last day</span><input className="field" type="date" min={today} value={campaign.ends} onChange={(e) => setC({ ends: e.target.value })} /></label>
          </>
        )}
      </section>
      {problem && dirty && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{problem}</p>}
      <button className="btn act block" disabled={busy || !dirty || !!problem} onClick={() => void save()}>Save to my page</button>

      <section className="card stack" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">QR poster</h2><Icons.qr width={18} height={18} style={{ color: "var(--text3)" }} /></div>
        <div className="mk-qr">
          <span dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code for your enquiry form" role="img" />
          <p className="small" style={{ margin: 0 }}>For gym noticeboards, studios, cafés and physio waiting rooms. People who scan land on your enquiry form, tagged "Flyer or QR", so you can see what it brings in.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn act grow" onClick={poster}><Icons.print width={15} height={15} /> Print A4 poster</button>
          <button className="btn ghost" onClick={() => { downloadQr(qrLink, page.name); say("QR code saved"); }}><Icons.download width={15} height={15} /> QR only</button>
        </div>
      </section>
    </>
  );
}
