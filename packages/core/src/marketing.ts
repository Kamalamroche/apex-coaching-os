/* Marketing for a PT business, from the coach's own records. Ideas borrowed from outside fitness:
   - NPS ("would you recommend me?") from software and retail, asked at a calm moment, so the coach asks the happiest
     clients for a review or a friend while they're happy, and hears early from the unhappy ones (privately).
   - An honest "places left" count (restaurants, courses) and offers with a real end date (retail), never fake urgency.
   - A funnel by source (e-commerce): page visits → enquiries → clients, so the coach knows which channel works.
   - A weekly plan of a few small actions (a growth habit, like a sales team's weekly pipeline review).
   - Proof in numbers: real totals from the coach's clients, ready to post, never invented.
   Live: supabase/migrations/20261126090000_marketing.sql. Pure, so it is unit tested. */

import { sourceLabel } from "./leads";

const DAY = 86400000;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/* ---------- Happiness check (NPS) ---------- */

export interface HappinessAnswer {
  id: string;
  clientId: string;
  /** Short name the coach sees, "Priya S.". */
  name: string;
  /** 0–10: how likely they'd recommend the coach to a friend. */
  score: number;
  /** "What would make it a 10?" Optional. */
  comment: string;
  at: string;
}

export type HappinessBand = "promoter" | "passive" | "detractor";

export const HAPPINESS_COMMENT_MAX = 400;
/** Ask again after this many days. */
export const HAPPINESS_EVERY_DAYS = 90;
/** Not before this many days with the coach: they need time to have an opinion. */
export const HAPPINESS_AFTER_DAYS = 21;

export const happinessBand = (score: number): HappinessBand => (score >= 9 ? "promoter" : score >= 7 ? "passive" : "detractor");

export const HAPPINESS_BAND_LABEL: Record<HappinessBand, string> = { promoter: "Would recommend", passive: "Happy enough", detractor: "Not happy" };

export function happinessProblem(score: number, comment: string): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 10) return "Pick a number from 0 to 10.";
  if (comment.trim().length > HAPPINESS_COMMENT_MAX) return `Keep it to ${HAPPINESS_COMMENT_MAX} characters.`;
  return null;
}

/** Time to ask: three weeks in, and not asked (or answered) in the last 90 days, or put off in the last 14. */
export function happinessDue(p: { daysWithCoach: number; lastAnsweredAt: string | null; snoozedAt: string | null; now: Date }): boolean {
  if (p.daysWithCoach < HAPPINESS_AFTER_DAYS) return false;
  const since = (iso: string | null) => (iso ? (p.now.getTime() - Date.parse(iso)) / DAY : Infinity);
  return since(p.lastAnsweredAt) >= HAPPINESS_EVERY_DAYS && since(p.snoozedAt) >= 14;
}

/** Each client's latest answer, newest first. */
export function latestAnswers(list: HappinessAnswer[]): HappinessAnswer[] {
  const seen = new Map<string, HappinessAnswer>();
  for (const a of [...list].sort((x, y) => Date.parse(y.at) - Date.parse(x.at))) if (!seen.has(a.clientId)) seen.set(a.clientId, a);
  return [...seen.values()];
}

export interface HappinessScore {
  /** −100 to 100: % would recommend minus % not happy. */
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  count: number;
}

/** The score from each client's latest answer. Null with nobody answering. */
export function happinessScore(list: HappinessAnswer[]): HappinessScore | null {
  const latest = latestAnswers(list);
  if (!latest.length) return null;
  const n = (b: HappinessBand) => latest.filter((a) => happinessBand(a.score) === b).length;
  const promoters = n("promoter");
  const passives = n("passive");
  const detractors = n("detractor");
  return { score: Math.round(((promoters - detractors) / latest.length) * 100), promoters, passives, detractors, count: latest.length };
}

/** A plain-English read of the score. */
export function happinessVerdict(s: HappinessScore): string {
  if (s.count < 3) return "Early days: a few more answers and this becomes useful.";
  if (s.score >= 50) return "Excellent. Your clients are your best marketing: ask them for reviews and friends.";
  if (s.score >= 20) return "Good. Turn the happy-enough into fans: ask what would make it a 10.";
  if (s.score >= 0) return "Mixed. Read the comments and talk to anyone who isn't happy this week.";
  return "Needs attention. Talk to the clients who aren't happy before asking anyone for referrals.";
}

/* ---------- Places left and offers ---------- */

