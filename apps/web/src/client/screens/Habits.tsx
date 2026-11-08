import { bedtimeGoal, clockLabel, clockMinutes, formatMl, habitDays, habitStreak, habitsOn, isDone, localDate, stepsGoal, waterGoalMl, waterOn, type Habit, type RecoveryDay } from "@apex/core";
import { useEffect, useRef } from "react";
import { HabitDays, Icons, LiquidTile, NightTile, StepsTile } from "@apex/ui";
import { useAppInfo } from "../../app/AppContext";
import { HabitIcon, LifestyleStatus, daysText } from "../../app/LifestyleParts";
import { useActivitiesIfAny } from "../../data/ActivityContext";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";
import { WaterIcon, WaterTracker } from "./Water";

/** Today's habits with a tick each. `compact` is the card on Today. */
export function HabitList({ compact = false }: { compact?: boolean }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const today = localDate(new Date());
  const due = habitsOn(s.habits, today);
  // What the watch or ring measured: today's steps, and the night that ended this morning.
  const day = useActivitiesIfAny().recovery.find((d) => d.date === today);
  useAutoTicks(due, day, today);
  if (!due.length) return null;
  return (
    <div className="card flat list">
      {due.map((h) => {
        const done = isDone(s.ticks, h.id, today);
        const streak = habitStreak(h, s.ticks, today);
        return (
          <div key={h.id} className="hb-row">
            {h.kind === "water" && s.waterReady ? <WaterIcon />
              : h.kind === "steps" ? <StepsTile pct={done ? 1 : (day?.steps ?? 0) / stepsGoal(h.title)} label={day?.steps != null ? `${day.steps.toLocaleString("en-GB")} steps today` : h.title} />
              : h.kind === "sleep" ? <NightTile done={done} label={h.title} />
              : <HabitIcon kind={h.kind} />}
            <div className="grow">
              <div className="h3" style={{ textDecoration: done && compact ? "line-through" : undefined, color: done && compact ? "var(--text2)" : undefined }}>{h.title}</div>
              <div className="tiny">{h.kind === "water" && s.waterReady && !done ? `${formatMl(waterOn(s.water, today))} of ${formatMl(waterGoalMl(h.title))}` : !done && measured(h, day) ? measured(h, day) : streak > 0 ? <><Icons.flame width={12} height={12} style={{ verticalAlign: -2, color: "var(--act)" }} /> {streak} day{streak === 1 ? "" : "s"} in a row</> : compact ? "Not started" : daysText(h.days)}</div>
            </div>
            <button className={`tick ${done ? "on" : ""}`} aria-pressed={done} aria-label={`${h.title}: ${done ? "done" : "not done"}`} onClick={() => store.setHabitDone(h.id, today, !done)}>
              {done && <Icons.check width={20} height={20} strokeWidth={2.5} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Habits() {
  const s = useLifestyle();
  const { coachName } = useAppInfo();
  const today = localDate(new Date());
  const due = habitsOn(s.habits, today);
  const done = due.filter((h) => isDone(s.ticks, h.id, today)).length;
  const status = <LifestyleStatus state={s} />;
  return (
    <>
      <div className="stack" style={{ gap: 12 }}>
        <div><div className="eyebrow">Habits</div><h1 className="h1">{due.length ? `${done} of ${due.length} today` : "Your habits"}</h1></div>
        {due.length > 0 && <LiquidTile title="Today." sub={done === due.length ? "All done" : `${due.length - done} to go`} value={Math.round((done / due.length) * 100)} max={100} label={`${done} of ${due.length} habits done today`} />}
      </div>
      {s.status !== "ready" ? status : !s.habits.length ? (
        <div className="card small">No habits yet. {coachName} will add a few small daily ones, like water or steps. They'll show up here and on Today.</div>
      ) : (
        <>
          <WaterTracker />
          {due.length ? <HabitList /> : <div className="card small">Nothing due today. Enjoy the day off.</div>}
          <div className="card">
            <div className="sect" style={{ marginBottom: 10 }}><h3 className="h3">Last 7 days</h3></div>
            <HabitDays days={habitDays(s.habits, s.ticks, today)} today={today} />
          </div>
        </>
      )}
    </>
  );
}

/** The measured value behind a steps or bedtime habit, when a watch or ring sent one. */
function measured(h: Habit, day: RecoveryDay | undefined): string | null {
  if (h.kind === "steps" && day?.steps != null) return `${day.steps.toLocaleString("en-GB")} of ${stepsGoal(h.title).toLocaleString("en-GB")} steps`;
  if (h.kind === "sleep" && day?.bedtime) return `In bed ${clockLabel(clockMinutes(day.bedtime))} last night, goal ${clockLabel(bedtimeGoal(h.title))}`;
  return null;
}

/**
 * Ticks steps and bedtime habits by themselves when the watch shows they were met, like water does at its goal.
 * Each habit is ticked at most once a day this way, so unticking it by hand sticks.
 */
function useAutoTicks(due: Habit[], day: RecoveryDay | undefined, today: string) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!day) return;
    for (const h of due) {
      const key = `${h.id}:${today}`;
      if (tried.current.has(key) || isDone(s.ticks, h.id, today)) continue;
      const met = (h.kind === "steps" && day.steps != null && day.steps >= stepsGoal(h.title))
        || (h.kind === "sleep" && !!day.bedtime && clockMinutes(day.bedtime) <= bedtimeGoal(h.title));
      if (met) { tried.current.add(key); store.setHabitDone(h.id, today, true); }
    }
  }, [due, day, today, s.ticks, store]);
}
