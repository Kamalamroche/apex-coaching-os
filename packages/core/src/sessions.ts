/* 1:1 training sessions: the coach's cancellation policy, session packs (credits), and the register.
   A pack is a number of sessions a client paid for (or was given). Each booked training session uses one credit,
   and so does a late cancel or a no-show unless the coach waives it. Calls are free and never use a credit.
   Live: supabase/migrations/20261119090000_sessions.sql. Pure, so it is unit tested. */

import type { Booking, BookingSettings } from "./booking";
import { formatPrice } from "./onDemand";

/* ---------- Policy ---------- */

export interface SessionPolicy {
  /** Clients can cancel for free until this many hours before. 0 = any time. */
  cancelHours: number;
  /** Clients need a session left to book a training session. */
  requireCredits: boolean;
}

export const CANCEL_CHOICES = [0, 3, 12, 24, 48];
export const DEFAULT_POLICY: SessionPolicy = { cancelHours: 24, requireCredits: false };

const H = 3600000;

/** The policy inside the coach's booking settings. */
export const policyOf = (s: Pick<BookingSettings, "cancelHours" | "requireCredits"> | null | undefined): SessionPolicy =>
  ({ cancelHours: s?.cancelHours ?? DEFAULT_POLICY.cancelHours, requireCredits: !!s?.requireCredits });

/** Cancelling now would be late: inside the policy window, before the session starts. */
export function isLateCancel(startsAt: string, now: Date, policy: SessionPolicy): boolean {
  if (!policy.cancelHours) return false;
  const left = Date.parse(startsAt) - now.getTime();
  return left < policy.cancelHours * H;
}

/** One line the client sees before booking. */
export function policyText(policy: SessionPolicy): string {
  if (!policy.cancelHours) return "You can move or cancel any time for free.";
  return `Move or cancel for free up to ${hoursText(policy.cancelHours)} before. Later cancels and no-shows use a session.`;
}

