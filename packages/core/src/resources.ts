/* Resource library: guides the coach writes and links they share (videos, PDFs, articles), for every client
   or one in particular. Live: coach_resources (supabase/migrations/20261104090000_resources_notes.sql).
   Pure, so it is unit tested. */

export const RESOURCE_CATEGORIES = ["Training", "Nutrition", "Recovery", "Mindset", "Getting started"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  /** A short guide in the coach's words. */
  body: string;
  /** Optional https link: a video, a PDF, an article. */
  url: string;
  /** Null: every client. Otherwise only this client sees it. */
  clientId: string | null;
  createdAt: string;
}

export type LinkKind = "video" | "pdf" | "link";

/** What kind of link it is, for the icon and the words on the button. */
export function linkKind(url: string): LinkKind {
  try {
    const u = new URL(url);
    if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com)$/.test(u.hostname)) return "video";
    if (u.pathname.toLowerCase().endsWith(".pdf")) return "pdf";
  } catch { /* not a link */ }
  return "link";
}

export const linkHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Only plain web links: nothing that could run code when tapped. */
export function safeUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function resourceProblem(r: Resource): string | null {
  if (!r.title.trim()) return "Give it a title.";
  if (r.title.length > 120) return "Keep the title under 120 characters.";
  if (!r.body.trim() && !r.url.trim()) return "Write a short guide, add a link, or both.";
  if (r.body.length > 8000) return "That guide is too long (8,000 characters at most).";
  if (r.url.trim() && !safeUrl(r.url)) return "That link doesn't look right. It should start with https://";
  if (!RESOURCE_CATEGORIES.includes(r.category)) return "Pick a category.";
  return null;
}

/** For the client: their own and everyone's, newest first, grouped by category in the usual order. */
export function groupResources(list: Resource[]): { category: ResourceCategory; items: Resource[] }[] {
  return RESOURCE_CATEGORIES.map((category) => ({ category, items: list.filter((r) => r.category === category).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })).filter((g) => g.items.length);
}

export interface ResourceRow {
  id: string;
  coach_id: string;
  client_id: string | null;
  title: string;
  category: string;
  body: string | null;
  url: string | null;
  created_at: string;
}

export const toResourceRow = (r: Resource, coachId: string): Omit<ResourceRow, "created_at"> => ({
  id: r.id, coach_id: coachId, client_id: r.clientId, title: r.title.trim(), category: r.category, body: r.body.trim() || null, url: r.url.trim() || null,
});

export const fromResourceRow = (r: ResourceRow): Resource => ({
  id: r.id, title: r.title, category: (RESOURCE_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as ResourceCategory) : "Getting started",
  body: r.body ?? "", url: r.url ?? "", clientId: r.client_id, createdAt: r.created_at,
});

export const blankResource = (now = new Date()): Resource => ({ id: crypto.randomUUID(), title: "", category: "Training", body: "", url: "", clientId: null, createdAt: now.toISOString() });

export function sampleResources(): Resource[] {
  const at = (d: string) => `${d}T09:00:00.000Z`;
  return [
    { id: "demo-res-1", title: "How your first four weeks work", category: "Getting started", url: "", clientId: null, createdAt: at("2026-10-01"),
      body: "Weeks 1 and 2 are about learning the movements and finding your starting weights. Leave one or two reps in the tank on every set.\n\nWeeks 3 and 4 we add a little weight each session if the last one felt good. Log every set in the app so I can see how it's going.\n\nCheck in every Monday. It takes two minutes and it's how I adjust your plan." },
    { id: "demo-res-2", title: "Protein made simple", category: "Nutrition", url: "", clientId: null, createdAt: at("2026-10-05"),
      body: "Aim for a palm-sized portion of protein at each meal: chicken, fish, eggs, Greek yoghurt, tofu or lentils.\n\nThree meals plus one protein snack gets most people to their target without counting every gram." },
    { id: "demo-res-3", title: "Sleep checklist", category: "Recovery", url: "", clientId: null, createdAt: at("2026-10-12"),
      body: "Same bedtime most nights, within 30 minutes.\nPhone out of the bedroom, or at least across the room.\nCool, dark room.\nNo caffeine after 2 pm." },
    { id: "demo-res-4", title: "Bracing for big lifts (video)", category: "Training", url: "https://www.youtube.com/", clientId: null, createdAt: at("2026-10-20"),
      body: "Watch this before your next lower body day. Big breath into your belly, brace like someone's about to poke you, then lift." },
  ];
}
