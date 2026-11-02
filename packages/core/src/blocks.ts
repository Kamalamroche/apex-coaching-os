/* Blocks: the items sharing a letter. One item is a straight set; two a superset, three a tri-set,
   four or more a giant set. Any linked block can run as a circuit: round by round, stations often timed. */

import type { SessionSets } from "./session";
import type { SetTarget, Workout, WorkoutItem } from "./types";

/** The items in the same block as the one at `index`, in order, with their positions. */
export function blockAt(items: WorkoutItem[], index: number): { start: number; items: WorkoutItem[] } {
  const letter = items[index]?.group[0];
  let start = index;
  while (start > 0 && items[start - 1]?.group[0] === letter) start--;
  let end = index;
  while (end < items.length - 1 && items[end + 1]?.group[0] === letter) end++;
  return { start, items: items.slice(start, end + 1) };
}

/** What the block is called in the builder and the player. */
export function blockLabel(block: WorkoutItem[]): string {
  if (block[0]?.blockStyle === "circuit") return `Circuit · ${block[0].sets} round${block[0].sets === 1 ? "" : "s"}`;
  return block.length >= 4 ? "Giant set" : block.length === 3 ? "Tri-set" : block.length === 2 ? "Superset" : "Straight sets";
}

const mapBlock = (workout: Workout, key: string, fn: (it: WorkoutItem, i: number, block: WorkoutItem[]) => WorkoutItem): Workout => {
  const index = workout.items.findIndex((it) => it.key === key);
  if (index < 0) return workout;
  const { start, items: block } = blockAt(workout.items, index);
  return { ...workout, items: workout.items.map((it, i) => (i >= start && i < start + block.length ? fn(it, i - start, block) : it)) };
};

/** Runs a linked block as a circuit (or back to normal). A circuit's rounds are every station's sets, so they are lined up;
    stations rest 0 (go straight to the next) and the last station's rest is the rest between rounds. */
export function setCircuit(workout: Workout, key: string, on: boolean): Workout {
  return mapBlock(workout, key, (it, i, block) => {
    if (!on) {
      const { blockStyle: _b, ...rest } = it;
      return rest;
    }
    const rounds = Math.max(...block.map((b) => b.sets));
    const last = i === block.length - 1;
    return { ...it, blockStyle: "circuit", sets: rounds, restSeconds: last ? Math.max(it.restSeconds, 60) : 0, ...(it.setPlan ? { setPlan: fitPlan(it.setPlan, rounds) } : {}) };
  });
}

export const setRounds = (workout: Workout, key: string, rounds: number): Workout =>
  mapBlock(workout, key, (it) => ({ ...it, sets: rounds, ...(it.setPlan ? { setPlan: fitPlan(it.setPlan, rounds) } : {}) }));

/* ---------- per-set targets ---------- */

/** Stretches or trims a plan to `sets` entries, repeating the last set. */
export function fitPlan(plan: SetTarget[], sets: number): SetTarget[] {
  const last = plan.at(-1) ?? { reps: "10", kg: 0 };
  return Array.from({ length: sets }, (_, i) => ({ ...(plan[i] ?? last) }));
}

/** What each set asks for: the per-set plan when there is one, otherwise the item's reps and kg every set. */
export const setTargets = (item: WorkoutItem): SetTarget[] =>
  item.setPlan ? fitPlan(item.setPlan, item.sets) : Array.from({ length: item.sets }, () => ({ reps: item.reps, kg: item.kg }));

/** Turns per-set targets on (starting from the current prescription) or off (back to the first set's numbers). */
export function setVarySets(item: WorkoutItem, on: boolean): WorkoutItem {
  if (on) return { ...item, setPlan: setTargets(item) };
  const { setPlan, ...rest } = item;
  const first = setPlan?.[0];
  return first ? { ...rest, reps: first.reps, kg: first.kg } : rest;
}

/** Edits one set of the plan. The item's own reps and kg follow the top set, so lists and summaries stay meaningful. */
export function updateSetTarget(item: WorkoutItem, index: number, patch: Partial<SetTarget>): WorkoutItem {
  const setPlan = setTargets(item).map((s, i) => (i === index ? { ...s, ...patch } : s));
  const top = setPlan.reduce((a, b) => (b.kg > a.kg ? b : a), setPlan[0] as SetTarget);
  return { ...item, setPlan, reps: top.reps, kg: top.kg };
}

/** "8 · 6 · 4" or "60 → 70 → 80 kg" for a compact line. */
export function planSummary(item: WorkoutItem): string {
  const t = setTargets(item);
  const reps = t.map((s) => s.reps).join(" · ");
  const kgs = [...new Set(t.map((s) => s.kg))];
  return kgs.length > 1 ? `${reps} reps · ${t.map((s) => s.kg).join(" → ")} kg` : `${reps} reps${kgs[0] ? ` · ${kgs[0]} kg` : ""}`;
}

/* ---------- the player's route through a block ---------- */

/** Where the player goes after a set is ticked. In a linked block the client moves to the next station that still
    has a set to do, coming back round to the first; rest runs after the last station of each round. A straight set
    rests and stays put. `next` null = stay on this item. */
export function afterSet(workout: Workout, sets: SessionSets, index: number): { next: number | null; restSeconds: number } {
  const item = workout.items[index];
  if (!item) return { next: null, restSeconds: 0 };
  const { start, items: block } = blockAt(workout.items, index);
  if (block.length === 1) return { next: null, restSeconds: item.restSeconds };
  const pending = (i: number) => (sets[workout.items[i]?.key ?? ""] ?? []).some((s) => !s.done);
  const pos = index - start;
  // Next station after this one in the round, then wrap round to the start of the block.
  for (let n = 1; n <= block.length; n++) {
    const p = (pos + n) % block.length;
    if (!pending(start + p)) continue;
    const wrapped = p <= pos;
    const last = block[block.length - 1] as WorkoutItem;
    return { next: start + p === index ? null : start + p, restSeconds: wrapped ? last.restSeconds || item.restSeconds : item.restSeconds };
  }
  // Block finished: rest, then the player offers the next exercise.
  return { next: null, restSeconds: item.restSeconds };
}

/** Seconds for a timed target such as "40s"; null for reps. */
/** "1000m" or "20 m" → 1000 / 20: a distance station (run, row, sled). Null for reps or time. */
export const distanceMetres = (reps: string): number | null => {
  const m = /^(\d+)\s*m$/i.exec(reps.trim());
  return m ? Number(m[1]) : null;
};

export const timedSeconds = (reps: string): number | null => {
  const m = /^(\d+)\s*s$/i.exec(reps.trim());
  return m ? Number(m[1]) : null;
};
