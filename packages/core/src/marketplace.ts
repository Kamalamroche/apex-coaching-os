/* Find a trainer: the public directory of APEX trainers, the match quiz and the verified badge.
   Pure: the data layer loads the rows, these decide what shows, in what order and why. */

import { GOAL_CHOICES, MODE_LABEL, SPECIALTY_IDEAS, type CoachPage, type TrainingModeName } from "./growth";
import { formatPrice } from "./onDemand";

export type GoalChoice = (typeof GOAL_CHOICES)[number];

/** One trainer in the directory: what their public page shows, plus the trust signals. */
export interface TrainerCard {
  slug: string;
  name: string;
  headline: string;
  city: string;
  specialties: string[];
  modes: TrainingModeName[];
  /** Approved reviews only. Null when there are none yet. */
  rating: { average: number; count: number } | null;
  /** The cheapest paid service open to everyone, in pence. Null when nothing is priced. */
  fromPence: number | null;
  /** A current qualification AND current insurance, both checked by APEX. */
  verified: boolean;
  /** Clients coached right now, only when the trainer shows it on their page. */
  clients: number | null;
  /** Free first session on their page. */
  introOffer: boolean;
  /** When the trainer joined the directory (ISO). */
  listedAt: string;
}

/** Which specialties serve each goal. A trainer with any of them is a fit. */
export const GOAL_SPECIALTIES: Record<GoalChoice, string[]> = {
  "Get stronger": ["Strength", "Muscle", "Hybrid racing"],
  "Lose fat": ["Fat loss", "Muscle", "Running"],
  "Build muscle": ["Muscle", "Strength"],
  "Run further": ["Running", "Hybrid racing"],
  "Move better": ["Mobility", "Rehab", "Pre and postnatal"],
  "Race prep": ["Hybrid racing", "Running"],
};

export const isGoal = (g: string): g is GoalChoice => (GOAL_CHOICES as readonly string[]).includes(g);

/** How someone wants to train → the trainer modes that serve it. Hybrid trainers do both. */
const MODE_FIT: Record<TrainingModeName, TrainingModeName[]> = {
  online: ["online", "hybrid"],
  in_person: ["in_person", "hybrid"],
  hybrid: ["hybrid"],
};

export const modeFits = (wanted: TrainingModeName, offered: TrainingModeName[]): boolean => MODE_FIT[wanted].some((m) => offered.includes(m));

/** Lower-case letters and digits only, so "St Albans" matches "st. albans". */
const plain = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Does a trainer's city match what someone typed? Either can contain the other ("London" ↔ "East London"). */
export function placeMatches(city: string, typed: string): boolean {
  const a = plain(city), b = plain(typed);
  if (!b) return true;
  if (!a) return false;
  return a.includes(b) || b.includes(a);
}

export type DirectorySort = "best" | "rating" | "price" | "new";
export const SORT_LABEL: Record<DirectorySort, string> = { best: "Best match", rating: "Top rated", price: "Lowest price", new: "Newest" };

export interface DirectoryFilter {
  goal: GoalChoice | null;
  specialty: string | null;
  mode: TrainingModeName | null;
  place: string;
  /** Per-session budget in pence; null = any. */
  maxPence: number | null;
  verifiedOnly: boolean;
  sort: DirectorySort;
}

export const EMPTY_FILTER: DirectoryFilter = { goal: null, specialty: null, mode: null, place: "", maxPence: null, verifiedOnly: false, sort: "best" };

/** Budget steps people pick from (per session). */
export const BUDGET_CHOICES: { label: string; pence: number | null }[] = [
  { label: "Any budget", pence: null },
  { label: "Up to £30", pence: 3000 },
  { label: "Up to £45", pence: 4500 },
  { label: "Up to £60", pence: 6000 },
  { label: "Up to £80", pence: 8000 },
];

export const filterCount = (f: DirectoryFilter): number =>
  [f.goal, f.specialty, f.mode, f.place.trim() || null, f.maxPence, f.verifiedOnly || null].filter((x) => x !== null).length;