/** "24 hours", "2 days". */
export function hoursText(h: number): string {
  return h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hour${h === 1 ? "" : "s"}`;
}

/** The client can still move this booking to another free slot: it's ahead and outside the cancel window. */
export function canMove(b: Pick<Booking, "status" | "startsAt" | "kind">, now: Date, policy: SessionPolicy): boolean {
  return b.status === "booked" && Date.parse(b.startsAt) > now.getTime() && !(b.kind === "session" && isLateCancel(b.startsAt, now, policy));
}

/** What the client is told before they cancel this booking, or null when cancelling costs nothing. */
export function cancelWarning(b: Pick<Booking, "kind" | "startsAt">, now: Date, policy: SessionPolicy): string | null {
  if (b.kind !== "session" || !isLateCancel(b.startsAt, now, policy)) return null;
  return `This is less than ${hoursText(policy.cancelHours)} before, so it still uses a session. Your coach can waive it.`;
}

/* ---------- Packs ---------- */

export type PackPaidVia = "cash" | "bank" | "card" | "free";
export type PackSource = "purchase" | "referral" | "intro" | "gift";

export interface SessionPack {
  id: string;
  clientId: string;
  sessions: number;
  /** What the client paid, in pence. 0 for gifts and rewards. */
  pricePence: number;
  paidVia: PackPaidVia;
  source: PackSource;
  boughtAt: string;
  /** Unused sessions lapse at this time. Null: never. */
  expiresAt: string | null;
  note: string;
}

export const PACK_CHOICES = [1, 5, 10, 20];
/** Months until a pack expires; 0 = never. */
export const EXPIRY_CHOICES = [0, 1, 3, 6, 12];
export const PACK_MAX = 100;
export const PAID_LABEL: Record<PackPaidVia, string> = { cash: "Cash", bank: "Bank transfer", card: "Card", free: "Free" };
export const SOURCE_LABEL: Record<PackSource, string> = { purchase: "Pack", referral: "Referral reward", intro: "Intro session", gift: "Gift" };

/** Adds whole months, keeping the day where the month has it (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

export function newPack(clientId: string, sessions: number, pricePence: number, paidVia: PackPaidVia, expiryMonths: number, note = "", source: PackSource = "purchase", now = new Date()): SessionPack {
  const boughtAt = now.toISOString();
  return {
    id: crypto.randomUUID(), clientId, sessions: Math.max(1, Math.min(PACK_MAX, Math.round(sessions))), pricePence: Math.max(0, Math.round(pricePence)),
    paidVia: pricePence ? paidVia : "free", source, boughtAt, expiresAt: expiryMonths ? addMonths(boughtAt, expiryMonths) : null, note: note.trim().slice(0, 200),
  };
}

export function packProblem(sessions: number, pricePence: number | null): string | null {
  if (!Number.isFinite(sessions) || sessions < 1) return "A pack needs at least 1 session.";
  if (sessions > PACK_MAX) return `A pack can hold up to ${PACK_MAX} sessions.`;
  if (pricePence === null) return "Type a price such as 45 or 400, or leave it empty for free.";
  return null;
}

/** "10 sessions · £400" */
export const packTitle = (p: Pick<SessionPack, "sessions" | "pricePence" | "source">) =>
  `${p.sessions} session${p.sessions === 1 ? "" : "s"}${p.source !== "purchase" ? ` · ${SOURCE_LABEL[p.source]}` : p.pricePence ? ` · ${formatPrice(p.pricePence)}` : ""}`;

/* ---------- Credits ---------- */

/** What happened to a session. Null while it's ahead, or not marked yet. */
export type Attendance = "attended" | "no_show" | null;

/** This booking costs the client a session. */
export function usesCredit(b: Booking): boolean {
  if (b.kind !== "session") return false;
  if (b.status === "cancelled") return !!b.late && !b.waived;
  if (b.attendance === "no_show") return !b.waived;
  return true;
}

export interface Credits {
  /** Sessions still available in packs that haven't expired. */
  left: number;
  /** Sessions that used a credit. */
  used: number;
  /** Sessions taken with no credit to cover them: the client owes these. */
  owed: number;
  /** Unused sessions that lapsed with their pack. */
  lapsed: number;
  /** The soonest pack expiry with sessions still in it. */
  nextExpiry: { at: string; sessions: number } | null;
  /** Which pack paid for each booking; null when nothing covered it. */
  paidBy: Record<string, string | null>;
}

/** Works through a client's bookings in time order, paying each from the pack that expires first. */
export function credits(packs: SessionPack[], bookings: Booking[], now: Date): Credits {
  const order = [...packs].sort((a, b) => (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999") || a.boughtAt.localeCompare(b.boughtAt));
  const left = new Map(order.map((p) => [p.id, p.sessions]));
  const paidBy: Record<string, string | null> = {};
  let used = 0, owed = 0;
  for (const b of [...bookings].filter(usesCredit).sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    used++;
    const at = b.startsAt;
    const pack = order.find((p) => (left.get(p.id) ?? 0) > 0 && (!p.expiresAt || p.expiresAt > at));
    if (pack) { left.set(pack.id, left.get(pack.id)! - 1); paidBy[b.id] = pack.id; }
    else { owed++; paidBy[b.id] = null; }
  }
  const t = now.toISOString();
  let available = 0, lapsed = 0;
  let nextExpiry: Credits["nextExpiry"] = null;
  for (const p of order) {
    const n = left.get(p.id) ?? 0;
    if (!n) continue;
    if (p.expiresAt && p.expiresAt <= t) { lapsed += n; continue; }
    available += n;
    if (p.expiresAt && !nextExpiry) nextExpiry = { at: p.expiresAt, sessions: n };
  }
  return { left: available, used, owed, lapsed, nextExpiry, paidBy };
}

/** A client can book a training session: always unless the coach asks for credits first. */
export function canBookSession(policy: SessionPolicy, c: Pick<Credits, "left">): boolean {
  return !policy.requireCredits || c.left > 0;
}

/** "7 sessions left · 3 expire 3 Feb", "1 session owed", "No sessions left". */
export function creditsText(c: Credits): string {
  if (c.owed) return `${c.owed} session${c.owed === 1 ? "" : "s"} owed`;
  if (!c.left) return "No sessions left";
  const exp = c.nextExpiry ? ` · ${c.nextExpiry.sessions === c.left ? "they" : c.nextExpiry.sessions} expire ${new Date(c.nextExpiry.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "";
  return `${c.left} session${c.left === 1 ? "" : "s"} left${exp}`;
}

/** "3 expire 19 Jan." or "" when nothing expires. */
export function expiryText(c: Credits): string {
  if (!c.nextExpiry || c.owed) return "";
  const n = c.nextExpiry.sessions === c.left ? (c.left === 1 ? "It expires" : "They expire") : `${c.nextExpiry.sessions} expire`;
  return `${n} ${new Date(c.nextExpiry.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`;
}

/* ---------- Register ---------- */

/** Past training sessions the coach hasn't marked yet, oldest first. */
export function toMark(bookings: Booking[], now: Date): Booking[] {
  return bookings.filter((b) => b.kind === "session" && b.status === "booked" && !b.attendance && Date.parse(b.endsAt) <= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Late cancels and no-shows the coach may want to waive, newest first. */
export function chargeable(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.kind === "session" && !b.waived && ((b.status === "cancelled" && b.late) || b.attendance === "no_show"))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** "Attended", "No-show", "Late cancel", "Cancelled by coach"… */
export function outcomeLabel(b: Booking): string {
  if (b.status === "cancelled") {
    if (b.cancelledBy === "coach") return "Cancelled by you";
    return b.late ? (b.waived ? "Late cancel · waived" : "Late cancel") : "Cancelled in time";
  }
  if (b.attendance === "attended") return "Attended";
  if (b.attendance === "no_show") return b.waived ? "No-show · waived" : "No-show";
  return "Booked";
}

export interface SessionMonth {
  /** Money from packs bought this month, in pence. */
  incomePence: number;
  packs: number;
  attended: number;
  lateOrNoShow: number;
  /** Share of finished sessions that went ahead, 0-100. Null with none. */
  showRate: number | null;
}

/** The coach's month at a glance: what came in and how many sessions went ahead. */
export function sessionMonth(packs: SessionPack[], bookings: Booking[], month: string): SessionMonth {
  const inMonth = (iso: string) => iso.slice(0, 7) === month;
  const bought = packs.filter((p) => p.source === "purchase" && inMonth(p.boughtAt));
  const sessions = bookings.filter((b) => b.kind === "session" && inMonth(b.startsAt));
  const attended = sessions.filter((b) => b.status === "booked" && b.attendance === "attended").length;
  const lateOrNoShow = sessions.filter((b) => (b.status === "cancelled" && b.late) || b.attendance === "no_show").length;
  const done = attended + lateOrNoShow;
  return { incomePence: bought.reduce((s, p) => s + p.pricePence, 0), packs: bought.length, attended, lateOrNoShow, showRate: done ? Math.round((attended / done) * 100) : null };
}

/* ---------- Repeat weekly ---------- */

export const REPEAT_CHOICES = [1, 4, 8, 12];

/** The same time each week for `weeks` weeks, skipping any that are taken. */
export function weeklyStarts(firstStart: string, weeks: number, taken: { startsAt: string }[]): { starts: string[]; skipped: string[] } {
  const busy = new Set(taken.map((t) => Date.parse(t.startsAt)));
  const starts: string[] = [], skipped: string[] = [];
  for (let i = 0; i < Math.max(1, Math.min(12, weeks)); i++) {
    const t = Date.parse(firstStart) + i * 7 * 86400000;
    (busy.has(t) ? skipped : starts).push(new Date(t).toISOString());
  }
  return { starts, skipped };
}

/* ---------- Database rows ---------- */

export interface SessionPackRow {
  id: string;
  coach_id: string;
  client_id: string;
  sessions: number;
  price_pence: number;
  paid_via: PackPaidVia;
  source: PackSource;
  bought_at: string;
  expires_at: string | null;
  note: string | null;
}

export const toPackRow = (p: SessionPack, coachId: string): SessionPackRow => ({
  id: p.id, coach_id: coachId, client_id: p.clientId, sessions: p.sessions, price_pence: p.pricePence, paid_via: p.paidVia, source: p.source, bought_at: p.boughtAt, expires_at: p.expiresAt, note: p.note || null,
});

export const fromPackRow = (r: SessionPackRow): SessionPack => ({
  id: r.id, clientId: r.client_id, sessions: Number(r.sessions), pricePence: Number(r.price_pence), paidVia: r.paid_via, source: r.source,
  boughtAt: new Date(r.bought_at).toISOString(), expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null, note: r.note ?? "",
});

/* ---------- Demo ---------- */

/** Priya bought 10 sessions this month; James has an older pack of 5. */
export function samplePacks(now = new Date()): SessionPack[] {
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  return [
    { ...newPack("demo-priya", 10, 40000, "bank", 3, "", "purchase", ago(Math.min(5, now.getUTCDate() - 1))), id: "demo-pack-1" },
    { ...newPack("demo-james", 5, 22500, "cash", 0, "", "purchase", ago(40)), id: "demo-pack-2" },
  ];
}

/** Past training sessions for the demo register: some attended, one to mark, a no-show and a late cancel. James is down to his last session. */
export function samplePastSessions(now = new Date()): Booking[] {
  const at = (daysAgo: number, hour: number) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - daysAgo); d.setUTCHours(hour, 0, 0, 0); return d.toISOString(); };
  const make = (id: string, clientId: string, daysAgo: number, hour: number, extra: Partial<Booking> = {}): Booking => {
    const startsAt = at(daysAgo, hour);
    return { id, clientId, startsAt, endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(), kind: "session", note: "", status: "booked", createdAt: at(daysAgo + 7, 9), attendance: null, cancelledBy: null, late: false, waived: false, repeatId: null, ...extra };
  };
  return [
    make("demo-past-1", "demo-priya", 15, 7, { attendance: "attended" }),
    make("demo-past-2", "demo-priya", 8, 7, { attendance: "attended" }),
    make("demo-past-3", "demo-priya", 1, 7),
    make("demo-past-4", "demo-james", 6, 18, { attendance: "no_show" }),
    make("demo-past-5", "demo-james", 3, 18, { status: "cancelled", cancelledBy: "client", late: true }),
    make("demo-past-6", "demo-sarah", 4, 12, { attendance: "attended" }),
    make("demo-past-7", "demo-james", 20, 18, { attendance: "attended" }),
    make("demo-past-8", "demo-james", 13, 18, { attendance: "attended" }),
  ];
}
