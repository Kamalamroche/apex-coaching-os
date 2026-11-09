import { LEAD_STAGES, MODE_LABEL, LEAD_STAGE_LABEL, followUpLabel, sourceLabel, type Lead, type LeadStage } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import { CountUp } from "./motion";
import { teamInitials } from "./team";

/* Leads: the coach's pipeline. Same poster language as Growth: serif numerals, quiet cards, staggered rise.
   Each stage has its own token colour so the strip, the pills and the cards read as one system. */

export const STAGE_TONE: Record<LeadStage, string> = { new: "var(--act)", contacted: "var(--blue)", trial: "var(--viz-3)", client: "var(--good)", lost: "var(--text3)" };

/** The five stages as one strip: how many on each, bar widths by share. Tap a stage to filter. */
export function PipelineStrip({ counts, active, onPick, winRate }: { counts: Record<LeadStage, number>; active: LeadStage | null; onPick: (s: LeadStage | null) => void; winRate: number | null }) {
  const total = LEAD_STAGES.reduce((n, s) => n + counts[s], 0);
  return (
    <section className="ld-strip" aria-label="Pipeline">
      <div className="ld-bar" aria-hidden="true">
        {LEAD_STAGES.map((s, i) => counts[s] > 0 && <span key={s} style={{ flexGrow: counts[s], background: STAGE_TONE[s], ["--i" as string]: i }} />)}
        {total === 0 && <span style={{ flexGrow: 1, background: "var(--line)" }} />}
      </div>
      <div className="ld-stages" role="tablist" aria-label="Filter by stage">
        {LEAD_STAGES.map((s, i) => (
          <button key={s} role="tab" aria-selected={active === s} className="ld-stage" style={{ ["--tone" as string]: STAGE_TONE[s], ["--i" as string]: i }} onClick={() => onPick(active === s ? null : s)}>
            <b className="num"><CountUp value={counts[s]} duration={700} /></b>
            <span>{LEAD_STAGE_LABEL[s]}</span>
          </button>
        ))}
      </div>
      {winRate !== null && <p className="ld-win"><b className="num">{winRate}%</b> of decided leads became clients</p>}
    </section>
  );
}

/** One lead in the pipeline. The whole card opens it. */
export function LeadCard({ lead, today, i = 0, onOpen, children }: { lead: Lead; today: string; i?: number; onOpen?: () => void; children?: ReactNode }) {
  const days = Math.floor((Date.now() - Date.parse(lead.at)) / 86_400_000);
  const when = days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  const open = lead.stage !== "client" && lead.stage !== "lost";
  const due = open && lead.followUp && lead.followUp <= today;
  return (
    <article className={`ld-card st-${lead.stage}${due ? " due" : ""}`} style={{ ["--tone" as string]: STAGE_TONE[lead.stage], ["--i" as string]: Math.min(i, 8) }}>
      <button className="ld-open" onClick={onOpen} aria-label={`Open ${lead.name}`}>
        <span className="tm-av" aria-hidden="true">{teamInitials(lead.name)}</span>
        <span className="grow">
          <b>{lead.name}</b>
          <small>{when}{lead.goal ? ` · ${lead.goal}` : ""}{lead.how ? ` · ${MODE_LABEL[lead.how]}` : ""}</small>
        </span>
        <span className="ld-pill">{LEAD_STAGE_LABEL[lead.stage]}</span>
      </button>
      <div className="ld-tags">
        <span className="ld-tag">{lead.referredBy ? <><Icons.five width={12} height={12} /> Sent by {lead.referredBy}</> : <><Icons.link width={12} height={12} /> {sourceLabel(lead.source)}</>}</span>
        {open && lead.followUp && <span className={`ld-tag${due ? " due" : ""}`}><Icons.clock width={12} height={12} /> {followUpLabel(lead.followUp, today)}</span>}
        {lead.welcomedAt && <span className="ld-tag"><Icons.mail width={12} height={12} /> Welcomed</span>}
      </div>
      {lead.message && <p className="gr-msg">{lead.message}</p>}
      {lead.notes && <p className="ld-note"><Icons.note width={13} height={13} /> {lead.notes}</p>}
      {children && <footer>{children}</footer>}
    </article>
  );
}

/** Pick a stage: five pills in pipeline order. */
export function StageChips({ stage, onPick }: { stage: LeadStage; onPick: (s: LeadStage) => void }) {
  return (
    <div className="ld-chips" role="radiogroup" aria-label="Stage">
      {LEAD_STAGES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={stage === s} className="ld-chip" style={{ ["--tone" as string]: STAGE_TONE[s] }} onClick={() => onPick(s)}>{LEAD_STAGE_LABEL[s]}</button>
      ))}
    </div>
  );
}

/** What the welcome email will look like in the person's inbox. */
export function WelcomePreview({ coachName, body }: { coachName: string; body: string }) {
  const first = coachName.split(" ")[0] || coachName;
  return (
    <figure className="ld-mail" aria-label="Welcome email preview">
      <header><span className="ld-mail-from"><Icons.logo width={14} height={14} /> {coachName} via APEX</span><span className="tiny">Just now</span></header>
      <b className="ld-mail-subj">Thanks for getting in touch · {coachName}</b>
      {body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
      <p className="ld-mail-sign">{first}</p>
    </figure>
  );
}