/** Trust score: verified, reviews (weighted by how many), and a little for being priced and open about client numbers. */
function trust(t: TrainerCard): number {
  const reviews = t.rating ? t.rating.average * Math.min(1, t.rating.count / 5) : 0;
  return (t.verified ? 3 : 0) + reviews + (t.fromPence !== null ? 0.3 : 0) + (t.clients ? 0.2 : 0);
}

const byName = (a: TrainerCard, b: TrainerCard) => a.name.localeCompare(b.name, "en-GB");

/** The directory as someone filtered it. A trainer with no price still shows under a budget (they may be free or say on request). */
export function filterTrainers(list: TrainerCard[], f: DirectoryFilter): TrainerCard[] {
  const fits = list.filter((t) =>
    (!f.goal || t.specialties.some((s) => GOAL_SPECIALTIES[f.goal!].includes(s))) &&
    (!f.specialty || t.specialties.includes(f.specialty)) &&
    (!f.mode || modeFits(f.mode, t.modes)) &&
    // Online coaching works from anywhere, so a town only narrows in-person trainers.
    (!f.place.trim() || placeMatches(t.city, f.place) || (f.mode === "online" && t.modes.some((m) => m !== "in_person"))) &&
    (f.maxPence === null || t.fromPence === null || t.fromPence <= f.maxPence) &&
    (!f.verifiedOnly || t.verified),
  );
  const sorted = [...fits];
  if (f.sort === "rating") sorted.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0) || byName(a, b));
  else if (f.sort === "price") sorted.sort((a, b) => (a.fromPence ?? Infinity) - (b.fromPence ?? Infinity) || byName(a, b));
  else if (f.sort === "new") sorted.sort((a, b) => b.listedAt.localeCompare(a.listedAt) || byName(a, b));
  else sorted.sort((a, b) => trust(b) - trust(a) || byName(a, b));
  return sorted;
}

/** Specialties that at least one listed trainer offers, in the usual order, then any others. */
export function specialtiesOffered(list: TrainerCard[]): string[] {
  const all = new Set(list.flatMap((t) => t.specialties));
  return [...SPECIALTY_IDEAS.filter((s) => all.has(s)), ...[...all].filter((s) => !(SPECIALTY_IDEAS as readonly string[]).includes(s)).sort()];
}

/** "From £45 a session", or null. */
export const fromPriceText = (pence: number | null): string | null => (pence === null ? null : pence === 0 ? "Free first session" : `From ${formatPrice(pence)}`);

export const modesText = (modes: TrainingModeName[]): string => modes.map((m) => MODE_LABEL[m]).join(" · ");

// ── Match quiz ────────────────────────────────────────────────────────────────

export type MatchPriority = "reviews" | "verified" | "price" | "nearby";
export const PRIORITY_LABEL: Record<MatchPriority, string> = { reviews: "Great reviews", verified: "Checked qualifications", price: "Good value", nearby: "Close to me" };

export interface MatchAnswers {
  goal: GoalChoice | null;
  how: TrainingModeName | null;
  place: string;
  maxPence: number | null;
  priority: MatchPriority | null;
}

export const EMPTY_ANSWERS: MatchAnswers = { goal: null, how: null, place: "", maxPence: null, priority: null };

export interface MatchStep { key: keyof MatchAnswers; title: string; caption: string }

/** The quiz: five short questions. The place step is skipped for online-only. */
export function matchSteps(a: MatchAnswers): MatchStep[] {
  return [
    { key: "goal", title: "What's your main goal?", caption: "Pick one" },
    { key: "how", title: "How do you want to train?", caption: "Online works from anywhere" },
    ...(a.how === "online" ? [] : [{ key: "place" as const, title: "Where are you?", caption: "Your town or area" }]),
    { key: "maxPence", title: "What's your budget?", caption: "Per session" },
    { key: "priority", title: "What matters most?", caption: "We'll weigh it highest" },
  ];
}

export interface Match { trainer: TrainerCard; score: number; reasons: string[] }

/** Score every trainer against the answers and keep the best 3 that can actually coach this person.
    Hard limits: the goal, how they train and (for in-person) the place. Budget and priority only rank. */
