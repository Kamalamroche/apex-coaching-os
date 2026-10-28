import { baseline, bestPerDay, formatSleep, localDate, RECOVERY_SOURCES, vsBaseline, type RecoveryDay } from "@apex/core";
import { Gauge, Label, SleepBars, SleepStagesBar, TrendChart } from "@apex/ui";
import type { CSSProperties } from "react";

/* Recovery for one client, the same for the client and the coach: last night up top, then sleep,
   HRV, resting heart rate and stress against the client's own usual. All Data: measured, not guessed. */

const scoreColour = (s: number) => (s >= 67 ? "var(--good)" : s >= 34 ? "var(--warn)" : "var(--crit)");
const SCORE_NAME: Record<RecoveryDay["source"], string> = { whoop: "Recovery", oura: "Readiness", garmin: "Body Battery", polar: "Nightly Recharge", fitbit: "Recovery", manual: "Recovery" };

/** "+8%" in green or "−12%" in red, the right way round for the metric. */
function Delta({ pct, lowerIsBetter = false }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null || pct === 0) return null;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return <i style={{ color: good ? "var(--good)" : "var(--crit)" }}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</i>;
}

export function RecoveryView({ recovery, compact = false }: { recovery: RecoveryDay[]; compact?: boolean }) {
  const days = bestPerDay(recovery);
  const today = localDate(new Date());
  const last = days[0];
  if (!last) return null;
  const hrvB = baseline(recovery, "hrvMs", last.date);
  const rhrB = baseline(recovery, "restingHr", last.date);
  const sleepB = baseline(recovery, "sleepMinutes", last.date);
  // The provider's own score when there is one, else a simple one from sleep and HRV against usual.
  const score = last.recoveryScore ?? (last.sleepScore !== undefined ? last.sleepScore : null);
  const colour = score === null ? "var(--data)" : scoreColour(score);
  const when = last.date === today ? "Last night" : new Date(`${last.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const fortnight = days.slice(0, 14);
  return (
    <>
      <section className="rc-hero" style={{ "--band": colour } as CSSProperties}>
        <Gauge value={score} size={compact ? 116 : 140} stroke={compact ? 11 : 13} color={colour} gradient={["var(--crit)", "var(--warn)", "var(--good)"]} label={score === null ? "No score" : `${SCORE_NAME[last.source]} ${score} out of 100`}>
          <b className="rdy-num" style={{ fontSize: compact ? 34 : 42 }}>{score ?? "–"}</b>
          <span className="rdy-word" style={{ color: colour }}>{last.recoveryScore !== undefined ? SCORE_NAME[last.source] : "Sleep score"}</span>
        </Gauge>
        <div className="rc-stats">
          <div className="eyebrow">{when}</div>
          {last.sleepMinutes !== undefined && <div className="rc-stat"><span>Sleep</span><b>{formatSleep(last.sleepMinutes)}<Delta pct={vsBaseline(last.sleepMinutes, sleepB)} /></b></div>}
          {last.hrvMs !== undefined && <div className="rc-stat"><span>HRV</span><b>{Math.round(last.hrvMs)} ms<Delta pct={vsBaseline(last.hrvMs, hrvB)} /></b></div>}
          {last.restingHr !== undefined && <div className="rc-stat"><span>Resting HR</span><b>{last.restingHr} bpm<Delta pct={vsBaseline(last.restingHr, rhrB)} lowerIsBetter /></b></div>}
        </div>
      </section>
      <div className="row" style={{ gap: 6, marginTop: -6 }}><Label kind="data">From {RECOVERY_SOURCES[last.source]}</Label><span className="tiny">▲▼ against the last two weeks</span></div>

      {(last.stages || fortnight.some((d) => d.sleepMinutes)) && (
        <section>
          <div className="sect"><h2 className="h2">Sleep</h2>{last.sleepScore !== undefined && <span className="num small" style={{ fontWeight: 700 }}>Score {last.sleepScore}</span>}</div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {last.stages && <SleepStagesBar stages={last.stages} />}
            {fortnight.filter((d) => d.sleepMinutes).length > 2 && <SleepBars days={fortnight.filter((d) => d.sleepMinutes)} />}
          </div>
        </section>
      )}

      {!compact && days.filter((d) => d.hrvMs).length > 2 && (
        <section>
          <div className="sect"><h2 className="h2">Heart-rate variability</h2><span className="tiny">Higher is better rested</span></div>
          <div className="card"><TrendChart days={days.slice(0, 30)} value={(d) => d.hrvMs} colour="var(--ai)" unit="ms" usual={hrvB} label="HRV over the last month" /></div>
        </section>
      )}
      {!compact && days.filter((d) => d.restingHr).length > 2 && (
        <section>
          <div className="sect"><h2 className="h2">Resting heart rate</h2><span className="tiny">Lower is better rested</span></div>
          <div className="card"><TrendChart days={days.slice(0, 30)} value={(d) => d.restingHr} colour="var(--act)" unit="bpm" usual={rhrB} lowerIsBetter label="Resting heart rate over the last month" /></div>
        </section>
      )}

      {(last.stress !== undefined || last.steps !== undefined || last.strain !== undefined || last.respiratoryRate !== undefined) && (
        <div className="rc-tiles">
          {last.stress !== undefined && (
            <div className="rc-tile">
              <span className="tiny">Stress yesterday</span>
              <b>{last.stress}<small className="tiny"> /100</small></b>
              <div className="rc-meter"><i style={{ left: `calc(${last.stress}% - 2px)` }} /></div>
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
