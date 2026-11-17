/* On-demand programmes: a coach turns a saved program into something many clients can start on their own,
   free or for a one-off price. Each client who starts gets their own copy, exactly like assigning a template.
   Live: programme_listings + programme_enrolments (supabase/migrations/20261115090000_programmes.sql).
   Paid programmes are unlocked by the coach for now (bank transfer, cash, a gift). When card payments go live
   (Stripe, PR #48) the webhook marks the enrolment paid the same way. Pure, so it is unit tested. */

import { HERO_IMAGES, type HeroImage } from "./hero";
import { fromTemplate, toTemplate } from "./program";
import type { ProgramTemplate, TemplateDay } from "./types";
import { STARTER_TEMPLATES } from "./data/starterTemplates";

export const PROGRAMME_LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"] as const;
export type ProgrammeLevel = (typeof PROGRAMME_LEVELS)[number];

export const PROGRAMME_GOALS = ["Strength", "Muscle", "Fat loss", "Hybrid", "Running", "Mobility"] as const;
export type ProgrammeGoal = (typeof PROGRAMME_GOALS)[number];

/** Cover photos a coach can pick: the HELIX studio set, nothing else. */
export const PROGRAMME_COVERS: HeroImage[] = ["squat", "hinge", "bench", "dumbbell", "upper", "pull", "lower", "hip-thrust", "calisthenics", "rings", "kettlebell", "sled", "wall-ball", "ski", "run", "ride", "core", "mobility"];

export const DEFAULT_COVER: Record<ProgrammeGoal, HeroImage> = { Strength: "squat", Muscle: "dumbbell", "Fat loss": "kettlebell", Hybrid: "sled", Running: "run", Mobility: "mobility" };

export const TITLE_MAX = 60;
export const TAGLINE_MAX = 90;
export const DESCRIPTION_MAX = 2000;
export const INCLUDES_MAX = 6;
/** £500. Anything more is almost certainly a typo. */
export const PRICE_MAX_PENCE = 50_000;

export type ListingStatus = "draft" | "live";

export interface ProgrammeListing {
  id: string;
  title: string;
  /** One line under the title: who it's for and what it does. */
  tagline: string;
  description: string;
  level: ProgrammeLevel;
  goal: ProgrammeGoal;
  cover: HeroImage;
  /** 0 = free. Whole pence, GBP. */
  pricePence: number;
  /** Short lines for "What's included". */
  includes: string[];
  status: ListingStatus;
  /** Also shown on the coach's public Train with me page. */
  onPage: boolean;
  weeks: number;
  /** A snapshot of the program, every week written out, so later edits to the template never change what people bought. */
  days: TemplateDay[];
  /** The template it came from, if it still exists. */
  templateId: string | null;
  createdAt: string;
}

export type EnrolmentStatus = "requested" | "active" | "declined";
export type PaidVia = "free" | "manual" | "gift" | "stripe";

export interface Enrolment {
  id: string;
  listingId: string;
  clientId: string;
  /** Coach side only. */
  clientName?: string;
  status: EnrolmentStatus;
  paidPence: number;
  paidVia: PaidVia | null;
  /** Set once the client has started: their copy of the program. */
  programId: string | null;
  startedAt: string | null;
  createdAt: string;
}

/* ---------- money ---------- */

/** "Free", "£29" or "£29.50". */
export function formatPrice(pence: number): string {
  if (!pence) return "Free";
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What the coach typed in the price box, in pence. Empty or "free" = 0. Null when it isn't a price. */
export function parsePrice(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/^£/, "").replace(/,/g, "");
  if (!t || t === "free" || t === "0") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const pence = Math.round(Number(t) * 100);
  return pence > PRICE_MAX_PENCE ? null : pence;
}

export const priceInput = (pence: number): string => (pence ? (pence % 100 ? (pence / 100).toFixed(2) : String(pence / 100)) : "");

/* ---------- the programme itself ---------- */

