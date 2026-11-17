import { HERO_IMAGES, type Credits, type SessionMonth } from "@apex/core";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop, Label } from "./primitives";

/* 1:1 sessions in the poster language of Report and Gym: a studio photo with a Roman-caps title,
   three big serif numbers for the month, and a quiet balance of sessions for the client. */

const ART = { ...HERO_IMAGES.coach, word: "Sessions" };

export function SessionsHero({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="hero rp-hero ss-hero">
      <HeroBackdrop art={ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">1:1 sessions</span></div>
      <div className="hero-body"><EditorialTitle as="h1" text={title} caption={caption} /></div>
    </div>
  );
}

/** The coach's month: money from packs, sessions that went ahead, and how often clients showed up. */
export function SessionMonthStats({ month }: { month: SessionMonth }) {
  return (
    <>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">This month</h2><Label kind="data">Data</Label></div>
      <div className="gy-stats">
        <div className="gy-stat" style={{ ["--i" as string]: 0 }}><b>£<CountUp value={Math.round(month.incomePence / 100)} /></b><span>from {month.packs} pack{month.packs === 1 ? "" : "s"}</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 1 }}><b><CountUp value={month.attended} /></b><span>sessions done</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 2 }}><b>{month.showRate === null ? "–" : <><CountUp value={month.showRate} />%</>}</b><span>{month.lateOrNoShow ? `turned up · ${month.lateOrNoShow} missed` : "turned up"}</span></div>
      </div>
    </>
  );
}

/** What the client has left: one big number, and when the soonest ones expire. */
export function CreditBalance({ credits, caption }: { credits: Credits; caption: string }) {
  const owed = credits.owed > 0;
  const n = owed ? credits.owed : credits.left;
  return (
    <div className={`ss-balance${owed ? " owed" : ""}`}>
      <b className="num"><CountUp value={n} /></b>
      <div className="grow">
        <div className="h3">{owed ? `Session${n === 1 ? "" : "s"} to pay for` : `Session${n === 1 ? "" : "s"} left`}</div>
        <div className="tiny">{caption}</div>
      </div>
    </div>
  );
}
