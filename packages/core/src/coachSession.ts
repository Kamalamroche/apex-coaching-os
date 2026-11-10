// One-to-one sessions run by the coach: the coach logs the client's sets on their own phone or tablet, then writes a
// session note (just for them, or shared with the client) and can take weight, measurements and photos on the spot.
// Pure, so it is unit tested.
import { buildSummary } from "./summary";
import { completedSets, countPersonalBests, sessionVolume, type SessionSets } from "./session";
import type { SessionLog, TrainingHistory, Workout } from "./types";

export interface SessionNote {
  id: string;
  clientId: string;
  body: string;
  /** True when the client can read it too. */
  shared: boolean;
  createdAt: string;
  /** "Lower A · 14 sets · 2,340 kg", when the note came with a session the coach ran. */
  session: string | null;
}

export const SESSION_NOTE_MAX = 1000;

export function sessionNoteProblem(body: string): string | null {
  const t = body.trim();
  if (t.length < 2) return "Write a few words first.";
  if (t.length > SESSION_NOTE_MAX) return `Keep it under ${SESSION_NOTE_MAX} characters.`;
  return null;
}

/** The session as the client would have logged it, ready for the store. */
export function coachSessionLog(workout: Workout, sets: SessionSets, minutes: number, history: TrainingHistory, rpe: number): SessionLog {
  return {
    workoutName: workout.name,
    sets: completedSets(sets),
    volumeKg: sessionVolume(sets),
    minutes,
    rpe,
    prs: countPersonalBests(workout, sets, history.bestKg),
    summary: buildSummary(workout, sets, minutes, history),
  };
}

/** One line about the session for a note's heading: "Lower A · 14 sets · 2,340 kg · 1 PB". */
export function sessionLine(log: Pick<SessionLog, "workoutName" | "sets" | "volumeKg" | "prs">): string {
  return [log.workoutName, `${log.sets} set${log.sets === 1 ? "" : "s"}`, log.volumeKg ? `${Math.round(log.volumeKg).toLocaleString("en-GB")} kg` : null, log.prs ? `${log.prs} PB` : null]
    .filter(Boolean)
    .join(" · ");
}

/** What the client gets in Messages after a session the coach ran: what they did, any new bests, and the shared note. */
export function coachSessionMessage(log: SessionLog, clientFirst: string, sharedNote: string | null): string {
  const lines = [`Great session today${clientFirst ? `, ${clientFirst}` : ""}. ${sessionLine(log)}.`];
  for (const b of log.summary?.bests ?? []) lines.push(`New best: ${b.exercise} ${b.kg} kg (was ${b.previousKg} kg).`);
  if (sharedNote?.trim()) lines.push("", sharedNote.trim());
  lines.push("", "It's in your history now, so you'll see it in Progress.");
  return lines.join("\n");
}

const DAY = 864e5;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Notes newest first, grouped "This week", "Last week", then by month ("October 2026"). */
export function noteTimeline(notes: SessionNote[], now = new Date()): { label: string; notes: SessionNote[] }[] {
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const thisWeek = startOfWeek.getTime();
  const lastWeek = thisWeek - 7 * DAY;
  const groups: { label: string; notes: SessionNote[] }[] = [];
  for (const n of [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const at = Date.parse(n.createdAt);
    const d = new Date(at);
    const label = at >= thisWeek ? "This week" : at >= lastWeek ? "Last week" : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const g = groups.at(-1);
    if (g && g.label === label) g.notes.push(n);
    else groups.push({ label, notes: [n] });
  }
  return groups;
}

/** A few sample notes for the demo client, so the timeline isn't empty. */
export function sampleSessionNotes(clientId: string, now = new Date()): SessionNote[] {
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  return [
    { id: "sn-1", clientId, createdAt: ago(2), shared: true, session: "Lower A · Strength · 14 sets · 3,120 kg", body: "Squat depth much better today. Keep the pause at the bottom on the last set. Hip felt fine, so we'll add 2.5 kg next week." },
    { id: "sn-2", clientId, createdAt: ago(2), shared: false, session: null, body: "Mentioned work is busy until the end of the month. Keep sessions to 45 minutes and check in on sleep." },
    { id: "sn-3", clientId, createdAt: ago(9), shared: true, session: "Upper A · 12 sets · 1,870 kg · 1 PB", body: "New best on the dumbbell press. Shoulders stayed down all session. Homework: band pull-aparts on rest days." },
    { id: "sn-4", clientId, createdAt: ago(33), shared: false, session: null, body: "First in-person session. Left hip tight in deep squats, so start with box squats to a parallel box." },
  ];
}
