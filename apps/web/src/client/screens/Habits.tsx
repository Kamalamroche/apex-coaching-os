import { formatMl, habitDays, habitStreak, habitsOn, isDone, localDate, waterGoalMl, waterOn } from "@apex/core";
import { HabitDays, Icons, LiquidPill } from "@apex/ui";
import { useAppInfo } from "../../app/AppContext";
import { HabitIcon, LifestyleStatus, daysText } from "../../app/LifestyleParts";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";
import { WaterIcon, WaterTracker } from "./Water";

/** Today's habits with a tick each. `compact` is the card on Today. */
export function HabitList({ compact = false }: { compact?: boolean }) {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const today = localDate(new Date());
  const due = habitsOn(s.habits, today);
  if (!due.length) return null;
  return (
    <div className="card flat list">
      {due.map((h) => {
        const done = isDone(s.ticks, h.id, today);
        const streak = habitStreak(h, s.ticks, today);
        return (
          <div key={h.id} className="hb-row">
            {h.kind === "water" && s.waterReady ? <WaterIcon /> : <HabitIcon kind={h.kind} />}
            <div className="grow">
              <div className="h3" style={{ textDecoration: done && compact ? "line-through" : undefined, color: done && compact ? "var(--text2)" : undefined }}>{h.title}</div>
              <div className="tiny">{h.kind === "water" && s.waterReady && !done ? `${formatMl(waterOn(s.water, today))} of ${formatMl(waterGoalMl(h.title))}` : streak > 0 ? <><Icons.flame width={12} height={12} style={{ verticalAlign: -2, color: "var(--act)" }} /> {streak} day{streak === 1 ? "" : "s"} in a row</> : compact ? "Not started" : daysText(h.days)}</div>
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
        {due.length > 0 && <LiquidPill value={done} max={due.length} label={`${done} of ${due.length} habits done today`} size="md" />}
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