/** Every week written out: a template that only plans week 1 repeats it, as when a coach assigns it. */
export function snapshotDays(t: Pick<ProgramTemplate, "name" | "weeks" | "days">): TemplateDay[] {
  const tpl: ProgramTemplate = { id: "snapshot", name: t.name, weeks: t.weeks, days: t.days };
  return toTemplate(fromTemplate(tpl), t.name).days;
}

const guessGoal = (name: string, note = ""): ProgrammeGoal => {
  const s = `${name} ${note}`.toLowerCase();
  if (/hybrid|race|hyrox|station/.test(s)) return "Hybrid";
  if (/run|5k|10k|marathon/.test(s)) return "Running";
  if (/mobility|stretch|flow|yoga/.test(s)) return "Mobility";
  if (/fat|condition|circuit|hiit/.test(s)) return "Fat loss";
  if (/muscle|hypertrophy|build/.test(s)) return "Muscle";
  return "Strength";
};

const guessLevel = (name: string, note = ""): ProgrammeLevel => {
  const s = `${name} ${note}`.toLowerCase();
  if (/intermediate/.test(s)) return "Intermediate";
  if (/advanced|elite/.test(s)) return "Advanced";
  if (/new lifter|beginner|foundation/.test(s)) return "Beginner";
  return "All levels";
};

/** A new draft from one of the coach's templates, with sensible first guesses the coach can change. */
export function listingFromTemplate(t: ProgramTemplate, now = new Date(), id: string = crypto.randomUUID()): ProgrammeListing {
  const goal = guessGoal(t.name, t.note);
  const title = t.name.split(" · ")[0]!.slice(0, TITLE_MAX);
  return {
    id, title, tagline: (t.note ?? "").slice(0, TAGLINE_MAX), description: "", level: guessLevel(t.name, t.note), goal, cover: DEFAULT_COVER[goal],
    pricePence: 0, includes: defaultIncludes(t), status: "draft", onPage: true, weeks: t.weeks, days: snapshotDays(t),
    templateId: t.starter ? null : t.id, createdAt: now.toISOString(),
  };
}

export function defaultIncludes(t: Pick<ProgramTemplate, "weeks" | "days">): string[] {
  const perWeek = daysPerWeek(t.days);
  return [
    `${t.weeks} week${t.weeks === 1 ? "" : "s"}, ${perWeek} session${perWeek === 1 ? "" : "s"} a week`,
    "Guided sessions with sets, reps, rest and cues",
    "Your lifts and personal bests tracked",
  ];
}

/** Training days in a normal week (week 1). */
export function daysPerWeek(days: TemplateDay[]): number {
  const first = Math.min(...days.map((d) => d.week));
  return new Set(days.filter((d) => d.week === first).map((d) => d.dayIndex)).size;
}

export const sessionCount = (l: Pick<ProgrammeListing, "days">): number => l.days.length;

export const minutesPerSession = (l: Pick<ProgrammeListing, "days">): number =>
  l.days.length ? Math.round(l.days.reduce((a, d) => a + d.minutes, 0) / l.days.length / 5) * 5 : 0;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Week 1, for the "What a week looks like" list. */
export function weekOutline(l: Pick<ProgrammeListing, "days">): { day: string; name: string; exercises: number; minutes: number }[] {
  if (!l.days.length) return [];
  const first = Math.min(...l.days.map((d) => d.week));
  return l.days
    .filter((d) => d.week === first)
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((d) => ({ day: DAY_NAMES[d.dayIndex] ?? "", name: d.name, exercises: d.items.length, minutes: d.minutes }));
}

/** "8 weeks · 4 days a week · 50 min". */
export function listingFacts(l: Pick<ProgrammeListing, "weeks" | "days">): string {
  const per = daysPerWeek(l.days);
  const min = minutesPerSession(l);
  return [`${l.weeks} week${l.weeks === 1 ? "" : "s"}`, `${per} day${per === 1 ? "" : "s"} a week`, min ? `${min} min` : ""].filter(Boolean).join(" · ");
}

