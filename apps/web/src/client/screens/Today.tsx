import { HERO_IMAGES, WEEKDAY_NAMES, checkInDue, dayRings, localDate, ringNudge, ringStreak, ringWeek, type RingInput, exerciseFor, heroForWorkout, newestFirst, shortDate, trainingWeek } from "@apex/core";
import { LiveFollow, LiveNowBanner } from "../../app/LiveParts";
import { AssessmentBanner } from "./Assessment";
import { useApexState } from "@apex/core/react";
import { Avatar, DailyRings, EditorialTitle, Icons, LevelRow, RingWeek, SwipeStart, ScriptTitle, HeroBackdrop, useUnits } from "@apex/ui";
import { useMemo, useState } from "react";
import { useActivitiesIfAny } from "../../data/ActivityContext";
import { useAppInfo, useStoreStatus } from "../../app/AppContext";
import { WorkoutSummaryCard } from "../../app/WorkoutSummary";
import { useLifestyle } from "../../data/LifestyleContext";
import { HabitList } from "./Habits";
import { AsPlannedSheet } from "./AsPlanned";
import { useFeatures } from "../../data/features";
import { useStore } from "../../data/StoreContext";
import { WeekStoryCard, WeekStoryViewer } from "./WeekStory";
import { FreshMilestone, LevelsSheet, useLevels } from "../../app/LevelParts";
import { TeamPeek } from "../../app/TeamParts";
import { PushPrompt } from "../../app/PushParts";
import { FirstWeek, useFirstWeek } from "../FirstWeek";
import { PlanChanged } from "../PlanChanged";
import { ReviewPrompt } from "../Review";
import { HappinessPrompt } from "../Happiness";
import type { FirstWeekStepId } from "@apex/core";

const MOODS = ["Rough", "Low", "OK", "Good", "Great"];
/* Demo week pattern: the sample client trains Mon, Tue, Thu and Sat. */
const DEMO_PLANNED = [0, 1, 3, 5];

