/* Weekly Review Mode: the coach's weekly round of every client who needs them, one at a time.
   Pure: who is in the queue, in what order, why, and a first-draft reply the coach edits before anything is sent. */

import type { CheckIn } from "./checkins";
import type { Health } from "./health";

export interface ReviewInput {
  id: string;
  name: string;
  health: Health | null;
  /** Health score change over the last fortnight, when known. */
  trend?: number | null;
  /** Check-ins the coach hasn't replied to yet. */
  checkInsWaiting: number;
  /** Form-check videos the coach hasn't replied to yet. */
  videosWaiting: number;
}

export type ReviewReason = "check-in" | "video" | "needs-you" | "slipping" | "keep-an-eye";

export interface ReviewEntry {
  id: string;
  name: string;
  reasons: ReviewReason[];
  /** Short chips for the queue, e.g. "Check-in to review". */
  why: string[];
  /** Rough minutes this client takes in review. A guess for planning, not a measure. */
  minutes: number;
  /** Higher goes first. */
  priority: number;
}

const WHY: Record<ReviewReason, string> = {
  "check-in": "Check-in to review",
  video: "Form video to review",
  "needs-you": "Needs you",
  slipping: "Slipping",
  "keep-an-eye": "Keep an eye",
};

/** Everyone with something waiting or a health score that needs the coach, most urgent first. Clients on track with nothing waiting are left out. */
export function reviewQueue(inputs: ReviewInput[]): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const c of inputs) {
    const reasons: ReviewReason[] = [];
    let priority = 0;
    if (c.health?.band === "low") { reasons.push("needs-you"); priority += 50; }
    else if ((c.trend ?? 0) <= -10) { reasons.push("slipping"); priority += 30; }
    else if (c.health?.band === "watch") { reasons.push("keep-an-eye"); priority += 15; }
    if (c.checkInsWaiting > 0) { reasons.push("check-in"); priority += 25 + Math.min(c.checkInsWaiting - 1, 3) * 5; }
    if (c.videosWaiting > 0) { reasons.push("video"); priority += 20 + Math.min(c.videosWaiting - 1, 3) * 3; }
    if (!reasons.length) continue;
    // Lower health breaks ties, so the client most at risk comes first.
    priority += c.health?.score != null ? (100 - c.health.score) / 100 : 0;
    const minutes = 1 + (c.checkInsWaiting ? 2 : 0) + Math.min(c.videosWaiting, 3) + (reasons.some((r) => r === "needs-you" || r === "slipping") ? 1 : 0);
    out.push({ id: c.id, name: c.name, reasons, why: reasons.map((r) => WHY[r]), minutes, priority });
  }
  return out.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

/** Total minutes for the round, rounded up to the next 5. */
export function reviewMinutes(queue: ReviewEntry[]): number {
  const total = queue.reduce((n, e) => n + e.minutes, 0);
  return total ? Math.ceil(total / 5) * 5 : 0;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * A first-draft reply from what the client actually did and said. Rule-based, shown as an AI suggestion:
 * the coach edits it, and nothing is sent until they press Send.
 */
export function draftReviewReply(o: { name: string; coach?: string; health: Health | null; checkIn?: CheckIn | null; previous?: CheckIn | null; reasons: ReviewReason[] }): string {
  const lines: string[] = [`Hi ${first(o.name)},`];
  const training = o.health?.parts.find((p) => p.key === "training");
  const ci = o.checkIn;
  if (ci) {
    const bits: string[] = [];
    if (ci.weightKg != null && o.previous?.weightKg != null) {
      const d = Math.round((ci.weightKg - o.previous.weightKg) * 10) / 10;
      bits.push(d === 0 ? "weight steady" : `weight ${d < 0 ? "down" : "up"} ${Math.abs(d)} kg`);
    }
    if (ci.sleepHours != null) bits.push(`${ci.sleepHours} h sleep`);
    if (ci.energy != null) bits.push(`energy ${ci.energy}/5`);
    lines.push(`Thanks for your check-in${bits.length ? ` (${bits.join(", ")})` : ""}.`);
    if (ci.wins.trim()) lines.push(`Great to hear: ${ci.wins.trim().replace(/\.$/, "")}.`);
    if (ci.struggles.trim()) lines.push(`On "${ci.struggles.trim().replace(/\.$/, "")}", here's what we'll do: [your plan].`);
    else if (ci.note.trim()) lines.push(`You mentioned "${ci.note.trim().replace(/\.$/, "")}". [your answer]`);
  }
  if (o.reasons.includes("needs-you") || o.reasons.includes("slipping")) {
    lines.push(`${training ? `I can see ${training.note.toLowerCase()}. ` : ""}No stress, it happens. What got in the way this week? Let's find a slot that works and I'll adjust the plan around it.`);
  } else if (training && training.score >= 0.8) {
    lines.push(`Training's on point: ${training.note.toLowerCase()}. Keep it up.`);
  }
  if (o.reasons.includes("video")) lines.push("I've watched your form video, see my note on it.");
  lines.push(o.coach ? `Speak soon, ${first(o.coach)}` : "Speak soon");
  return lines.join("\n\n");
}
