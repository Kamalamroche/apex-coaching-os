/* Growing a PT business from the clients you already have: referral rewards, a free intro session,
   reviews on the public page (and Google), and ready-to-send nudges when a pack runs low or a client stops booking.
   Live: supabase/migrations/20261120090000_growth_tools.sql. Pure, so it is unit tested. */

import type { Booking } from "./booking";
import type { Credits } from "./sessions";

/* ---------- The coach's offers ---------- */

export interface GrowOffer {
  /** New people see "First session free" on the page, and new clients get one free session. */
  introOffer: boolean;
  /** Free sessions the client who brought a friend gets when the friend joins. 0 = no reward. */
  referralReward: number;
  /** The coach's Google review link, shown to clients after they write a review. */
  googleReviewUrl: string;
}

export const DEFAULT_OFFER: GrowOffer = { introOffer: false, referralReward: 1, googleReviewUrl: "" };
export const REWARD_CHOICES = [0, 1, 2];

/** The Google link the coach pasted, or why it can't be saved. */
export function reviewUrlProblem(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  let u: URL;
  try { u = new URL(v); } catch { return "Paste the full link, starting with https://"; }
  if (u.protocol !== "https:") return "The link should start with https://";
  if (!/(^|\.)(google\.[a-z.]+|g\.page|goo\.gl)$/.test(u.hostname)) return "Use the review link from your Google Business Profile (g.page or google.com).";
  return null;
}

/** What a client sees on the invite-a-friend screen. */
export function rewardText(offer: Pick<GrowOffer, "referralReward" | "introOffer">, coach: string): string | null {
  const parts: string[] = [];
  if (offer.referralReward) parts.push(`you get ${offer.referralReward === 1 ? "a free session" : `${offer.referralReward} free sessions`} when they join`);
  if (offer.introOffer) parts.push("their first session is free");
  if (!parts.length) return null;
  return `Bring a friend to ${coach}: ${parts.join(", and ")}.`;
}

/* ---------- Referral rewards ---------- */

export interface ReferralJoin {
  /** The join request. */
  id: string;
  friend: string;
  /** The client who sent them. */
  referrerId: string;
  joined: boolean;
  rewarded: boolean;
}

/** Friends who joined and whose referrer hasn't had their reward yet. */
export const pendingRewards = (list: ReferralJoin[]): ReferralJoin[] => list.filter((r) => r.joined && !r.rewarded);

/** The chat message that goes with the reward. */
export function rewardMessage(first: string, friend: string, sessions: number): string {
  return `Thanks for bringing ${friend.split(" ")[0]}, ${first}. I've added ${sessions === 1 ? "a free session" : `${sessions} free sessions`} to your account. See you soon.`;
}

/* ---------- Reviews ---------- */

export interface Review {
  id: string;
  clientId: string;
  /** "Priya S." when they let their name show, else null. */
  name: string | null;
  stars: number;
  body: string;
  approved: boolean;
  at: string;
}

export const REVIEW_MIN = 20;
export const REVIEW_MAX = 600;

export function reviewProblem(stars: number, body: string): string | null {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return "Pick 1 to 5 stars.";
  const t = body.trim();
  if (t.length < REVIEW_MIN) return `A sentence or two, please (at least ${REVIEW_MIN} characters).`;
  if (t.length > REVIEW_MAX) return `Keep it to ${REVIEW_MAX} characters.`;
  return null;
}

/** "Priya Sharma" → "Priya S.". */
export function shortName(full: string): string {
  const [first = "", ...rest] = full.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first;
}

/** Time to ask for a review: a few weeks in, and enough training done to have an opinion. Never twice. */
export function reviewDue(p: { daysWithCoach: number; workoutsDone: number; sessionsAttended: number; hasReview: boolean; dismissed: boolean }): boolean {
  if (p.hasReview || p.dismissed) return false;
  return p.daysWithCoach >= 21 && (p.workoutsDone >= 8 || p.sessionsAttended >= 6);
}