/** What the client trains: a fresh copy with new keys, like assigning a template. */
export const programmeTemplate = (l: ProgrammeListing): ProgramTemplate => ({ id: l.id, name: l.title, weeks: l.weeks, days: l.days });

export const cleanIncludes = (lines: string[]): string[] =>
  lines.map((s) => s.trim().replace(/^[-•*]\s*/, "").slice(0, 80)).filter(Boolean).slice(0, INCLUDES_MAX);

export function listingProblem(l: ProgrammeListing): string | null {
  if (!l.title.trim()) return "Give it a title.";
  if (l.title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (l.tagline.length > TAGLINE_MAX) return `Keep the one-liner under ${TAGLINE_MAX} characters.`;
  if (l.description.length > DESCRIPTION_MAX) return "That description is too long (2,000 characters at most).";
  if (!Number.isInteger(l.pricePence) || l.pricePence < 0 || l.pricePence > PRICE_MAX_PENCE) return "Set a price between free and £500.";
  if (l.pricePence > 0 && l.pricePence < 100) return "Paid programmes start at £1.";
  if (!PROGRAMME_LEVELS.includes(l.level)) return "Pick a level.";
  if (!PROGRAMME_GOALS.includes(l.goal)) return "Pick a goal.";
  if (!(l.cover in HERO_IMAGES)) return "Pick a cover photo.";
  if (l.weeks < 1 || l.weeks > 52) return "A programme runs 1 to 52 weeks.";
  if (!l.days.length || l.days.every((d) => !d.items.length)) return "This programme has no exercises yet. Build it first, then save it as a template.";
  if (l.includes.length > INCLUDES_MAX) return `Keep "What's included" to ${INCLUDES_MAX} lines.`;
  return null;
}

/* ---------- people ---------- */

export interface ListingStats {
  members: number;
  started: number;
  waiting: number;
  revenuePence: number;
}

export function listingStats(listingId: string, enrolments: Enrolment[]): ListingStats {
  const mine = enrolments.filter((e) => e.listingId === listingId);
  const active = mine.filter((e) => e.status === "active");
  return {
    members: active.length,
    started: active.filter((e) => e.startedAt).length,
    waiting: mine.filter((e) => e.status === "requested").length,
    revenuePence: active.reduce((a, e) => a + e.paidPence, 0),
  };
}

export interface ShopTotals {
  live: number;
  members: number;
  waiting: number;
  revenuePence: number;
}

export function shopTotals(listings: ProgrammeListing[], enrolments: Enrolment[]): ShopTotals {
  const ids = new Set(listings.map((l) => l.id));
  const own = enrolments.filter((e) => ids.has(e.listingId));
  return {
    live: listings.filter((l) => l.status === "live").length,
    members: own.filter((e) => e.status === "active").length,
    waiting: own.filter((e) => e.status === "requested").length,
    revenuePence: own.filter((e) => e.status === "active").reduce((a, e) => a + e.paidPence, 0),
  };
}

/** Oldest first, so nobody waits longest. */
export const waitingList = (enrolments: Enrolment[]): Enrolment[] =>
  enrolments.filter((e) => e.status === "requested").sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export type ClientStep =
  | { kind: "start"; label: string }
  | { kind: "ask"; label: string }
  | { kind: "waiting"; label: string }
  | { kind: "following"; label: string }
  | { kind: "restart"; label: string };

/** What the client can do next on a programme. `currentProgram` is the name of what they train now. */
export function clientStep(l: ProgrammeListing, e: Enrolment | undefined, currentProgram?: string): ClientStep {
  if (e?.status === "active" && e.startedAt) {
    return currentProgram === l.title ? { kind: "following", label: "You're on it" } : { kind: "restart", label: "Go back to it" };
  }
  if (e?.status === "active" || l.pricePence === 0) return { kind: "start", label: "Start programme" };
  if (e?.status === "requested") return { kind: "waiting", label: "Waiting for your coach" };
  return { kind: "ask", label: `Get it · ${formatPrice(l.pricePence)}` };
}

/** Client shop order: theirs first, then the newest. */
export function shopOrder(listings: ProgrammeListing[], enrolments: Enrolment[]): ProgrammeListing[] {
  const mine = new Set(enrolments.filter((e) => e.status !== "declined").map((e) => e.listingId));
  return listings
    .filter((l) => l.status === "live")
    .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || b.createdAt.localeCompare(a.createdAt));
}

