-- Service menu and booking link.
-- 1. The coach lists services (a free consultation, a 60-min PT session…) with a length and a price.
-- 2. Clients pick a service when they book; the booking remembers it (bookings.service_id).
-- 3. Services open to everyone show on the coach's public page. Someone who isn't a client yet books a time
--    there without an account (public.book_as_guest). It holds the slot until the coach confirms or declines,
--    and the person also lands in Leads.
-- Payment is in person or by bank transfer for now. Mirrors packages/core/src/services.ts.
-- Needs 20261103180000_bookings.sql. The public booking page also needs the public page (20261110090000_growth.sql);
-- without it the coach's menu and client booking still work. Leads (20261118090000_leads.sql) is used when present.
-- Safe to run more than once.

create table if not exists public.coach_services (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 2 and 60),
  minutes      smallint not null check (minutes in (15, 20, 30, 45, 60, 75, 90, 120)),
  price_pence  integer not null default 0 check (price_pence between 0 and 1000000),
  kind         text not null default 'session' check (kind in ('call', 'session')),
  description  text not null default '' check (length(description) <= 300),
  audience     text not null default 'everyone' check (audience in ('clients', 'everyone')),
  active       boolean not null default true,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists coach_services_coach_idx on public.coach_services (coach_id, position);

alter table public.coach_services enable row level security;
drop policy if exists "coach manages own services" on public.coach_services;
create policy "coach manages own services" on public.coach_services for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "client reads coach services" on public.coach_services;
create policy "client reads coach services" on public.coach_services for select
  using (active and public.is_my_coach(coach_id));

-- Which service a client's booking was for. Empty for bookings made before services.
alter table public.bookings add column if not exists service_id uuid references public.coach_services (id) on delete set null;

create table if not exists public.guest_bookings (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  service_id    uuid references public.coach_services (id) on delete set null,
  service_name  text not null check (length(service_name) between 2 and 60),
  price_pence   integer not null default 0 check (price_pence >= 0),
  kind          text not null default 'session' check (kind in ('call', 'session')),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  name          text not null check (length(btrim(name)) between 2 and 60),
  email         text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200),
  phone         text not null default '' check (phone = '' or phone ~ '^\+?[0-9][0-9 ()-]{5,22}$'),
  note          text not null default '' check (length(note) <= 400),
  status        text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  -- The person's row in Leads, when Leads is set up (linked below).
  lead_id       uuid,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '4 hours')
);
do $$
begin
  if to_regclass('public.join_requests') is not null
     and not exists (select 1 from pg_constraint where conname = 'guest_bookings_lead_id_fkey') then
    alter table public.guest_bookings add constraint guest_bookings_lead_id_fkey foreign key (lead_id) references public.join_requests (id) on delete set null;
  end if;
end $$;
create unique index if not exists guest_bookings_one_per_slot on public.guest_bookings (coach_id, starts_at) where status in ('requested', 'confirmed');
create index if not exists guest_bookings_coach_idx on public.guest_bookings (coach_id, starts_at);

alter table public.guest_bookings enable row level security;
-- No insert policy: guests book through book_as_guest(), which checks the time and limits bookings.
drop policy if exists "coach reads own guest bookings" on public.guest_bookings;
create policy "coach reads own guest bookings" on public.guest_bookings for select using (coach_id = auth.uid());
drop policy if exists "coach answers own guest bookings" on public.guest_bookings;
create policy "coach answers own guest bookings" on public.guest_bookings for update
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach removes own guest bookings" on public.guest_bookings;
create policy "coach removes own guest bookings" on public.guest_bookings for delete using (coach_id = auth.uid());

