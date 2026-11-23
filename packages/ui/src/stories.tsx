import { storyLines, type IncomePlan, type StoryKey, type StoryNumbers } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import "./stories.css";

/** One client success story: a headline, the real numbers, the client's words. Children: buttons (coach side). */
export function SuccessStoryCard({ headline, numbers, shown, quote, name, i = 0, note, children }: {
  headline: string; numbers: StoryNumbers; shown: StoryKey[]; quote: string; name: string | null; i?: number; note?: ReactNode; children?: ReactNode;
}) {
  const lines = storyLines(numbers, shown).slice(0, 3);
  return (
    <article className="sg-story" style={{ ["--i" as string]: i }} aria-label={headline}>
      <h3>{headline}</h3>
      {lines.length > 0 && (
        <div className="sg-nums">
          {lines.map((l) => <div key={l.key}><b className="num">{l.value}</b><span>{l.label}</span></div>)}
        </div>
      )}
      {quote.trim() && <blockquote>“{quote.trim()}”</blockquote>}
      <div className="sg-by">
        <Icons.check width={13} height={13} aria-hidden />
        <span>{name ? `${name} · ` : ""}Real numbers from their training, shared with their permission</span>
      </div>
      {note}
      {children && <div className="sg-actions">{children}</div>}
    </article>
  );
}

/** The free starter plan on a trainer's page. Children: the form or button. */
export function StarterOffer({ title, tagline, weeks, cover, children }: { title: string; tagline: string; weeks: number; cover?: string | null; children?: ReactNode }) {
  return (
    <section className="sg-starter" aria-label="Free starter plan">
      {cover && <img src={cover} alt="" loading="lazy" />}
      <div className="sg-starter-body">
        <span className="sg-eyebrow"><Icons.gift width={13} height={13} aria-hidden /> Free starter plan · {weeks} week{weeks === 1 ? "" : "s"}</span>
        <h2>{title}</h2>
        {tagline && <p>{tagline}</p>}
        {children}
      </div>
    </section>
  );
}

/** Monthly income against the goal. */
export function GoalMeter({ plan }: { plan: IncomePlan }) {
  const pct = plan.progressPct;
  const money = (p: number) => `£${Math.round(p / 100).toLocaleString("en-GB")}`;
  return (
    <div className="sg-meter" role="img" aria-label={`${money(plan.nowPence)} of ${money(plan.goalPence)} a month, ${pct}%`}>
      <div className="sg-meter-top"><b className="num">{money(plan.nowPence)}</b><span>of {money(plan.goalPence)} a month</span><em className="num">{pct}%</em></div>
      <div className="sg-bar"><i style={{ width: `${pct}%` }} className={plan.reached ? "done" : ""} /></div>
      {!plan.reached && plan.feePence !== null && (
        <div className="sg-meter-facts">
          <div><b className="num">{plan.clientsNeeded}</b><span>more client{plan.clientsNeeded === 1 ? "" : "s"}</span></div>
          <div><b className="num">{plan.leadsPerWeek}</b><span>enquir{plan.leadsPerWeek === 1 ? "y" : "ies"} a week</span></div>
          <div><b className="num">{plan.winPct}%</b><span>{plan.winAssumed ? "win rate (a guess)" : "your win rate"}</span></div>
        </div>
      )}
    </div>
  );
}
