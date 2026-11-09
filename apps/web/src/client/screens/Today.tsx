import { HERO_IMAGES, WEEKDAY_NAMES, checkInDue, dayRings, localDate, ringNudge, ringStreak, ringWeek, type RingInput, exerciseFor, heroForWorkout, newestFirst, shortDate } from "@apex/core";
import { useApexState } from "@apex/core/react";
import { Avatar, DailyRings, EditorialTitle, Icons, LevelRow, RingWeek, SwipeStart, ScriptTitle, HeroBackdrop, useUnits } from "@apex/ui";
import { useMemo, useState } from "react";
import { useActivitiesIfAny } from "../../data/ActivityContext";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useLifestyle } from "../../data/LifestyleContext";
import { HabitList } from "./Habits";
import { useStore } from "../../data/StoreContext";
import { WeekStoryCard, WeekStoryViewer } from "./WeekStory";
import { FreshMilestone, LevelsSheet, useLevels } from "../../app/LevelParts";
import { TeamPeek } from "../../app/TeamParts";
import { PushPrompt } from "../../app/PushParts";
import { FirstWeek, useFirstWeek } from "../FirstWeek";
import { PlanChanged } from "../PlanChanged";
import type { FirstWeekStepId } from "@apex/core";

const MOODS = ["Rough", "Low", "OK", "Good", "Great"];
/* 1 = done, 2 = today, 0 = rest or not yet */
const WEEK: [string, 0 | 1 | 2][] = [["Mon", 1], ["Tue", 1], ["Wed", 0], ["Thu", 1], ["Fri", 0], ["Sat", 2], ["Sun", 0]];
const TODAY_INDEX = 5;
/* Sample week: Monday 20 to Sunday 26 October. */
const WEEK_DATES = [20, 21, 22, 23, 24, 25, 26];
/* Sample plan: which days have a session. */
const PLANNED = [true, true, false, true, false, true, false];

