import { HEALTH_BANDS, HERO_IMAGES, pounds, voiceClock, type BizMonth, type GlanceTile, type BizSource, type HealthBand, type HealthPart } from "@apex/core";
import { useEffect, useRef, useState } from "react";
import { Icons } from "./icons";
import { EditorialTitle, HeroBackdrop } from "./primitives";
import "./business.css";

/* Business dashboard, client health and chat tools, in the same poster language as Gym and Sessions.
   Colours come from the token set only: fees = action orange, packs = blue, programme sales = data cyan. */

const ART = { ...HERO_IMAGES.dumbbell, word: "Business" };

export function BusinessHero({ title, caption, pills }: { title: string; caption: string; pills: string[] }) {
  return (
    <div className="hero gy-hero bz-hero">
      <HeroBackdrop art={ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">Business</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={title} caption={caption} />
        {pills.length > 0 && <div className="gpills">{pills.map((p, i) => <span key={p} className="gpill num" style={{ ["--i" as string]: i }}>{p}</span>)}</div>}
      </div>
    </div>
  );
}

const SHORT = (pence: number) => (pence >= 100000 ? `£${(pence / 100000).toFixed(1)}k` : pounds(Math.round(pence / 100) * 100));

/** Six months of income, stacked: monthly fees, session packs, programme sales. */
export function IncomeBars({ months }: { months: BizMonth[] }) {
  const max = Math.max(1, ...months.map((m) => m.totalPence));
  return (
    <div className="bz-income">
      <div className="bz-bars" role="img" aria-label={`Income by month: ${months.map((m) => `${m.label} ${pounds(m.totalPence)}`).join(", ")}`}>
        {months.map((m, i) => {
          const last = i === months.length - 1;
          const h = (p: number) => `${(p / max) * 100}%`;
          return (
            <div key={m.key} className={`bz-col${last ? " now" : ""}`} style={{ ["--i" as string]: i }}>
              <span className="bz-val num">{m.totalPence ? SHORT(m.totalPence) : "–"}</span>
              <div className="bz-stack">
                {m.salesPence > 0 && <i className="s-sales" style={{ height: h(m.salesPence) }} />}
                {m.packsPence > 0 && <i className="s-packs" style={{ height: h(m.packsPence) }} />}
                {m.feesPence > 0 && <i className="s-fees" style={{ height: h(m.feesPence) }} />}
              </div>
              <span className="bz-month">{m.label}</span>
            </div>
          );
        })}
      </div>
      <div className="bz-key">
        <span><i className="s-fees" />Monthly fees</span>
        <span><i className="s-packs" />Session packs</span>
        <span><i className="s-sales" />Programmes</span>
      </div>
    </div>
  );
}

/** New and lost clients each month, as two small bars side by side. */
export function ClientFlow({ months }: { months: BizMonth[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.newClients, m.lostClients)));
  return (
    <div className="bz-flow" role="img" aria-label={months.map((m) => `${m.label}: ${m.newClients} joined, ${m.lostClients} left`).join("; ")}>
      {months.map((m, i) => (
        <div key={m.key} className="bz-flow-col" style={{ ["--i" as string]: i }}>
          <div className="bz-flow-pair">
            <i className="in" style={{ height: `${(m.newClients / max) * 100}%` }} title={`${m.newClients} joined`} />
            <i className="out" style={{ height: `${(m.lostClients / max) * 100}%` }} title={`${m.lostClients} left`} />
          </div>
          <span className="bz-month">{m.label}</span>
        </div>
      ))}
      <div className="bz-key"><span><i className="in" />Joined</span><span><i className="out" />Left</span></div>
    </div>
  );
}

