import type { BillingInterval, CoachingPlan, Membership, MembershipStatus, Payment } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Reading plans, memberships and payments from Supabase, and asking the `billing` edge function
   (supabase/functions/billing) for anything that has to touch Stripe. */

type Row = Record<string, unknown>;

const toPlan = (r: Row): CoachingPlan => ({
  id: r.id as string,
  name: r.name as string,
  description: (r.description as string | null) ?? null,
  amountPence: r.amount_pence as number,
  interval: (r.billing_interval as BillingInterval) ?? "month",
  active: !!r.active,
});

const toMembership = (r: Row): Membership => ({
  id: r.stripe_subscription_id as string,
  clientId: r.client_id as string,
  planId: (r.plan_id as string | null) ?? null,
  status: r.status as MembershipStatus,
  amountPence: (r.amount_pence as number | null) ?? null,
  interval: (r.billing_interval as BillingInterval | null) ?? null,
  currentPeriodEnd: (r.current_period_end as string | null) ?? null,
  cancelAtPeriodEnd: !!r.cancel_at_period_end,
});

const toPayment = (r: Row): Payment => ({
  id: r.stripe_invoice_id as string,
  clientId: r.client_id as string,
  amountPence: r.amount_pence as number,
  status: r.status as "paid" | "failed",
  paidAt: r.paid_at as string,
});

export async function callBilling<T>(db: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("billing", { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { error?: string } | null)?.error ?? error.message);
  }
  return data as T;
}

/** Plans the signed-in user can see: a coach gets all their own, a client gets their coach's live ones. */
export async function listPlans(db: SupabaseClient, coachId: string): Promise<CoachingPlan[]> {
  const { data, error } = await db.from("coaching_plans").select("*").eq("coach_id", coachId).order("amount_pence");
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export interface CoachBilling {
  plans: CoachingPlan[];
  memberships: Membership[];
  payments: Payment[];
}

export async function loadCoachBilling(db: SupabaseClient, coachId: string): Promise<CoachBilling> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 6, 1);
  const [plans, subs, pays] = await Promise.all([
    listPlans(db, coachId),
    db.from("client_subscriptions").select("*").eq("coach_id", coachId).order("created_at", { ascending: false }),
    db.from("payments").select("*").eq("coach_id", coachId).gte("paid_at", since.toISOString()).order("paid_at", { ascending: false }),
  ]);
  if (subs.error) throw subs.error;
  if (pays.error) throw pays.error;
  return { plans, memberships: (subs.data ?? []).map(toMembership), payments: (pays.data ?? []).map(toPayment) };
}

export async function myMemberships(db: SupabaseClient, clientId: string): Promise<{ memberships: Membership[]; payments: Payment[] }> {
  const [subs, pays] = await Promise.all([
    db.from("client_subscriptions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    db.from("payments").select("*").eq("client_id", clientId).order("paid_at", { ascending: false }).limit(12),
  ]);
  if (subs.error) throw subs.error;
  if (pays.error) throw pays.error;
  return { memberships: (subs.data ?? []).map(toMembership), payments: (pays.data ?? []).map(toPayment) };
}

/** Calls `onChange` whenever Stripe reports a change to this client's membership. Returns a stop function. */
export function watchMemberships(db: SupabaseClient, clientId: string, onChange: () => void): () => void {
  const channel = db
    .channel(`apex-billing-${clientId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "client_subscriptions", filter: `client_id=eq.${clientId}` }, onChange)
    .subscribe();
  return () => void db.removeChannel(channel);
}

/** "?billing=success" etc. after coming back from Stripe; tidies the address bar. */
export function takeBillingReturn(): "success" | "cancel" | "back" | null {
  const q = new URLSearchParams(location.search);
  const v = q.get("billing");
  if (v !== "success" && v !== "cancel" && v !== "back") return null;
  q.delete("billing");
  history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}${location.hash}`);
  return v;
}