export interface Campaign {
  /** "New Year kick-off". */
  title: string;
  /** "First month half price for anyone who starts by 31 January." */
  text: string;
  /** Last day, "2027-01-31". */
  ends: string;
}

export interface MarketingSettings {
  /** New clients the coach can take this month. Null = don't show. */
  spots: number | null;
  /** Null = no offer running. */
  campaign: Campaign | null;
}

export const DEFAULT_MARKETING: MarketingSettings = { spots: null, campaign: null };
export const SPOTS_MAX = 50;
export const CAMPAIGN_TITLE_MAX = 40;
export const CAMPAIGN_TEXT_MAX = 160;

/** Places still open this month: the number the coach set, less the clients who started this month. */
export const spotsLeft = (spots: number, joinedThisMonth: number): number => Math.max(0, spots - Math.max(0, joinedThisMonth));

/** "2 places left in November", or null when not set. */
export function spotsText(spots: number | null, joinedThisMonth: number, now: Date): string | null {
  if (spots === null) return null;
  const left = spotsLeft(spots, joinedThisMonth);
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  if (left === 0) return `Full for ${month}. Ask to join the waiting list`;
  return `${left} ${left === 1 ? "place" : "places"} left in ${month}`;
}

export function spotsProblem(spots: number | null): string | null {
  if (spots === null) return null;
  if (!Number.isInteger(spots) || spots < 0 || spots > SPOTS_MAX) return `Pick 0 to ${SPOTS_MAX} places.`;
  return null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function campaignProblem(c: Campaign | null, today: string): string | null {
  if (!c) return null;
  if (!c.title.trim()) return "Give the offer a short name.";
  if (c.title.trim().length > CAMPAIGN_TITLE_MAX) return `Keep the name to ${CAMPAIGN_TITLE_MAX} characters.`;
  if (c.text.trim().length < 10) return "Say what people get, in a sentence.";
  if (c.text.trim().length > CAMPAIGN_TEXT_MAX) return `Keep it to ${CAMPAIGN_TEXT_MAX} characters.`;
  if (!ISO_DATE.test(c.ends)) return "Pick the last day of the offer.";
  if (c.ends < today) return "The end date has passed. Pick a day from today.";
  return null;
}

/** The offer shows while today is on or before its last day. */
export const campaignLive = (c: Campaign | null, today: string): c is Campaign => !!c && ISO_DATE.test(c.ends) && c.ends >= today;

/** "Ends today", "Ends tomorrow", "6 days left", "Ends 31 January". */
export function campaignEndsText(ends: string, today: string): string {
  const days = Math.round((Date.parse(`${ends}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  if (days <= 10) return `${days} days left`;
  return `Ends ${new Date(`${ends}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}

/* ---------- Funnel ---------- */

export interface PageVisits { day: string; source: string; visits: number }
export interface FunnelLead { createdAt: string; stage: string; source: string }

export interface FunnelStep { key: "visits" | "enquiries" | "clients"; label: string; value: number; /** Of the step before, 0–100, or null. */ rate: number | null }
export interface FunnelSource { source: string; label: string; visits: number; enquiries: number; clients: number }

export interface Funnel { days: number; steps: FunnelStep[]; sources: FunnelSource[]; best: FunnelSource | null }

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
/** Lead sources that mean "came through the page", so visits and enquiries line up. */
const pageSource = (s: string) => (s === "" || s === "page" ? "page" : s);

/** Visits, enquiries and clients over the last `days`, overall and by where they came from. */
export function funnel(visits: PageVisits[], leads: FunnelLead[], now: Date, days = 30): Funnel {
  const from = now.getTime() - days * DAY;
  const fromDay = new Date(from).toISOString().slice(0, 10);
  const v = visits.filter((x) => x.day >= fromDay);
  const l = leads.filter((x) => Date.parse(x.createdAt) >= from);
  const totalVisits = v.reduce((t, x) => t + x.visits, 0);
  const enquiries = l.length;
  const clients = l.filter((x) => x.stage === "client").length;
  const by = new Map<string, FunnelSource>();
  const row = (s: string) => {
    const key = pageSource(s);
    let r = by.get(key);
    if (!r) { r = { source: key, label: sourceLabel(key), visits: 0, enquiries: 0, clients: 0 }; by.set(key, r); }
    return r;
  };
  for (const x of v) row(x.source).visits += x.visits;
  for (const x of l) { const r = row(x.source); r.enquiries += 1; if (x.stage === "client") r.clients += 1; }
  const sources = [...by.values()].sort((a, b) => b.clients - a.clients || b.enquiries - a.enquiries || b.visits - a.visits);
  const best = sources.find((s) => s.clients > 0) ?? sources.find((s) => s.enquiries > 0) ?? null;
  return {
    days,
    steps: [
      { key: "visits", label: "Page visits", value: totalVisits, rate: null },
      { key: "enquiries", label: "Enquiries", value: enquiries, rate: pct(enquiries, totalVisits) },
      { key: "clients", label: "Became clients", value: clients, rate: pct(clients, enquiries) },
    ],
    sources,
    best,
  };
}

/* ---------- Proof in numbers ---------- */

export interface ProofNumbers {
  days: number;
  /** Clients who trained at least once. */
  clients: number;
  workouts: number;
  /** Kilograms lifted: load × reps, every logged set. */
  kg: number;
  /** New heaviest weights on a lift. */
  bests: number;
  /** One-to-one sessions attended. */
  sessions: number;
}

export interface ProofLine { value: string; unit: string; label: string }

/** The numbers worth posting, biggest story first. Leaves out anything that's zero. */
export function proofLines(p: ProofNumbers): ProofLine[] {
  const out: ProofLine[] = [];
  if (p.kg >= 1000) out.push({ value: (p.kg / 1000).toFixed(p.kg >= 100000 ? 0 : 1).replace(/\.0$/, ""), unit: "tonnes", label: "lifted" });
  else if (p.kg > 0) out.push({ value: String(Math.round(p.kg)), unit: "kg", label: "lifted" });
  if (p.bests > 0) out.push({ value: String(p.bests), unit: p.bests === 1 ? "personal best" : "personal bests", label: "set" });
  if (p.workouts > 0) out.push({ value: String(p.workouts), unit: p.workouts === 1 ? "workout" : "workouts", label: "finished" });
  if (p.sessions > 0) out.push({ value: String(p.sessions), unit: p.sessions === 1 ? "session" : "sessions", label: "coached in person" });
  return out;
}

/* ---------- Captions (AI suggestion style, written from rules: the coach edits before posting) ---------- */

export function proofCaption(p: ProofNumbers, link: string): string {
  const lines = proofLines(p);
  const facts = lines.slice(0, 3).map((l) => `${l.value} ${l.unit} ${l.label}`).join(", ");
  return `The last ${p.days} days with my clients: ${facts || "steady work, every week"}. Real people, busy lives, consistent training.\n\nWant a plan written for you? ${link}`;
}

export function reviewCaption(name: string | null, link: string): string {
  return `Kind words from ${name ?? "one of my clients"}. This is why I coach.\n\nIf you're ready to start, ask me here: ${link}`;
}

export function spotsCaption(text: string, link: string): string {
  return `${text}. I keep my client list small so everyone gets proper coaching.\n\nAsk for a place: ${link}`;
}

export function campaignCaption(c: Campaign, endsText: string, link: string): string {
  return `${c.title}: ${c.text.trim().replace(/\.$/, "")}. ${endsText}.\n\n${link}`;
}

/* ---------- Ready-to-send messages ---------- */

export const askReviewMessage = (name: string, coach: string) =>
  `Hi ${firstName(name)}, thank you for the lovely score. Would you write a sentence or two about training with me? It really helps people decide to start. It's under More → Review in the app. ${coach}`;

export const askFriendMessage = (name: string, coach: string, reward: string | null) =>
  `Hi ${firstName(name)}, I've got room for a couple more people. If you know someone who'd like what we do, send them your link under More → Invite a friend.${reward ? ` ${reward}` : ""} ${coach}`;

export const unhappyMessage = (name: string, coach: string) =>
  `Hi ${firstName(name)}, thanks for being honest in your check. I'd love to hear what would make training better for you. Have you got ten minutes for a quick call this week? ${coach}`;

export const winBackMessage = (name: string, coach: string, offer: string | null) =>
  `Hi ${firstName(name)}, it's ${coach}. I've been thinking about how well you were doing. If you'd like to get going again, I'd love to have you back${offer ? `: ${offer}` : ""}. No pressure, just reply here.`;

export const coldLeadMessage = (name: string, coach: string) =>
  `Hi ${firstName(name)}, it's ${coach}. You asked about training a while back. Is now a better time? I've got a place open and I'm happy to start with a quick chat.`;

/* ---------- This week's growth plan ---------- */

export type PlanKind = "reply" | "follow" | "unhappy" | "review" | "friend" | "winback" | "cold" | "post" | "setup";

export interface PlanAction {
  id: string;
  kind: PlanKind;
  title: string;
  why: string;
  /** A drafted message for the coach to send or copy. Null for actions that open a screen. */
  message: string | null;
  /** Client (in-app message) or lead (copy, they're not in the app). */
  to: { kind: "client" | "lead"; id: string; name: string; email?: string } | null;
}

export interface PlanInput {
  coach: string;
  now: Date;
  /** Open leads: stage, when they asked, follow-up date. */
  leads: { id: string; name: string; email: string; stage: string; at: string; followUp: string | null }[];
  answers: HappinessAnswer[];
  /** Client ids with a review written. */
  reviewed: string[];
  /** Client ids who have brought a friend already. */
  referred: string[];
  /** Clients who ended, with when. */
  ended: { id: string; name: string; endedAt: string | null }[];
  /** Current client ids (so names and ids line up and ended clients who came back are skipped). */
  current: string[];
  proof: ProofNumbers | null;
  published: boolean;
  googleReviewUrl: boolean;
  spotsSet: boolean;
  /** "you get a free session when they join." from the coach's referral reward, or null. */
  rewardLine: string | null;
  /** Actions the coach ticked off this week, by id. */
  done: string[];
}

const PLAN_MAX = 5;
const ageDays = (iso: string, now: Date) => Math.floor((now.getTime() - Date.parse(iso)) / DAY);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "2026-W46": plan ids carry the week so ticking one off lasts the week. */
export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Up to five small actions for this week, most valuable first: answer people waiting, look after unhappy clients,
    then ask happy ones, win people back and post proof. Built from the coach's records only. */
export function growthPlan(p: PlanInput): { week: string; actions: PlanAction[]; doneCount: number } {
  const week = weekKey(p.now);
  const today = isoDay(p.now);
  const all: PlanAction[] = [];
  const add = (a: Omit<PlanAction, "id"> & { key: string }) => {
    const { key, ...rest } = a;
    all.push({ ...rest, id: `${week}:${key}` });
  };

  const waiting = p.leads.filter((l) => l.stage === "new" && ageDays(l.at, p.now) >= 1);
  for (const l of waiting.slice(0, 2)) {
    add({ key: `reply:${l.id}`, kind: "reply", title: `Reply to ${firstName(l.name)}`, why: `Asked ${ageDays(l.at, p.now)} days ago. A quick reply wins most clients.`, message: null, to: { kind: "lead", id: l.id, name: l.name, email: l.email } });
  }
  const due = p.leads.filter((l) => l.followUp && l.followUp <= today && l.stage !== "client" && l.stage !== "lost");
  if (due.length) add({ key: `follow:${due.map((l) => l.id).join(",")}`, kind: "follow", title: due.length === 1 ? `Follow up ${firstName(due[0]!.name)}` : `${due.length} follow-ups due`, why: "You set a date to get back to them.", message: null, to: null });

  const recent = latestAnswers(p.answers).filter((a) => ageDays(a.at, p.now) <= 45 && p.current.includes(a.clientId));
  for (const a of recent.filter((x) => happinessBand(x.score) === "detractor").slice(0, 2)) {
    add({ key: `unhappy:${a.clientId}`, kind: "unhappy", title: `Talk to ${firstName(a.name)}`, why: `Scored you ${a.score} out of 10${a.comment ? `: "${a.comment.slice(0, 80)}${a.comment.length > 80 ? "…" : ""}"` : ""}. Fix it before it becomes a goodbye.`, message: unhappyMessage(a.name, p.coach), to: { kind: "client", id: a.clientId, name: a.name } });
  }
  const promoters = recent.filter((x) => happinessBand(x.score) === "promoter");
  const toReview = promoters.find((a) => !p.reviewed.includes(a.clientId));
  if (toReview) add({ key: `review:${toReview.clientId}`, kind: "review", title: `Ask ${firstName(toReview.name)} for a review`, why: `Scored you ${toReview.score} out of 10 and hasn't written a review yet.`, message: askReviewMessage(toReview.name, p.coach), to: { kind: "client", id: toReview.clientId, name: toReview.name } });
  const toRefer = promoters.find((a) => a !== toReview && !p.referred.includes(a.clientId));
  if (toRefer) add({ key: `friend:${toRefer.clientId}`, kind: "friend", title: `Ask ${firstName(toRefer.name)} to bring a friend`, why: `Scored you ${toRefer.score} out of 10. Happy clients bring the best new clients.`, message: askFriendMessage(toRefer.name, p.coach, p.rewardLine), to: { kind: "client", id: toRefer.clientId, name: toRefer.name } });

  const back = p.ended
    .filter((c) => c.endedAt && !p.current.includes(c.id))
    .map((c) => ({ ...c, days: ageDays(c.endedAt!, p.now) }))
    .filter((c) => c.days >= 30 && c.days <= 180)
    .sort((a, b) => a.days - b.days)[0];
  if (back) add({ key: `winback:${back.id}`, kind: "winback", title: `Invite ${firstName(back.name)} back`, why: `Left ${Math.round(back.days / 7)} weeks ago. People who've trained with you before are the easiest to bring back.`, message: winBackMessage(back.name, p.coach, null), to: { kind: "client", id: back.id, name: back.name } });

  const cold = p.leads
    .filter((l) => l.stage === "lost" && l.email)
    .map((l) => ({ ...l, days: ageDays(l.at, p.now) }))
    .filter((l) => l.days >= 30 && l.days <= 120)
    .sort((a, b) => a.days - b.days)[0];
  if (cold) add({ key: `cold:${cold.id}`, kind: "cold", title: `Check in with ${firstName(cold.name)}`, why: `Said "not now" ${Math.round(cold.days / 7)} weeks ago. Timing changes.`, message: coldLeadMessage(cold.name, p.coach), to: { kind: "lead", id: cold.id, name: cold.name, email: cold.email } });

  if (p.proof && proofLines(p.proof).length) add({ key: "post", kind: "post", title: "Post your clients' numbers", why: `${proofLines(p.proof).slice(0, 2).map((l) => `${l.value} ${l.unit}`).join(" and ")} in ${p.proof.days} days. Real results are your best advert.`, message: null, to: null });

  if (!p.published) add({ key: "setup:page", kind: "setup", title: "Put your page live", why: "Everything else points people to it.", message: null, to: null });
  else if (!p.googleReviewUrl) add({ key: "setup:google", kind: "setup", title: "Add your Google review link", why: "Happy clients can post their review on Google too, where new people search.", message: null, to: null });
  else if (!p.spotsSet) add({ key: "setup:spots", kind: "setup", title: "Say how many places you have", why: "An honest \"2 places left\" helps people decide.", message: null, to: null });

  const actions = all.slice(0, PLAN_MAX);
  return { week, actions, doneCount: actions.filter((a) => p.done.includes(a.id)).length };
}

/* ---------- Rows and demo ---------- */

export interface HappinessRow { id: string; client_id: string; name: string | null; score: number; comment: string | null; created_at: string }
export const fromHappinessRow = (r: HappinessRow): HappinessAnswer => ({ id: r.id, clientId: r.client_id, name: r.name ?? "Client", score: Number(r.score), comment: r.comment ?? "", at: r.created_at });

export function sampleHappiness(now = new Date()): HappinessAnswer[] {
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  return [
    { id: "h1", clientId: "demo-james", name: "James K.", score: 10, comment: "", at: ago(6) },
    { id: "h2", clientId: "demo-amara", name: "Amara O.", score: 9, comment: "Love the sessions. More mobility work would make it a 10.", at: ago(9) },
    { id: "h3", clientId: "demo-tom", name: "Tom R.", score: 8, comment: "", at: ago(12) },
    { id: "h4", clientId: "demo-sarah", name: "Sarah L.", score: 6, comment: "Struggling to fit the Thursday session in with shifts.", at: ago(3) },
    { id: "h5", clientId: "demo-wei", name: "Wei C.", score: 10, comment: "", at: ago(20) },
  ];
}

export function sampleVisits(now = new Date()): PageVisits[] {
  const out: PageVisits[] = [];
  const mix: [string, number][] = [["instagram", 5], ["page", 2], ["flyer", 1], ["referral", 1]];
  for (let d = 0; d < 30; d++) {
    const day = new Date(now.getTime() - d * DAY).toISOString().slice(0, 10);
    for (const [s, base] of mix) {
      const n = Math.max(0, Math.round(base + Math.sin(d * 1.7 + base) * (base / 2)));
      if (n) out.push({ day, source: s, visits: n });
    }
  }
  return out;
}

export function sampleProof(): ProofNumbers {
  return { days: 30, clients: 6, workouts: 74, kg: 61840, bests: 19, sessions: 22 };
}
