import { HERO_IMAGES, type ProgressReport } from "@apex/core";
import { Icons } from "./icons";
import { CountUp } from "./motion";
import { EditorialTitle, HeroBackdrop, Label } from "./primitives";
import { useUnits } from "./prefs";

/* The monthly report: the poster language of Gym and Team. A studio photo with the client's name in Roman capitals,
   three big serif numbers, a quiet bar per week, then lifts, body and habits as simple ruled rows. */

const ART = { ...HERO_IMAGES.squat, word: "Month" };

export function ReportHero({ name, label }: { name: string; label: string }) {
  return (
    <div className="hero rp-hero">
      <HeroBackdrop art={ART} word={null} />
      <div className="hero-top"><span className="gpill dim caps">Month in review</span></div>
      <div className="hero-body">
        <EditorialTitle as="h1" text={name} caption={label} />
      </div>
    </div>
  );
}

export function ReportView({ report: r }: { report: ProgressReport }) {
  const u = useUnits();
  const top = Math.max(2, ...r.weeks);
  const change = r.sessions - r.previousSessions;
  return (
    <>
      <div className="sect" style={{ marginBottom: 0 }}><h2 className="h2">Training</h2><Label kind="data">Data</Label></div>
      <div className="gy-stats rp-stats">
        <div className="gy-stat" style={{ ["--i" as string]: 0 }}><b><CountUp value={r.sessions} /></b><span>sessions{r.previousSessions || r.sessions ? ` · ${change > 0 ? "+" : change < 0 ? "−" : "±"}${Math.abs(change)} vs before` : ""}</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 1 }}><b><CountUp value={Math.round(r.minutes / 60 * 10) / 10} decimals={1} /></b><span>hours trained</span></div>
        <div className="gy-stat" style={{ ["--i" as string]: 2 }}><b><CountUp value={Math.round(u.w(r.volumeKg) / 1000 * 10) / 10} decimals={1} /></b><span>{u.weight === "lb" ? "thousand lb" : "tonnes"} lifted</span></div>
      </div>
      <div className="rp-weeks" role="img" aria-label={`Sessions per week: ${r.weeks.join(", ")}`}>
        {r.weeks.map((n, i) => (
          <div key={i} className="rp-week" style={{ ["--i" as string]: i }}>
            <span className="rp-bar"><i style={{ height: `${(n / top) * 100}%` }} className={n >= 2 ? "on" : ""} /></span>
            <b className="num">{n}</b>
            <small>Week {i + 1}</small>
          </div>
        ))}
      </div>

      {r.bests.length > 0 && (
        <section className="rp-sec">
          <div className="sect"><h2 className="h2">New bests</h2><span className="tiny">{r.bests.length}</span></div>
          <ul className="rp-rows">
            {r.bests.map((b, i) => (
              <li key={b.exercise} style={{ ["--i" as string]: i }}>
                <Icons.trophy width={16} height={16} />
                <span className="grow">{b.exercise}</span>
                <span className="num rp-was">{u.fw(b.previousKg)}</span>
                <span className="num rp-now">{u.fw(b.kg)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.body.length > 0 && (
        <section className="rp-sec">
          <div className="sect"><h2 className="h2">Body</h2></div>
          <ul className="rp-rows">
            {r.body.map((b, i) => (
              <li key={b.key} style={{ ["--i" as string]: i }}>
                <span className="grow">{b.label}</span>
                <span className="num rp-was">{fmt(u, b.from, b.unit)}</span>
                <span className="num rp-now">{fmt(u, b.to, b.unit)}</span>
                <span className="num rp-chg">{b.change > 0 ? "+" : "−"}{fmt(u, Math.abs(b.change), b.unit)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(r.habits !== null || r.ratings.length > 0) && (
        <section className="rp-sec">
          <div className="sect"><h2 className="h2">Habits and how they felt</h2><span className="tiny">{r.checkIns} {r.checkIns === 1 ? "check-in" : "check-ins"}</span></div>
          <ul className="rp-rows">
            {r.habits !== null && <li><span className="grow">Habits ticked</span><span className="num rp-now">{r.habits}%</span></li>}
            {r.ratings.map((x) => (
              <li key={x.key}>
                <span className="grow">{x.label}{x.key === "sleepHours" ? " (hours)" : " (out of 5)"}</span>
                {x.previousAvg !== null && <span className="num rp-was">{x.previousAvg}</span>}
                <span className="num rp-now">{x.avg}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.highlights.length > 0 && (
        <section className="rp-sec">
          <div className="sect"><h2 className="h2">What stands out</h2><Label kind="insight">Insight</Label></div>
          <ul className="rp-notes">
            {r.highlights.map((h, i) => <li key={h} style={{ ["--i" as string]: i }}>{h}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}

function fmt(u: ReturnType<typeof useUnits>, value: number, unit: string): string {
  if (unit === "kg") return u.fw(value, 1);
  if (unit === "cm") return u.fl(value, 1);
  return `${Math.round(value * 10) / 10}${unit === "%" ? "%" : ` ${unit}`}`;
}
