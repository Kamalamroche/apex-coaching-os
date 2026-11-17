import { HAPPINESS_BAND_LABEL, HERO_IMAGES, happinessBand, type Funnel, type HappinessScore, type PlanKind, type ProofLine } from "@apex/core";
import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop } from "./primitives";
import "./marketing.css";

/* Marketing: the coach's weekly growth plan, happiness score, funnel and page boosts.
   Same poster language as Business and Train with me. Token colours only. */

const ART = { ...HERO_IMAGES.kettlebell, word: "Grow" };

export function MarketingHero({ title, caption, pills, children }: { title: string; caption: string; pills: string[]; children?: ReactNode }) {
  return (
    <div className="hero gy-hero mk-hero">
      <HeroBackdrop art={ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">Marketing</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={title} caption={caption} />
        {pills.length > 0 && <div className="gpills">{pills.map((p, i) => <span key={p} className="gpill num" style={{ ["--i" as string]: i }}>{p}</span>)}</div>}
        {children}
      </div>
    </div>
  );
}

const KIND_ICON: Record<PlanKind, [IconName, string]> = {
  reply: ["mail", "c1"], follow: ["clock", "c4"], unhappy: ["heart", "crit"], review: ["star", "c2"], friend: ["gift", "c3"],
  winback: ["arrow", "c1"], cold: ["phone", "c4"], post: ["share", "c2"], setup: ["globe", "c3"],
};

/** One action in the week's plan: tick it off when done. */
export function PlanItem({ kind, title, why, done, i = 0, onToggle, children }: { kind: PlanKind; title: string; why: string; done: boolean; i?: number; onToggle: () => void; children?: ReactNode }) {
  const [icon, tone] = KIND_ICON[kind];
  const I = Icons[icon];
  return (
    <li className={`mk-plan-item${done ? " done" : ""}`} style={{ ["--i" as string]: i }}>
      <button className="mk-tick" role="checkbox" aria-checked={done} aria-label={done ? `Done: ${title}` : `Mark done: ${title}`} onClick={onToggle}>
        {done ? <Icons.check width={14} height={14} /> : null}
      </button>
      <div className="mk-plan-body">
        <div className="mk-plan-head"><span className={`mi ${tone}`}><I /></span><b>{title}</b></div>
        <p>{why}</p>
        {children && !done && <div className="mk-plan-acts">{children}</div>}
      </div>
    </li>
  );
}

/** Done-this-week dots. */
export function PlanProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="mk-progress" role="img" aria-label={`${done} of ${total} done this week`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? "on" : ""} style={{ ["--i" as string]: i }} />)}
      <span className="num">{done}/{total}</span>
    </div>
  );
}

/** The happiness score (NPS): a big signed number and the split of answers. */
export function HappinessGauge({ score }: { score: HappinessScore }) {
  const parts: [keyof Pick<HappinessScore, "promoters" | "passives" | "detractors">, string, string][] = [
    ["promoters", "good", HAPPINESS_BAND_LABEL.promoter], ["passives", "warn", HAPPINESS_BAND_LABEL.passive], ["detractors", "crit", HAPPINESS_BAND_LABEL.detractor],
  ];
  return (
    <div className="mk-nps">
      <div className="mk-nps-top">
        <b className="mk-nps-num">{score.score > 0 ? "+" : score.score < 0 ? "−" : ""}{Math.abs(score.score)}</b>
        <span>happiness score<br /><small>from {score.count} {score.count === 1 ? "client" : "clients"}, −100 to +100</small></span>
      </div>
      <div className="mk-nps-bar" role="img" aria-label={parts.map(([k, , l]) => `${l}: ${score[k]}`).join(", ")}>
        {parts.map(([k, tone], i) => score[k] > 0 && <i key={k} className={tone} style={{ flex: score[k], ["--i" as string]: i }} />)}
      </div>
      <div className="mk-key">
        {parts.map(([k, tone, l]) => <span key={k}><i className={tone} />{l} <b className="num">{score[k]}</b></span>)}
      </div>
    </div>
  );
}

/** One client's answer, coloured by band. */
export function HappinessRow({ name, score, comment, when }: { name: string; score: number; comment: string; when: string }) {
  const band = happinessBand(score);
  return (
    <li className="mk-answer">
      <span className={`mk-score ${band}`}>{score}</span>
      <div><b>{name}</b> <small>{when}</small>{comment && <p>“{comment}”</p>}</div>
    </li>
  );
}

/** 0–10, one tap. */
export function ScorePicker({ value, onPick }: { value: number | null; onPick: (n: number) => void }) {
  return (
    <div className="mk-pick" role="radiogroup" aria-label="0 is not at all likely, 10 is extremely likely">
      {Array.from({ length: 11 }, (_, n) => (
        <button key={n} role="radio" aria-checked={value === n} className={value === n ? `on ${happinessBand(n)}` : ""} onClick={() => onPick(n)}>{n}</button>
      ))}
      <div className="mk-pick-ends"><span>Not likely</span><span>Very likely</span></div>
    </div>
  );
}

/** Visits → enquiries → clients, with the step-to-step rate, then where they came from. */
export function FunnelView({ funnel }: { funnel: Funnel }) {
  const top = Math.max(1, funnel.steps[0]!.value, ...funnel.steps.map((s) => s.value));
  return (
    <div className="mk-funnel">
      <ol>
        {funnel.steps.map((s, i) => (
          <li key={s.key} style={{ ["--i" as string]: i }}>
            <div className="mk-funnel-label"><span>{s.label}</span>{s.rate !== null && <small className="num">{s.rate}% of the step before</small>}</div>
            <div className="mk-funnel-bar"><i className={`s${i}`} style={{ width: `${Math.max(2, (s.value / top) * 100)}%` }} /><b className="num"><CountUp value={s.value} /></b></div>
          </li>
        ))}
      </ol>
      {funnel.sources.length > 0 && (
        <table className="mk-sources">
          <thead><tr><th>Where from</th><th>Visits</th><th>Asked</th><th>Joined</th></tr></thead>
          <tbody>
            {funnel.sources.slice(0, 6).map((s) => (
              <tr key={s.source} className={funnel.best?.source === s.source ? "best" : ""}>
                <td>{s.label}</td><td className="num">{s.visits || "–"}</td><td className="num">{s.enquiries || "–"}</td><td className="num">{s.clients || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Real totals, big and quiet. */
export function ProofTiles({ lines }: { lines: ProofLine[] }) {
  return (
    <div className="mk-proof">
      {lines.map((l, i) => (
        <div key={l.unit} className="mk-proof-tile" style={{ ["--i" as string]: i }}>
          <b>{l.value}</b>
          <span>{l.unit} {l.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Public page: an honest places-left line. */
export function SpotsBadge({ text, full }: { text: string; full: boolean }) {
  return <span className={`mk-spots${full ? " full" : ""}`}><i aria-hidden /> {text}</span>;
}

/** Public page: the offer while it runs. */
export function OfferBanner({ title, text, ends }: { title: string; text: string; ends: string }) {
  return (
    <section className="mk-offer" aria-label={title}>
      <div className="mk-offer-top"><span className="gr-eyebrow">{title}</span><span className="mk-ends num"><Icons.clock width={12} height={12} aria-hidden /> {ends}</span></div>
      <p>{text}</p>
    </section>
  );
}