/** The message the coach gets when a client asks for a paid programme. */
export const requestMessage = (l: Pick<ProgrammeListing, "title" | "pricePence">): string =>
  `I'd like to join ${l.title} (${formatPrice(l.pricePence)}). How would you like me to pay?`;

/* ---------- database rows ---------- */

export interface ListingRow {
  id: string;
  coach_id: string;
  template_id: string | null;
  title: string;
  tagline: string;
  description: string;
  level: string;
  goal: string;
  cover: string;
  price_pence: number;
  includes: string[];
  status: string;
  on_page: boolean;
  weeks: number;
  days: TemplateDay[];
  created_at: string;
}

export const toListingRow = (l: ProgrammeListing, coachId: string): Omit<ListingRow, "created_at"> => ({
  id: l.id, coach_id: coachId, template_id: l.templateId, title: l.title.trim(), tagline: l.tagline.trim(), description: l.description.trim(),
  level: l.level, goal: l.goal, cover: l.cover, price_pence: l.pricePence, includes: cleanIncludes(l.includes), status: l.status, on_page: l.onPage,
  weeks: l.weeks, days: l.days,
});

const oneOf = <T extends string>(list: readonly T[], v: string, fallback: T): T => ((list as readonly string[]).includes(v) ? (v as T) : fallback);

export const fromListingRow = (r: ListingRow): ProgrammeListing => ({
  id: r.id, title: r.title, tagline: r.tagline ?? "", description: r.description ?? "",
  level: oneOf(PROGRAMME_LEVELS, r.level, "All levels"), goal: oneOf(PROGRAMME_GOALS, r.goal, "Strength"),
  cover: (r.cover in HERO_IMAGES ? r.cover : "squat") as HeroImage, pricePence: r.price_pence ?? 0, includes: r.includes ?? [],
  status: r.status === "live" ? "live" : "draft", onPage: !!r.on_page, weeks: r.weeks, days: Array.isArray(r.days) ? r.days : [],
  templateId: r.template_id, createdAt: r.created_at,
});

export interface EnrolmentRow {
  id: string;
  listing_id: string;
  client_id: string;
  client_name?: string | null;
  status: string;
  paid_pence: number;
  paid_via: string | null;
  program_id: string | null;
  started_at: string | null;
  created_at: string;
}

export const fromEnrolmentRow = (r: EnrolmentRow): Enrolment => ({
  id: r.id, listingId: r.listing_id, clientId: r.client_id, ...(r.client_name ? { clientName: r.client_name } : {}),
  status: r.status === "active" ? "active" : r.status === "declined" ? "declined" : "requested",
  paidPence: r.paid_pence ?? 0, paidVia: (["free", "manual", "gift", "stripe"] as const).find((v) => v === r.paid_via) ?? null,
  programId: r.program_id, startedAt: r.started_at, createdAt: r.created_at,
});

/** Anyone on the coach's public page sees only this. */
export interface PublicProgramme {
  id: string;
  title: string;
  tagline: string;
  level: ProgrammeLevel;
  goal: ProgrammeGoal;
  cover: HeroImage;
  pricePence: number;
  weeks: number;
  perWeek: number;
}

export interface PublicProgrammeRow {
  id: string;
  title: string;
  tagline: string;
  level: string;
  goal: string;
  cover: string;
  price_pence: number;
  weeks: number;
  per_week: number;
}

