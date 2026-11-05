import { WATER_SIZES, formatMl, isDone, localDate, waterGoalMl, waterHabitOn, waterLogOn, waterOn, type WaterEntry } from "@apex/core";
import { CountUp, Icons, LiquidTank, NumberSheet, enableTilt, useToast } from "@apex/ui";
import { useState } from "react";
import { createPortal } from "react-dom";
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

/** The chips that add a drink, and "Custom" for any amount on the wheel. */
function DrinkChips({ onDrink, onCustom }: { onDrink: (ml: number) => void; onCustom: () => void }) {
  return (
    <div className="lq-chips" role="group" aria-label="Add a drink">
      {WATER_SIZES.map((ml) => (
        <button key={ml} className="lq-chip" onClick={() => onDrink(ml)} aria-label={`Add ${ml} ml`}><Icons.plus width={13} height={13} strokeWidth={2.4} />{ml} ml</button>
      ))}
      <button className="lq-chip solid" onClick={onCustom}>Custom</button>
    </div>
  );
}

/**
 * Water on the Habits page: a card of water that fills as the client drinks, with quick-add sizes.
 * Tapping "Open" goes full screen, with today's log underneath.
 */
export function WaterTracker() {
  const w = useWater();
  const [custom, setCustom] = useState(false);
  const [full, setFull] = useState(false);
  const [toast, show] = useToast();
  if (!w.habit) return null;
  if (!w.ready) return <div className="card small">The water tracker needs a quick database update. Ask your coach to run the water SQL in Supabase. Your habits still work as normal.</div>;
  const pct = w.goal ? w.total / w.goal : 0;
  const drink = (ml: number) => {
    enableTilt();
    if (w.add(ml)) show("Water goal reached");
  };
  const left = Math.max(0, w.goal - w.total);
  const head = (
    <>
      <h2 className="lq-title"><b>Water</b></h2>
      <div className="lq-line">today: <b><CountUp value={w.total} /></b> of {w.goal.toLocaleString("en-GB")} ml</div>
      {left ? null : <div className="lq-goal" role="status"><Icons.check width={13} height={13} strokeWidth={2.6} /> Goal reached · habit ticked</div>}
    </>
  );
  const sheet = custom && <NumberSheet title="Add water" value={300} min={50} max={2000} step={50} unit="ml" onClose={() => setCustom(false)} onConfirm={(ml) => { setCustom(false); drink(ml); }} />;
  return (
    <section aria-label="Water today">
      <LiquidTank pct={pct} className="lq-scene lq-card" label={`Water: ${formatMl(w.total)} of ${formatMl(w.goal)}, ${Math.round(pct * 100)}%`} top={0.5} bottom={0.06} numberTop={168}>
        <div className="lq-head">
          <div>{head}</div>
          <button className="lq-open" onClick={() => setFull(true)}>Open <Icons.forward width={14} height={14} /></button>
        </div>
        <DrinkChips onDrink={drink} onCustom={() => setCustom(true)} />
      </LiquidTank>
      {full && createPortal(
        <div className="lqx" role="dialog" aria-modal="true" aria-label="Water today">
          <LiquidTank pct={pct} className="lq-scene" top={0.27} bottom={0.36} numberTop={210} numberBottom={64}>
            <div className="lqx-top">
              <button className="lqx-back" onClick={() => setFull(false)} aria-label="Back to habits"><Icons.back width={18} height={18} /></button>
            </div>
            {head}
            <div className="lqx-foot">
              <DrinkChips onDrink={drink} onCustom={() => setCustom(true)} />
              <div className="lqx-log">
                <h3>Today</h3>
                {w.log.length ? w.log.map((e) => (
                  <div key={e.id} className="wlog">
                    <span className="grow ml">Water (+{e.ml} ml)</span>
                    <time>{clock(e.at)}</time>
                    <button className="iconbtn" onClick={() => w.remove(e)} aria-label={`Remove ${e.ml} ml at ${clock(e.at)}`}>Undo</button>
                  </div>
                )) : <div className="small">Nothing yet. Tap a size above when you drink.</div>}
              </div>
            </div>
          </LiquidTank>
          {sheet}
        </div>,
        document.body,
      )}
      {!full && sheet}
      {toast}
    </section>
  );
}