export function matchTrainers(list: TrainerCard[], a: MatchAnswers, count = 3): Match[] {
  const out: Match[] = [];
  for (const t of list) {
    const reasons: string[] = [];
    let score = 0;
    if (a.goal) {
      const hit = t.specialties.filter((s) => GOAL_SPECIALTIES[a.goal!].includes(s));
      if (!hit.length) continue;
      score += 4 + (hit.length - 1);
      reasons.push(`Coaches ${hit.slice(0, 2).join(" and ").toLowerCase()}`);
    }
    if (a.how) {
      if (!modeFits(a.how, t.modes)) continue;
      score += 2;
      reasons.push(a.how === "online" ? "Coaches online" : a.how === "hybrid" ? "Online and in person" : "Trains in person");
    }
    const near = !!a.place.trim() && placeMatches(t.city, a.place);
    if (a.how !== "online" && a.place.trim()) {
      if (!near && a.how === "in_person") continue;
      if (near) { score += a.priority === "nearby" ? 4 : 2; reasons.push(`Based in ${t.city}`); }
    }
    if (a.maxPence !== null && t.fromPence !== null) {
      if (t.fromPence <= a.maxPence) { score += a.priority === "price" ? 3 : 1.5; reasons.push(`${fromPriceText(t.fromPence)}, in your budget`); }
      else score -= 2;
    } else if (a.priority === "price" && t.fromPence !== null) score += Math.max(0, 2 - t.fromPence / 5000);
    if (t.verified) { score += a.priority === "verified" ? 4 : 1.5; reasons.push("Qualifications checked by APEX"); }
    if (t.rating) {
      const r = t.rating.average * Math.min(1, t.rating.count / 5);
      score += a.priority === "reviews" ? r : r / 2;
      if (t.rating.average >= 4) reasons.push(`${t.rating.average.toFixed(1)} stars from ${t.rating.count} client${t.rating.count === 1 ? "" : "s"}`);
    }
    if (t.introOffer) { score += 0.5; reasons.push("First session free"); }
    out.push({ trainer: t, score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 3) });
  }
  return out.sort((x, y) => y.score - x.score || byName(x.trainer, y.trainer)).slice(0, count);
}

/** What the person told the quiz, as the first line of their enquiry, so the trainer knows them before replying. */
export function matchMessage(a: MatchAnswers): string {
  const how = a.how === "online" ? "online" : a.how === "hybrid" ? "online and in person" : a.how === "in_person" ? "in person" : null;
  const place = a.place.trim() && a.how !== "online" ? a.place.trim() : null;
  const parts = [
    how ? `wants to train ${how}${place ? ` near ${place}` : ""}` : place ? `based near ${place}` : null,
    a.maxPence !== null ? `budget up to ${formatPrice(a.maxPence)} a session` : null,
    a.priority ? `cares most about ${PRIORITY_LABEL[a.priority].toLowerCase()}` : null,
  ].filter((x): x is string => !!x);
  return parts.length ? `From the APEX match quiz: ${parts.join(", ")}.` : "";
}

/** The page link that opens the enquiry form with the quiz answers filled in. */
export function matchLink(origin: string, slug: string, a: MatchAnswers): string {
  const q = new URLSearchParams({ src: "match", form: "1" });
  if (a.goal) q.set("goal", a.goal);
  if (a.how) q.set("how", a.how);
  const note = matchMessage(a);
  if (note) q.set("note", note);
  return `${origin}/c/${slug}/?${q.toString()}`;
}

/** The trainer card link from the directory, tagged so the trainer sees the lead came from here. */
export const directoryLink = (origin: string, slug: string): string => `${origin}/c/${slug}/?src=directory`;

// ── Listing ───────────────────────────────────────────────────────────────────

/** Why a trainer can't join the directory yet, or null. */
export function directoryProblem(p: Pick<CoachPage, "published" | "headline" | "specialties" | "modes" | "city">): string | null {
  if (!p.published) return "Publish your page first.";
  if (!p.headline.trim()) return "Add a headline to your page.";
  if (!p.specialties.length) return "Pick at least one specialty.";
  if (!p.modes.length) return "Say how you coach: online, in person or both.";
  if (p.modes.some((m) => m !== "online") && !p.city.trim()) return "Add your city so people nearby can find you.";
  return null;
}