/** Where leads came from and how many became clients. */
export function SourceRows({ sources }: { sources: BizSource[] }) {
  const max = Math.max(1, ...sources.map((s) => s.leads));
  return (
    <ul className="bz-sources">
      {sources.map((s, i) => (
        <li key={s.source} style={{ ["--i" as string]: i }}>
          <div className="bz-src-top"><b>{s.label}</b><span className="num">{s.clients} of {s.leads} joined</span></div>
          <span className="bz-src-bar"><i className="lead" style={{ width: `${(s.leads / max) * 100}%` }} /><i className="won" style={{ width: `${(s.clients / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

const BAND_TONE: Record<HealthBand, string> = { new: "var(--text3)", good: "var(--good)", watch: "var(--warn)", low: "var(--crit)" };

/** A client's health: a small ring with the score, coloured by band. */
export function HealthBadge({ score, band, size = 40 }: { score: number | null; band: HealthBand; size?: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : score / 100;
  return (
    <span className="ch" style={{ width: size, height: size, ["--tone" as string]: BAND_TONE[band] }} aria-label={score === null ? "New client, no score yet" : `Health ${score} of 100, ${HEALTH_BANDS[band]}`} role="img">
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <circle cx="20" cy="20" r={r} className="ch-track" />
        {score !== null && <circle cx="20" cy="20" r={r} className="ch-fill" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 20 20)" />}
      </svg>
      <b className="num">{score === null ? "New" : score}</b>
    </span>
  );
}

/** "+6" / "−12" over a week, with a small arrow. Nothing when flat or unknown. */
export function HealthTrend({ trend }: { trend: number | null }) {
  if (trend === null || Math.abs(trend) < 3) return null;
  const up = trend > 0;
  const I = up ? Icons.up : Icons.down;
  return <span className={`ch-trend ${up ? "up" : "down"}`}><I width={13} height={13} />{up ? "+" : "−"}{Math.abs(trend)}</span>;
}

export function HealthBandPill({ band }: { band: HealthBand }) {
  return <span className={`ch-band b-${band}`}>{HEALTH_BANDS[band]}</span>;
}

/** What makes up the score: one thin bar per part, with the plain-words note. */
export function HealthParts({ parts }: { parts: HealthPart[] }) {
  return (
    <ul className="ch-parts">
      {parts.map((p, i) => (
        <li key={p.key} style={{ ["--i" as string]: i }}>
          <div className="ch-part-top"><b>{p.label}</b><span className="num">{Math.round(p.score * 100)}</span></div>
          <span className="gy-bar"><i style={{ width: `${Math.round(p.score * 100)}%`, background: BAND_TONE[p.score >= 0.75 ? "good" : p.score >= 0.5 ? "watch" : "low"], ["--i" as string]: i }} /></span>
          <small>{p.note}</small>
        </li>
      ))}
    </ul>
  );
}

/** A voice note bubble: play/pause, a progress line and the length. `load` fetches a playable link the first time. */
export function VoiceNote({ seconds, load, mine }: { seconds: number; load: () => Promise<string>; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = async () => {
    if (playing) { audio.current?.pause(); return; }
    try {
      if (!audio.current) {
        const a = new Audio(await load());
        a.ontimeupdate = () => setPos(a.currentTime);
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        a.onended = () => { setPlaying(false); setPos(0); };
        audio.current = a;
      }
      await audio.current.play();
    } catch {
      setFailed(true);
    }
  };
  const I = playing ? Icons.pause : Icons.play;
  return (
    <span className={`vn${mine ? " mine" : ""}`}>
      <button type="button" className="vn-play" onClick={() => void toggle()} aria-label={playing ? "Pause voice note" : "Play voice note"}><I width={16} height={16} /></button>
      <span className="vn-line"><i style={{ width: `${Math.min(100, (pos / Math.max(1, seconds)) * 100)}%` }} /></span>
      <span className="vn-time num">{failed ? "Can't play" : voiceClock(playing || pos ? pos : seconds)}</span>
    </span>
  );
}

/** Brief: the business in four numbers, with a way through to the full Business screen. */
export function BusinessGlance({ tiles, sample, onOpen }: { tiles: GlanceTile[]; sample?: boolean; onOpen?: () => void }) {
  return (
    <section className="bg-glance">
      <div className="sect"><h2 className="h2">Business</h2>{onOpen ? <button className="link" onClick={onOpen}>Open Business ›</button> : null}</div>
      <div className="bg-tiles">
        {tiles.map((t, i) => (
          <div key={t.key} className="bg-tile" style={{ ["--i" as string]: i }}>
            <b className="num">{t.value}</b>
            <span>{t.label}</span>
            {t.note && <small>{t.note}</small>}
          </div>
        ))}
      </div>
      {sample && <div className="tiny" style={{ marginTop: 8 }}>Sample figures. Your own fill in when you sign in.</div>}
    </section>
  );
}
