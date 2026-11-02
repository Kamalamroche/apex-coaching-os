import type { WorkoutSummary } from "./types";

/* The social share card a client can post after a workout: their photo with a small stats graphic. */

export type ShareStyle = "strip" | "crown" | "sticker";

export const SHARE_STYLES: { id: ShareStyle; name: string }[] = [
  { id: "strip", name: "The Strip" },
  { id: "crown", name: "The Crown" },
  { id: "sticker", name: "Progress" },
];

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";

export interface ShareReward {
  title: string;
  rarity: Rarity;
  /** What earned it, e.g. "New best · Back squat 100 kg". */
  reason: string;
  xp: number;
}

/** The reward for this session, from the HELIX rewards ladder: a personal best beats more volume beats turning up. */
export function shareReward(summary: WorkoutSummary): ShareReward {
  const best = [...summary.bests].sort((a, b) => b.kg - b.previousKg - (a.kg - a.previousKg))[0];
  if (best) {
    const more = summary.bests.length - 1;
    return { title: "The Lifter", rarity: "Rare", reason: `New best · ${best.exercise} ${best.kg} kg${more ? ` +${more} more` : ""}`, xp: 100 };
  }
  if (summary.vsLast && summary.vsLast.volumeKg > 0) {
    return { title: "Stronger Than Yesterday", rarity: "Common", reason: `${summary.vsLast.volumeKg.toLocaleString("en-GB")} kg more than last time`, xp: 50 };
  }
  return { title: "The Grinder", rarity: "Common", reason: "Showed up and did the work", xp: 25 };
}

export interface ShareCardData {
  workoutName: string;
  totalKg: number;
  sets: number;
  minutes: number;
  /** kg against last session, null on the first one. */
  vsLastKg: number | null;
  /** Last session's kg then today's, for the little progress bars. Null on the first session. */
  lastKg: number | null;
  reward: ShareReward;
  /** "Coached by Kamal". Left out when the client hides it. */
  coach: string | null;
}

export function shareCardData(
  summary: WorkoutSummary,
  session: { workoutName: string; volumeKg: number; sets: number; minutes: number },
  coachName: string | null,
): ShareCardData {
  const totalKg = summary.totalKg ?? session.volumeKg;
  const vsLastKg = summary.vsLast?.volumeKg ?? null;
  return {
    workoutName: session.workoutName,
    totalKg,
    sets: session.sets,
    minutes: session.minutes,
    vsLastKg,
    lastKg: vsLastKg === null ? null : totalKg - vsLastKg,
    reward: shareReward(summary),
    coach: coachName?.trim() ? coachName.trim() : null,
  };
}

/** The text that goes with the image on social media. */
export function shareCaption(d: ShareCardData, link: string): string {
  const parts = [`${d.workoutName} done: ${d.totalKg.toLocaleString("en-GB")} kg lifted in ${d.minutes} min.`];
  if (d.reward.xp >= 100) parts.push(d.reward.reason + ".");
  parts.push(d.coach ? `Coached by ${d.coach} on APEX. ${link}` : `Tracked on APEX. ${link}`);
  return parts.join(" ");
}
