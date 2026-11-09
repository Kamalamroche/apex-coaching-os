/* Business dashboard: the coach's real numbers from their own records (clients, fees, leads, sessions, packs, programme sales).
   Pure, so it is unit tested. Card payments join in once Stripe is connected; until then income is what the coach recorded.
   Money is whole pence (GBP) throughout. */

import { sourceLabel } from "./leads";

export interface BizClient {
  id: string;
  name: string;
  startedAt: string;
  /** When the coaching ended. Null while active or paused, or for clients who ended before this was recorded. */
  endedAt: string | null;
  status: "invited" | "active" | "paused" | "ended";
  /** What the client pays each month, as the coach set it. 0 = not set or free. */
  feePence: number;
}
export interface BizLead { createdAt: string; stage: string; source: string }
export interface BizBooking { startsAt: string; kind: "call" | "session"; status: "booked" | "cancelled"; attendance: "attended" | "no_show" | null; late: boolean }
export interface BizPack { boughtAt: string; pricePence: number }
export interface BizSale { at: string; paidPence: number }

export interface BizInput {
  clients: BizClient[];
  leads: BizLead[];
  bookings: BizBooking[];
  packs: BizPack[];
  sales: BizSale[];
  now: Date;
}

export interface BizMonth {
  /** "2026-11" */
  key: string;
  /** "Nov" */
  label: string;
  feesPence: number;
  packsPence: number;
  salesPence: number;
  totalPence: number;
  newClients: number;
  lostClients: number;
}

export interface BizSource { source: string; label: string; leads: number; clients: number }

export interface BizSummary {
  active: number;
  paused: number;
  /** Monthly recurring: the fees of clients who are active or paused. */
  recurringPence: number;
  /** Active clients with no fee set, so the coach knows the recurring figure is incomplete. */
  noFee: number;
  /** Average fee per paying client. */
  perClientPence: number;
  newThisMonth: number;
  lostThisMonth: number;
  /** Clients who ended in the last 30 days, as a share of everyone coached 30 days ago. Null with nobody to compare. */
  churnPct: number | null;
  /** Share of clients coached 90 days ago who are still here. Null with nobody to compare. */
  retained90Pct: number | null;
  /** Average months a client stays (current and past clients). */
  avgMonths: number | null;
  /** What an average client is worth over their time with you: fee per client × months they stay. Null until there's enough history. */
  lifetimePence: number | null;
  months: BizMonth[];
  thisMonth: BizMonth;
  leads90: number;
  won90: number;
  conversionPct: number | null;
  sources: BizSource[];
  sessions30: { delivered: number; noShows: number; lateCancels: number; noShowPct: number | null };
}

const DAY = 864e5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const t = (iso: string) => Date.parse(iso);

/** Was the client being coached at any point in [from, to)? */
function overlaps(c: BizClient, from: number, to: number): boolean {
  if (c.status === "invited") return false;
  const start = t(c.startedAt);
  if (start >= to) return false;
  if (c.status !== "ended") return true;
  const end = c.endedAt ? t(c.endedAt) : null;
  // Ended before end dates were recorded: we only know they're gone, so they don't count in any month.
  if (end === null) return false;
  return end > from;
}

function coachedAt(c: BizClient, at: number): boolean {
  if (c.status === "invited" || t(c.startedAt) > at) return false;
  if (c.status !== "ended") return true;
  return c.endedAt !== null && t(c.endedAt) > at;
}

/** The last `count` calendar months, oldest first, ending with the month `now` is in. */
export function lastMonths(now: Date, count = 6): { key: string; label: string; from: number; to: number }[] {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ key: monthKey(start), label: MONTHS[start.getMonth()]!, from: start.getTime(), to: end.getTime() });
  }
  return out;
}

