// Coaching payments for APEX. Runs on Supabase Edge Functions (Deno).
// The browser never sees the Stripe secret key. With the signed-in user's token it sends one of
//   coach:  { action: "create-plan", name, description?, amountPence, interval }   a new plan, made in Stripe too
//           { action: "archive-plan", planId }                                     stops new sign-ups (current members keep paying)
//   client: { action: "checkout", planId }   → { url } of a Stripe Checkout page for a monthly/weekly membership
//           { action: "portal" }             → { url } of Stripe's billing page (change card, cancel, receipts)
// Payment results come back through the `stripe-webhook` function, not here.
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY      sk_test_… while testing, sk_live_… when going live
//   BILLING_COACH_EMAILS   the coach accounts allowed to take payments into this Stripe account, comma-separated
//   SITE_URL               e.g. https://apex-coaching-os-web.vercel.app (where clients come back to)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { emailList, returnOrigin, stripe } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = env("STRIPE_SECRET_KEY");
  if (!key) return json({ error: "Payments aren't switched on yet." }, 503);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Sign in again, then try once more." }, 401);

  let body: { action?: string; planId?: string; name?: string; description?: string; amountPence?: number; interval?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!profile) return json({ error: "Finish setting up your account first." }, 403);
  const allowed = emailList(env("BILLING_COACH_EMAILS"));
  const site = returnOrigin(req.headers.get("origin"), env("SITE_URL") || "https://apex-coaching-os-web.vercel.app");

  try {
    // ───────────── coach ─────────────
    if (body.action === "create-plan" || body.action === "archive-plan") {
      if (profile.role !== "coach") return json({ error: "Only coaches can change plans." }, 403);
      if (!allowed.includes((user.email ?? "").toLowerCase())) return json({ error: "Payments aren't switched on for this coach account yet." }, 403);

      if (body.action === "create-plan") {
        const name = (body.name ?? "").trim().slice(0, 80);
        const description = (body.description ?? "").trim().slice(0, 500) || null;
        const amount = Math.round(Number(body.amountPence));
        const interval = body.interval === "week" ? "week" : "month";
        if (!name) return json({ error: "Give the plan a name." }, 400);
        if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000) return json({ error: "Price must be between £1 and £10,000." }, 400);
        const product = await stripe<{ id: string }>(key, "POST", "/products", { name, description: description ?? undefined, metadata: { coach_id: user.id } });
        const price = await stripe<{ id: string }>(key, "POST", "/prices", { product: product.id, currency: "gbp", unit_amount: amount, recurring: { interval }, metadata: { coach_id: user.id } });
        const { data, error } = await admin.from("coaching_plans").insert({
          coach_id: user.id, name, description, amount_pence: amount, billing_interval: interval, stripe_product_id: product.id, stripe_price_id: price.id,
        }).select("id").single();
        if (error) throw error;
        return json({ id: data.id });
      }

      const { data: plan } = await admin.from("coaching_plans").select("id, stripe_price_id, stripe_product_id").eq("id", body.planId ?? "").eq("coach_id", user.id).maybeSingle();
      if (!plan) return json({ error: "Plan not found." }, 404);
      if (plan.stripe_price_id) await stripe(key, "POST", `/prices/${plan.stripe_price_id}`, { active: false });
      if (plan.stripe_product_id) await stripe(key, "POST", `/products/${plan.stripe_product_id}`, { active: false });
      const { error } = await admin.from("coaching_plans").update({ active: false }).eq("id", plan.id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ───────────── client ─────────────
    if (body.action === "checkout" || body.action === "portal") {
      if (profile.role !== "client") return json({ error: "Only clients pay for coaching." }, 403);
      const { data: saved } = await admin.from("billing_customers").select("stripe_customer_id").eq("client_id", user.id).maybeSingle();

      if (body.action === "portal") {
        if (!saved) return json({ error: "There's no payment on file yet." }, 404);
        const session = await stripe<{ url: string }>(key, "POST", "/billing_portal/sessions", { customer: saved.stripe_customer_id, return_url: `${site}/client/?billing=back` });
        return json({ url: session.url });
      }

      const { data: plan } = await admin.from("coaching_plans").select("id, coach_id, stripe_price_id, active").eq("id", body.planId ?? "").maybeSingle();
      if (!plan || !plan.active || !plan.stripe_price_id) return json({ error: "That plan isn't available any more." }, 404);
      const { data: link } = await admin.from("coach_clients").select("coach_id").eq("client_id", user.id).eq("coach_id", plan.coach_id).neq("status", "ended").maybeSingle();
      if (!link) return json({ error: "That plan belongs to a different coach." }, 403);
      const { data: coachUser } = await admin.auth.admin.getUserById(plan.coach_id);
      if (!allowed.includes((coachUser?.user?.email ?? "").toLowerCase())) return json({ error: "Your coach hasn't switched on payments yet." }, 403);

      // One membership at a time: someone already paying manages it on Stripe's billing page instead.
      const { data: live } = await admin.from("client_subscriptions").select("stripe_subscription_id")
        .eq("client_id", user.id).in("status", ["active", "trialing", "past_due", "unpaid", "paused"]).limit(1);
      if (live?.length) return json({ error: "You already have a membership. Use Manage payments to change it." }, 409);

      let customer = saved?.stripe_customer_id as string | undefined;
      if (!customer) {
        const c = await stripe<{ id: string }>(key, "POST", "/customers", { email: user.email, name: profile.full_name, metadata: { client_id: user.id } }, `apex-customer-${user.id}`);
        customer = c.id;
        const { error } = await admin.from("billing_customers").upsert({ client_id: user.id, stripe_customer_id: customer });
        if (error) throw error;
      }
      const meta = { client_id: user.id, coach_id: plan.coach_id, plan_id: plan.id };
      const session = await stripe<{ url: string }>(key, "POST", "/checkout/sessions", {
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        subscription_data: { metadata: meta },
        metadata: meta,
        allow_promotion_codes: true,
        success_url: `${site}/client/?billing=success`,
        cancel_url: `${site}/client/?billing=cancel`,
      });
      return json({ url: session.url });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
