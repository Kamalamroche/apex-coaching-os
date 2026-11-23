/* Income goal planner: from a monthly target and the trainer's real numbers (fees, win rate, clients leaving)
   to how many clients and enquiries it takes, and what to do each week. Pure. */

import type { BizSummary } from "./business";
import { pounds } from "./business";

export const GOAL_MIN_PENCE = 10000;
export const GOAL_MAX_PENCE = 10000000;
/** Used only when the trainer has no decided leads yet, and said so on screen. */
export const ASSUMED_WIN_PCT = 25;
export const PLAN_MONTHS = 3;

export function incomeGoalProblem(pence: number | null): string | null {
  if (pence === null) return null;
  if (!Number.isFinite(pence) || pence < GOAL_MIN_PENCE) return `Set a goal of at least ${pounds(GOAL_MIN_PENCE)} a month.`;
  if (pence > GOAL_MAX_PENCE) return `Set a goal under ${pounds(GOAL_MAX_PENCE)} a month.`;
  return null;
}

export interface IncomePlan {
  goalPence: number;
  nowPence: number;
  gapPence: number;
  /** 0 to 100. */
  progressPct: number;
  reached: boolean;
  /** Average monthly fee used for the sums. Null when no client has a fee yet. */
  feePence: number | null;
  /** New paying clients to close the gap. */
  clientsNeeded: number;
  /** Clients who leave in a typical month, to replace on top. */
  replacePerMonth: number;
  winPct: number;
  winAssumed: boolean;
  /** Enquiries a month, and a week, to get there in PLAN_MONTHS months. */
  leadsPerMonth: number;
  leadsPerWeek: number;
  months: number;
}

/** The sums. Rounds up: half a client is still a client to find. */
export function incomePlan(goalPence: number, sum: Pick<BizSummary, "recurringPence" | "perClientPence" | "active" | "churnPct" | "conversionPct">, months = PLAN_MONTHS): IncomePlan {
  const nowPence = Math.max(0, sum.recurringPence);
  const gapPence = Math.max(0, goalPence - nowPence);
  const feePence = sum.perClientPence > 0 ? sum.perClientPence : null;
  const clientsNeeded = feePence ? Math.ceil(gapPence / feePence) : 0;
  const replacePerMonth = sum.churnPct !== null && sum.active > 0 ? Math.round((sum.active * sum.churnPct) / 100) : 0;
  const winAssumed = sum.conversionPct === null || sum.conversionPct <= 0;
  const winPct = winAssumed ? ASSUMED_WIN_PCT : sum.conversionPct!;
  const clientsPerMonth = clientsNeeded / months + replacePerMonth;
  const leadsPerMonth = clientsPerMonth > 0 ? Math.ceil(clientsPerMonth / (winPct / 100)) : 0;
  return {
    goalPence, nowPence, gapPence,
    progressPct: goalPence > 0 ? Math.min(100, Math.round((nowPence / goalPence) * 100)) : 0,
    reached: gapPence === 0,
    feePence, clientsNeeded, replacePerMonth, winPct, winAssumed,
    leadsPerMonth, leadsPerWeek: Math.ceil(leadsPerMonth / 4.33), months,
  };
}

/** One line that says it plainly. */
export function incomePlanSummary(p: IncomePlan): string {
  if (p.reached) return `You're at ${pounds(p.nowPence)} a month, at or above your goal. Keep the clients you have and raise the goal when you're ready.`;
  if (p.feePence === null) return "Set a monthly fee for your clients in Business, then this works out how many more you need.";
  return `${pounds(p.gapPence)} to go: about ${p.clientsNeeded} more client${p.clientsNeeded === 1 ? "" : "s"} at ${pounds(p.feePence)} a month${p.replacePerMonth ? `, plus ${p.replacePerMonth} a month to replace those who leave` : ""}.`;
}

export interface GoalStep { text: string; why: string }

/** What to do each week. Rules, not AI: the trainer decides. */
export function weeklySteps(p: IncomePlan): GoalStep[] {
  if (p.reached || p.feePence === null) return [];
  const steps: GoalStep[] = [
    { text: `Get ${p.leadsPerWeek} new enquir${p.leadsPerWeek === 1 ? "y" : "ies"} a week`, why: `At your ${p.winAssumed ? "starting guess of " : ""}${p.winPct}% win rate, that's ${p.leadsPerMonth} a month to reach the goal in ${p.months} months.` },
    { text: "Message 5 people who know you", why: "Past leads, old clients and friends are the cheapest enquiries there are." },
    { text: "Share your page or a post 3 times", why: "Every share carries your link, tagged so you see what worked." },
  ];
  if (p.replacePerMonth > 0) steps.push({ text: "Check in with anyone quiet this week", why: `About ${p.replacePerMonth} client${p.replacePerMonth === 1 ? " leaves" : "s leave"} a month. Keeping one is worth more than finding one.` });
  if (p.winPct < 30 && !p.winAssumed) steps.push({ text: "Offer a free first session to new enquiries", why: `Your win rate is ${p.winPct}%. A first session together usually lifts it.` });
  return steps;
}