export function businessSummary(input: BizInput, monthsBack = 6): BizSummary {
  const now = input.now.getTime();
  const clients = input.clients.filter((c) => c.status !== "invited");
  const current = clients.filter((c) => c.status === "active" || c.status === "paused");
  const active = current.filter((c) => c.status === "active").length;
  const paused = current.length - active;
  const recurringPence = current.reduce((a, c) => a + Math.max(0, c.feePence), 0);
  const paying = current.filter((c) => c.feePence > 0);
  const noFee = current.length - paying.length;
  const perClientPence = paying.length ? Math.round(recurringPence / paying.length) : 0;

  const months: BizMonth[] = lastMonths(input.now, monthsBack).map((m) => {
    // A fee counts for a month the client was coached in. Past months use today's fee: a fair estimate until Stripe has the real history.
    const feesPence = clients.filter((c) => overlaps(c, m.from, m.to)).reduce((a, c) => a + Math.max(0, c.feePence), 0);
    const packsPence = input.packs.filter((p) => t(p.boughtAt) >= m.from && t(p.boughtAt) < m.to).reduce((a, p) => a + Math.max(0, p.pricePence), 0);
    const salesPence = input.sales.filter((s) => t(s.at) >= m.from && t(s.at) < m.to).reduce((a, s) => a + Math.max(0, s.paidPence), 0);
    const newClients = clients.filter((c) => t(c.startedAt) >= m.from && t(c.startedAt) < m.to).length;
    const lostClients = clients.filter((c) => c.status === "ended" && c.endedAt && t(c.endedAt) >= m.from && t(c.endedAt) < m.to).length;
    return { key: m.key, label: m.label, feesPence, packsPence, salesPence, totalPence: feesPence + packsPence + salesPence, newClients, lostClients };
  });
  const thisMonth = months[months.length - 1]!;

  const ago30 = now - 30 * DAY;
  const base30 = clients.filter((c) => coachedAt(c, ago30));
  const lost30 = base30.filter((c) => c.status === "ended" && c.endedAt && t(c.endedAt) > ago30 && t(c.endedAt) <= now).length;
  const churnPct = base30.length ? Math.round((lost30 / base30.length) * 100) : null;
  const ago90 = now - 90 * DAY;
  const base90 = clients.filter((c) => coachedAt(c, ago90));
  const still90 = base90.filter((c) => c.status !== "ended").length;
  const retained90Pct = base90.length ? Math.round((still90 / base90.length) * 100) : null;

  // Time with you: finished stays end at their end date, current ones run to today. Unknown end dates are left out.
  const stays = clients
    .map((c) => (c.status === "ended" ? (c.endedAt ? t(c.endedAt) - t(c.startedAt) : null) : now - t(c.startedAt)))
    .filter((ms): ms is number => ms !== null && ms >= 0);
  const avgMonths = stays.length ? Math.round((stays.reduce((a, b) => a + b, 0) / stays.length / (30.44 * DAY)) * 10) / 10 : null;
  // Only meaningful once someone has actually left: otherwise "average stay" is just "how long you've been coaching".
  const anyEnded = clients.some((c) => c.status === "ended" && c.endedAt);
  const lifetimePence = anyEnded && avgMonths !== null && perClientPence > 0 ? Math.round(perClientPence * Math.max(1, avgMonths)) : null;

  const leads90 = input.leads.filter((l) => t(l.createdAt) > ago90);
  const won90 = leads90.filter((l) => l.stage === "client").length;
  const bySource = new Map<string, BizSource>();
  for (const l of leads90) {
    const key = (l.source || "page").toLowerCase();
    const s = bySource.get(key) ?? { source: key, label: sourceLabel(key), leads: 0, clients: 0 };
    s.leads += 1;
    if (l.stage === "client") s.clients += 1;
    bySource.set(key, s);
  }
  const sources = [...bySource.values()].sort((a, b) => b.clients - a.clients || b.leads - a.leads || a.label.localeCompare(b.label));

  const sessions = input.bookings.filter((b) => b.kind === "session" && t(b.startsAt) > ago30 && t(b.startsAt) <= now);
  const delivered = sessions.filter((b) => b.status === "booked" && b.attendance === "attended").length;
  const noShows = sessions.filter((b) => b.status === "booked" && b.attendance === "no_show").length;
  const lateCancels = sessions.filter((b) => b.status === "cancelled" && b.late).length;
  const marked = delivered + noShows;

  return {
    active,
    paused,
    recurringPence,
    noFee,
    perClientPence,
    newThisMonth: thisMonth.newClients,
    lostThisMonth: thisMonth.lostClients,
    churnPct,
    retained90Pct,
    avgMonths,
    lifetimePence,
    months,
    thisMonth,
    leads90: leads90.length,
    won90,
    conversionPct: leads90.length ? Math.round((won90 / leads90.length) * 100) : null,
    sources,
    sessions30: { delivered, noShows, lateCancels, noShowPct: marked ? Math.round((noShows / marked) * 100) : null },
  };
}

/** "£1,234" or "£12.50": whole pounds when there are no pence. */
export function pounds(pence: number): string {
  const p = Math.round(pence);
  const whole = p % 100 === 0;
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

/** Parses what a coach types as a fee ("150", "£150", "149.99") into pence. Null when it isn't a sensible amount. */
export function parsePounds(text: string): number | null {
  const s = text.trim().replace(/^£/, "").replace(/,/g, "");
  if (s === "") return 0;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const pence = Math.round(Number(s) * 100);
  return pence <= 10_000_000 ? pence : null;
}
