import { fromPriceText, modesText, type TrainerCard } from "@apex/core";
import type { ReactNode } from "react";
import { Icons } from "./icons";
import { Stars } from "./reviews";
import "./marketplace.css";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** "Verified": a checked qualification and checked insurance. */
export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`ft-verified${compact ? " compact" : ""}`} title="Qualification and insurance checked by APEX">
      <Icons.verified width={compact ? 14 : 15} height={compact ? 14 : 15} aria-hidden />
      {compact ? <span className="ft-sr">Verified</span> : "Verified"}
    </span>
  );
}

/** One trainer in the directory or a match. Children: the buttons. */
export function TrainerCardView({ trainer: t, href, reasons, rank, i = 0, children }: { trainer: TrainerCard; href?: string; reasons?: string[]; rank?: number; i?: number; children?: ReactNode }) {
  const price = fromPriceText(t.fromPence);
  const name = href ? <a href={href} className="ft-name">{t.name}</a> : <span className="ft-name">{t.name}</span>;
  return (
    <article className={`ft-card${rank === 1 ? " top" : ""}`} style={{ ["--i" as string]: i }} aria-label={t.name}>
      <div className="ft-head">
        <span className="ft-mono" aria-hidden>{initials(t.name)}</span>
        <div className="ft-who">
          {rank !== undefined && <span className="ft-rank">{rank === 1 ? "Best match" : `Match ${rank}`}</span>}
          <h3>{name}{t.verified && <VerifiedBadge compact />}</h3>
          <span className="ft-where">
            {t.city && <><Icons.pin width={13} height={13} aria-hidden /> {t.city} · </>}{modesText(t.modes)}
          </span>
        </div>
      </div>
      {t.headline && <p className="ft-line">{t.headline}</p>}
      <div className="ft-facts">
        {t.rating ? <span className="ft-fact"><Stars value={Math.round(t.rating.average)} size={13} /><b className="num">{t.rating.average.toFixed(1)}</b><span>({t.rating.count})</span></span> : <span className="ft-fact quiet">New to APEX</span>}
        {price && <span className="ft-fact"><b>{price}</b></span>}
        {t.introOffer && <span className="ft-fact good"><Icons.gift width={13} height={13} aria-hidden /> First session free</span>}
        {t.clients ? <span className="ft-fact quiet">{t.clients} clients now</span> : null}
      </div>
      {t.specialties.length > 0 && <div className="ft-tags">{t.specialties.map((s) => <span key={s}>{s}</span>)}</div>}
      {reasons && reasons.length > 0 && (
        <ul className="ft-why" aria-label="Why this trainer">
          {reasons.map((r) => <li key={r}><Icons.check width={14} height={14} aria-hidden />{r}</li>)}
        </ul>
      )}
      {children && <div className="ft-actions">{children}</div>}
    </article>
  );
}

/** On a trainer's page: the badge and the qualification behind it. */
export function TrustStrip({ verified, credentials }: { verified: boolean; credentials: { title: string; issuer: string }[] }) {
  if (!verified && !credentials.length) return null;
  return (
    <section className="ft-trust" aria-label="Checked by APEX">
      <Icons.shield width={20} height={20} aria-hidden />
      <div>
        <b>{verified ? "Qualified and insured" : "Qualification checked"}</b>
        <span>{credentials.length ? credentials.map((c) => `${c.title}, ${c.issuer}`).join(" · ") : "Qualification and insurance"}. Checked by APEX.</span>
      </div>
    </section>
  );
}

/** One step of the quiz: progress dots, the question and its choices. */
export function MatchStepView({ step, of, title, caption, children }: { step: number; of: number; title: string; caption: string; children: ReactNode }) {
  return (
    <div className="ft-step" key={step}>
      <div className="ft-dots" role="progressbar" aria-valuemin={1} aria-valuemax={of} aria-valuenow={step} aria-label={`Question ${step} of ${of}`}>
        {Array.from({ length: of }, (_, n) => <span key={n} className={n < step ? "on" : ""} />)}
      </div>
      <span className="ft-eyebrow">{step} / {of} · {caption}</span>
      <h2 className="ft-q">{title}</h2>
      {children}
    </div>
  );
}
