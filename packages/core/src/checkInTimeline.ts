/* Check-ins side by side: every answer a client gave, week by week, so the coach sees patterns at a glance
   (energy sliding for three weeks, steps "No" twice running). Pure, so it is unit tested. No AI. */

import { RATINGS, type CheckIn, type RatingKey } from "./checkins";

export type CellTone = "good" | "bad" | null;

export interface TimelineCell {
  /** What to show: "62.4", "4", "Yes", "Busy week at work". Empty when not answered. */
  text: string;
  /** Green or red against the week before, for numbers and yes/no. */
  tone: CellTone;
}

export interface TimelineRow {
  label: string;
  kind: "number" | "yesno" | "text";
  cells: TimelineCell[];
  /** Plain words for the coach when a number moved the same way for 3 weeks or more. */
  streak: string | null;
}

export interface CheckInTimeline {
  /** Oldest first: "4 Oct", "11 Oct"… */
  weeks: { id: string; label: string }[];
  rows: TimelineRow[];
}

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Higher is better for these; lower is better for stress. Weight is neither: no colour. */
const BETTER_UP: Record<RatingKey | "sleepHours", boolean> = { energy: true, mood: true, stress: false, hunger: false, training: true, nutrition: true, sleepHours: true };

function numberRow(label: string, values: (number | null | undefined)[], betterUp: boolean | null): TimelineRow | null {
  if (values.every((v) => v == null)) return null;
  const cells = values.map((v, i) => {
    const prev = i > 0 ? values[i - 1] : null;
    let tone: CellTone = null;
    if (v != null && prev != null && betterUp !== null && v !== prev) tone = (v > prev) === betterUp ? "good" : "bad";
    return { text: v == null ? "" : `${Math.round(v * 10) / 10}`, tone };
  });
  // Three or more moves the same way at the end of the run.
  let run = 0;
  let dir = 0;
  for (let i = values.length - 1; i > 0; i--) {
    const a = values[i];
    const b = values[i - 1];
    if (a == null || b == null || a === b) break;
    const d = a > b ? 1 : -1;
    if (dir && d !== dir) break;
    dir = d;
    run++;
  }
  const streak = run >= 3 ? `${label.replace(/ \(.*\)$/, "")} ${dir > 0 ? "up" : "down"} ${run} check-ins running` : null;
  return { label, kind: "number", cells, streak };
}

/**
 * The last `max` check-ins as columns (oldest first) and every answer as a row: weight, sleep, the 1 to 5 ratings,
 * then the coach's own questions (matched by question id), then wins and struggles.
 */
export function checkInTimeline(checkIns: CheckIn[], max = 6): CheckInTimeline {
  const list = [...checkIns].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)).slice(-max);
  const rows: TimelineRow[] = [];
  const push = (r: TimelineRow | null) => { if (r) rows.push(r); };
  push(numberRow("Weight (kg)", list.map((c) => c.weightKg), null));
  push(numberRow("Sleep (h)", list.map((c) => c.sleepHours), BETTER_UP.sleepHours));
  for (const r of RATINGS) push(numberRow(r.label, list.map((c) => c[r.key]), BETTER_UP[r.key]));

  // The coach's questions, in the order they first appear.
  const seen = new Map<string, { question: string; kind: "text" | "scale" | "yesno" }>();
  for (const c of list) for (const a of c.answers ?? []) if (!seen.has(a.id)) seen.set(a.id, { question: a.question, kind: a.kind });
  for (const [id, q] of seen) {
    const values = list.map((c) => c.answers?.find((a) => a.id === id)?.value);
    if (q.kind === "scale") { push(numberRow(q.question, values.map((v) => (typeof v === "number" ? v : null)), true)); continue; }
    if (q.kind === "yesno") {
      const cells = values.map((v, i) => {
        const prev = i > 0 ? values[i - 1] : undefined;
        const tone: CellTone = typeof v === "boolean" && typeof prev === "boolean" && v !== prev ? (v ? "good" : "bad") : null;
        return { text: typeof v === "boolean" ? (v ? "Yes" : "No") : "", tone };
      });
      const lastNos = [...values].reverse().findIndex((v) => v !== false);
      const nos = lastNos === -1 ? values.length : lastNos;
      rows.push({ label: q.question, kind: "yesno", cells, streak: nos >= 2 ? `"No" ${nos} check-ins running` : null });
      continue;
    }
    rows.push({ label: q.question, kind: "text", cells: values.map((v) => ({ text: typeof v === "string" ? v.trim() : "", tone: null })), streak: null });
  }
  for (const [label, key] of [["Wins", "wins"], ["Hard this week", "struggles"]] as const) {
    if (list.some((c) => c[key].trim())) rows.push({ label, kind: "text", cells: list.map((c) => ({ text: c[key].trim(), tone: null })), streak: null });
  }
  return { weeks: list.map((c) => ({ id: c.id, label: DAY(c.submittedAt) })), rows };
}