export function Today({ start, checkedIn, onCheckIn, openCheckIn, openIntake, openTeam, go, say }: { start: () => void; checkedIn: boolean; onCheckIn: () => void; openCheckIn: () => void; openIntake: () => void; openTeam?: () => void; go?: (id: FirstWeekStepId) => void; say?: (m: string) => void }) {
  const u = useUnits();
  const store = useStore();
  const { clientName, coachName, mode } = useAppInfo();
  const { status } = useStoreStatus();
  const { workout: w, log, progress, history } = useApexState(store);
  const { activities } = useActivitiesIfAny();
  const [mood, setMood] = useState<number | null>(null);
  const [story, setStory] = useState(false);
  const [asPlanned, setAsPlanned] = useState(false);
  const [levels, setLevels] = useState(false);
  const lv = useLevels();
  const life = useLifestyle();
  const on = useFeatures();
  const firstWeek = useFirstWeek();
  const latest = newestFirst(progress.checkIns)[0];
  const due = checkInDue(latest?.submittedAt ?? null, progress.checkInDay);
  const totalSets = w.items.reduce((a, it) => a + it.sets, 0);
  const hero = HERO_IMAGES[heroForWorkout(w)];
  const day = localDate(new Date());
  const { program } = useApexState(store);
  const week = useMemo(() => {
    if (mode === "demo") {
      const base = trainingWeek({ today: day, sessions: [], plannedDays: DEMO_PLANNED, trainedToday: !!log });
      const days = base.days.map((d) => ({ ...d, trained: d.trained || (d.planned && d.day < day) }));
      return { ...base, days, done: days.filter((d) => d.trained).length };
    }
    return trainingWeek({ today: day, sessions: history.sessions ?? [], plannedDays: [...new Set(program.days.map((d) => d.dayIndex))], trainedToday: !!log });
  }, [mode, day, history.sessions, program.days, log]);
  const rings = useMemo(() => {
    const input: RingInput = { sessions: history.sessions ?? [], activities, habits: life.habits, ticks: life.ticks, water: life.water, food: life.food, targets: life.targets };
    const today = dayRings(input, day);
    const streak = ringStreak(input, day);
    return { today, streak, week: ringWeek(input, day), nudge: ringNudge(today, streak.days) };
  }, [history.sessions, activities, life.habits, life.ticks, life.water, life.food, life.targets, day]);
  const ringLabels = rings.week.map((d) => (d.day === day ? "Today" : "MTWTFSS"[(new Date(`${d.day}T12:00:00`).getDay() + 6) % 7]!));
  const cover = status === "ready" && !log;
  const [following, setFollowing] = useState(false);
  const freshReply = latest?.coachReply && latest.reviewedAt && Date.now() - Date.parse(latest.reviewedAt) < 7 * 86400000 ? latest : null;
  return (
    <>
      <LiveNowBanner onJoin={() => setFollowing(true)} />
      {following && <LiveFollow onClose={() => setFollowing(false)} />}
      <AssessmentBanner />
      {cover ? (
        <section className="hero cover" aria-label="Today's session">
          <HeroBackdrop art={hero} word={null} />
          <div className="cv-top">
            <div className="cv-hi"><span>Hi {clientName.split(" ")[0]}</span><small>{week.todayLabel}</small></div>
            <Avatar initials={clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={38} />
          </div>
          <div className="cv-days" role="list" aria-label="Your week">
            {week.days.map(({ label: d, date, trained, planned, today }, i) => {
              const I = trained ? Icons.flame : planned ? Icons.train : null;
              return (
                <span key={d} role="listitem" className={`cv-day${trained ? " done" : ""}${today ? " today" : ""}`} style={{ ["--i" as string]: i }} aria-label={`${d} ${date}${trained ? ", trained" : today ? ", today" : planned ? ", planned" : ", rest"}`}>
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
          <div><p className="sub">{week.todayLabel}</p><ScriptTitle script="Hi">{clientName.split(" ")[0]}</ScriptTitle></div>
          <Avatar initials={clientName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={44} />
        </div>
      )}


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
                <span style={{ color: "var(--text)", minWidth: 0 }}>{exerciseFor(it).name}{it.note && <span className="tiny" style={{ display: "block" }}>{it.note}</span>}</span>
                <span className="num" style={{ marginLeft: "auto" }}>{it.sets}×{it.reps}{it.kg ? ` · ${u.fw(it.kg)}` : ""}</span>
              </li>
            ))}
            </ul>
            {w.items.length > 0 && <button className="link ap-open" onClick={() => setAsPlanned(true)}>Already trained? Log it as planned</button>}
          </div>
          {asPlanned && <AsPlannedSheet onClose={() => setAsPlanned(false)} onDone={() => { setAsPlanned(false); window.scrollTo(0, 0); say?.(`Session logged · ${coachName} can see it`); }} />}
        </>
      ) : (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--good) 45%,var(--line))", background: "var(--good-soft)" }}>
          <div className="eyebrow" style={{ color: "var(--good)" }}>Done for today</div>
          <h2 className="h2" style={{ marginTop: 6 }}>{log.workoutName}</h2>
          <div className="small num" style={{ marginTop: 4 }}>{log.sets} sets{log.summary?.totalReps ? ` · ${log.summary.totalReps} reps` : ""} · {u.fw(log.volumeKg, 0)} · {log.minutes} min · RPE {log.rpe}{log.prs ? ` · ${log.prs} PR` : ""}</div>
          {log.summary && <div style={{ marginTop: 12 }}><WorkoutSummaryCard summary={log.summary} compact /></div>}
        </div>
      )}

      <PlanChanged />
      {go && <FirstWeek go={go} />}

      {life.status === "ready" && !life.intake && !(go && firstWeek.visible) && (
        <div className="card" style={{ borderColor: "color-mix(in srgb,var(--act) 40%,var(--line))" }}>
          <div className="eyebrow" style={{ color: "var(--act)" }}>Before you start</div>
          <h2 className="h2" style={{ marginTop: 6 }}>Tell {coachName} about you</h2>
          <div className="small" style={{ marginTop: 4 }}>A short health check, your goals and your training so far. About five minutes.</div>
          <button className="btn sec block" style={{ marginTop: 12 }} onClick={openIntake}>Start</button>
        </div>
      )}

      {on("habits") && life.habits.length > 0 && (
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

      {/* On a training day the readiness check before the first set asks this, so the card is for rest days and after the session. */}
      {on("mood") && !checkedIn && !(status === "ready" && !log && w.items.length > 0) && (
        <div className="card">
          <div className="sect" style={{ marginBottom: 8 }}><h3 className="h3">How are you feeling today?</h3><span className="tiny">10 seconds</span></div>
          <div className="rpe">
            {MOODS.map((m, i) => <button key={m} className={mood === i ? "on" : ""} onClick={() => setMood(i)} style={{ fontFamily: "var(--ui)", fontSize: 13 }}>{m}</button>)}
          </div>
          {mood !== null && <button className="btn sec block" style={{ marginTop: 10 }} onClick={() => { store.sendMessage("client", `Feeling ${MOODS[mood]!.toLowerCase()} today`); onCheckIn(); }}>Send to {coachName}</button>}
        </div>
      )}

      {(on("rings") || (openTeam && on("community"))) && <section aria-label="Today's rings">
        {on("rings") && <>
        <DailyRings rings={rings.today} streak={rings.streak.days} best={rings.streak.best} />
        <RingWeek days={rings.week} labels={ringLabels} />
        <p className="tiny dr-nudge">{rings.nudge}</p>
        <LevelRow level={lv.level} onOpen={() => setLevels(true)} />
        <FreshMilestone list={lv.list} today={lv.today} say={say} />
        </>}
        {openTeam && on("community") && <TeamPeek onOpen={openTeam} />}
        {levels && <LevelsSheet onClose={() => setLevels(false)} say={say} />}
      </section>}
      <section aria-label="This week">
        <div className="sect" style={{ marginBottom: 8 }}>
          <h2 className="h3">This week</h2>
          <span className="tiny num">{week.done} of {week.planned} done</span>
        </div>
        {!cover && <div className="daystrip">
          {week.days.map(({ label: d, date, trained, today }) => {
            return (
              <div key={d} className={`day ${trained ? "done" : ""} ${today ? "today" : ""}`} aria-label={`${d} ${date}${trained ? ", trained" : today ? ", today" : ""}`}>
                <small>{d}</small><b>{date}</b><i />
              </div>
            );
          })}
        </div>}
        <WeekStoryCard onOpen={() => setStory(true)} />
        {story && <WeekStoryViewer onClose={() => setStory(false)} />}
      </section>
      {!(go && firstWeek.visible) && <PushPrompt say={say ?? (() => {})} />}
      <HappinessPrompt say={say} fallback={<ReviewPrompt say={say} />} />
    </>
  );
}