/** Average stars to one decimal, and how many reviews. */
export function reviewScore(list: Pick<Review, "stars" | "approved">[]): { average: number; count: number } | null {
  const shown = list.filter((r) => r.approved);
  if (!shown.length) return null;
  return { average: Math.round((shown.reduce((s, r) => s + r.stars, 0) / shown.length) * 10) / 10, count: shown.length };
}

/* ---------- Keep clients training ---------- */

export interface ClientSessions {
  id: string;
  name: string;
  credits: Credits;
  /** Every training session they've had or booked. */
  bookings: Booking[];
  /** They have bought at least one pack. */
  hasPacks: boolean;
}

export type NudgeKind = "renew" | "book" | "owed";

export interface Nudge {
  clientId: string;
  name: string;
  kind: NudgeKind;
  why: string;
  message: string;
}

const DAY = 86400000;

/** Clients worth a message today: a pack running out, sessions paid for but nothing booked, or sessions owed. */
export function sessionNudges(clients: ClientSessions[], coach: string, now: Date): Nudge[] {
  const out: Nudge[] = [];
  for (const c of clients) {
    if (!c.hasPacks) continue;
    const first = c.name.split(" ")[0] ?? c.name;
    const booked = c.bookings.filter((b) => b.status === "booked");
    const ahead = booked.some((b) => Date.parse(b.startsAt) > now.getTime());
    const last = booked.filter((b) => Date.parse(b.startsAt) <= now.getTime()).map((b) => Date.parse(b.startsAt)).sort((a, b) => b - a)[0];
    const quietDays = last ? Math.floor((now.getTime() - last) / DAY) : null;
    if (c.credits.owed > 0) {
      out.push({ clientId: c.id, name: c.name, kind: "owed", why: `${c.credits.owed} session${c.credits.owed === 1 ? "" : "s"} not paid for`, message: `Hi ${first}, quick one: ${c.credits.owed === 1 ? "your last session isn't" : `${c.credits.owed} of your sessions aren't`} covered by a pack yet. Shall I set up your next pack? ${coach}` });
    } else if (c.credits.left <= 1) {
      out.push({ clientId: c.id, name: c.name, kind: "renew", why: c.credits.left ? "1 session left" : "Pack used up", message: `Hi ${first}, ${c.credits.left ? "you've got one session left" : "that's your pack finished"}. Great work so far. Want me to set up the next one so we keep the momentum? ${coach}` });
    } else if (!ahead && quietDays !== null && quietDays >= 14) {
      out.push({ clientId: c.id, name: c.name, kind: "book", why: `${c.credits.left} sessions left · none booked for ${quietDays} days`, message: `Hi ${first}, you've still got ${c.credits.left} sessions with me. Want to book one in this week? Pick a time in the app under More → Book. ${coach}` });
    }
  }
  const order: Record<NudgeKind, number> = { owed: 0, renew: 1, book: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

/* ---------- Database rows ---------- */

export interface ReviewRow { id: string; client_id: string; name: string | null; stars: number; body: string; approved: boolean; created_at: string }

export const fromReviewRow = (r: ReviewRow): Review => ({ id: r.id, clientId: r.client_id, name: r.name, stars: Number(r.stars), body: r.body, approved: !!r.approved, at: r.created_at });

/* ---------- Demo ---------- */

export function sampleReviews(now = new Date()): Review[] {
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  return [
    { id: "demo-review-1", clientId: "demo-james", name: "James K.", stars: 5, body: "Kamal fixed my deadlift in two sessions and my back has stopped aching. The app makes it easy to see what to do every day.", approved: true, at: ago(20) },
    { id: "demo-review-2", clientId: "demo-sarah", name: null, stars: 5, body: "I came back after a long break and never felt rushed. Sessions are hard but always doable, and the plan fits around my shifts.", approved: false, at: ago(2) },
  ];
}
