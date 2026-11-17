import { exerciseById } from "./library";
import type { Workout, WorkoutItem } from "./types";

/* "Why your plan changed": the coach publishes changes to a day with a short reason, the client gets a chat
   message, and Today shows it as a card until they've read it. The message is the record, so nothing new is stored. */

export const PLAN_UPDATE_MARK = "🔄 Plan update";

export type PlanChangeKind = "added" | "removed" | "swapped" | "changed";
export interface PlanChange { kind: PlanChangeKind; exercise: string; detail: string }

const name = (it: WorkoutItem) => exerciseById(it.exerciseId).name;
const kgText = (kg: number) => `${Math.round(kg * 10) / 10} kg`;

/** What the client will notice, item by item: new and dropped exercises, swaps, and load, sets, reps or rest changes. */
export function planChanges(before: Workout, after: Workout): PlanChange[] {
  const out: PlanChange[] = [];
  for (const b of before.items) {
    const a = after.items.find((x) => x.key === b.key);
    if (!a) { out.push({ kind: "removed", exercise: name(b), detail: "taken out" }); continue; }
    if (a.exerciseId !== b.exerciseId) { out.push({ kind: "swapped", exercise: name(b), detail: `swapped for ${name(a)}` }); continue; }
    const parts: string[] = [];
    if (a.kg !== b.kg) parts.push(b.kg && a.kg ? `${kgText(b.kg)} → ${kgText(a.kg)}` : a.kg ? `now ${kgText(a.kg)}` : "bodyweight now");
    if (a.sets !== b.sets) parts.push(`${b.sets} → ${a.sets} sets`);
    if (a.reps !== b.reps) parts.push(`${b.reps} → ${a.reps} reps`);
    if (a.restSeconds !== b.restSeconds) parts.push(`rest ${b.restSeconds} → ${a.restSeconds} s`);
    if (a.rpe !== b.rpe) parts.push(`effort RPE ${b.rpe} → ${a.rpe}`);
    if (parts.length) out.push({ kind: "changed", exercise: name(a), detail: parts.join(", ") });
  }
  for (const a of after.items) {
    if (!before.items.some((b) => b.key === a.key)) out.push({ kind: "added", exercise: name(a), detail: `added: ${a.sets} × ${a.reps}${a.kg ? ` at ${kgText(a.kg)}` : ""}` });
  }
  return out;
}

export const changeLine = (c: PlanChange) => (c.kind === "changed" ? `${c.exercise}: ${c.detail}` : `${c.exercise} ${c.detail}`);

/** The chat message. The reason goes first, in the coach's words. */
export function planUpdateMessage(workoutName: string, changes: PlanChange[], why: string): string {
  const lines = [`${PLAN_UPDATE_MARK} · ${workoutName}`];
  if (why.trim()) lines.push(`Why: ${why.trim()}`);
  for (const c of changes) lines.push(`• ${changeLine(c)}`);
  return lines.join("\n");
}

export interface PlanUpdate { workoutName: string; why: string; lines: string[] }

/** Reads a plan update back out of a chat message, or null for any other message. */
export function parsePlanUpdate(text: string): PlanUpdate | null {
  const [head, ...rest] = text.split("\n");
  if (!head?.startsWith(PLAN_UPDATE_MARK)) return null;
  const workoutName = head.slice(PLAN_UPDATE_MARK.length).replace(/^\s*·\s*/, "").trim();
  const why = rest.find((l) => l.startsWith("Why: "))?.slice(5).trim() ?? "";
  const lines = rest.filter((l) => l.startsWith("• ")).map((l) => l.slice(2));
  return { workoutName, why, lines };
}

/** A short stable key for a message, so "got it" survives the chat list growing or being trimmed. */
export function textKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}-${(h >>> 0).toString(36)}`;
}

/** The newest plan update the coach sent, with a key that identifies it for "got it". */
export function latestPlanUpdate(messages: { from: string; text: string }[]): (PlanUpdate & { key: string }) | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.from !== "coach") continue;
    const p = parsePlanUpdate(m.text);
    if (p) return { ...p, key: textKey(m.text) };
  }
  return null;
}
