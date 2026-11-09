import { HERO_IMAGES, MODE_LABEL, type CoachPage, type JoinRequest } from "@apex/core";
import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { ReviewQuote, ReviewScore } from "./reviews";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop } from "./primitives";
import { TEAM_ART, teamInitials } from "./team";

/* Growth: the coach's public page, the coach's share card for it, and the client's invite-a-friend card.
   Same poster language as Today and Team: studio photo, Roman capitals, glass pills, staggered rise. */

const COACH_ART = HERO_IMAGES.coach;

const OFFER: [IconName, string, string][] = [
  ["build", "A plan built for you", "Written around your goal, your week and your kit."],
  ["play", "Guided sessions", "Every set, rest and cue in your pocket."],
  ["chat", "A coach who checks in", "Weekly check-ins and messages, not a template."],
  ["progress", "Progress you can see", "Stronger lifts, closed rings, real milestones."],
];

/** The public page itself. Also used as the coach's live preview. */
/** Extras from the growth tools: the free first session and approved reviews. */
export interface PageReviews { introOffer: boolean; reviews: { name: string | null; stars: number; body: string; at: string }[] }

export function CoachPageView({ page, action, preview = false, extras }: { page: CoachPage; action?: ReactNode; preview?: boolean; extras?: PageReviews | null }) {
  const first = page.name.split(" ")[0] || page.name;
  const caption = ["Coach", page.city].filter(Boolean).join(" · ");
  return (
    <div className={`gr-page${preview ? " preview" : ""}`}>
      <section className="hero gr-hero">
        <HeroBackdrop art={COACH_ART} word={null} />
        <div className="hero-top">
          <span className="gpill dim caps">Train with me</span>
          {page.modes.length > 0 && <span className="gpill dim caps">{page.modes.map((m) => MODE_LABEL[m]).join(" · ")}</span>}
        </div>
        <div className="hero-body">
          <EditorialTitle as="h1" text={page.name || "Your name"} caption={caption} />
          {page.headline && <p className="gr-headline">{page.headline}</p>}
          {page.specialties.length > 0 && (
            <div className="gpills">{page.specialties.map((s, i) => <span key={s} className="gpill" style={{ ["--i" as string]: i }}>{s}</span>)}</div>
          )}
          {extras?.introOffer && <span className="gr-intro"><Icons.gift width={14} height={14} aria-hidden /> First session free</span>}
          {action}
        </div>
      </section>
      {page.clients !== null && page.clients > 0 && (
        <div className="gr-count">
          <b><CountUp value={page.clients} duration={1100} /></b>
          <span>{page.clients === 1 ? "client" : "clients"} training with {first} right now</span>
        </div>
      )}
      <section className="gr-offer" aria-label="What you get">
        <span className="gr-eyebrow">What you get</span>
        <ul>
          {OFFER.map(([icon, t, s], i) => { const I = Icons[icon]; return <li key={t} style={{ ["--i" as string]: i }}><I width={18} height={18} /><b>{t}</b><span>{s}</span></li>; })}
        </ul>
      </section>
      {page.bio && (
        <section className="gr-about">
          <span className="gr-eyebrow">About {first}</span>
          <blockquote>{page.bio}</blockquote>
        </section>
      )}
      {extras && extras.reviews.length > 0 && (
        <section className="gr-reviews" aria-label="What clients say">
          <span className="gr-eyebrow">What clients say</span>
          <ReviewScore average={Math.round((extras.reviews.reduce((t, r) => t + r.stars, 0) / extras.reviews.length) * 10) / 10} count={extras.reviews.length} />
          <div>{extras.reviews.slice(0, 6).map((r, i) => <ReviewQuote key={`${r.at}-${i}`} {...r} i={i} />)}</div>
        </section>
      )}
      <p className="gr-made"><Icons.logo width={12} height={12} /> Made with APEX</p>
    </div>
  );
}

/** Coach's own poster: their page as a share card, with what it has brought in. */
export function GrowHero({ page, fresh, joined, children }: { page: CoachPage; fresh: number; joined: number; children?: ReactNode }) {
  return (
    <div className="hero gr-hero coach">
      <HeroBackdrop art={COACH_ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">{page.published ? "Live" : "Draft"}</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text="Train with me" caption="Your page · your link" />
        <div className="gpills">
          <span className="gpill num" style={{ ["--i" as string]: 0 }}><Icons.mail /> {fresh} new</span>
          <span className="gpill num" style={{ ["--i" as string]: 1 }}><Icons.clients /> {joined} joined</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One request to train, with the coach's actions. */
export function RequestItem({ r, i = 0, children }: { r: JoinRequest; i?: number; children?: ReactNode }) {
  const days = Math.floor((Date.now() - Date.parse(r.at)) / 86_400_000);
  const when = days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  return (
    <article className={`gr-req s-${r.status}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
      <header>
        <span className="tm-av" aria-hidden="true">{teamInitials(r.name)}</span>
        <span className="grow">
          <b>{r.name}</b>
          <small>{when}{r.goal ? ` · ${r.goal}` : ""}</small>
        </span>
        <span className={`gr-state s-${r.status}`}>{r.status === "new" ? "New" : r.status === "invited" ? "Invited" : r.status === "joined" ? "Joined" : "Declined"}</span>
      </header>
      {r.referredBy && <p className="gr-ref"><Icons.five width={13} height={13} /> Sent by {r.referredBy}</p>}
      {r.message && <p className="gr-msg">{r.message}</p>}
      {children && <footer>{children}</footer>}
    </article>
  );
}

/** Client: bring a friend. The team photo, Roman capitals, and how many friends came. */
export function InviteFriendCard({ coachName, asked, joined, children }: { coachName: string; asked: number; joined: number; children?: ReactNode }) {
  return (
    <section className="hero gr-invite">
      <HeroBackdrop art={TEAM_ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">Invite a friend</span></div>
      <div className="hero-body">
        <EditorialTitle as="h2" text="Bring a friend" caption={`Train with ${coachName}`} />
        <div className="gpills">
          <span className="gpill num" style={{ ["--i" as string]: 0 }}><Icons.mail /> {asked} asked</span>
          <span className="gpill num" style={{ ["--i" as string]: 1 }}><Icons.five /> {joined} joined</span>
        </div>
        {children}
      </div>
    </section>
  );
}
