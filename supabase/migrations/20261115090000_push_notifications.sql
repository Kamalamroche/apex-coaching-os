-- Push notifications: each phone or browser that says yes to notifications gets a row here, and the
-- push edge function sends new unread messages to them about a minute after they arrive.
-- Safe to run more than once.

-- One row per device that turned notifications on. Its owner manages it through the two functions below.
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh      text not null check (length(p256dh) between 40 and 200),
  auth        text not null check (length(auth) between 10 and 100),
  device      text check (length(device) <= 80),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "people see own devices" on public.push_subscriptions;
create policy "people see own devices" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "people remove own devices" on public.push_subscriptions;
create policy "people remove own devices" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Save this device for the signed-in person. A device that belonged to someone else (a shared phone,
-- or signing out and in as another account) moves to the new person.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_device, 80));
end $$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- The signing keys (made by the function on first use) and the secret the cron job sends.
-- No policies: only the database and the edge function (service role) can read it.
create table if not exists public.push_config (
  id           int primary key default 1 check (id = 1),
  public_key   text,
  private_key  text,
  cron_secret  text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
alter table public.push_config enable row level security;
insert into public.push_config (id) values (1) on conflict (id) do nothing;

-- One row per message already pushed, so nobody hears about the same message twice.
create table if not exists public.push_sends (
  message_id  uuid primary key references public.messages (id) on delete cascade,
  sent_at     timestamptz not null default now()
);
alter table public.push_sends enable row level security;

create or replace function public.push_config_get()
returns public.push_config language sql stable security definer set search_path = '' as $$
  select * from public.push_config where id = 1;
$$;

create or replace function public.push_config_set_keys(p_public text, p_private text)
returns public.push_config language plpgsql security definer set search_path = '' as $$
declare r public.push_config;
begin
  -- Only fills empty keys, so two first calls at once can't swap the keys under live subscriptions.
  update public.push_config set public_key = p_public, private_key = p_private where id = 1 and public_key is null;
  select * into r from public.push_config where id = 1;
  return r;
end $$;

create or replace function public.push_user_role(p_user uuid)
returns table (role text) language sql stable security definer set search_path = '' as $$
  select p.role::text from public.profiles p where p.id = p_user;
$$;

create or replace function public.push_subscriptions_of(p_user uuid)
returns table (id uuid, endpoint text, p256dh text, auth text) language sql stable security definer set search_path = '' as $$
  select s.id, s.endpoint, s.p256dh, s.auth from public.push_subscriptions s where s.user_id = p_user;
$$;

create or replace function public.push_subscription_gone(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where id = p_id;
$$;

-- Who to notify now: unread messages from the last hour not pushed yet, one row per reader who has a device.
create or replace function public.pending_push_alerts(p_now timestamptz default now())
returns table (user_id uuid, role text, senders text[], unread int, latest text, message_ids uuid[], subscriptions jsonb)
language sql stable security definer set search_path = '' as $$
  with waiting as (
    select m.id, m.body, m.created_at, m.sender_id,
           case when m.sender_id = m.coach_id then m.client_id else m.coach_id end as reader
    from public.messages m
    where m.read_at is null
      and m.created_at > p_now - interval '1 hour'
      and not exists (select 1 from public.push_sends s where s.message_id = m.id)
  )
  select w.reader,
         p.role::text,
         array_agg(distinct split_part(sp.full_name, ' ', 1)),
         count(*)::int,
         (array_agg(w.body order by w.created_at desc))[1],
         array_agg(w.id),
         (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
            from public.push_subscriptions s where s.user_id = w.reader)
  from waiting w
  join public.profiles p on p.id = w.reader
  join public.profiles sp on sp.id = w.sender_id
  where exists (select 1 from public.push_subscriptions s where s.user_id = w.reader)
  group by w.reader, p.role
$$;

create or replace function public.mark_push_sent(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  insert into public.push_sends (message_id) select unnest(p_ids) on conflict do nothing;
$$;

-- Only the edge function may call these.
revoke all on function public.push_config_get() from public, anon, authenticated;
revoke all on function public.push_config_set_keys(text, text) from public, anon, authenticated;
revoke all on function public.push_user_role(uuid) from public, anon, authenticated;
revoke all on function public.push_subscriptions_of(uuid) from public, anon, authenticated;
revoke all on function public.push_subscription_gone(uuid) from public, anon, authenticated;
revoke all on function public.pending_push_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.mark_push_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.push_config_get() to service_role;
grant execute on function public.push_config_set_keys(text, text) to service_role;
grant execute on function public.push_user_role(uuid) to service_role;
grant execute on function public.push_subscriptions_of(uuid) to service_role;
grant execute on function public.push_subscription_gone(uuid) to service_role;
grant execute on function public.pending_push_alerts(timestamptz) to service_role;
grant execute on function public.mark_push_sent(uuid[]) to service_role;

-- Every minute on Supabase: call the push function with the secret from push_config.
-- Skipped where pg_cron or pg_net isn't available, e.g. the test database.
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    if exists (select 1 from cron.job where jobname = 'apex-push') then
      perform cron.unschedule('apex-push');
    end if;
    perform cron.schedule('apex-push', '* * * * *', $job$
      select net.http_post(
        url := 'https://ptxtshirthnzovfbdyav.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select cron_secret from public.push_config where id = 1)),
        body := '{}'::jsonb
      )
    $job$);
  end if;
end $outer$;
