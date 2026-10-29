import {
  baseline, bestPerDay, contributors, formatSleep, loadAndRecovery, loadByDay, loadEffect, localDate, morningLine, RECOVERY_SOURCES, sleepSchedule, vsBaseline,
  type Activity, type RecoveryDay,
} from "@apex/core";
import { BalanceRows, Gauge, Hypnogram, Label, LoadRecoveryChart, RecoveryCalendar, SleepBars, SleepScheduleChart, SleepStagesBar, TrendChart } from "@apex/ui";
import { useMemo } from "react";

/* Recovery for one client, the same for the client and the coach. Last night up top with one line on
   what's behind it, then each part against the client's own usual, the night as it happened, how
   training lines up with the next morning, their sleep schedule and the month. Numbers are Data;
   the sentences built from them are Insights. */

const scoreColour = (s: number) => (s >= 67 ? "var(--good)" : s >= 34 ? "var(--warn)" : "var(--crit)");
const SCORE_NAME: Record<RecoveryDay["source"], string> = { whoop: "Recovery", oura: "Readiness", garmin: "Body Battery", polar: "Nightly Recharge", fitbit: "Recovery", manual: "Recovery" };

/** "▲ 8%" in green or "▼ 12%" in red, the right way round for the metric. */
function Delta({ pct, lowerIsBetter = false }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null || pct === 0) return null;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return <i style={{ color: good ? "var(--good)" : "var(--crit)" }}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</i>;
}

