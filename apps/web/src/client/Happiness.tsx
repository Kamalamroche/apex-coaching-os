import { HAPPINESS_COMMENT_MAX, happinessBand, happinessDue, type HappinessAnswer } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons, ScorePicker } from "@apex/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { InviteFriend } from "../app/GrowthParts";
import { useAppInfo } from "../app/AppContext";
import { MARKETING_NEEDS_UPDATE, useMarketingApi } from "../data/marketing";
import { useStore } from "../data/StoreContext";
import { ReviewForm, useMyReview } from "./Review";

const SNOOZE_KEY = "apex-happiness-snooze";
const readSnooze = () => { try { return localStorage.getItem(SNOOZE_KEY); } catch { return null; } };
const snooze = () => { try { localStorage.setItem(SNOOZE_KEY, new Date().toISOString()); } catch { /* this visit only */ } };
const DAY = 86400000;

/** Today: every three months, "How likely are you to recommend your coach?". Happy clients are then invited to
    review and bring a friend while it's fresh; anyone unhappy is told their coach will be in touch.
    Shows `fallback` (the review ask) when the check isn't due, so a client never gets two asks at once. */
export function HappinessPrompt({ say, fallback }: { say?: (m: string) => void; fallback?: ReactNode }) {
  const api = useMarketingApi();
  const store = useStore();
  const { history } = useApexState(store);
  const { coachName } = useAppInfo();
  const [mine, setMine] = useState<HappinessAnswer[] | null>(null);
  const [snoozedAt, setSnoozedAt] = useState(readSnooze);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const load = useCallback(() => { api?.happiness().then(setMine, () => setMine(null)); }, [api]);
  useEffect(load, [load]);
  if (!api || api.side !== "client") return <>{fallback}</>;
  const sessions = history.sessions ?? [];
  const oldest = sessions.reduce((m, s) => Math.min(m, Date.parse(s.at)), Date.now());
  const due = mine !== null && happinessDue({ daysWithCoach: Math.floor((Date.now() - oldest) / DAY), lastAnsweredAt: mine[0]?.at ?? null, snoozedAt, now: new Date() });
  if (sent !== null) return <AfterAnswer score={sent} say={say} onClose={() => setSent(null)} />;
  if (!due) return <>{fallback}</>;

  const band = score === null ? null : happinessBand(score);
  const send = async () => {
    if (score === null) return;
    setBusy(true); setError(null);
    try { await api.answer(score, comment); setSent(score); load(); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); setError(m === MARKETING_NEEDS_UPDATE ? `This isn't switched on yet. Let ${coachName} know.` : m); }
    setBusy(false);
  };
  return (
    <section className="card stack" aria-label="Quick question" style={{ gap: 12 }}>
      <div className="sect" style={{ marginBottom: 0 }}>
        <h2 className="h3">One quick question</h2>
        <button className="iconbtn" aria-label="Not now" onClick={() => { snooze(); setSnoozedAt(new Date().toISOString()); }}><Icons.close width={16} height={16} /></button>
      </div>
      <p className="small" style={{ margin: 0 }}>How likely are you to recommend {coachName} to a friend?</p>
      <ScorePicker value={score} onPick={setScore} />
      {band && (
        <label className="stack" style={{ gap: 6 }}>
          <span className="tiny">{band === "promoter" ? `What do you like most about training with ${coachName}? (optional)` : "What would make it a 10? (optional)"}</span>
          <textarea className="field" rows={2} maxLength={HAPPINESS_COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      )}
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--crit)" }}>{error}</p>}
      {score !== null && <button className="btn act block" disabled={busy} onClick={() => void send()}>{busy ? "Sending…" : "Send"}</button>}
      <p className="tiny" style={{ margin: 0 }}>Only {coachName} sees your answer. We ask every three months.</p>
    </section>
  );
}

/** Straight after answering: a fan gets the review and invite asks; anyone else a thank-you. */
function AfterAnswer({ score, say, onClose }: { score: number; say?: (m: string) => void; onClose: () => void }) {
  const { coachName } = useAppInfo();
  const { state, reload } = useMyReview();
  const [reviewed, setReviewed] = useState(false);
  const band = happinessBand(score);
  const close = <button className="iconbtn" aria-label="Close" onClick={onClose}><Icons.close width={16} height={16} /></button>;
  if (band !== "promoter") {
    return (
      <section className="card stack" style={{ gap: 10 }}>
        <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">Thank you</h2>{close}</div>
        <p className="small" style={{ margin: 0 }}>{band === "detractor" ? `Thanks for being honest. ${coachName} will see this and get in touch to make training work better for you.` : `Thanks. ${coachName} reads every answer and uses them to make coaching better.`}</p>
      </section>
    );
  }
  const canReview = !!state && !state.review && !reviewed;
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h3">That means a lot</h2>{close}</div>
      {canReview ? (
        <>
          <p className="small" style={{ margin: 0 }}>Would you say it on {coachName}'s page? A sentence or two helps people decide to start.</p>
          <ReviewForm onSaved={async () => { setReviewed(true); await reload(); say?.(`Sent · ${coachName} will see it first`); }} />
        </>
      ) : (
        <p className="small" style={{ margin: 0 }}>{reviewed ? "Thanks for the review." : `Thanks, ${coachName} will be glad to hear it.`} Know someone who'd like this too?</p>
      )}
      {say && !canReview && <InviteFriend say={say} />}
    </section>
  );
}
