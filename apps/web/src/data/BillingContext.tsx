import type { BillingInterval, CoachingPlan, Membership, Payment } from "@apex/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, type ReactNode } from "react";
import { callBilling, listPlans, loadCoachBilling, myMemberships, watchMemberships, type CoachBilling } from "./billing";

/* What the Membership screen (client) and the Business tab (coach) need from payments.
   Live: Supabase plus the `billing` edge function, which talks to Stripe.
   Demo: sample plans in memory, and nobody is charged. */

export interface ClientBillingData {
  plans: CoachingPlan[];
  memberships: Membership[];
  payments: Payment[];
}

export interface ClientBillingLink {
  demo: boolean;
  load(): Promise<ClientBillingData>;
  /** Live: sends the browser to Stripe Checkout. Demo: starts a pretend membership. */
  join(planId: string): Promise<void>;
  /** Live: sends the browser to Stripe's billing page. */
  manage(): Promise<void>;
  watch(onChange: () => void): () => void;
}

export interface NewPlan {
  name: string;
  description: string;
  amountPence: number;
  interval: BillingInterval;
}

export interface CoachBillingLink {
  demo: boolean;
  load(): Promise<CoachBilling>;
  createPlan(plan: NewPlan): Promise<void>;
  archivePlan(id: string): Promise<void>;
}

// ───────────── live ─────────────

export function liveClientBilling(db: SupabaseClient, clientId: string, coachId: string): ClientBillingLink {
  return {
    demo: false,
    async load() {
      const [plans, mine] = await Promise.all([listPlans(db, coachId), myMemberships(db, clientId)]);
      return { plans: plans.filter((p) => p.active), ...mine };
    },
    async join(planId) {
      const { url } = await callBilling<{ url: string }>(db, { action: "checkout", planId });
      location.assign(url);
    },
    async manage() {
      const { url } = await callBilling<{ url: string }>(db, { action: "portal" });
      location.assign(url);
    },
    watch: (onChange) => watchMemberships(db, clientId, onChange),
  };
}

export function liveCoachBilling(db: SupabaseClient, coachId: string): CoachBillingLink {
  return {
    demo: false,
    load: () => loadCoachBilling(db, coachId),
    async createPlan(plan) { await callBilling(db, { action: "create-plan", ...plan }); },
    async archivePlan(planId) { await callBilling(db, { action: "archive-plan", planId }); },
  };
}

// ───────────── demo ─────────────

const DEMO_PLANS: CoachingPlan[] = [
  { id: "demo-online", name: "Online coaching", description: "Your program, weekly check-ins and messages with your coach.", amountPence: 12000, interval: "month", active: true },
  { id: "demo-hybrid", name: "Hybrid coaching", description: "Online coaching plus two in-person sessions a month.", amountPence: 22000, interval: "month", active: true },
  { id: "demo-pt", name: "Personal training", description: "One in-person session a week with full online support.", amountPence: 7500, interval: "week", active: true },
];

const ago = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

const demo = {
  plans: [...DEMO_PLANS],
  // The demo client starts without a membership so the join flow can be tried.
  client: [] as Membership[],
  clientPayments: [] as Payment[],
  // The demo coach's other clients, keyed to the sample client ids.
  coach: [
    { id: "sub_demo_1", clientId: "1", planId: "demo-online", status: "active", amountPence: 12000, interval: "month", currentPeriodEnd: ahead(12), cancelAtPeriodEnd: false },
    { id: "sub_demo_2", clientId: "2", planId: "demo-hybrid", status: "active", amountPence: 22000, interval: "month", currentPeriodEnd: ahead(4), cancelAtPeriodEnd: false },
    { id: "sub_demo_3", clientId: "3", planId: "demo-online", status: "past_due", amountPence: 12000, interval: "month", currentPeriodEnd: ago(2), cancelAtPeriodEnd: false },
    { id: "sub_demo_4", clientId: "4", planId: "demo-pt", status: "active", amountPence: 7500, interval: "week", currentPeriodEnd: ahead(3), cancelAtPeriodEnd: false },
    { id: "sub_demo_6", clientId: "6", planId: "demo-hybrid", status: "active", amountPence: 22000, interval: "month", currentPeriodEnd: ahead(20), cancelAtPeriodEnd: true },
  ] as Membership[],
  listeners: new Set<() => void>(),
};

function demoPayments(): Payment[] {
  const out: Payment[] = [];
  const amounts = [41000, 48500, 54000, 59500, 62000, 66500];
  amounts.forEach((pence, i) => out.push({ id: `in_demo_${i}`, clientId: "1", amountPence: pence, status: "paid", paidAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (5 - i), 3)).toISOString() }));
  out.push({ id: "in_demo_fail", clientId: "3", amountPence: 12000, status: "failed", paidAt: ago(2) });
  return out;
}

export const demoClientBilling: ClientBillingLink = {
  demo: true,
  async load() {
    return { plans: demo.plans.filter((p) => p.active), memberships: demo.client, payments: demo.clientPayments };
  },
  async join(planId) {
    const plan = demo.plans.find((p) => p.id === planId);
    if (!plan) return;
    demo.client = [{ id: "sub_demo_me", clientId: "me", planId, status: "active", amountPence: plan.amountPence, interval: plan.interval, currentPeriodEnd: ahead(plan.interval === "week" ? 7 : 30), cancelAtPeriodEnd: false }];
    demo.clientPayments = [{ id: "in_demo_me", clientId: "me", amountPence: plan.amountPence, status: "paid", paidAt: new Date().toISOString() }];
    demo.listeners.forEach((l) => l());
  },
  async manage() {
    // Stripe's own page does this live; in the demo, "manage" ends the pretend membership so joining can be tried again.
    demo.client = demo.client.map((m) => ({ ...m, status: "canceled" }));
    demo.listeners.forEach((l) => l());
  },
  watch(onChange) {
    demo.listeners.add(onChange);
    return () => demo.listeners.delete(onChange);
  },
};

export const demoCoachBilling: CoachBillingLink = {
  demo: true,
  async load() {
    return { plans: demo.plans, memberships: demo.coach, payments: demoPayments() };
  },
  async createPlan(plan) {
    demo.plans = [...demo.plans, { id: `demo-${Date.now()}`, name: plan.name, description: plan.description || null, amountPence: plan.amountPence, interval: plan.interval, active: true }];
  },
  async archivePlan(id) {
    demo.plans = demo.plans.map((p) => (p.id === id ? { ...p, active: false } : p));
  },
};

// ───────────── context ─────────────

const ClientCtx = createContext<ClientBillingLink>(demoClientBilling);
export const ClientBillingProvider = ({ link, children }: { link: ClientBillingLink; children: ReactNode }) => <ClientCtx.Provider value={link}>{children}</ClientCtx.Provider>;
export const useClientBilling = () => useContext(ClientCtx);