export function RecoveryView({ recovery, activities = [], compact = false }: { recovery: RecoveryDay[]; activities?: Activity[]; compact?: boolean }) {
  const days = useMemo(() => bestPerDay(recovery), [recovery]);
  const today = localDate(new Date());
  const load = useMemo(() => loadByDay(activities.map((a) => ({ date: localDate(new Date(a.startedAt)), minutes: a.movingSeconds / 60, rpe: a.rpe }))), [activities]);
  const last = days[0];
  if (!last) return null;
  const hrvB = baseline(recovery, "hrvMs", last.date);
  const rhrB = baseline(recovery, "restingHr", last.date);
  const sleepB = baseline(recovery, "sleepMinutes", last.date);
  const parts = contributors(recovery, last.date, load);
  const line = morningLine(parts);
  const series = loadAndRecovery(recovery, load, today);
  const showLoad = series.some((d) => d.load > 0) && series.filter((d) => d.recoveryScore !== undefined).length >= 4;
  const effect = loadEffect(recovery, load);
  const schedule = sleepSchedule(recovery);
  // The provider's own score when there is one, else its sleep score.
  const score = last.recoveryScore ?? last.sleepScore ?? null;
  const colour = score === null ? "var(--text3)" : scoreColour(score);
  const when = last.date === today ? "Last night" : new Date(`${last.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const fortnight = days.slice(0, 14).filter((d) => d.sleepMinutes);
  const night = last.hypnogram && last.bedtime ? (last as RecoveryDay & { hypnogram: string; bedtime: string }) : null;
  return (
    <>
      <section className="rc-hero">
        <div className="rc-hero-top">
          <Gauge value={score} size={compact ? 112 : 132} stroke={compact ? 8 : 9} color={colour} label={score === null ? "No score" : `${SCORE_NAME[last.source]} ${score} out of 100`}>
            <b className="rdy-num" style={{ fontSize: compact ? 32 : 40 }}>{score ?? "–"}</b>
            <span className="rdy-word" style={{ color: colour }}>{last.recoveryScore !== undefined ? SCORE_NAME[last.source] : "Sleep score"}</span>
          </Gauge>
          <div className="rc-stats">
            <div className="eyebrow">{when}</div>
            {last.sleepMinutes !== undefined && <div className="rc-stat"><span>Sleep</span><b>{formatSleep(last.sleepMinutes)}<Delta pct={vsBaseline(last.sleepMinutes, sleepB)} /></b></div>}
            {last.hrvMs !== undefined && <div className="rc-stat"><span>HRV</span><b>{Math.round(last.hrvMs)} ms<Delta pct={vsBaseline(last.hrvMs, hrvB)} /></b></div>}
            {last.restingHr !== undefined && <div className="rc-stat"><span>Resting HR</span><b>{last.restingHr} bpm<Delta pct={vsBaseline(last.restingHr, rhrB)} lowerIsBetter /></b></div>}
          </div>
        </div>
        {line && <div className="rc-hero-line"><span><Label kind="insight">Insight</Label></span>{line}</div>}
      </section>
      <div className="row" style={{ gap: 6, marginTop: -6 }}><Label kind="data">From {RECOVERY_SOURCES[last.source]}</Label><span className="tiny">▲▼ against the last two weeks</span></div>

      {parts.length > 1 && (
        <section>
          <div className="sect"><h2 className="h2">What's behind it</h2><span className="tiny">Against your usual</span></div>
          <div className="card"><BalanceRows items={parts} /></div>
        </section>
      )}

      {(night || last.stages || fortnight.length > 2) && (
        <section>
          <div className="sect"><h2 className="h2">{night ? "Your night" : "Sleep"}</h2>{last.sleepScore !== undefined && <span className="num small" style={{ fontWeight: 700 }}>Score {last.sleepScore}</span>}</div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {night ? <Hypnogram day={night} /> : last.stages ? <SleepStagesBar stages={last.stages} /> : null}
            {!compact && fortnight.length > 2 && <SleepBars days={fortnight} />}
          </div>
        </section>
      )}

      {showLoad && (
        <section>
          <div className="sect"><h2 className="h2">Training and recovery</h2><span className="tiny">Last 4 weeks</span></div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <LoadRecoveryChart days={series} />
            {effect && Math.abs(effect.hrvPct) >= 3 && (
              <div className="small" style={{ color: "var(--text)", borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <span><Label kind="insight">Insight</Label></span>
                After the hardest training days, HRV the next morning runs {Math.abs(effect.hrvPct)}% {effect.hrvPct < 0 ? "lower" : "higher"} than after other days ({effect.hardDays} hard days so far).
              </div>
            )}
          </div>
        </section>
      )}

      {!compact && schedule && (
        <section>
          <div className="sect"><h2 className="h2">Sleep schedule</h2><span className="tiny">Steadier is better</span></div>
          <div className="card"><SleepScheduleChart schedule={schedule} /></div>
        </section>
      )}

      {!compact && days.filter((d) => d.hrvMs).length > 2 && (
        <section>
          <div className="sect"><h2 className="h2">Heart-rate variability</h2><span className="tiny">Higher is better rested</span></div>
          <div className="card"><TrendChart days={days.slice(0, 30)} value={(d) => d.hrvMs} colour="var(--viz-1)" unit="ms" usual={hrvB} label="HRV over the last month" /></div>
        </section>
      )}
      {!compact && days.filter((d) => d.restingHr).length > 2 && (
        <section>
          <div className="sect"><h2 className="h2">Resting heart rate</h2><span className="tiny">Lower is better rested</span></div>
          <div className="card"><TrendChart days={days.slice(0, 30)} value={(d) => d.restingHr} colour="var(--viz-2)" unit="bpm" usual={rhrB} lowerIsBetter label="Resting heart rate over the last month" /></div>
        </section>
      )}

      {!compact && days.filter((d) => d.recoveryScore !== undefined || d.sleepScore !== undefined).length > 6 && (
        <section>
          <div className="sect"><h2 className="h2">The month</h2><span className="tiny">{SCORE_NAME[last.source]} each morning</span></div>
          <div className="card"><RecoveryCalendar days={days} today={today} /></div>
        </section>
      )}

      {(last.stress !== undefined || last.steps !== undefined || last.strain !== undefined || last.respiratoryRate !== undefined) && (
        <div className="rc-tiles">
          {last.stress !== undefined && (
            <div className="rc-tile">
              <span className="tiny">Stress yesterday</span>
              <b>{last.stress}<small className="tiny"> /100</small></b>
              <div className="rc-meter"><u style={{ width: `${last.stress}%` }} /></div>
            </div>
          )}
          {last.strain !== undefined && <div className="rc-tile"><span className="tiny">Strain yesterday</span><b>{last.strain}<small className="tiny"> /21</small></b></div>}
          {last.steps !== undefined && <div className="rc-tile"><span className="tiny">Steps</span><b>{last.steps.toLocaleString("en-GB")}</b></div>}
          {last.respiratoryRate !== undefined && <div className="rc-tile"><span className="tiny">Breathing rate</span><b>{last.respiratoryRate}<small className="tiny"> /min</small></b></div>}
        </div>
      )}
    </>
  );
}