// ── Verified badge ────────────────────────────────────────────────────────────

export type CredentialKind = "qualification" | "insurance" | "first_aid";
export type CredentialStatus = "pending" | "approved" | "rejected";

export const CREDENTIAL_LABEL: Record<CredentialKind, string> = { qualification: "Qualification", insurance: "Insurance", first_aid: "First aid" };
export const CREDENTIAL_HINT: Record<CredentialKind, string> = {
  qualification: "Your PT certificate, for example Level 3 Personal Trainer.",
  insurance: "Your public liability or professional indemnity certificate.",
  first_aid: "Optional. A current first aid or CPR certificate.",
};
export const CREDENTIAL_STATUS_LABEL: Record<CredentialStatus, string> = { pending: "Being checked", approved: "Checked", rejected: "Not accepted" };

export interface Credential {
  id: string;
  kind: CredentialKind;
  title: string;
  issuer: string;
  /** YYYY-MM-DD, or null when it doesn't expire. */
  expires: string | null;
  status: CredentialStatus;
  /** Why it wasn't accepted, from the checker. */
  note: string;
  fileName: string;
  createdAt: string;
}

export interface CredentialDraft { kind: CredentialKind; title: string; issuer: string; expires: string | null }

export const CREDENTIAL_TITLE_MAX = 80;
export const CREDENTIAL_ISSUER_MAX = 80;
export const CREDENTIAL_FILE_MAX = 8 * 1024 * 1024;
export const CREDENTIAL_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Why a credential can't be sent for checking, or null. */
export function credentialProblem(d: CredentialDraft, file: { size: number; type: string } | null, today: string): string | null {
  if (d.title.trim().length < 3) return "Name the certificate, for example Level 3 Personal Trainer.";
  if (d.title.trim().length > CREDENTIAL_TITLE_MAX) return `Keep the name under ${CREDENTIAL_TITLE_MAX} characters.`;
  if (d.issuer.trim().length < 2) return "Add who issued it.";
  if (d.issuer.trim().length > CREDENTIAL_ISSUER_MAX) return `Keep the issuer under ${CREDENTIAL_ISSUER_MAX} characters.`;
  if (d.expires !== null && !ISO.test(d.expires)) return "Check the expiry date.";
  if (d.expires !== null && d.expires < today) return "This one has expired. Upload your current certificate.";
  if (d.kind === "insurance" && d.expires === null) return "Insurance needs its renewal date.";
  if (!file) return "Attach a photo or PDF of the certificate.";
  if (!CREDENTIAL_FILE_TYPES.includes(file.type)) return "Use a PDF or a photo (JPEG, PNG, WebP or HEIC).";
  if (file.size > CREDENTIAL_FILE_MAX) return "That file is over 8 MB. Try a smaller photo.";
  return null;
}

const current = (c: Credential, today: string) => c.status === "approved" && (c.expires === null || c.expires >= today);

/** Verified = a checked qualification and checked insurance, both in date. */
export function isVerified(list: Credential[], today: string): boolean {
  return list.some((c) => c.kind === "qualification" && current(c, today)) && list.some((c) => c.kind === "insurance" && current(c, today));
}

export interface VerifyStep { kind: CredentialKind; done: boolean; text: string }

/** What a trainer still needs for the badge, in order. */
export function verifySteps(list: Credential[], today: string): VerifyStep[] {
  return (["qualification", "insurance"] as const).map((kind) => {
    const mine = list.filter((c) => c.kind === kind);
    const ok = mine.find((c) => current(c, today));
    const waiting = mine.find((c) => c.status === "pending");
    const expired = mine.find((c) => c.status === "approved" && c.expires !== null && c.expires < today);
    const text = ok ? `${ok.title} checked` : waiting ? "Sent, being checked" : expired ? "Expired. Upload the new one" : kind === "qualification" ? "Upload your PT qualification" : "Upload your insurance";
    return { kind, done: !!ok, text };
  });
}

