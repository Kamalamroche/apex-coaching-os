import { REVIEW_MAX, reviewDue, reviewProblem, shortName, type GrowOffer, type Review } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, ReviewQuote, StarPicker } from "@apex/ui";
import { useCallback, useEffect, useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { GROW_NEEDS_UPDATE, useGrowApi } from "../data/grow";
import { useStore } from "../data/StoreContext";

const ASKED_KEY = "apex-review-asked";
const asked = () => { try { return localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; } };
const markAsked = () => { try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* this visit only */ } };
const DAY = 86400000;

/** My review and my coach's offer (for the Google link). Null until loaded, or when reviews aren't set up. */
export function useMyReview() {
  const api = useGrowApi();
  const [state, setState] = useState<{ review: Review | null; offer: GrowOffer } | null>(null);
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [list, offer] = await Promise.all([api.reviews(), api.offer()]);
      setState({ review: list[0] ?? null, offer });
    } catch { setState(null); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);
  return { api, state, reload };
}

/** Today: asks once, three weeks in with enough training done. Stars first, then a sentence or two. */
export function ReviewPrompt({ say }: { say?: (m: string) => void }) {
  const store = useStore();
  const { history } = useApexState(store);
  const { coachName } = useAppInfo();
  const { api, state, reload } = useMyReview();
  const [dismissed, setDismissed] = useState(asked);
  const [done, setDone] = useState(false);
  const sessions = history.sessions ?? [];
  const oldest = sessions.reduce((m, s) => Math.min(m, Date.parse(s.at)), Date.now());
  const due = reviewDue({ daysWithCoach: Math.floor((Date.now() - oldest) / DAY), workoutsDone: sessions.length, sessionsAttended: 0, hasReview: !!state?.review, dismissed });
  if (!api || !state || (!due && !done)) return null;
  const close = () => { markAsked(); setDismissed(true); };
  return (
    <section className="card stack rv-ask" aria-label={`Review ${coachName}`} style={{ gap: 12 }}>
      {done ? (
        <Thanks offer={state.offer} coachName={coachName} review={state.review} onClose={() => { setDone(false); close(); }} say={say} />
      ) : (
        <>
          <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">How's training with {coachName}?</h2><button className="iconbtn" aria-label="Not now" onClick={close}><Icons.close width={16} height={16} /></button></div>
          <p className="small" style={{ margin: 0 }}>A few words help {coachName} and help people decide to start. {coachName} chooses which reviews go on their page.</p>
          <ReviewForm onSaved={async () => { markAsked(); await reload(); setDone(true); }} />
        </>
      )}
    </section>
  );
}

/** More → Review: write, read back or edit my review. */
export function MyReview({ say }: { say: (m: string) => void }) {
  const { coachName, clientName } = useAppInfo();
  const { api, state, reload } = useMyReview();
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(false);
  if (!api) return null;
  if (!state) return <div className="card small">Loading…</div>;
  const r = state.review;
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <h2 className="h2" style={{ margin: 0 }}>Review {coachName}</h2>
      {done ? (
        <Thanks offer={state.offer} coachName={coachName} review={r} onClose={() => setDone(false)} say={say} />
      ) : r && !editing ? (
        <>
          <ReviewQuote name={r.name ? shortName(clientName) : null} stars={r.stars} body={r.body} at={r.at} />
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className={`ss-tag${r.approved ? " good" : ""}`}>{r.approved ? `On ${coachName}'s page` : `Waiting for ${coachName}`}</span>
            <span className="grow" />
            <button className="btn ghost sm" onClick={() => setEditing(true)}>Edit</button>
          </div>
          {state.offer.googleReviewUrl && <GoogleButton url={state.offer.googleReviewUrl} body={r.body} say={say} />}
        </>
      ) : (
        <ReviewForm existing={r} onSaved={async () => { await reload(); setEditing(false); setDone(true); }} />
      )}
    </section>
  );
}

function ReviewForm({ existing, onSaved }: { existing?: Review | null; onSaved: () => Promise<void> }) {
  const api = useGrowApi();
  const { coachName, clientName } = useAppInfo();
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [showName, setShowName] = useState(existing ? existing.name !== null : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = reviewProblem(stars, body);
  const save = async () => {
    if (!api || problem) return;
    setBusy(true); setError(null);
    try { await api.saveReview(stars, body, showName); await onSaved(); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); setError(m === GROW_NEEDS_UPDATE ? `Reviews aren't switched on yet. Let ${coachName} know.` : m); }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <StarPicker value={stars} onChange={setStars} />
      {stars > 0 && (
        <>
          <label className="stack" style={{ gap: 6 }}>
            <span className="tiny">What's it like training with {coachName}? <span className="num">{REVIEW_MAX - body.trim().length}</span></span>
            <textarea className="field" rows={4} maxLength={REVIEW_MAX} placeholder="What changed for you, and what you'd tell a friend." value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <label className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--act)", flex: "none" }} />
            <span className="grow small">Show my name as <b>{shortName(clientName) || "first name and initial"}</b> on the page. Untick to post it as "A client".</span>
          </label>
          {error && <div className="small" role="alert" style={{ color: "var(--crit)" }}>{error}</div>}
          {body.trim() && problem && <div className="tiny">{problem}</div>}
          <button className="btn act block" disabled={busy || !!problem} onClick={() => void save()}>{busy ? "Sending…" : existing ? "Save changes" : `Send to ${coachName}`}</button>
          {existing?.approved && <p className="tiny" style={{ margin: 0 }}>Changes go back to {coachName} before they show on the page again.</p>}
        </>
      )}
    </div>
  );
}

function Thanks({ offer, coachName, review, onClose, say }: { offer: GrowOffer; coachName: string; review: Review | null; onClose: () => void; say?: (m: string) => void }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8 }}><Icons.check width={20} height={20} style={{ color: "var(--good)" }} /><h2 className="h3" style={{ margin: 0 }}>Thank you. {coachName} will see it.</h2></div>
      {offer.googleReviewUrl && review ? (
        <>
          <p className="small" style={{ margin: 0 }}>Happy to post it on Google too? It helps people nearby find {coachName}. We'll copy your words so you can paste them.</p>
          <GoogleButton url={offer.googleReviewUrl} body={review.body} say={say} />
        </>
      ) : null}
      <button className="btn ghost sm" onClick={onClose}>Done</button>
    </div>
  );
}

function GoogleButton({ url, body, say }: { url: string; body: string; say?: (m: string) => void }) {
  const go = async () => {
    try { await navigator.clipboard.writeText(body); say?.("Review copied · paste it on Google"); } catch { /* they can type it */ }
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <button className="btn act sm" style={{ alignSelf: "flex-start" }} onClick={() => void go()}><Icons.globe width={14} height={14} /> Post on Google too</button>
  );
}
