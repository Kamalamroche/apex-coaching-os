import { WATER_SIZES, formatMl, isDone, localDate, waterGoalMl, waterHabitOn, waterLogOn, waterOn, type WaterEntry } from "@apex/core";
import { CountUp, Icons, LiquidTank, NumberSheet, useToast } from "@apex/ui";
import { useState } from "react";
import { useLifestyle, useLifestyleStore } from "../../data/LifestyleContext";

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Today's water against the goal, and the drink actions. Ticks the water habit when the goal is reached and unticks it if a drink is taken off below it. */
export function useWater() {
  const store = useLifestyleStore();
  const s = useLifestyle();
  const today = localDate(new Date());
  const habit = waterHabitOn(s.habits, today);
  const goal = habit ? waterGoalMl(habit.title) : 0;
  const total = waterOn(s.water, today);
  const add = (ml: number): boolean => {
    const e: WaterEntry = { id: newId(), day: today, ml, at: new Date().toISOString() };
    store.addWater(e);
    const reached = !!habit && total < goal && total + ml >= goal;
    if (reached && habit && !isDone(s.ticks, habit.id, today)) store.setHabitDone(habit.id, today, true);
    return reached;
  };
  const remove = (e: WaterEntry) => {
    store.removeWater(e.id);
    if (habit && total >= goal && total - e.ml < goal && isDone(s.ticks, habit.id, today)) store.setHabitDone(habit.id, today, false);
  };
  return { habit, goal, total, today, ready: s.waterReady, log: waterLogOn(s.water, today), add, remove };
}

/** The small water tile used as the habit's icon: the level of today's water. */
export function WaterIcon() {
  const w = useWater();
  return <LiquidTank size="mini" pct={w.goal ? w.total / w.goal : 0} label={`${formatMl(w.total)} of ${formatMl(w.goal)} water`} />;
}

/** Full water tracker: a tank that fills as the client drinks, quick-add sizes, a custom amount on the wheel, and today's log. */
export function WaterTracker() {
  const w = useWater();
  const [custom, setCustom] = useState(false);
  const [toast, show] = useToast();
  if (!w.habit) return null;
  if (!w.ready) return <div className="card small">The water tracker needs a quick database update. Ask your coach to run the water SQL in Supabase. Your habits still work as normal.</div>;
  const pct = w.goal ? w.total / w.goal : 0;
  const drink = (ml: number) => { if (w.add(ml)) show("Water goal reached"); };
  const left = Math.max(0, w.goal - w.total);
  return (
    <section aria-label="Water today" className="stack" style={{ gap: 10 }}>
      <LiquidTank pct={pct} className="lq-full" big={<><CountUp value={Math.round(pct * 100)} /><small>%</small></>}>
        <div className="lq-head">
          <div>
            <div className="eyebrow">Water today</div>
            <h2 className="h1 num"><CountUp value={w.total} format={(v) => Math.round(v).toLocaleString("en-GB")} /><small style={{ fontSize: 16, marginLeft: 4 }}>ml</small></h2>
            <small>of {w.goal.toLocaleString("en-GB")} ml{left ? ` · ${formatMl(left)} to go` : ""}</small>
            {!left && <div className="lq-goal" role="status"><Icons.check width={14} height={14} strokeWidth={2.5} /> Goal reached, habit ticked</div>}
          </div>
          <Icons.water width={22} height={22} style={{ color: "var(--data)", flex: "none" }} aria-hidden />
        </div>
        <div className="lq-chips" role="group" aria-label="Add a drink">
          {WATER_SIZES.map((ml) => (
            <button key={ml} className="lq-chip" onClick={() => drink(ml)} aria-label={`Add ${ml} ml`}><Icons.plus width={12} height={12} strokeWidth={2.6} />{ml} ml</button>
          ))}
          <button className="lq-chip solid" onClick={() => setCustom(true)}>Custom</button>
        </div>
      </LiquidTank>
      {w.log.length > 0 && (
        <div className="card flat list">
          {w.log.map((e) => (
            <div key={e.id} className="wlog">
              <span className="hb-ico" aria-hidden style={{ color: "var(--data)" }}><Icons.water /></span>
              <div className="grow"><div className="ml">+{e.ml} ml</div><div className="tiny">{clock(e.at)}</div></div>
              <button className="iconbtn" onClick={() => w.remove(e)} aria-label={`Remove ${e.ml} ml at ${clock(e.at)}`}>Undo</button>
            </div>
          ))}
        </div>
      )}
      {custom && <NumberSheet title="Add water" value={300} min={50} max={2000} step={50} unit="ml" onClose={() => setCustom(false)} onConfirm={(ml) => { setCustom(false); drink(ml); }} />}
      {toast}
    </section>
  );
}
