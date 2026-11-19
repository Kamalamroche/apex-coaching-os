/**
 * Quick find: one search box for the coach that reaches any client, screen or action.
 * Pure ranking, so it is fast with hundreds of clients and easy to test.
 */

export type QuickKind = "client" | "screen" | "action";

export interface QuickItem {
  id: string;
  kind: QuickKind;
  title: string;
  /** A short second line, e.g. "Clients · profile tab". */
  hint?: string;
  /** Extra words that should find this item ("money" finds Business). */
  keywords?: string[];
  /** Show only when a query word matches one of these, e.g. a client's Check-ins row needs "check" typed, not just the name. */
  only?: string[];
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").trim();
const words = (s: string) => norm(s).split(/\s+/).filter(Boolean);

/** How well one query word fits one item: 0 is no match, higher is better. */
function wordScore(q: string, titleWords: string[], keyWords: string[]): number {
  let best = 0;
  for (const w of titleWords) {
    if (w === q) best = Math.max(best, 10);
    else if (w.startsWith(q)) best = Math.max(best, 8);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 4);
  }
  for (const w of keyWords) {
    if (w === q) best = Math.max(best, 7);
    else if (w.startsWith(q)) best = Math.max(best, 6);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 3);
  }
  // Initials: "sm" finds Sarah Mitchell.
  if (!best && q.length >= 2 && titleWords.length >= 2 && titleWords.map((w) => w[0]).join("").startsWith(q)) best = 5;
  return best;
}

/**
 * Items that match every word of the query, best first. An empty query gives `empty` (or nothing).
 * Ties keep the order the items came in, so callers can put the most useful first.
 */
export function quickFind(query: string, items: QuickItem[], limit = 8, empty: QuickItem[] = []): QuickItem[] {
  const qs = words(query);
  if (!qs.length) return empty.slice(0, limit);
  const scored: { item: QuickItem; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const tw = words(item.title);
    const kw = (item.keywords ?? []).flatMap(words);
    if (item.only) {
      const ow = item.only.flatMap(words);
      if (!qs.some((q) => wordScore(q, ow, []))) return;
    }
    let total = 0;
    for (const q of qs) {
      const s = wordScore(q, tw, kw);
      if (!s) return;
      total += s;
    }
    // A whole-title start ("bri" → Brief) beats a match deep inside a long title.
    if (norm(item.title).startsWith(norm(query))) total += 3;
    // Shorter titles are more likely what was meant.
    total -= tw.length * 0.1;
    scored.push({ item, score: total, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.item);
}

/** The places a coach can open on a client's profile from quick find. */
export const CLIENT_PLACES: { tab: string; keywords: string[] }[] = [
  { tab: "Programme", keywords: ["program", "plan", "workouts", "training"] },
  { tab: "Check-ins", keywords: ["checkin", "check in", "weekly", "photos", "weight"] },
  { tab: "Notes", keywords: ["notes", "tags", "memo"] },
  { tab: "In person", keywords: ["session", "pt", "face to face", "one to one"] },
  { tab: "Nutrition", keywords: ["food", "macros", "diet", "meals", "calories"] },
  { tab: "Habits", keywords: ["habit", "steps", "water", "sleep"] },
  { tab: "Goals", keywords: ["goal", "target"] },
  { tab: "Form checks", keywords: ["video", "form", "technique"] },
  { tab: "Assessment", keywords: ["assessment", "posture", "mobility", "test"] },
  { tab: "Recovery", keywords: ["recovery", "cardio", "readiness", "hrv"] },
  { tab: "Report", keywords: ["report", "progress", "summary"] },
];

/** One item per client (open the profile) and, when the query names a place, one per client + place. */
export function clientItems(clients: { id: string; name: string; hint?: string }[]): QuickItem[] {
  const out: QuickItem[] = [];
  for (const c of clients) out.push({ id: `client:${c.id}`, kind: "client", title: c.name, hint: c.hint ?? "Open profile", keywords: ["client"] });
  for (const c of clients)
    for (const p of CLIENT_PLACES)
      out.push({ id: `client:${c.id}:${p.tab}`, kind: "client", title: `${c.name} · ${p.tab}`, hint: "Client profile", keywords: p.keywords, only: [p.tab, ...p.keywords] });
  return out;
}

/** Splits an id made by clientItems back into the client and the profile tab. */
export function parseClientItem(id: string): { clientId: string; tab?: string } | null {
  if (!id.startsWith("client:")) return null;
  const [, clientId, tab] = id.split(":");
  return clientId ? { clientId, tab } : null;
}
