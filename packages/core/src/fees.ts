/* Monthly fees paid outside the app (bank transfer, cash, card machine). The coach ticks each client off once they've
   paid for the month, and sees who still owes. Card payments through Stripe will tick themselves later.
   Live: supabase/migrations/20261202090000_money_owed.sql (fee_payments). Pure, so it is unit tested. */

export type FeePaidVia = "bank" | "cash" | "card";
export const FEE_PAID_LABEL: Record<FeePaidVia, string> = { bank: "Bank transfer", cash: "Cash", card: "Card" };

export interface FeePayment {
  id: string;
  clientId: string;
  /** "2026-11" */
  month: string;
  amountPence: number;
  paidVia: FeePaidVia;
  paidAt: string;
  note: string;
}

/** "2026-11" for this date, in local time (a fee for November is November wherever the coach is). */
export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** "November". */
export const monthName = (key: string): string => new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long" });

export function newFeePayment(clientId: string, month: string, amountPence: number, paidVia: FeePaidVia, now = new Date(), note = ""): FeePayment {
  return { id: crypto.randomUUID(), clientId, month, amountPence: Math.max(0, Math.round(amountPence)), paidVia, paidAt: now.toISOString(), note: note.trim().slice(0, 200) };
}

export interface FeeClient { id: string; name: string; feePence: number; status: string }

export interface FeeMonth {
  month: string;
  /** Clients with a fee who are being coached (active, not paused or ended). */
  due: FeeClient[];
  paid: { client: FeeClient; payment: FeePayment }[];
  /** Due and not ticked off yet. */
  toCollect: FeeClient[];
  paidPence: number;
  toCollectPence: number;
}

/** Who has paid this month's fee and who still owes it. Paused clients don't owe a fee. */
export function feeMonth(clients: FeeClient[], payments: FeePayment[], month: string): FeeMonth {
  const due = clients.filter((c) => c.status === "active" && c.feePence > 0);
  const byClient = new Map(payments.filter((p) => p.month === month).map((p) => [p.clientId, p]));
  const paid = due.flatMap((c) => { const p = byClient.get(c.id); return p ? [{ client: c, payment: p }] : []; });
  const toCollect = due.filter((c) => !byClient.has(c.id));
  return {
    month, due, paid, toCollect,
    paidPence: paid.reduce((t, x) => t + x.payment.amountPence, 0),
    toCollectPence: toCollect.reduce((t, c) => t + c.feePence, 0),
  };
}

/** A friendly reminder the coach can edit before sending. */
export function feeReminder(firstName: string, coachFirst: string, month: string, amountText: string): string {
  return `Hi ${firstName}, quick reminder that your ${monthName(month)} coaching fee of ${amountText} is due. Let me know once it's sent. Thanks! ${coachFirst}`;
}

/* ---------- Database rows ---------- */

export interface FeePaymentRow {
  id: string;
  coach_id: string;
  client_id: string;
  /** "2026-11-01" */
  month: string;
  amount_pence: number;
  paid_via: FeePaidVia;
  paid_at: string;
  note: string | null;
}

export const toFeeRow = (p: FeePayment, coachId: string): FeePaymentRow => ({
  id: p.id, coach_id: coachId, client_id: p.clientId, month: `${p.month}-01`, amount_pence: p.amountPence, paid_via: p.paidVia, paid_at: p.paidAt, note: p.note || null,
});

export const fromFeeRow = (r: FeePaymentRow): FeePayment => ({
  id: r.id, clientId: r.client_id, month: r.month.slice(0, 7), amountPence: Number(r.amount_pence), paidVia: r.paid_via, paidAt: new Date(r.paid_at).toISOString(), note: r.note ?? "",
});
