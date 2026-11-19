/* Master programmes: the coach fixes one client's programme, then shares the change with everyone on the same
   programme. Pure: what would change for each client, in plain words, so the coach ticks who gets it. */

import { exerciseById } from "./library";
import type { Program, ProgramDay, WorkoutItem } from "./types";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface ProgramChange {
  kind: "added" | "removed" | "changed" | "day-added" | "day-removed" | "renamed";
  /** "W2 Thu · Back squat: 4×5 at 100 kg → 5×5 at 100 kg". */
  text: string;
}

const dayId = (d: Pick<ProgramDay, "week" | "dayIndex">) => `${d.week}:${d.dayIndex}`;
const dayLabel = (d: Pick<ProgramDay, "week" | "dayIndex">) => `W${d.week} ${DAY_SHORT[d.dayIndex] ?? "?"}`;
const nameOf = (id: number) => exerciseById(id)?.name ?? `Exercise ${id}`;

/** "4×5 at 100 kg, RPE 8" in the units the programme is written in (kg). */
export function prescription(i: Pick<WorkoutItem, "sets" | "reps" | "kg" | "rpe">): string {
  return `${i.sets}×${i.reps}${i.kg ? ` at ${i.kg} kg` : ""}${i.rpe ? `, RPE ${i.rpe}` : ""}`;
}

const sameItem = (a: WorkoutItem, b: WorkoutItem) =>
  a.sets === b.sets && a.reps === b.reps && a.kg === b.kg && a.rpe === b.rpe && a.restSeconds === b.restSeconds &&
  (a.note ?? "") === (b.note ?? "") && JSON.stringify(a.setPlan ?? null) === JSON.stringify(b.setPlan ?? null) && (a.blockStyle ?? null) === (b.blockStyle ?? null);

/** What changes for a client on `from` if they get `to`. Empty when the two are the same. */
export function programChanges(from: Program, to: Program): ProgramChange[] {
  const out: ProgramChange[] = [];
  if (from.name !== to.name) out.push({ kind: "renamed", text: `Name: ${from.name} → ${to.name}` });
  const before = new Map(from.days.map((d) => [dayId(d), d]));
  const after = new Map(to.days.map((d) => [dayId(d), d]));
  const order = [...new Set([...to.days, ...from.days].sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex).map(dayId))];
  for (const id of order) {
    const a = before.get(id);
    const b = after.get(id);
    if (!a && b) { out.push({ kind: "day-added", text: `${dayLabel(b)}: new day “${b.name}”` }); continue; }
    if (a && !b) { out.push({ kind: "day-removed", text: `${dayLabel(a)}: “${a.name}” removed` }); continue; }
    if (!a || !b) continue;
    if (a.name !== b.name) out.push({ kind: "renamed", text: `${dayLabel(b)}: “${a.name}” → “${b.name}”` });
    // Match exercises by id, in order, so the same move twice in a day pairs up one to one.
    const left = [...a.items];
    for (const it of b.items) {
      const i = left.findIndex((x) => x.exerciseId === it.exerciseId);
      if (i < 0) { out.push({ kind: "added", text: `${dayLabel(b)} · ${nameOf(it.exerciseId)} added (${prescription(it)})` }); continue; }
      const [old] = left.splice(i, 1);
      if (old && !sameItem(old, it)) {
        const p1 = prescription(old);
        const p2 = prescription(it);
        out.push({ kind: "changed", text: `${dayLabel(b)} · ${nameOf(it.exerciseId)}: ${p1 === p2 ? "rest, notes or set targets changed" : `${p1} → ${p2}`}` });
      }
    }
    for (const old of left) out.push({ kind: "removed", text: `${dayLabel(a)} · ${nameOf(old.exerciseId)} removed` });
  }
  return out;
}

/** Clients whose current programme has the same name as the one open: the "master" group to share a change with. */
export function sameProgramme<T extends { programName: string | null }>(clients: T[], name: string): T[] {
  const key = name.trim().toLowerCase();
  return clients.filter((c) => (c.programName ?? "").trim().toLowerCase() === key);
}
