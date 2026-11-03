// Stripe → APEX. Stripe calls this whenever a membership starts, changes, renews, fails or ends.
// It must be deployed with JWT checks off (Stripe doesn't sign in): see [functions.stripe-webhook] in config.toml.
// Every call is checked against STRIPE_WEBHOOK_SECRET (whsec_…, from the webhook's page in Stripe),
// and each event id is recorded so a retry does nothing twice.
// Events to send it: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
//                    invoice.paid, invoice.payment_failed
import { createClient } from "npm:@supabase/supabase-js@2";
import { invoiceSubscriptionId, paymentRow, subscriptionRow, verifyStripeSignature, type StripeInvoice, type StripeSubscription } from "../_shared/stripe.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const reply = (status: number, text = "ok") => new Response(text, { status });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "POST only");
  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET")))) return reply(400, "Bad signature");

  const event = JSON.parse(raw) as { id: string; type: string; created: number; data: { object: unknown } };
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  const { data: seen } = await admin.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return reply(200, "already handled");

  try {
    if (event.type.startsWith("customer.subscription.")) {
      const row = subscriptionRow(event.data.object as StripeSubscription, event.created);
      if (row) {
        const { data: existing } = await admin.from("client_subscriptions").select("stripe_event_at").eq("stripe_subscription_id", row.stripe_subscription_id).maybeSingle();
        // Stripe doesn't promise order: skip an event older than the one already saved.
        if (!existing || new Date(existing.stripe_event_at as string) <= new Date(row.stripe_event_at)) {
          const { error } = await admin.from("client_subscriptions").upsert(row);
          if (error) throw error;
        }
      }
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const inv = event.data.object as StripeInvoice;
      const subId = invoiceSubscriptionId(inv);
      let who = subId ? (await admin.from("client_subscriptions").select("client_id, coach_id").eq("stripe_subscription_id", subId).maybeSingle()).data : null;
      // The first invoice can land before the subscription event; the metadata on the invoice says whose it is.
      const meta = inv.parent?.subscription_details?.metadata;
      if (!who && meta?.client_id && meta?.coach_id) who = { client_id: meta.client_id, coach_id: meta.coach_id };
      if (!who && subId) {
        // Older API versions: ask Stripe for the subscription and its metadata.
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` } });
        const sub = res.ok ? ((await res.json()) as StripeSubscription) : null;
        if (sub?.metadata?.client_id && sub.metadata.coach_id) who = { client_id: sub.metadata.client_id, coach_id: sub.metadata.coach_id };
      }
      if (!who) return reply(500, "Subscription not known yet, Stripe will retry"); // not recorded as handled
      const status = event.type === "invoice.paid" ? "paid" : "failed";
      // A failed attempt that's later paid becomes paid; a paid one is never turned back into failed.
      const { data: prior } = await admin.from("payments").select("status").eq("stripe_invoice_id", inv.id).maybeSingle();
      if (!(prior?.status === "paid" && status === "failed")) {
        const { error } = await admin.from("payments").upsert(paymentRow(inv, who as { client_id: string; coach_id: string }, status));
        if (error) throw error;
      }
    }
    await admin.from("stripe_events").insert({ id: event.id, type: event.type });
    return reply(200);
  } catch (e) {
    console.error(e);
    return reply(500, "Couldn't save, Stripe will retry");
  }
});
