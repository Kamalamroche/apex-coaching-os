import { HERO_IMAGES, formatPrice, type HeroImage } from "@apex/core";
import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop } from "./primitives";
import "./programmes.css";

/* On-demand programmes: poster cards in the Daylight language. Studio photo, Roman capitals,
   glass pills, one orange action. Same look for the coach's shop, the client's shop and the public page. */

export interface PosterData {
  title: string;
  tagline?: string;
  cover: HeroImage;
  level: string;
  weeks: number;
  perWeek: number;
  pricePence: number;
}

const facts = (p: PosterData) => `${p.weeks} week${p.weeks === 1 ? "" : "s"} · ${p.perWeek} day${p.perWeek === 1 ? "" : "s"} a week`;

/** One programme as a poster. `badge` sits top left (Live, Draft, Yours); the price sits top right. */
export function ProgrammePoster({ p, badge, i = 0, onOpen, children, tall = false }: { p: PosterData; badge?: ReactNode; i?: number; onOpen?: () => void; children?: ReactNode; tall?: boolean }) {
  const art = HERO_IMAGES[p.cover] ?? HERO_IMAGES.squat;
  const body = (
    <>
      <HeroBackdrop art={art} word={null} />
      <div className="hero-top">
        {badge ?? <span className="gpill dim caps">{p.level}</span>}
        <span className={`gpill num pg-price${p.pricePence ? "" : " free"}`}>{formatPrice(p.pricePence)}</span>
      </div>
      <div className="hero-body">
        <EditorialTitle as="h3" text={p.title} caption={facts(p)} />
        {p.tagline && <p className="pg-tag">{p.tagline}</p>}
        {children}
      </div>
    </>
  );
  const cls = `hero pg-poster${tall ? " tall" : ""}`;
  const style = { ["--i" as string]: Math.min(i, 8) };
  return onOpen
    ? <button type="button" className={cls} style={style} onClick={onOpen} aria-label={`${p.title}, ${formatPrice(p.pricePence)}`}>{body}</button>
    : <article className={cls} style={style}>{body}</article>;
}

/** Big cover for one programme: the detail page. */
export function ProgrammeCover({ p, top, children }: { p: PosterData; top?: ReactNode; children?: ReactNode }) {
  const art = HERO_IMAGES[p.cover] ?? HERO_IMAGES.squat;
  return (
    <section className="hero pg-cover">
      <HeroBackdrop art={art} word={null} />
      <div className="hero-top">
        {top ?? <span className="gpill dim caps">{p.level}</span>}
        <span className={`gpill num pg-price${p.pricePence ? "" : " free"}`}>{formatPrice(p.pricePence)}</span>
      </div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={p.title} caption={facts(p)} />
        {p.tagline && <p className="pg-tag">{p.tagline}</p>}
        {children}
      </div>
    </section>
  );
}

/** Coach's shop header: how the programmes are doing. */
export function ShopHero({ live, members, revenuePence, waiting, children }: { live: number; members: number; revenuePence: number; waiting: number; children?: ReactNode }) {
  return (
    <section className="hero pg-shop">
      <HeroBackdrop art={HERO_IMAGES.dumbbell} word={null} />
      <div className="hero-top">
        <span className="gpill dim caps">On demand</span>
        {waiting > 0 && <span className="gpill pg-wait"><Icons.bell /> {waiting} waiting</span>}
      </div>
      <div className="hero-body">
        <EditorialTitle as="h1" text="Programmes" caption="Build once · sell to many" />
        <div className="pg-stats">
          <span style={{ ["--i" as string]: 0 }}><b><CountUp value={live} duration={900} /></b><small>live</small></span>
          <span style={{ ["--i" as string]: 1 }}><b><CountUp value={members} duration={1000} /></b><small>{members === 1 ? "member" : "members"}</small></span>
          <span style={{ ["--i" as string]: 2 }}><b>£<CountUp value={Math.round(revenuePence / 100)} duration={1200} /></b><small>taken</small></span>
        </div>
        {children}
      </div>
    </section>
  );
}

/** "What's included", with a tick on each line. */
export function IncludesList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="pg-includes">
      {items.map((t, i) => <li key={t + i} style={{ ["--i" as string]: i }}><span aria-hidden="true"><Icons.check /></span>{t}</li>)}
    </ul>
  );
}

/** Week 1 at a glance. */
export function WeekOutline({ days }: { days: { day: string; name: string; exercises: number; minutes: number }[] }) {
  return (
    <ol className="pg-week">
      {days.map((d, i) => (
        <li key={d.day + i} style={{ ["--i" as string]: i }}>
          <span className="pg-day">{d.day}</span>
          <span><b>{d.name}</b>
          <small>{d.exercises} exercise{d.exercises === 1 ? "" : "s"}{d.minutes ? ` · ${d.minutes} min` : ""}</small></span>
        </li>
      ))}
    </ol>
  );
}

/** Small facts row under a cover: icon, value, label. */
export function ProgrammeFacts({ items }: { items: [IconName, string, string][] }) {
  return (
    <div className="pg-facts">
      {items.map(([icon, v, l], i) => { const I = Icons[icon]; return <span key={l} style={{ ["--i" as string]: i }}><I width={16} height={16} /><b>{v}</b><small>{l}</small></span>; })}
    </div>
  );
}

/** Cover picker for the coach: the HELIX studio set as thumbnails. */
export function CoverPicker({ value, options, onChange }: { value: HeroImage; options: HeroImage[]; onChange: (c: HeroImage) => void }) {
  return (
    <div className="pg-covers" role="radiogroup" aria-label="Cover photo">
      {options.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={HERO_IMAGES[c].word} className="pg-cov" onClick={() => onChange(c)}>
          <img src={HERO_IMAGES[c].src} alt="" style={{ objectPosition: HERO_IMAGES[c].focus }} loading="lazy" />
          {value === c && <span className="pg-cov-tick"><Icons.check /></span>}
        </button>
      ))}
    </div>
  );
}
