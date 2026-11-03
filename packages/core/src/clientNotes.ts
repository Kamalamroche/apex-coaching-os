/* Private coach notes and tags on each client. Only the coach ever sees them: never shown in the client app.
   Live: coach_client_notes and coach_client_tags (supabase/migrations/20261104090000_resources_notes.sql).
   Pure, so it is unit tested. */

export interface ClientNote {
  id: string;
  clientId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export const TAG_SUGGESTIONS = ["New", "VIP", "Injury", "Fat loss", "Strength", "Hybrid", "Race prep", "At risk", "Paused"];
export const MAX_TAGS = 8;

/** Tidy tags: trimmed, 24 characters at most, no repeats (ignoring case), 8 at most. */
export function cleanTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const tag = t.trim().replace(/\s+/g, " ").slice(0, 24);
    if (tag && !out.some((x) => x.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out.slice(0, MAX_TAGS);
}

/** Every tag in use, most used first, for the filter. */
export function tagsInUse(byClient: Record<string, string[]>): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const tags of Object.values(byClient)) for (const t of tags) {
    const k = t.toLowerCase();
    const cur = counts.get(k);
    counts.set(k, { tag: cur?.tag ?? t, count: (cur?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const hasTag = (tags: string[] | undefined, tag: string): boolean => !!tags?.some((t) => t.toLowerCase() === tag.toLowerCase());

/** Pinned first, then newest. */
export const sortNotes = (notes: ClientNote[]): ClientNote[] => [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

export function noteProblem(body: string): string | null {
  if (!body.trim()) return "Write something first.";
  if (body.length > 4000) return "That note is too long (4,000 characters at most).";
  return null;
}

export interface ClientNoteRow {
  id: string;
  coach_id: string;
  client_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
}

export const fromNoteRow = (r: ClientNoteRow): ClientNote => ({ id: r.id, clientId: r.client_id, body: r.body, pinned: r.pinned, createdAt: r.created_at });

export function sampleNotes(): { notes: ClientNote[]; tags: Record<string, string[]> } {
  return {
    notes: [
      { id: "demo-note-1", clientId: "5", body: "Old left knee injury (2023). Avoid deep lunges for now, split squats to a box are fine.", pinned: true, createdAt: "2026-09-02T10:00:00.000Z" },
      { id: "demo-note-2", clientId: "5", body: "Wedding in June: wants to feel strong and fit into the dress. Cares more about energy than the scale.", pinned: false, createdAt: "2026-09-02T10:05:00.000Z" },
      { id: "demo-note-3", clientId: "5", body: "Works shifts every other week. Offer 30-minute versions on shift weeks.", pinned: false, createdAt: "2026-10-14T18:20:00.000Z" },
    ],
    tags: { "1": ["At risk"], "2": ["Strength"], "3": ["Hybrid", "Race prep"], "4": ["Strength", "VIP"], "5": ["Fat loss", "Injury"], "6": ["New"] },
  };
}
