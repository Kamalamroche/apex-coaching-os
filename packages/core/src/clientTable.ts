// The trainer's desktop client table: one row per client with their health score, each part of it, how long since
// they last trained, and what they pay. Sorting is pure so it is unit tested; the screen only draws it.
import type { HealthBand, HealthPart, RosterRow } from "./health";

export type TablePartKey = HealthPart["key"];
export const TABLE_PARTS: { key: TablePartKey; label: string }[] = [
  { key: "training", label: "Training" },
  { key: "checkins", label: "Check-ins" },
  { key: "habits", label: "Habits" },
  { key: "food", label: "Food" },
  { key: "contact", label: "In touch" },
];

export interface TableClient { id: string; name: string; mode: string; plan?: string }

export interface ClientTableRow {
  id: string;
  name: string;
  mode: string;
  plan: string | null;
  score: number | null;
  band: HealthBand;
  trend: number | null;
  /** 0–100 per part. Null when the part isn't scored for this client (no habits set, no food targets, first week). */
  parts: Record<TablePartKey, number | null>;
  /** Whole days since the last finished session. Null when they haven't trained yet. */
  daysSinceSession: number | null;
  /** Monthly fee in pence. Null when unknown. */
  feePence: number | null;
  /** The thing pulling the score down most, in plain words. */
  why: string;
}

export type TableSortKey = "need" | "name" | "score" | "trend" | TablePartKey | "last" | "fee";
export type SortDir = "asc" | "desc";

const DAY = 864e5;

/** Build the rows from the health roster plus each client's last session and fee. */
export function clientTableRows<T extends TableClient>(
  roster: RosterRow<T>[],
  extra: { lastSession?: (c: T) => string | null; daysSince?: (c: T) => number | null; feePence?: (c: T) => number | null },
  now = new Date(),
): ClientTableRow[] {
  return roster.map((r) => {
    const parts = Object.fromEntries(TABLE_PARTS.map((p) => [p.key, null])) as Record<TablePartKey, number | null>;
    for (const p of r.health.parts) parts[p.key] = Math.round(p.score * 100);
    let days: number | null = extra.daysSince ? extra.daysSince(r.client) : null;
    if (extra.lastSession) {
      const iso = extra.lastSession(r.client);
      days = iso ? Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY)) : null;
    }
    return {
      id: r.client.id,
      name: r.client.name,
      mode: r.client.mode,
      plan: r.client.plan ?? null,
      score: r.health.score,
      band: r.health.band,
      trend: r.trend,
      parts,
      daysSinceSession: days,
      feePence: extra.feePence ? extra.feePence(r.client) : null,
      why: r.health.score === null ? "In their first week" : r.health.reasons[0] ?? "",
    };
  });
}

/** The direction a column sorts in on its first click: worst first for scores, longest gap first for last session. */
export function defaultDir(key: TableSortKey): SortDir {
  return key === "name" || key === "need" || key === "score" || key === "trend" || TABLE_PARTS.some((p) => p.key === key) ? "asc" : "desc";
}

function value(r: ClientTableRow, key: TableSortKey): number | string | null {
  switch (key) {
    case "name": return r.name.toLowerCase();
    case "score": return r.score;
    case "trend": return r.trend;
    case "last": return r.daysSinceSession;
    case "fee": return r.feePence;
    case "need": return null;
    default: return r.parts[key];
  }
}

/** Sort the table. Blanks (no score, never trained, no fee) always go last whatever the direction.
    "need" keeps the roster's own order (lowest health first, biggest drop next). Ties fall back to name. */
export function sortClientTable(rows: ClientTableRow[], key: TableSortKey, dir: SortDir = defaultDir(key)): ClientTableRow[] {
  if (key === "need") return dir === "asc" ? [...rows] : [...rows].reverse();
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: value(r, key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === null ? (b.v === null ? a.i - b.i : 1) : -1;
      const c = typeof a.v === "string" ? a.v.localeCompare(b.v as string) : (a.v as number) - (b.v as number);
      return sign * c || a.r.name.localeCompare(b.r.name);
    })
    .map((x) => x.r);
}

/** "Today", "Yesterday", "5 days ago", "Not yet". */
export function lastSessionLabel(days: number | null): string {
  if (days === null) return "Not yet";
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/** Roster totals for the table footer: how many need the coach, the average score, monthly income from the rows. */
export function tableSummary(rows: ClientTableRow[]): { needYou: number; average: number | null; feesPence: number } {
  const scored = rows.filter((r) => r.score !== null);
  return {
    needYou: rows.filter((r) => r.band === "low").length,
    average: scored.length ? Math.round(scored.reduce((a, r) => a + r.score!, 0) / scored.length) : null,
    feesPence: rows.reduce((a, r) => a + (r.feePence ?? 0), 0),
  };
}

/** "Sarah Mitchell, James Kowalski" style search: every word must be in the name, mode or plan. */
export function matchesClientSearch(r: Pick<ClientTableRow, "name" | "mode" | "plan">, q: string): boolean {
  const hay = `${r.name} ${r.mode} ${r.plan ?? ""}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
