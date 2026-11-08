/* Coaching payments: plans a coach sells, a client's membership, and the money coming in.
   Stripe holds the truth; these helpers turn the rows the webhook saves into what the screens show. */

export type BillingInterval = "week" | "month";

export interface CoachingPlan {
  id: string;
  name: string;
  description: string | null;
  amountPence: number;
  interval: BillingInterval;
  active: boolean;
}

/** Stripe's subscription statuses. */
export type MembershipStatus = "trialing" | "active" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";

export interface Membership {
  id: string;
  clientId: string;
  planId: string | null;
  status: MembershipStatus;
  amountPence: number | null;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Payment {
  id: string;
  clientId: string;
  amountPence: number;
  status: "paid" | "failed";
  paidAt: string;
}

/** "£150" or "£49.50". */
export function formatPounds(pence: number): string {
  const whole = pence % 100 === 0;
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "£150 a month" / "£35 a week". */
export function formatPlanPrice(pence: number, interval: BillingInterval): string {
  return `${formatPounds(pence)} a ${interval}`;
}

/** What a coach types in the price box ("150", "£49.50", "1,200") as pence. null if it isn't a sensible price. */
export function parsePounds(input: string): number | null {
  const clean = input.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const pence = Math.round(Number(clean) * 100);
  return pence >= 100 && pence <= 1_000_000 ? pence : null;
}

/** Statuses where the client still has (or is about to get) coaching and shouldn't be asked to join again. */
export function isLiveMembership(status: MembershipStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid" || status === "incomplete" || status === "paused";
}

/** Stripe's monthly equivalent: a week is 52 / 12 of a month. */
export function monthlyPence(amountPence: number, interval: BillingInterval): number {
  return interval === "week" ? Math.round((amountPence * 52) / 12) : amountPence;
}

/** Monthly recurring revenue from memberships that are paying or about to (past due still counts until Stripe gives up). */
export function monthlyRecurring(memberships: Membership[]): number {
  return memberships
    .filter((m) => (m.status === "active" || m.status === "trialing" || m.status === "past_due") && !m.cancelAtPeriodEnd)
    .reduce((sum, m) => sum + monthlyPence(m.amountPence ?? 0, m.interval ?? "month"), 0);
}

/** The newest membership worth showing a client: a live one first, otherwise the latest ended one. */
export function currentMembership(memberships: Membership[]): Membership | null {
  return memberships.find((m) => isLiveMembership(m.status)) ?? memberships[0] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Paid income per calendar month, oldest first, for the last `months` months including this one. */
export function revenueByMonth(payments: Payment[], months: number, now: Date = new Date()): { label: string; pence: number }[] {
  const out: { key: string; label: string; pence: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: MONTHS[d.getUTCMonth()] ?? "", pence: 0 });
  }
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const d = new Date(p.paidAt);
    const slot = out.find((o) => o.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (slot) slot.pence += p.amountPence;
  }
  return out.map(({ label, pence }) => ({ label, pence }));
}

export type Tone = "good" | "warn" | "crit" | "muted";

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

/** One line about a membership, in plain words, and a colour for it. */
export function membershipLabel(m: Membership | null): { text: string; tone: Tone } {
  if (!m) return { text: "Not paying yet", tone: "muted" };
  const end = m.currentPeriodEnd ? dayMonth(m.currentPeriodEnd) : null;
  switch (m.status) {
    case "active":
    case "trialing":
      if (m.cancelAtPeriodEnd) return { text: end ? `Ends ${end}` : "Ending", tone: "warn" };
      return { text: end ? `${m.status === "trialing" ? "Trial until" : "Renews"} ${end}` : "Active", tone: "good" };
    case "past_due":
    case "unpaid":
      return { text: "Payment failed", tone: "crit" };
    case "incomplete":
      return { text: "Waiting for payment", tone: "warn" };
    case "paused":
      return { text: "Paused", tone: "muted" };
    default:
      return { text: "Ended", tone: "muted" };
  }
}
