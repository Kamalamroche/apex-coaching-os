/* Never run out: spot programmes about to end, and draft the next block from the last week, progressed.
   Pure. The coach reviews the new weeks in the Builder; clients only reach them when the current block ends. */

import { copyWeek } from "./program";
import type { Program } from "./types";

const DAY = 864e5;

export type RunwayStatus = "ok" | "ending" | "ended";

export interface Runway { daysLeft: number; status: RunwayStatus; label: string }

/** How long a programme has left, from when it started and how many weeks it runs. */
export function programmeRunway(p: { createdAt: string; weeks: number }, now = new Date()): Runway {
  const end = Date.parse(p.createdAt) + Math.max(1, p.weeks) * 7 * DAY;
  const daysLeft = Math.ceil((end - now.getTime()) / DAY);
  if (daysLeft <= 0) return { daysLeft, status: "ended", label: daysLeft === 0 ? "Ended today" : `Ended ${-daysLeft} day${daysLeft === -1 ? "" : "s"} ago` };
  return { daysLeft, status: daysLeft <= 7 ? "ending" : "ok", label: daysLeft === 1 ? "Ends tomorrow" : `Ends in ${daysLeft} days` };
}

/** Clients whose programme ends within a week or already has, the soonest first. */
export function endingSoon<T extends { createdAt: string; weeks: number }>(list: T[], now = new Date()): (T & { runway: Runway })[] {
  return list.map((p) => ({ ...p, runway: programmeRunway(p, now) })).filter((p) => p.runway.status !== "ok").sort((a, b) => a.runway.daysLeft - b.runway.daysLeft);
}

/** Planned weeks left after the week the client is on: 0 = this is the last week with training in it.
    Empty weeks don't count, so an 8-week programme with only 4 weeks written runs out after week 4. */
export const weeksLeft = (program: Program, currentWeek: number) => Math.max(0, Math.max(0, ...program.days.map((d) => d.week)) - currentWeek);

/**
 * The next block: the last week copied forward `add` times, each week progressed from the one before
 * (loads go up where every rep was hit at or under target RPE). Returns the programme and the first new week.
 */
export function nextBlock(program: Program, add = 4): { program: Program; firstWeek: number; added: number } {
  const last = Math.max(0, ...program.days.map((d) => d.week));
  if (!last) return { program, firstWeek: 1, added: 0 };
  let p = program;
  let added = 0;
  for (let w = last; w < last + add; w++) {
    const r = copyWeek(p, w, w + 1, { progress: true });
    p = r.program;
    added += r.added.length;
  }
  return { program: p, firstWeek: last + 1, added };
}