export const fromPublicProgrammeRow = (r: PublicProgrammeRow): PublicProgramme => ({
  id: r.id, title: r.title, tagline: r.tagline ?? "", level: oneOf(PROGRAMME_LEVELS, r.level, "All levels"), goal: oneOf(PROGRAMME_GOALS, r.goal, "Strength"),
  cover: (r.cover in HERO_IMAGES ? r.cover : "squat") as HeroImage, pricePence: r.price_pence ?? 0, weeks: r.weeks, perWeek: r.per_week,
});

export const toPublicProgramme = (l: ProgrammeListing): PublicProgramme => ({
  id: l.id, title: l.title, tagline: l.tagline, level: l.level, goal: l.goal, cover: l.cover, pricePence: l.pricePence, weeks: l.weeks, perWeek: daysPerWeek(l.days),
});

/* ---------- demo ---------- */

/** Sample shop for the demo: two live programmes (one free, one paid) and a draft. */
export function sampleProgrammes(): { listings: ProgrammeListing[]; enrolments: Enrolment[] } {
  const by = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!;
  const at = (d: string) => `${d}T09:00:00.000Z`;
  const base = (id: string, tplId: string, created: string) => ({ ...listingFromTemplate(by(tplId), new Date(at(created)), id), templateId: null });
  const listings: ProgrammeListing[] = [
    {
      ...base("demo-prog-1", "starter-upper-lower", "2026-10-20"), title: "Strong in 8", level: "Intermediate", goal: "Strength", cover: "hinge", pricePence: 4900, status: "live",
      tagline: "Four days a week to a stronger squat, bench and deadlift.",
      description: "Eight weeks of upper and lower days. The big lift comes first while you're fresh, accessories follow as supersets so you're done in under an hour.\n\nLog every set and the app tells you when to add weight.",
      includes: ["8 weeks, 4 sessions a week", "Heavy compound lift first, accessories as supersets", "Weights that go up when you're ready", "Message me any time"],
    },
    {
      ...base("demo-prog-2", "starter-foundations", "2026-10-28"), title: "First six weeks", level: "Beginner", goal: "Strength", cover: "dumbbell", pricePence: 0, status: "live",
      tagline: "New to lifting? Three short full-body days to learn the basics.",
      description: "One main lift a day and a couple of simple supersets. You'll learn to squat, hinge, push and pull with good form, and finish each session wanting more.",
    },
    {
      ...base("demo-prog-3", "starter-hybrid-race", "2026-11-04"), title: "Race ready", level: "Advanced", goal: "Hybrid", cover: "sled", pricePence: 7900, status: "draft",
      tagline: "Eight weeks to your next hybrid fitness race.",
    },
  ];
  const e = (id: string, listingId: string, clientId: string, clientName: string, status: EnrolmentStatus, paidPence: number, paidVia: PaidVia | null, created: string, started: string | null): Enrolment =>
    ({ id, listingId, clientId, clientName, status, paidPence, paidVia, programId: null, startedAt: started ? at(started) : null, createdAt: at(created) });
  const enrolments: Enrolment[] = [
    e("demo-enr-1", "demo-prog-1", "c-omar", "Omar Tahir", "active", 4900, "manual", "2026-10-22", "2026-10-23"),
    e("demo-enr-2", "demo-prog-1", "c-james", "James Kerr", "active", 4900, "manual", "2026-10-30", "2026-11-01"),
    e("demo-enr-3", "demo-prog-1", "c-ana", "Ana Silva", "requested", 0, null, "2026-11-08", null),
    e("demo-enr-4", "demo-prog-2", "c-lena", "Lena Brooks", "active", 0, "free", "2026-11-02", "2026-11-02"),
    e("demo-enr-5", "demo-prog-2", "c-sam", "Sam Okafor", "active", 0, "free", "2026-11-05", "2026-11-06"),
  ];
  return { listings, enrolments };
}
