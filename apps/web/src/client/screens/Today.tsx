import { WEEKDAY_NAMES, checkInDue, exerciseFor, newestFirst, shortDate } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Icons } from "@apex/ui";
import { useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useStore } from "../../data/StoreContext";

const MOODS = ["Rough", "Low", "OK", "Good", "Great"];
/* 1 = done, 2 = today, 0 = rest or not yet */
const WEEK: [string, 0 | 1 | 2][] = [["M", 1], ["T", 1], ["W", 0], ["T", 1], ["F", 0], ["S", 2], ["S", 0]];
const TODAY_INDEX = 5;

export function Today({ start, checkedIn, onCheckIn, openCheckIn }: { start: () => void; checkedIn: boolean; onCheckIn: () => void; openCheckIn: () => void }) {
  const store = useStore();
  const { clientName, coachName } = useAppInfo();
  const { status } = useStoreStatus();
  const { workout: w, log, progress } = useApexState(store);
  const [mood, setMood] = useState<number | null>(null);
  const latest = newestFirst(progress.checkIns)[0];
  const due = checkInDue(latest?.submittedAt ?? null, progress.checkInDay);
  const freshReply = latest?.coachReply && latest.reviewedAt && Date.now() - Date.parse(latest.reviewedAt) < 7 * 86400000 ? latest : null;
  return (
    <>
      <div><div className="eyebrow">Saturday 25 October</div><h1 className="h1">Hi {clientName.split(" ")[0]}.</h1></div>
      {status === "loading" ? (
        <div className="card"><div className="small">Loading today's session…</div></div>
      ) : status === "no-program" ? (
        <div className="card"><h2 className="h2">No workout yet</h2><div className="small" style={{ marginTop: 4 }}>{coachName} is setting up your program. It will appear here as soon as it's ready.</div></div>
      ) : !log ? (
        <div className="card" style={{ background: "linear-gradient(150deg,var(--act-soft),transparent 70%),var(--card)", borderColor: "color-mix(in srgb,var(--act) 40%,var(--line))", padding: 18 }}>
          <div className="eyebrow" style={{ color: "var(--act)" }}>Today's session · week {w.week} of {w.ofWeeks}</div>
          <h2 className="h1" style={{ fontSize: 28, marginTop: 6 }}>{w.name}</h2>
          <div className="small" style={{ marginTop: 4 }}><span className="num">{w.items.length}</span> exercises · about <span className="num">{w.minutes}</span> min</div>
          <ul style={{ margin: "12px 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {w.items.map((it) => (
              <li key={it.key} className="row small" style={{ gap: 8 }}>
                <span className="grp" style={{ width: 28, fontSize: 11 }}>{it.group}</span>
                <span style={{ color: "var(--text)" }}>{exerciseFor(it).name}</span>
                <span className="num" style={{ marginLeft: "auto" }}>{it.sets}×{it.reps}{it.kg ? ` · ${it.kg} kg` : ""}</span>
              </li>
            ))}
          </ul>
          <button className="btn act block" style={{ minHeight: 54, fontSize: 16 }} onClick={start} disabled={w.items.length === 0}><Icons.play /> Start workout</button>
        </div>
      ) : (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--good) 45%,var(--line))", background: "var(--good-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--good)" }}>Done for today</div>
          <h2 className="h2" style={{ marginTop: 6 }}>{log.workoutName}</h2>
          <div className="small num" style={{ marginTop: 4 }}>{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {log.volumeKg.toLocaleString()} kg · {log.minutes} min · RPE {log.rpe}{log.prs ? ` · ${log.prs} PR` : ""}</div>
          {log.summary && <div style={{ marginTop: 12 }}><WorkoutSummaryCard summary={log.summary} compact /></div>}
        </div>
      )}

      {due.due ? (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--blue) 45%,var(--line))", background: "var(--blue-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--blue)" }}>Weekly check-in · {due.daysLate === 0 ? "due today" : due.daysLate === 1 ? "due yesterday" : `due ${WEEKDAY_NAMES[progress.checkInDay]}`}</div>
          <h2 className="h2" style={{ marginTop: 6 }}>Tell {coachName} how your week went</h2>
          <div className="small" style={{ marginTop: 4 }}>Weight, photos, sleep, energy and a few words. About two minutes.</div>
          <button className="btn sec block" style={{ marginTop: 12 }} onClick={openCheckIn}>Start check-in</button>
        </div>
      ) : freshReply ? (
        <div className="card">
          <div className="sect" style={{ marginBottom: 6 }}><h3 className="h3">{coachName} replied to your check-in</h3><span className="tiny">{shortDate(freshReply.submittedAt)}</span></div>
          <div className="small" style={{ color: "var(--text)" }}>{freshReply.coachReply}</div>
        </div>
      ) : latest ? (
        <div className="card"><div className="small">Check-in sent {shortDate(latest.submittedAt)}. Next one is due {WEEKDAY_NAMES[progress.checkInDay]}.</div></div>
      ) : null}

      {!checkedIn && (
        <div className="card">
          <div className="sect" style={{ marginBottom: 8 }}><h3 className="h3">How are you feeling today?</h3><span className="tiny">10 seconds</span></div>
          <div className="rpe">
            {MOODS.map((m, i) => <button key={m} className={mood === i ? "on" : ""} onClick={() => setMood(i)} style={{ fontFamily: "var(--ui)", fontSize: 13 }}>{m}</button>)}
          </div>
          {mood !== null && <button className="btn sec block" style={{ marginTop: 10 }} onClick={onCheckIn}>Send to coach</button>}
        </div>
      )}

      <div className="card">
        <div className="sect" style={{ marginBottom: 8 }}>
          <h3 className="h3">This week</h3>
          <span className="tiny num">{WEEK.filter((d) => d[1] === 1).length + (log ? 1 : 0)} of 4 done · <Icons.flame width={13} height={13} style={{ verticalAlign: -2, color: "var(--act)" }} /> 19 days</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {WEEK.map(([d, s], i) => {
            const st = i === TODAY_INDEX && log ? 1 : s;
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ height: 34, borderRadius: 6, background: st === 1 ? "var(--good-soft)" : st === 2 ? "var(--act-soft)" : "var(--bg2)", border: st === 1 ? "1px solid color-mix(in srgb,var(--good) 45%,transparent)" : st === 2 ? "1.5px dashed var(--act)" : "1px solid var(--line)", display: "grid", placeItems: "center", color: "var(--good)", fontWeight: 800 }}>{st === 1 ? <Icons.check width={16} height={16} strokeWidth={2.5} /> : null}</div>
                <div className="tiny" style={{ marginTop: 4, fontWeight: i === TODAY_INDEX ? 800 : 500, color: i === TODAY_INDEX ? "var(--text)" : undefined }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
