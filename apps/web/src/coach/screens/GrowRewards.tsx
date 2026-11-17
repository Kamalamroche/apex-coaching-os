import { REWARD_CHOICES, firstName, pendingRewards, reviewScore, reviewUrlProblem, rewardMessage, type GrowOffer, type ReferralJoin, type Review } from "@apex/core";
import { Icons, Label, ReviewQuote, ReviewScore } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { GROW_NEEDS_UPDATE, type GrowApi } from "../../data/grow";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; offer: GrowOffer; joins: ReferralJoin[]; reviews: Review[] };

/** Coach: the offers on my page, rewards owed to clients who brought a friend, and the reviews clients wrote. */
export function GrowRewards({ api, names, send, say, onChanged }: {
  api: GrowApi;
  names: Record<string, string>;
  send: (clientId: string, body: string) => Promise<void>;
  say: (m: string) => void;
  onChanged?: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [draft, setDraft] = useState<GrowOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const [offer, joins, reviews] = await Promise.all([api.offer(), api.referralJoins(), api.reviews()]);
      setLoad({ status: "ready", offer, joins, reviews });
      setDraft((d) => d ?? offer);
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  if (load.status === "loading" || (load.status === "ready" && !draft)) return <div className="card small">Loading…</div>;
  if (load.status === "error") return <div className="card small">{load.message === GROW_NEEDS_UPDATE ? "Rewards and reviews need a quick database update. Run the growth tools SQL in Supabase, then reload." : load.message}</div>;
  const offer = draft as GrowOffer;
  const dirty = JSON.stringify(offer) !== JSON.stringify(load.offer);
  const urlProblem = reviewUrlProblem(offer.googleReviewUrl);
  const owed = pendingRewards(load.joins);
  const score = reviewScore(load.reviews);
  const waiting = load.reviews.filter((r) => !r.approved).length;
  const name = (id: string) => names[id] ?? "Your client";
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); say(done); onChanged?.(); } catch (e) { say(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
    await reload();
  };
  const reward = (r: ReferralJoin) => act(async () => {
    const n = load.offer.referralReward || 1;
    await api.reward(r, n);
    await send(r.referrerId, rewardMessage(firstName(name(r.referrerId)), r.friend, n));
  }, `${firstName(name(r.referrerId))} has a free session · message sent`);

  return (
    <>
      {owed.length > 0 && (
        <section className="card">
          <div className="sect"><h2 className="h3">Thank them for the friend</h2><Label kind="dec">Coach decision</Label></div>
          {owed.map((r, i) => {
            const n = load.offer.referralReward || 1;
            return (
              <div key={r.id} className="ss-row" style={{ ["--i" as string]: i, flexWrap: "wrap" }}>
                <Icons.gift width={20} height={20} style={{ color: "var(--act)", flex: "none" }} />
                <div className="grow" style={{ minWidth: 150 }}><div className="h3">{name(r.referrerId)}</div><div className="tiny">Brought {r.friend}, who joined</div></div>
                <button className="btn act sm" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void reward(r)}>Give {n === 1 ? "a free session" : `${n} sessions`}</button>
              </div>
            );
          })}
          <p className="tiny" style={{ margin: "6px 0 0" }}>Adds a free pack to their sessions and sends them a thank-you in chat.</p>
        </section>
      )}

      <section className="card stack" style={{ gap: 14 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Your offers</h2></div>
        <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <input type="checkbox" role="switch" checked={offer.introOffer} onChange={(e) => setDraft({ ...offer, introOffer: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
          <span className="grow"><b className="small" style={{ color: "var(--text)" }}>First session free</b><br /><span className="tiny">Shows on your page. Give it from Calendar → Sessions and packs when they join.</span></span>
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny">When a client brings a friend who joins, they get</span>
          <div className="chips" style={{ flexWrap: "wrap" }}>
            {REWARD_CHOICES.map((n) => <button key={n} className={`chip${offer.referralReward === n ? " on" : ""}`} aria-pressed={offer.referralReward === n} onClick={() => setDraft({ ...offer, referralReward: n })}>{n === 0 ? "Nothing" : n === 1 ? "1 free session" : `${n} free sessions`}</button>)}
          </div>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">Google review link (optional)</span>
          <input className="field" inputMode="url" placeholder="https://g.page/r/…/review" value={offer.googleReviewUrl} onChange={(e) => setDraft({ ...offer, googleReviewUrl: e.target.value })} />
          <span className="tiny">After a client writes a review here, they can post it on Google too. Find the link in your Google Business Profile under "Ask for reviews".</span>
        </label>
        {urlProblem && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{urlProblem}</p>}
        <button className="btn act block" disabled={busy || !dirty || !!urlProblem} onClick={() => void act(async () => { await api.saveOffer(offer); setDraft(null); }, "Offers saved")}>Save offers</button>
      </section>

      <section className="card">
        <div className="sect"><h2 className="h3">Reviews</h2>{waiting > 0 ? <span className="ss-tag warn">{waiting} to check</span> : <Label kind="data">Data</Label>}</div>
        {score && <ReviewScore average={score.average} count={score.count} />}
        {load.reviews.length === 0 && <p className="small" style={{ margin: 0 }}>No reviews yet. Clients are asked once, after three weeks of training.</p>}
        {load.reviews.map((r, i) => (
          <ReviewQuote key={r.id} name={r.name ?? `${firstName(name(r.clientId))} (name hidden on your page)`} stars={r.stars} body={r.body} at={r.at} i={i}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className={`ss-tag${r.approved ? " good" : ""}`}>{r.approved ? "On your page" : "Not shown"}</span>
              <span className="grow" />
              {r.approved
                ? <button className="btn ghost sm" disabled={busy} onClick={() => void act(() => api.setApproved(r.id, false), "Hidden from your page")}>Hide</button>
                : <button className="btn act sm" disabled={busy} onClick={() => void act(() => api.setApproved(r.id, true), "Showing on your page")}>Show on page</button>}
              {sure === r.id
                ? <button className="btn ghost sm" style={{ color: "var(--crit)" }} disabled={busy} onClick={() => void act(() => api.removeReview(r.id), "Review removed")}>Remove</button>
                : <button className="iconbtn" onClick={() => setSure(r.id)} aria-label="Remove this review">Remove</button>}
            </div>
          </ReviewQuote>
        ))}
        {load.reviews.length > 0 && <div className="row tiny" style={{ gap: 8, marginTop: 4 }}><span style={{ flex: "none" }}><Label kind="dec">Coach decision</Label></span><span>You choose which reviews show on your page. A client edit comes back here first.</span></div>}
      </section>
    </>
  );
}
