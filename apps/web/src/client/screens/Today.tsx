import { HERO_IMAGES, WEEKDAY_NAMES, checkInDue, exerciseFor, heroForWorkout, newestFirst, shortDate } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, Icons, SwipeStart } from "@apex/ui";
import { useState } from "react";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useLifestyle } from "../../data/LifestyleContext";
import { HabitList } from "./Habits";
import { useStore } from "../../data/StoreContext";

const MOODS = ["Rough", "Low", "OK", "Good", "Great"];
/* 1 = done, 2 = today, 0 = rest or not yet */
const WEEK: [string, 0 | 1 | 2][] = [["Mon", 1], ["Tue", 1], ["Wed", 0], ["Thu", 1], ["Fri", 0], ["Sat", 2], ["Sun", 0]];
const TODAY_INDEX = 5;
/* Sample week: Monday 20 to Sunday 26 October. */
const WEEK_DATES = [20, 21, 22, 23, 24, 25, 26];

export function Today({ start, checkedIn, onCheckIn, openCheckIn, openIntake }: { start: () => void; checkedIn: boolean; onCheckIn: () => void; openCheckIn: () => void; openIntake: () => void }) {
  const store = useStore();
  const { clientName, coachName } = useAppInfo();
  const { status } = useStoreStatus();
  const { workout: w, log, progress } = useApexState(store);
  const [mood, setMood] = useState<number | null>(null);
  const life = useLifestyle();
  const latest = newestFirst(progress.checkIns)[0];
  const due = checkInDue(latest?.submittedAt ?? null, progress.checkInDay);
  const doneCount = WEEK.filter((d) => d[1] === 1).length + (log ? 1 : 0);
  const totalSets = w.items.reduce((a, it) => a + it.sets, 0);
  const hero = HERO_IMAGES[heroForWorkout(w)];
  const freshReply = latest?.coachReply && latest.reviewedAt && Date.now() - Date.parse(latest.reviewedAt) < 7 * 86400000 ? latest : null;
  return (
    <>
      <div className="hello">
        <div><p className="sub">Saturday 25 October</p><h1 className="h1">Hi {clientName.split(" ")[0]}.</h1></div>
        <Avatar initials={clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={44} />
      </div>

      <section aria-label="This week">
        <div className="sect" style={{ marginBottom: 8 }}>
          <h2 className="h3">Your week</h2>
          <span className="tiny num">{doneCount} of 4 done</span>
        </div>
        <div className="daystrip">
          {WEEK.map(([d, s], i) => {
            const st = i === TODAY_INDEX && log ? 1 : s;
            return (
              <div key={d} className={`day ${st === 1 ? "done" : ""} ${i === TODAY_INDEX ? "today" : ""}`} aria-label={`${d} ${WEEK_DATES[i]}${st === 1 ? ", trained" : i === TODAY_INDEX ? ", today" : ""}`}>
                <small>{d}</small><b>{WEEK_DATES[i]}</b><i />
              </div>
            );
          })}
        </div>
      </section>
      {status === "loading" ? (
        <div className="card"><div className="small">Loading today's session…</div></div>
      ) : status === "no-program" ? (
        <div className="card"><h2 className="h2">No workout yet</h2><div className="small" style={{ marginTop: 4 }}>{coachName} is setting up your program. It will appear here as soon as it's ready.</div></div>
      ) : !log ? (
        <>
          <div className="hero">
            <img className="hero-img" src={hero.src} alt="" style={{ objectPosition: hero.focus }} />
            <div className="hero-top">
              <span className="gpill dim caps">Week {w.week} of {w.ofWeeks}</span>
              <span className="gpill dim">Today's session</span>
            </div>
            <div className="hero-body">
              <h2 className="hero-title">{w.name}</h2>
              <div className="gpills">
                <span className="gpill num"><Icons.clock /> {w.minutes} min</span>
                <span className="gpill num">{w.items.length} exercises</span>
                <span className="gpill num">{totalSets} sets</span>
              </div>
              <SwipeStart label="Swipe to start" onStart={start} disabled={w.items.length === 0} />
            </div>
          </div>
          <div className="card">
            <div className="sect" style={{ marginBottom: 10 }}><h3 className="h3">In this session</h3><span className="tiny">Coach plan</span></div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {w.items.map((it) => (
              <li key={it.key} className="row small" style={{ gap: 8 }}>
                <span className="grp" style={{ width: 28, fontSize: 11 }}>{it.group}</span>
                <span style={{ color: "var(--text)" }}>{exerciseFor(it).name}</span>
                <span className="num" style={{ marginLeft: "auto" }}>{it.sets}×{it.reps}{it.kg ? ` · ${it.kg} kg` : ""}</span>
              </li>
            ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--good) 45%,var(--line))", background: "var(--good-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--good)" }}>Done for today</div>
          <h2 className="h2" style={{ marginTop: 6 }}>{log.workoutName}</h2>
          <div className="small num" style={{ marginTop: 4 }}>{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {log.volumeKg.toLocaleString()} kg · {log.minutes} min · RPE {log.rpe}{log.prs ? ` · ${log.prs} PR` : ""}</div>
          {log.summary && <div style={{ marginTop: 12 }}><WorkoutSummaryCard summary={log.summary} compact /></div>}
        </div>
      )}

      <div className="tiles">
        <div className="tile c1"><span className="ic"><Icons.check /></span><b>{doneCount}<small> / 4</small></b><span>Sessions this week</span></div>
        <div className="tile c2"><span className="ic"><Icons.flame /></span><b>19<small> days</small></b><span>Streak</span></div>
        <button className="tile c3" onClick={openCheckIn}><span className="ic"><Icons.target /></span><b style={{ fontSize: 16, lineHeight: 1.25 }}>{due.due ? "Due" : (WEEKDAY_NAMES[progress.checkInDay] ?? "Weekly").slice(0, 3)}</b><span>Check-in</span></button>
      </div>

      {life.status === "ready" && !life.intake && (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--act) 40%,var(--line))" }}>
          <div className="eyebrow" style={{ color: "var(--act)" }}>Before you start</div>
          <h2 className="h2" style={{ marginTop: 6 }}>Tell {coachName} about you</h2>
          <div className="small" style={{ marginTop: 4 }}>A short health check, your goals and your training so far. About five minutes.</div>
          <button className="btn sec block" style={{ marginTop: 12 }} onClick={openIntake}>Start</button>
        </div>
      )}

      {life.habits.length > 0 && (
        <section>
          <div className="sect"><h2 className="h2">Today's habits</h2></div>
          <HabitList compact />
        </section>
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

    </>
  );
}
