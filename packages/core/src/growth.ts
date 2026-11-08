/* Growth: a coach's public page, the "Train with me" link that points at it, and clients inviting a friend.
   Pure helpers shared by the web app and mirrored by supabase/migrations/20261110090000_growth.sql. */

export type TrainingModeName = "online" | "hybrid" | "in_person";

/** What anyone can see on a coach's public page. Never client data. */
export interface CoachPage {
  slug: string;
  name: string;
  headline: string;
  bio: string;
  city: string;
  specialties: string[];
  modes: TrainingModeName[];
  published: boolean;
  /** Clients currently coached, shown only when the coach chooses to. */
  clients: number | null;
}

export interface JoinRequestDraft {
  name: string;
  email: string;
  goal: string;
  message: string;
}

export type JoinRequestStatus = "new" | "invited" | "joined" | "declined";

export interface JoinRequest extends JoinRequestDraft {
  id: string;
  at: string;
  status: JoinRequestStatus;
  /** "Priya S." when a client sent the friend. */
  referredBy: string | null;
}

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;
export const HEADLINE_MAX = 80;
export const BIO_MAX = 600;
export const SPECIALTY_MAX = 6;
export const REQUEST_MESSAGE_MAX = 400;

export const MODE_LABEL: Record<TrainingModeName, string> = { online: "Online", hybrid: "Hybrid", in_person: "In person" };

export const GOAL_CHOICES = ["Get stronger", "Lose fat", "Build muscle", "Run further", "Move better", "Race prep"] as const;

export const SPECIALTY_IDEAS = ["Strength", "Fat loss", "Muscle", "Hybrid racing", "Running", "Mobility", "Pre and postnatal", "Rehab"] as const;

/** Names coaches can't take: app routes and words that would confuse people. */
const RESERVED = new Set(["admin", "apex", "api", "app", "client", "coach", "help", "legal", "login", "privacy", "settings", "start", "support", "terms"]);

/** "Kamal Amroche" → "kamal-amroche". Lowercase letters, digits and single hyphens. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Why this page address can't be used, or null when it can. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Use at least ${SLUG_MIN} letters or numbers.`;
  if (slug.length > SLUG_MAX) return `Keep it to ${SLUG_MAX} characters.`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, numbers and single hyphens.";
  if (RESERVED.has(slug)) return "That name is taken. Try your own name.";
  return null;
}

/** Why the page can't be published yet, or null. */
export function pageProblem(p: Pick<CoachPage, "slug" | "headline" | "bio" | "specialties">): string | null {
  const s = slugProblem(p.slug);
  if (s) return s;
  if (!p.headline.trim()) return "Add a headline.";
  if (p.headline.trim().length > HEADLINE_MAX) return `Keep the headline to ${HEADLINE_MAX} characters.`;
  if (p.bio.trim().length > BIO_MAX) return `Keep your story to ${BIO_MAX} characters.`;
  if (p.specialties.length > SPECIALTY_MAX) return `Pick up to ${SPECIALTY_MAX} specialties.`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why a "Train with me" request can't be sent, or null. */
export function requestProblem(d: JoinRequestDraft): string | null {
  if (d.name.trim().length < 2) return "Add your name.";
  if (d.name.trim().length > 60) return "Keep your name to 60 characters.";
  if (!EMAIL.test(d.email.trim())) return "Add an email your coach can reply to.";
  if (d.message.trim().length > REQUEST_MESSAGE_MAX) return `Keep your message to ${REQUEST_MESSAGE_MAX} characters.`;
  return null;
}

/** The page address. With a friend's code, the coach sees who sent them. */
export function pageLink(origin: string, slug: string, ref?: string | null): string {
  const base = `${origin.replace(/\/+$/, "")}/c/?k=${encodeURIComponent(slug)}`;
  return ref ? `${base}&ref=${encodeURIComponent(ref)}` : base;
}

/** The slug and friend code from a page URL: /c/?k=kamal&ref=ab12cd, or /c/kamal/. */
export function readPageLink(pathname: string, search: string): { slug: string | null; ref: string | null } {
  const q = new URLSearchParams(search);
  const fromPath = /^\/c\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1] ?? null;
  const slug = (q.get("k") ?? fromPath ?? "").toLowerCase();
  const ref = q.get("ref");
  return { slug: slug && !slugProblem(slug) ? slug : null, ref: ref && /^[a-z0-9]{6,12}$/.test(ref) ? ref : null };
}

/** The coach's "Train with me" message, ready to paste into a bio or a DM. */
export function trainWithMeText(link: string): string {
  return `Train with me on APEX. A plan built for you, sessions that guide you, progress you can see. ${link}`;
}

/** The client's invite text. */
export function inviteFriendText(coachName: string, link: string): string {
  return `I train with ${coachName} on APEX and it's working. Come and train with us: ${link}`;
}

export interface ReferralSummary {
  asked: number;
  joined: number;
}

/** What the inviting client sees: how many friends asked to train, and how many joined. */
export function referralSummary(requests: Pick<JoinRequest, "status">[]): ReferralSummary {
  return {
    asked: requests.filter((r) => r.status !== "declined").length,
    joined: requests.filter((r) => r.status === "joined").length,
  };
}

/** Newest first, the ones that need the coach on top. */
export function sortRequests<T extends Pick<JoinRequest, "status" | "at">>(list: T[]): T[] {
  const rank: Record<JoinRequestStatus, number> = { new: 0, invited: 1, joined: 2, declined: 3 };
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || Date.parse(b.at) - Date.parse(a.at));
}

/** A new page, filled in from the coach's name. */
export function blankPage(name: string): CoachPage {
  return { slug: slugify(name), name, headline: "", bio: "", city: "", specialties: [], modes: ["online"], published: false, clients: null };
}

export interface PageRow {
  slug: string; name: string; headline: string; bio: string | null; city: string | null;
  specialties: string[] | null; modes: string[] | null; published?: boolean; clients?: number | null;
}

export const fromPageRow = (r: PageRow): CoachPage => ({
  slug: r.slug, name: r.name, headline: r.headline, bio: r.bio ?? "", city: r.city ?? "",
  specialties: r.specialties ?? [], modes: (r.modes ?? []).filter((m): m is TrainingModeName => m in MODE_LABEL),
  published: r.published ?? true, clients: r.clients ?? null,
});

/** The demo coach's page. */
export function samplePage(): CoachPage {
  return {
    slug: "kamal", name: "Kamal", published: true, clients: 6, city: "London",
    headline: "Strength and hybrid coaching that fits your life",
    bio: "I coach busy people to get strong, fit and confident. Every plan is written for you, every session is guided in the app, and I check in each week so you never train alone.",
    specialties: ["Strength", "Hybrid racing", "Fat loss", "Mobility"],
    modes: ["online", "hybrid"],
  };
}

export function sampleRequests(now = new Date()): JoinRequest[] {
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  return [
    { id: "r1", name: "Leo Martin", email: "leo@example.com", goal: "Run further", message: "Training for my first half marathon in spring.", at: ago(3), status: "new", referredBy: "Priya S." },
    { id: "r2", name: "Hana Ito", email: "hana@example.com", goal: "Get stronger", message: "", at: ago(26), status: "new", referredBy: null },
    { id: "r3", name: "Sam Okafor", email: "sam@example.com", goal: "Build muscle", message: "", at: ago(80), status: "joined", referredBy: "Priya S." },
  ];
}
