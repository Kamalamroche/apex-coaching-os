// Stripe helpers shared by the `billing` and `stripe-webhook` edge functions.
// Plain Web APIs only (fetch, Web Crypto), so no Stripe SDK is needed and the same file
// runs in Deno on Supabase and in Node for the tests in stripe.test.ts.

const STRIPE_API = "https://api.stripe.com/v1";

/** Stripe's form encoding: { line_items: [{ price: "p", quantity: 1 }] } → line_items[0][price]=p&line_items[0][quantity]=1 */
export function formBody(params: Record<string, unknown>): string {
  const out: string[] = [];
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
    else if (typeof value === "object") for (const [k, v] of Object.entries(value as Record<string, unknown>)) add(`${key}[${k}]`, v);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return out.join("&");
}

/** Calls Stripe's API with the secret key. Throws Stripe's own message on an error. */
export async function stripe<T>(secretKey: string, method: "GET" | "POST", path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
  const query = method === "GET" && Object.keys(params).length ? `?${formBody(params)}` : "";
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}${query}`, { method, headers, body: method === "POST" ? formBody(params) : undefined });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${data.error?.message ?? res.status}`);
  return data;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Same-length strings compared without stopping early, so timing gives nothing away. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(payload: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
}

/**
 * Checks the Stripe-Signature header the way Stripe's own libraries do: HMAC-SHA256 of "<t>.<raw body>"
 * with the endpoint's signing secret, and a timestamp no more than five minutes old.
 */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || !signatures.length) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = await signPayload(payload, secret, t);
  return signatures.some((s) => safeEqual(s, expected));
}

// ───────────── turning Stripe objects into APEX rows ─────────────

export interface StripeSubscription {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: { current_period_end?: number; price?: { id?: string; unit_amount?: number | null; recurring?: { interval?: string } | null } }[] };
}

export interface StripeInvoice {
  id: string;
  customer: string | { id: string } | null;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  status_transitions?: { paid_at?: number | null };
  created?: number;
  // Older API versions put the subscription on the invoice; newer ones under parent.subscription_details.
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null;
}

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);
const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/** A client_subscriptions row. Needs the client_id / coach_id / plan_id metadata the checkout put on the subscription. */
export function subscriptionRow(sub: StripeSubscription, eventCreated: number) {
  const meta = sub.metadata ?? {};
  if (!meta.client_id || !meta.coach_id) return null;
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval;
  return {
    stripe_subscription_id: sub.id,
    client_id: meta.client_id,
    coach_id: meta.coach_id,
    plan_id: meta.plan_id || null,
    stripe_customer_id: idOf(sub.customer) ?? "",
    status: sub.status,
    amount_pence: item?.price?.unit_amount ?? null,
    billing_interval: interval === "week" || interval === "month" ? interval : null,
    // Moved from the subscription onto its items in Stripe's 2025 API; read either.
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_event_at: new Date(eventCreated * 1000).toISOString(),
  };
}

export function invoiceSubscriptionId(inv: StripeInvoice): string | null {
  return idOf(inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null);
}

/** A payments row, once we know whose subscription the invoice belongs to. */
export function paymentRow(inv: StripeInvoice, who: { client_id: string; coach_id: string }, status: "paid" | "failed") {
  return {
    stripe_invoice_id: inv.id,
    client_id: who.client_id,
    coach_id: who.coach_id,
    amount_pence: status === "paid" ? inv.amount_paid ?? 0 : inv.amount_due ?? 0,
    currency: inv.currency ?? "gbp",
    status,
    paid_at: iso(inv.status_transitions?.paid_at ?? inv.created) ?? new Date().toISOString(),
  };
}

/** Where to send someone back to after Stripe: the page they came from if it's ours, otherwise the live site. */
export function returnOrigin(origin: string | null, siteUrl: string): string {
  const site = siteUrl.replace(/\/+$/, "");
  if (origin && (origin === site || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) return origin;
  return site;
}

/** Comma-separated emails from a secret, lower-cased. */
export function emailList(value: string): string[] {
  return value.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
