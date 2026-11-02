# Payments (Stripe)

Clients pay for coaching by card, monthly or weekly. The coach makes plans in **Business → Coaching plans**; the client joins from **More → Membership**, pays on Stripe's own checkout page, and manages their card, receipts and cancelling on Stripe's billing page. Every number on the Business tab comes from Stripe.

How it fits together:

- `supabase/functions/billing`: makes plans in Stripe, opens checkout and the billing page. Holds the secret key, so the browser never sees it.
- `supabase/functions/stripe-webhook`: Stripe tells APEX when a membership starts, renews, fails or ends. Checks Stripe's signature on every call and ignores repeats.
- `supabase/migrations/20261102120000_billing.sql`: `coaching_plans`, `client_subscriptions`, `payments`, plus server-only `billing_customers` and `stripe_events`. Browsers can only read their own rows; only the two functions write.
- `packages/core/src/billing.ts`: prices, monthly recurring revenue, revenue per month, status wording.

All money goes into one Stripe account (Kamal's). Only coach emails listed in `BILLING_COACH_EMAILS` can make plans or be paid. Before other coaches take payments, each needs their own account through Stripe Connect.

## Set up in test mode (no real money)

1. **Stripe account.** Sign up free at stripe.com. Keep the **Test mode** switch on (top right) for every step below.
2. **Secret key.** Developers → API keys → reveal the **Secret key** (`sk_test_…`). Keep it private.
3. **Database.** Supabase → SQL Editor → paste `supabase/migrations/20261102120000_billing.sql` → Run.
4. **Deploy the two functions** from the repo folder (once, `npx supabase login` first):
   ```
   npx supabase functions deploy billing --project-ref ptxtshirthnzovfbdyav
   npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref ptxtshirthnzovfbdyav
   ```
5. **Webhook.** Stripe → Developers → Webhooks → Add endpoint.
   - URL: `https://ptxtshirthnzovfbdyav.supabase.co/functions/v1/stripe-webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Save, then copy the **Signing secret** (`whsec_…`).
6. **Secrets.** Supabase → Edge Functions → Secrets, add:
   - `STRIPE_SECRET_KEY` = the `sk_test_…` key
   - `STRIPE_WEBHOOK_SECRET` = the `whsec_…` secret
   - `BILLING_COACH_EMAILS` = the coach's sign-in email (comma-separate if more than one)
   - `SITE_URL` = `https://apex-coaching-os-web.vercel.app`
7. **Billing page.** Stripe → Settings → Billing → Customer portal → turn on: update payment method, cancel subscriptions (at end of period), invoice history. Save.

## Try it

1. Coach app → Business → **New plan**, e.g. "Online coaching", £120, Monthly.
2. Client app (a test client linked to that coach) → More → Membership → **Join**.
3. On Stripe's page use card `4242 4242 4242 4242`, any future date, any 3-digit CVC, any postcode.
4. You land back on Membership showing "Renews …". The coach's Business tab shows the client, £120 monthly recurring and the payment.
5. **Manage payments** opens Stripe's billing page. Cancel there and the status changes to "Ends …".
6. A card that's declined: `4000 0000 0000 0002`.

## Going live later

Finish Stripe's account checks (business details, bank account), switch Test mode off, and repeat steps 2, 5, 6 and 7 with the live key (`sk_live_…`) and a live webhook. Test plans don't carry over; make the real plans again.