-- Anyone: the services on a published page, in the coach's order.
-- (plpgsql, so these can be created before the public page update; they need coach_pages only when called.)
create or replace function public.public_services(p_slug text)
returns table (id uuid, name text, minutes smallint, price_pence integer, kind text, description text, "position" smallint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
  select s.id, s.name, s.minutes, s.price_pence, s.kind, s.description, s.position
  from public.coach_services s
  join public.coach_pages cp on cp.coach_id = s.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published and s.active and s.audience = 'everyone'
  order by s.position, s.name;
end;
$$;

-- Anyone: the coach's bookable hours and which times are taken, never who took them. Two weeks ahead at most.
create or replace function public.public_booking_hours(p_slug text)
returns table (slot_min smallint, notice_hours smallint, timezone text, windows jsonb)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
  select bs.slot_min, bs.notice_hours, bs.timezone, bs.windows
  from public.coach_booking_settings bs
  join public.coach_pages cp on cp.coach_id = bs.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published;
end;
$$;

create or replace function public.public_busy(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
  with c as (select cp.coach_id from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published)
  select b.starts_at, b.ends_at from public.bookings b, c
  where b.coach_id = c.coach_id and b.status = 'booked' and b.ends_at > p_from and b.starts_at < least(p_to, now() + interval '15 days')
  union all
  select g.starts_at, g.ends_at from public.guest_bookings g, c
  where g.coach_id = c.coach_id and g.status in ('requested', 'confirmed') and g.ends_at > p_from and g.starts_at < least(p_to, now() + interval '15 days')
  order by 1;
end;
$$;

-- Clients see guest bookings as taken too. Same signature as before, so it is replaced in place.
create or replace function public.booking_busy(p_coach uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select x.starts_at, x.ends_at from (
    select b.starts_at, b.ends_at from public.bookings b
    where b.coach_id = p_coach and b.status = 'booked' and b.ends_at > p_from and b.starts_at < p_to
    union all
    select g.starts_at, g.ends_at from public.guest_bookings g
    where g.coach_id = p_coach and g.status in ('requested', 'confirmed') and g.ends_at > p_from and g.starts_at < p_to
  ) x
  where auth.uid() = p_coach or public.is_my_coach(p_coach)
  order by x.starts_at;
$$;

-- Anyone: book a service at a free time. Checks the time sits inside the coach's hours, after the notice period,
-- within two weeks, and clashes with nothing. Also adds the person to Leads (or notes the booking on their lead).
create or replace function public.book_as_guest(p_slug text, p_service uuid, p_starts timestamptz, p_name text, p_email text,
  p_phone text default '', p_note text default '', p_source text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_s public.coach_services;
  v_set public.coach_booking_settings;
  v_tz text;
  v_local timestamp;
  v_min int;
  v_ends timestamptz;
  v_email text := lower(trim(p_email));
  v_lead uuid;
  v_id uuid;
  v_source text := lower(trim(coalesce(p_source, '')));
begin
  select cp.coach_id into v_coach from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published;
  if v_coach is null then
    raise exception 'This coach page is not open right now.' using errcode = 'P0002';
  end if;
  select * into v_s from public.coach_services s where s.id = p_service and s.coach_id = v_coach and s.active and s.audience = 'everyone';
  if v_s.id is null then
    raise exception 'That service isn''t available to book.' using errcode = 'P0002';
  end if;
  select * into v_set from public.coach_booking_settings bs where bs.coach_id = v_coach;
  if v_set.coach_id is null then
    raise exception 'This coach hasn''t opened any times yet.' using errcode = 'P0002';
  end if;
  v_ends := p_starts + make_interval(mins => v_s.minutes);
  if p_starts < now() + make_interval(hours => v_set.notice_hours) or p_starts > now() + interval '15 days' then
    raise exception 'That time can''t be booked any more. Pick another one.' using errcode = '22023';
  end if;
  begin
    v_tz := v_set.timezone;
    v_local := p_starts at time zone v_tz;
  exception when others then
    v_tz := 'Europe/London';
    v_local := p_starts at time zone v_tz;
  end;
  v_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  if extract(second from v_local) <> 0 or not exists (
    select 1 from jsonb_array_elements(v_set.windows) w
    where (w->>'weekday')::int = extract(isodow from v_local)::int - 1
      and (w->>'start_min')::int <= v_min and v_min + v_s.minutes <= (w->>'end_min')::int
      and (v_min - (w->>'start_min')::int) % v_set.slot_min = 0
  ) then
    raise exception 'That time is outside the coach''s hours.' using errcode = '22023';
  end if;
  if exists (select 1 from public.bookings b where b.coach_id = v_coach and b.status = 'booked' and b.starts_at < v_ends and p_starts < b.ends_at)
     or exists (select 1 from public.guest_bookings g where g.coach_id = v_coach and g.status in ('requested', 'confirmed') and g.starts_at < v_ends and p_starts < g.ends_at) then
    raise exception 'That slot was just taken. Pick another one.' using errcode = '23505';
  end if;
  if (select count(*) from public.guest_bookings g where g.coach_id = v_coach and g.email = v_email and g.status in ('requested', 'confirmed') and g.ends_at > now()) >= 2 then
    raise exception 'You already have bookings waiting. Your coach will be in touch.' using errcode = '23505';
  end if;
  if (select count(*) from public.guest_bookings g where g.coach_id = v_coach and g.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Lots of people are booking right now. Try again in an hour.' using errcode = '54000';
  end if;
  if v_source !~ '^[a-z0-9-]{2,24}$' then v_source := 'booking'; end if;

  -- The person in Leads (when Leads is set up): an open lead with this email, or a new one.
  if to_regclass('public.join_requests') is not null then
    select r.id into v_lead from public.join_requests r
    where r.coach_id = v_coach and r.email = v_email and r.stage in ('new', 'contacted', 'trial')
    order by r.created_at desc limit 1;
    if v_lead is null then
      insert into public.join_requests (coach_id, name, email, message, phone, source)
      values (v_coach, trim(p_name), v_email, left('Booked: ' || v_s.name || '. ' || coalesce(trim(p_note), ''), 400), coalesce(trim(p_phone), ''), v_source)
      returning id into v_lead;
    end if;
  end if;

  insert into public.guest_bookings (coach_id, service_id, service_name, price_pence, kind, starts_at, ends_at, name, email, phone, note, lead_id)
  values (v_coach, v_s.id, v_s.name, v_s.price_pence, v_s.kind, p_starts, v_ends, trim(p_name), v_email, coalesce(trim(p_phone), ''), coalesce(trim(p_note), ''), v_lead)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.book_as_guest(text, uuid, timestamptz, text, text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_services(text) to anon, authenticated';
    execute 'grant execute on function public.public_booking_hours(text) to anon, authenticated';
    execute 'grant execute on function public.public_busy(text, timestamptz, timestamptz) to anon, authenticated';
    execute 'grant execute on function public.book_as_guest(text, uuid, timestamptz, text, text, text, text, text) to anon, authenticated';
    execute 'revoke execute on function public.booking_busy(uuid, timestamptz, timestamptz) from anon';
    execute 'grant execute on function public.booking_busy(uuid, timestamptz, timestamptz) to authenticated';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'guest_bookings') then
    alter publication supabase_realtime add table public.guest_bookings;
  end if;
end $$;
