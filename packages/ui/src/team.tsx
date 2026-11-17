import { HERO_IMAGES, LEVELS, agoText, feedDay, heroForPost, postFigure, rankEffort, type EffortLine, type TeamDraft, type TeamPost, type TeamPostKind } from "@apex/core";
import { useUnits } from "./prefs";
import { useState, type ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { CountUp, Rolling } from "./motion";
import { EditorialTitle, HeroBackdrop } from "./primitives";

/* Team: the same poster language as Today. Workout and distance posts sit on our studio photos, milestones and levels
   lead with a big light number, coach notes read like a quote. High fives burst and roll; the effort board rises as a podium. */

const KIND: Record<TeamPostKind, [IconName, string]> = {
  workout: ["train", "Workout"], milestone: ["trophy", "Milestone"], distance: ["run", "Distance"],
  streak: ["flame", "Streak"], level: ["spark", "Level"], note: ["note", "Coach note"],
};

export const teamInitials = (name: string) => name.replace(/\./g, "").split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

/** The poster at the top of the team screens: studio photo, big word, glass pills. */
/** The team's own studio still: two of our athletes mid high five. */
export const TEAM_ART = { src: "/hero/team.webp", cut: "/hero/team-cut.webp", focus: "center 40%", word: "Team", ink: "light" as const };

export function TeamHero({ eyebrow, title, pills, children }: { eyebrow: string; title: string; pills: { icon: IconName; text: string }[]; children?: ReactNode }) {
  return (
    <div className="hero tm-hero">
      <HeroBackdrop art={TEAM_ART} />
      <div className="hero-top"><span className="gpill dim caps">{eyebrow}</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={title} caption="Train together" />
        {pills.length > 0 && (
          <div className="gpills">
            {pills.map((p, i) => { const I = Icons[p.icon]; return <span key={p.text} className="gpill num" style={{ ["--i" as string]: i }}><I /> {p.text}</span>; })}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** High five: the hand pops, a ring of sparks bursts out, the count rolls. */
function FiveButton({ p, onFive }: { p: TeamPost; onFive?: () => void }) {
  const [burst, setBurst] = useState(0);
  return (
    <button
      className={`tm-five${p.iFived ? " on" : ""}`} aria-pressed={p.iFived} disabled={!onFive}
      onClick={() => { if (!p.iFived) setBurst((n) => n + 1); onFive?.(); }}
      aria-label={p.iFived ? `Take back your high five (${p.fives})` : `High five ${p.author} (${p.fives})`}
    >
      <span className="tm-hand">
        <Icons.five key={`h${burst}`} width={17} height={17} className={burst ? "tm-pop" : undefined} />
        {burst > 0 && <span key={`b${burst}`} className="tm-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, k) => <i key={k} style={{ ["--a" as string]: `${k * 45}deg` }} />)}</span>}
      </span>
      <Rolling text={String(p.fives)} className="num tm-count" />
      <span className="tm-five-label">{p.fives === 1 ? "high five" : "high fives"}</span>
    </button>
  );
}

function Who({ p, now, onRemove, glass }: { p: TeamPost; now?: Date; onRemove?: () => void; glass?: boolean }) {
  return (
    <header className={`tm-head${glass ? " glass" : ""}`}>
      <span className={`tm-av${p.isCoach ? " coach" : ""}`} aria-hidden="true">{teamInitials(p.author)}</span>
      <span className="tm-who">
        <b>{p.isMe ? `${p.author} (you)` : p.author}{p.isCoach && <em className="tm-coach">Coach</em>}</b>
        <small>{agoText(p.at, now)}</small>
      </span>
      {onRemove && <button className="tm-rm" onClick={onRemove} aria-label={`Remove ${p.author}'s post`}><Icons.trash width={15} height={15} /></button>}
    </header>
  );
}

function PhotoTitle({ title }: { title: string }) {
  const m = /^(finished)\s+(.+)$/i.exec(title);
  if (!m) return <EditorialTitle as="h3" text={title} />;
  const [name, kind] = m[2]!.split(" · ");
  return <EditorialTitle as="h3" text={name!} caption={kind ? `${m[1]} · ${kind}` : m[1]} />;
}

/** Every rung of our level ladder, lit up to this one. */
function LevelLadder({ level }: { level: number }) {
  return (
    <span className="tm-ladder" aria-label={`Level ${level} of ${LEVELS.length}`}>
      {LEVELS.map((l, k) => <i key={l.name} className={k < level ? (k === level - 1 ? "on now" : "on") : undefined} style={{ ["--k" as string]: k }} />)}
    </span>
  );
}

/** One post, drawn for its kind. */
export function TeamPostItem({ p: saved, onFive, onRemove, now, i = 0 }: { p: TeamPost; onFive?: () => void; onRemove?: () => void; now?: Date; i?: number }) {
  // Posts are saved in kg and km; each teammate reads them in their own units.
  const u = useUnits();
  const p = { ...saved, title: u.kt(saved.title), ...(saved.detail ? { detail: u.kt(saved.detail) } : {}) };
  const hero = heroForPost(p);
  const fig = postFigure(p);
  const [icon, label] = KIND[p.kind];
  const I = Icons[icon];
  const style = { ["--i" as string]: Math.min(i, 8) };
  const fresh = p.isMe && Date.now() - Date.parse(p.at) < 90_000 ? " fresh" : "";
  if (hero) {
    const art = HERO_IMAGES[hero];
    const bits = (p.detail ?? "").split(" · ").filter(Boolean);
    return (
      <article className={`tm-post photo${fresh}`} style={style}>
        <div className="tm-photo">
          <img src={art.src} alt="" style={{ objectPosition: art.focus }} loading="lazy" />
          <Who p={p} now={now} onRemove={onRemove} glass />
          <div className="tm-photo-body">
            <span className="gpill dim caps"><I /> {label}</span>
            {fig ? <div className="tm-fig light"><b className="num">{fig.value}</b><span>{fig.unit}</span></div> : <PhotoTitle title={p.title} />}
            {bits.length > 0 && <div className="gpills">{bits.map((b) => <span key={b} className="gpill num">{b}</span>)}</div>}
            <footer className="tm-foot glass"><FiveButton p={p} onFive={onFive} /></footer>
          </div>
        </div>
      </article>
    );
  }
  if (p.kind === "note") {
    return (
      <article className={`tm-post quote${fresh}`} style={style}>
        <Who p={p} now={now} onRemove={onRemove} />
        <blockquote className="tm-note">{p.title}</blockquote>
        {p.detail && <small className="tm-detail">{p.detail}</small>}
        <footer className="tm-foot"><FiveButton p={p} onFive={onFive} /></footer>
      </article>
    );
  }
  return (
    <article className={`tm-post figure k-${p.kind}${fresh}`} style={style}>
      <Who p={p} now={now} onRemove={onRemove} />
      <div className="tm-figure">
        <span className="tm-eyebrow"><I width={13} height={13} /> {label}</span>
        {fig ? <div className="tm-fig"><b className="num">{fig.value}</b><span>{fig.unit}</span></div> : <h3 className="tm-plain">{p.title}</h3>}
        {p.detail && <small className="tm-detail">{p.detail}</small>}
        {p.kind === "level" ? <LevelLadder level={Number(fig?.value) || 1} /> : <span className="tm-steps" aria-hidden="true"><i /><i /><i /></span>}
      </div>
      <footer className="tm-foot"><FiveButton p={p} onFive={onFive} /></footer>
    </article>
  );
}

export function TeamFeed({ posts, onFive, onRemove, canRemove, now }: { posts: TeamPost[]; onFive?: (id: string) => void; onRemove?: (p: TeamPost) => void; canRemove?: (p: TeamPost) => boolean; now?: Date }) {
  return (
    <div className="tm-feed">
      {posts.map((p, i) => {
        const day = feedDay(p.at, now);
        const head = i === 0 || feedDay(posts[i - 1]!.at, now) !== day;
        return (
          <div key={p.id} className="tm-slot">
            {head && <div className="tm-day" style={{ ["--i" as string]: Math.min(i, 8) }}><span>{day}</span></div>}
            <TeamPostItem p={p} i={i} now={now} onFive={onFive ? () => onFive(p.id) : undefined} onRemove={onRemove && (canRemove?.(p) ?? true) ? () => onRemove(p) : undefined} />
          </div>
        );
      })}
    </div>
  );
}

/** Effort only: the top three rise as a podium, the rest follow as bars. Never weight or measurements. */
export function EffortBoard({ lines, week, limit = 6 }: { lines: EffortLine[]; week: string; limit?: number }) {
  const ranked = rankEffort(lines);
  const most = Math.max(1, ...ranked.map((l) => l.minutes));
  const podium = ranked.slice(0, 3);
  // Second, first, third: the winner stands in the middle.
  const order = [podium[1], podium[0], podium[2]].filter((l): l is (typeof ranked)[number] => !!l);
  const rest = ranked.slice(3, limit);
  const me = ranked.find((l) => l.isMe);
  const restShown = me && ranked.indexOf(me) >= limit ? [...rest, me] : rest;
  return (
    <section className="tm-board" aria-label="Effort this week">
      <div className="tm-board-top"><span className="tm-eyebrow">Effort this week</span><small className="num">{week}</small></div>
      {ranked.length ? (
        <>
          <ol className="tm-podium">
            {order.map((l) => (
              <li key={l.name} className={`${l.place === 1 ? "first" : ""}${l.isMe ? " me" : ""}`} style={{ ["--h" as string]: 0.45 + 0.55 * (l.minutes / most), ["--d" as string]: l.place === 1 ? "0.25s" : l.place === 2 ? "0.1s" : "0.4s" }}>
                <span className={`tm-av${l.isMe ? " me" : ""}`} aria-hidden="true">{teamInitials(l.name)}</span>
                <b className="tm-pname">{l.isMe ? "You" : l.name}</b>
                <span className="tm-block">
                  <span className="tm-place num">{l.place}</span>
                  <span className="tm-mins num"><CountUp value={l.minutes} duration={1200} /> min</span>
                  <small className="num">{l.workouts} workout{l.workouts === 1 ? "" : "s"}</small>
                </span>
              </li>
            ))}
          </ol>
          {restShown.length > 0 && (
            <ol className="tm-rest">
              {restShown.map((l, i) => (
                <li key={`${l.name}-${i}`} className={l.isMe ? "me" : undefined} style={{ ["--i" as string]: i }}>
                  <span className="num tm-rplace">{l.place}</span>
                  <span className="grow">
                    <span className="tm-line"><b>{l.isMe ? `${l.name} (you)` : l.name}</b><small className="num">{l.workouts} · {l.minutes} min</small></span>
                    <span className="tm-bar"><i style={{ ["--p" as string]: l.minutes / most }} /></span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="tiny" style={{ margin: "8px 0 0" }}>Nobody has trained yet this week.</p>
      )}
      <p className="tm-fine">Workouts and active minutes only. Never weight, measurements or photos.</p>
    </section>
  );
}

/** What the team will see, before it goes. */
export function TeamDraftPreview({ draft, author }: { draft: TeamDraft; author: string }) {
  return <TeamPostItem p={{ id: "draft", ...draft, at: new Date().toISOString(), author, isCoach: false, isMe: false, fives: 0, iFived: false }} />;
}