/** Approved credentials that expire within 30 days, so the trainer can renew before the badge drops. */
export function expiringSoon(list: Credential[], today: string, days = 30): Credential[] {
  const limit = new Date(Date.parse(`${today}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
  return list.filter((c) => c.status === "approved" && c.expires !== null && c.expires >= today && c.expires <= limit);
}

/** A credential the checker is looking at, with whose it is. */
export interface CredentialReview extends Credential { coachName: string; slug: string | null; filePath: string }

export const REJECT_NOTE_MAX = 200;

// ── Samples for the demo ──────────────────────────────────────────────────────

export function sampleTrainers(now = new Date()): TrainerCard[] {
  const ago = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();
  return [
    { slug: "kamal", name: "Kamal Amroche", headline: "Strength and hybrid coaching that fits a busy week", city: "London", specialties: ["Strength", "Hybrid racing", "Muscle"], modes: ["online", "hybrid"], rating: { average: 4.9, count: 14 }, fromPence: 5500, verified: true, clients: 18, introOffer: true, listedAt: ago(40) },
    { slug: "amara-okafor", name: "Amara Okafor", headline: "Run your first half marathon without getting hurt", city: "Manchester", specialties: ["Running", "Mobility"], modes: ["online", "in_person"], rating: { average: 4.8, count: 9 }, fromPence: 4000, verified: true, clients: 12, introOffer: false, listedAt: ago(25) },
    { slug: "priya-shah", name: "Priya Shah", headline: "Strong, safe training before and after baby", city: "Leeds", specialties: ["Pre and postnatal", "Strength", "Rehab"], modes: ["in_person", "hybrid"], rating: { average: 5, count: 6 }, fromPence: 4500, verified: true, clients: null, introOffer: true, listedAt: ago(12) },
    { slug: "tom-walsh", name: "Tom Walsh", headline: "Fat loss coaching with food you actually like", city: "Bristol", specialties: ["Fat loss", "Muscle"], modes: ["online"], rating: { average: 4.6, count: 21 }, fromPence: 3000, verified: false, clients: 30, introOffer: false, listedAt: ago(60) },
    { slug: "mei-chen", name: "Mei Chen", headline: "Move without pain again, one session at a time", city: "London", specialties: ["Mobility", "Rehab"], modes: ["in_person"], rating: null, fromPence: 6500, verified: true, clients: null, introOffer: false, listedAt: ago(3) },
    { slug: "diego-ramirez", name: "Diego Ramírez", headline: "Race-ready for your first hybrid fitness race", city: "Birmingham", specialties: ["Hybrid racing", "Running", "Strength"], modes: ["hybrid", "in_person"], rating: { average: 4.7, count: 4 }, fromPence: 5000, verified: false, clients: 9, introOffer: true, listedAt: ago(18) },
  ];
}

export function sampleCredentials(now = new Date()): Credential[] {
  const day = (d: number) => new Date(now.getTime() + d * 864e5).toISOString().slice(0, 10);
  return [
    { id: "cr-1", kind: "qualification", title: "Level 3 Personal Trainer", issuer: "Northfield Fitness Academy", expires: null, status: "approved", note: "", fileName: "level-3-certificate.pdf", createdAt: new Date(now.getTime() - 40 * 864e5).toISOString() },
    { id: "cr-2", kind: "insurance", title: "Public liability £5m", issuer: "Shieldline Insurance", expires: day(200), status: "approved", note: "", fileName: "insurance-2026.pdf", createdAt: new Date(now.getTime() - 40 * 864e5).toISOString() },
  ];
}

/** Answers a match link carries into the enquiry form (?goal=, ?how=, ?note=). Anything unexpected is dropped. */
export function readPrefill(search: string): { goal: GoalChoice | ""; how: TrainingModeName | ""; note: string } {
  const q = new URLSearchParams(search);
  const goal = q.get("goal") ?? "";
  const how = q.get("how") ?? "";
  const note = (q.get("note") ?? "").replace(/[<>]/g, "").trim().slice(0, 240);
  return { goal: isGoal(goal) ? goal : "", how: how === "online" || how === "hybrid" || how === "in_person" ? how : "", note };
}