export function Today({ start, checkedIn, onCheckIn, openCheckIn, openIntake, openTeam, go, say }: { start: () => void; checkedIn: boolean; onCheckIn: () => void; openCheckIn: () => void; openIntake: () => void; openTeam?: () => void; go?: (id: FirstWeekStepId) => void; say?: (m: string) => void }) {
  const u = useUnits();
  const store = useStore();
  const { clientName, coachName } = useAppInfo();
  const { status } = useStoreStatus();
  const { workout: w, log, progress, history } = useApexState(store);
  const { activities } = useActivitiesIfAny();
  const [mood, setMood] = useState<number | null>(null);
  const [story, setStory] = useState(false);
  const [levels, setLevels] = useState(false);
  const lv = useLevels();
  const life = useLifestyle();
  const firstWeek = useFirstWeek();
  const latest = newestFirst(progress.checkIns)[0];
  const due = checkInDue(latest?.submittedAt ?? null, progress.checkInDay);
  const doneCount = WEEK.filter((d) => d[1] === 1).length + (log ? 1 : 0);
  const totalSets = w.items.reduce((a, it) => a + it.sets, 0);
  const hero = HERO_IMAGES[heroForWorkout(w)];
  const day = localDate(new Date());
  const rings = useMemo(() => {
    const input: RingInput = { sessions: history.sessions ?? [], activities, habits: life.habits, ticks: life.ticks, water: life.water, food: life.food, targets: life.targets };
    const today = dayRings(input, day);
    const streak = ringStreak(input, day);
    return { today, streak, week: ringWeek(input, day), nudge: ringNudge(today, streak.days) };
  }, [history.sessions, activities, life.habits, life.ticks, life.water, life.food, life.targets, day]);
  const ringLabels = rings.week.map((d) => (d.day === day ? "Today" : "MTWTFSS"[(new Date(`${d.day}T12:00:00`).getDay() + 6) % 7]!));
  const cover = status === "ready" && !log;
  const freshReply = latest?.coachReply && latest.reviewedAt && Date.now() - Date.parse(latest.reviewedAt) < 7 * 86400000 ? latest : null;
  return (
    <>
      {cover ? (
        <section className="hero cover" aria-label="Today's session">
          <HeroBackdrop art={hero} word={null} />
          <div className="cv-top">
            <div className="cv-hi"><span>Hi {clientName.split(" ")[0]}</span><small>Saturday 25 October</small></div>
            <Avatar initials={clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={38} />
          </div>
          <div className="cv-days" role="list" aria-label="Your week">
            {WEEK.map(([d, st], i) => {
              const today = i === TODAY_INDEX;
              const I = st === 1 ? Icons.flame : PLANNED[i] ? Icons.train : null;
              return (
                <span key={d} role="listitem" className={`cv-day${st === 1 ? " done" : ""}${today ? " today" : ""}`} style={{ ["--i" as string]: i }} aria-label={`${d} ${WEEK_DATES[i]}${st === 1 ? ", trained" : today ? ", today" : PLANNED[i] ? ", planned" : ", rest"}`}>
                  <small>{d.slice(0, d === "Thu" || d === "Tue" || d === "Sat" || d === "Sun" ? 2 : 1)}</small>
                  {I ? <I width={13} height={13} /> : <i />}
                </span>
              );
            })}
          </div>
          <div className="cv-title">
            <EditorialTitle as="h1" text={w.name} caption={`Today · week ${w.week} of ${w.ofWeeks}`} />
          </div>
          <div className="hero-body">
            <div className="gpills">
              <span className="gpill num"><Icons.clock /> {w.minutes} min</span>
              <span className="gpill num">{w.items.length} exercises</span>
              <span className="gpill num">{totalSets} sets</span>
            </div>
            <SwipeStart label="Swipe to start" onStart={start} disabled={w.items.length === 0} />
          </div>
        </section>
      ) : (
        <div className="hello">
          <div><p className="sub">Saturday 25 October</p><ScriptTitle script="Hi">{clientName.split(" ")[0]}</ScriptTitle></div>
          <Avatar initials={clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={44} />
        </div>
      )}

      <PlanChanged />
      {go && <FirstWeek go={go} />}
      <section aria-label="Today's rings">
        <DailyRings rings={rings.today} streak={rings.streak.days} best={rings.streak.best} />
        <RingWeek days={rings.week} labels={ringLabels} />
        <p className="tiny dr-nudge">{rings.nudge}</p>
        <LevelRow level={lv.level} onOpen={() => setLevels(true)} />
        <FreshMilestone list={lv.list} today={lv.today} say={say} />
        {openTeam && <TeamPeek onOpen={openTeam} />}
        {levels && <LevelsSheet onClose={() => setLevels(false)} say={say} />}
      </section>
      {!(go && firstWeek.visible) && <PushPrompt say={say ?? (() => {})} />}

      <section aria-label="This week">
        <div className="sect" style={{ marginBottom: 8 }}>
          <h2 className="h3">Your week</h2>
          <span className="tiny num">{doneCount} of 4 done</span>
        </div>
        {!cover && <div className="daystrip">
          {WEEK.map(([d, s], i) => {
            const st = i === TODAY_INDEX && log ? 1 : s;
            return (
              <div key={d} className={`day ${st === 1 ? "done" : ""} ${i === TODAY_INDEX ? "today" : ""}`} aria-label={`${d} ${WEEK_DATES[i]}${st === 1 ? ", trained" : i === TODAY_INDEX ? ", today" : ""}`}>
                <small>{d}</small><b>{WEEK_DATES[i]}</b><i />
              </div>
            );
          })}
        </div>}
        <WeekStoryCard onOpen={() => setStory(true)} />
        {story && <WeekStoryViewer onClose={() => setStory(false)} />}
      </section>
      {status === "loading" ? (
        <div className="card"><div className="small">Loading today's session…</div></div>
      ) : status === "no-program" ? (
        <div className="card"><h2 className="h2">No workout yet</h2><div className="small" style={{ marginTop: 4 }}>{coachName} is setting up your programme. It will appear here as soon as it's ready.</div></div>
      ) : !log ? (
        <>
          {!cover && <div className="hero">
            <HeroBackdrop art={hero} />
            <div className="hero-top">
              <span className="gpill dim caps">Week {w.week} of {w.ofWeeks}</span>
              <span className="gpill dim">Today's session</span>
            </div>
            <div className="hero-body">
              <EditorialTitle text={w.name} />
              <div className="gpills">
                <span className="gpill num"><Icons.clock /> {w.minutes} min</span>
                <span className="gpill num">{w.items.length} exercises</span>
                <span className="gpill num">{totalSets} sets</span>
              </div>
              <SwipeStart label="Swipe to start" onStart={start} disabled={w.items.length === 0} />
            </div>
          </div>}
          <div className="card">
            <div className="sect" style={{ marginBottom: 10 }}><h3 className="h3">In this session</h3><span className="tiny">Coach plan</span></div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {w.items.map((it) => (
              <li key={it.key} className="row small" style={{ gap: 8 }}>
                <span className="grp" style={{ width: 28, fontSize: 11 }}>{it.group}</span>
                <span style={{ color: "var(--text)" }}>{exerciseFor(it).name}</span>
                <span className="num" style={{ marginLeft: "auto" }}>{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""}</span>
              </li>
            ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--good) 45%,var(--line))", background: "var(--good-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--good)" }}>Done for today</div>
          <h2 className="h2" style={{ marginTop: 6 }}>{log.workoutName}</h2>
          <div className="small num" style={{ marginTop: 4 }}>{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {u.fw(log.volumeKg, 0)} · {log.minutes} min · RPE {log.rpe}{log.prs ? ` · ${log.prs} PR` : ""}</div>
          {log.summary && <div style={{ marginTop: 12 }}><WorkoutSummaryCard summary={log.summary} compact /></div>}
        </div>
      )}

      <div className="tiles">
        <div className="tile c1"><span className="ic"><Icons.check /></span><b>{doneCount}<small> / 4</small></b><span>Sessions this week</span></div>
        <div className="tile c2"><span className="ic"><Icons.flame /></span><b>{rings.streak.days}<small> day{rings.streak.days === 1 ? "" : "s"}</small></b><span>Streak</span></div>
        <button className="tile c3" onClick={openCheckIn}><span className="ic"><Icons.target /></span><b style={{ fontSize: 16, lineHeight: 1.25 }}>{due.due ? "Due" : (WEEKDAY_NAMES[progress.checkInDay] ?? "Weekly").slice(0, 3)}</b><span>Check-in</span></button>
      </div>

      {life.status === "ready" && !life.intake && !(go && firstWeek.visible) && (
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
