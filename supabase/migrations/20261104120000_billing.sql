-- Stripe payments: a coach's plans, each client's membership, and every invoice.
-- Stripe is the source of truth. The browser only reads these tables; the `billing` edge function
-- creates plans and checkout links, and the `stripe-webhook` function writes what Stripe reports,
-- both with the service role. So there are select policies only, and no insert/update/delete ones.

-- ───────────── plans a coach sells ─────────────

create table public.coaching_plans (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null references public.profiles (id) on delete cascade,
  name               text not null check (length(name) between 1 and 80),
  description        text check (length(description) <= 500),
  amount_pence       int not null check (amount_pence between 100 and 1000000),
  currency           text not null default 'gbp' check (currency = 'gbp'),
  billing_interval   text not null default 'month' check (billing_interval in ('week', 'month')),
  stripe_product_id  text,
  stripe_price_id    text unique,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index coaching_plans_coach_idx on public.coaching_plans (coach_id, active);

-- ───────────── who pays for what ─────────────

-- One Stripe customer per client. Server-only: RLS on, no policies.
create table public.billing_customers (
  client_id           uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id  text not null unique,
  created_at          timestamptz not null default now()
);

create table public.client_subscriptions (
  stripe_subscription_id  text primary key,
  client_id               uuid not null references public.profiles (id) on delete cascade,
  coach_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                 uuid references public.coaching_plans (id) on delete set null,
  stripe_customer_id      text not null,
  -- Stripe's own words: trialing, active, past_due, unpaid, canceled, incomplete, incomplete_expired, paused
  status                  text not null,
  amount_pence            int,
  billing_interval        text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  -- When Stripe sent the event this row came from, so an older event arriving late can't undo a newer one.
  stripe_event_at         timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
create index client_subscriptions_client_idx on public.client_subscriptions (client_id);
create index client_subscriptions_coach_idx on public.client_subscriptions (coach_id, status);

create table public.payments (
  stripe_invoice_id  text primary key,
  client_id          uuid not null references public.profiles (id) on delete cascade,
  coach_id           uuid not null references public.profiles (id) on delete cascade,
  amount_pence       int not null,
  currency           text not null default 'gbp',
  status             text not null check (status in ('paid', 'failed')),
  paid_at            timestamptz not null default now()
);
create index payments_coach_idx on public.payments (coach_id, paid_at desc);
create index payments_client_idx on public.payments (client_id, paid_at desc);

-- Stripe event ids already handled, so a retried webhook does nothing twice. Server-only.
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

-- ───────────── row level security ─────────────

alter table public.coaching_plans       enable row level security;
alter table public.billing_customers    enable row level security;
alter table public.client_subscriptions enable row level security;
alter table public.payments             enable row level security;
alter table public.stripe_events        enable row level security;

create policy "coach reads own plans" on public.coaching_plans for select using (coach_id = auth.uid());
create policy "client reads own coach's live plans" on public.coaching_plans for select
  using (active and exists (select 1 from public.coach_clients cc
                            where cc.client_id = auth.uid() and cc.coach_id = coaching_plans.coach_id and cc.status <> 'ended'));

create policy "read own memberships" on public.client_subscriptions for select
  using (client_id = auth.uid() or coach_id = auth.uid());

create policy "read own payments" on public.payments for select
  using (client_id = auth.uid() or coach_id = auth.uid());

-- The client app updates as soon as Stripe confirms a payment.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.client_subscriptions;
  end if;
end $$;
