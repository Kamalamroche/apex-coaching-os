# On-demand programmes

Coaches turn a saved template into a programme many clients can start on their own, free or for a one-off price.

- **Coach:** Business → Programmes. New programme → pick a template → cover, title, one-liner, price (empty = free), level, goal, about, what's included → Publish. Requests for paid programmes show under "Waiting for you": **Paid £X** (money received by bank transfer or cash), **Give free**, or **Decline**. A programme people have joined can be unpublished but not deleted.
- **Client:** More → Programmes. Free ones: Start programme. Paid ones: Get it → asks the coach in chat → once unlocked, Start programme. Starting gives the client their own copy as their current plan; the old plan stays in their history.
- **Public page:** live programmes with "Show on my public page" ticked appear on the coach's Train with me page. Tapping one opens the request form with the programme named.

## Database

`supabase/migrations/20261115093000_programmes.sql`: `programme_listings`, `programme_enrolments`, and the functions `request_programme`, `start_programme` (copies the programme into a new program for the client, server side) and `public_programmes`. Needs the bookings, growth and program-builder SQL first (all already run).

## Card payments later

When Stripe (PR #48) is live, the checkout for a programme should create a Checkout Session with `metadata.listing_id` and `metadata.client_id`, and the webhook should upsert `programme_enrolments` with `status = 'active'`, `paid_pence`, `paid_via = 'stripe'`, `stripe_session`. Nothing else changes: the client's Start programme button works the same.
