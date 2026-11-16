-- Catch-up for APEX growth and marketing. Run this one file in the Supabase SQL Editor.
-- It creates the public page, leads, session packs, rewards and reviews, and marketing tables if they're missing,
-- and is safe to run again if some of it already exists. Same as running, in order:
-- team_name() from 20261109090000_team.sql, 20261110090000_growth.sql, 20261118090000_leads.sql,
-- 20261119090000_sessions.sql, 20261125090000_growth_tools.sql, 20261126090000_marketing.sql, then public_programmes().

-- ===== team_name() (first name and initial) =====
create or replace function public.team_name(p_full text)
returns text
language sql immutable set search_path = ''
as $$
  select case when position(' ' in trim(coalesce(p_full, ''))) > 0
    then split_part(trim(p_full), ' ', 1) || ' ' || upper(left(regexp_replace(trim(p_full), '^.*\s', ''), 1)) || '.'
    else coalesce(nullif(trim(p_full), ''), 'Someone') end;
$$;

-- ===== 20261110090000_growth.sql =====
-- (The leads update changes what this returns, so start it fresh; the leads part below puts the newer one back.)
drop function if exists public.coach_join_requests();
-- Growth: a coach's public page (the "Train with me" link points at it), requests to train from people who
-- aren't clients yet, and clients inviting a friend with their own code so the coach sees who sent them.
-- The public page shows only what the coach wrote. Nothing about clients ever leaves the database through it.
-- Mirrors packages/core/src/growth.ts. Needs public.is_my_coach() from 20261103180000_bookings.sql
-- and public.team_name() from 20261109090000_team.sql.

create table if not exists public.coach_pages (
  coach_id      uuid primary key references public.profiles (id) on delete cascade,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 30),
  headline      text not null default '' check (length(headline) <= 80),
  bio           text not null default '' check (length(bio) <= 600),
  city          text not null default '' check (length(city) <= 60),
  specialties   text[] not null default '{}' check (cardinality(specialties) <= 6),
  modes         text[] not null default '{online}' check (modes <@ array['online', 'hybrid', 'in_person']),
  show_clients  boolean not null default false,
  published     boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.coach_pages enable row level security;
drop policy if exists "coach manages own page" on public.coach_pages;
create policy "coach manages own page" on public.coach_pages for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "clients read their coach's page" on public.coach_pages;
create policy "clients read their coach's page" on public.coach_pages for select
  using (public.is_my_coach(coach_id));

-- A client's own friend code, one per coach. The link carries the code, never the client's id.
create table if not exists public.referral_codes (
  client_id   uuid not null references public.profiles (id) on delete cascade,
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at  timestamptz not null default now(),
  primary key (client_id, coach_id)
);

alter table public.referral_codes enable row level security;
drop policy if exists "client sees own code" on public.referral_codes;
create policy "client sees own code" on public.referral_codes for select
  using (client_id = auth.uid());

create table if not exists public.join_requests (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 60),
  email         text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200),
  goal          text not null default '' check (length(goal) <= 40),
  message       text not null default '' check (length(message) <= 400),
  ref_client    uuid references public.profiles (id) on delete set null,
  status        text not null default 'new' check (status in ('new', 'invited', 'joined', 'declined')),
  invite_token  uuid references public.invites (token) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists join_requests_coach_idx on public.join_requests (coach_id, created_at desc);
create index if not exists join_requests_ref_idx on public.join_requests (ref_client);

alter table public.join_requests enable row level security;
-- No insert policy: people send requests through request_to_train(), which checks and limits them.
drop policy if exists "coach reads own requests" on public.join_requests;
create policy "coach reads own requests" on public.join_requests for select
  using (coach_id = auth.uid());
drop policy if exists "coach answers own requests" on public.join_requests;
create policy "coach answers own requests" on public.join_requests for update
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach removes own requests" on public.join_requests;
create policy "coach removes own requests" on public.join_requests for delete
  using (coach_id = auth.uid());

-- Anyone, signed in or not: a published page by its address.
create or replace function public.public_coach_page(p_slug text)
returns table (slug text, name text, headline text, bio text, city text, specialties text[], modes text[], clients int)
language sql stable security definer set search_path = ''
as $$
  select cp.slug, pr.full_name, cp.headline, cp.bio, cp.city, cp.specialties, cp.modes,
    case when cp.show_clients then (select count(*)::int from public.coach_clients cc where cc.coach_id = cp.coach_id and cc.status = 'active') end
  from public.coach_pages cp
  join public.profiles pr on pr.id = cp.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- Anyone: ask to train with a coach. Limited so a page can't be flooded.
create or replace function public.request_to_train(p_slug text, p_name text, p_email text, p_goal text default '', p_message text default '', p_ref text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_ref uuid;
  v_email text := lower(trim(p_email));
begin
  select cp.coach_id into v_coach from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published;
  if v_coach is null then
    raise exception 'This coach page is not open right now.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.email = v_email and r.status in ('new', 'invited')) >= 1 then
    raise exception 'You have already asked. Your coach will be in touch.' using errcode = '23505';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Lots of people are asking right now. Try again in an hour.' using errcode = '54000';
  end if;
  if p_ref is not null then
    select rc.client_id into v_ref from public.referral_codes rc where rc.code = p_ref and rc.coach_id = v_coach;
  end if;
  insert into public.join_requests (coach_id, name, email, goal, message, ref_client)
  values (v_coach, trim(p_name), v_email, left(coalesce(trim(p_goal), ''), 40), coalesce(trim(p_message), ''), v_ref);
end;
$$;

-- Client: my friend code for my coach, made the first time I ask.
create or replace function public.my_referral_code(p_coach uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_my_coach(p_coach) then
    raise exception 'Only your own coach''s clients can invite friends.' using errcode = '42501';
  end if;
  select rc.code into v_code from public.referral_codes rc where rc.client_id = auth.uid() and rc.coach_id = p_coach;
  while v_code is null loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    if exists (select 1 from public.referral_codes rc where rc.code = v_code) then
      v_code := null;
    end if;
  end loop;
  insert into public.referral_codes (client_id, coach_id, code) values (auth.uid(), p_coach, v_code)
  on conflict (client_id, coach_id) do nothing;
  return (select rc.code from public.referral_codes rc where rc.client_id = auth.uid() and rc.coach_id = p_coach);
end;
$$;

-- Client: how many friends I sent asked to train, and how many joined. No names.
create or replace function public.my_referrals(p_coach uuid)
returns table (asked int, joined int)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where r.status <> 'declined')::int, count(*) filter (where r.status = 'joined')::int
  from public.join_requests r
  where r.coach_id = p_coach and r.ref_client = auth.uid();
$$;

-- Coach: requests with the inviting client's short name.
create or replace function public.coach_join_requests()
returns table (id uuid, name text, email text, goal text, message text, status text, created_at timestamptz, referred_by text, invite_token uuid)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.email, r.goal, r.message, r.status, r.created_at,
    case when r.ref_client is not null then public.team_name(p.full_name) end, r.invite_token
  from public.join_requests r
  left join public.profiles p on p.id = r.ref_client
  where r.coach_id = auth.uid()
  order by r.created_at desc
  limit 200;
$$;

-- When the invite sent for a request is accepted, the request shows as joined.
create or replace function public.join_request_joined()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.accepted_by is not null and old.accepted_by is null then
    update public.join_requests set status = 'joined' where invite_token = new.token;
  end if;
  return new;
end;
$$;
drop trigger if exists join_request_joined on public.invites;
create trigger join_request_joined after update of accepted_by on public.invites
  for each row execute function public.join_request_joined();

revoke execute on function public.my_referral_code(uuid) from public;
revoke execute on function public.my_referrals(uuid) from public;
revoke execute on function public.coach_join_requests() from public;
revoke execute on function public.join_request_joined() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_coach_page(text) to anon, authenticated';
    execute 'grant execute on function public.request_to_train(text, text, text, text, text, text) to anon, authenticated';
    execute 'grant execute on function public.my_referral_code(uuid) to authenticated';
    execute 'grant execute on function public.my_referrals(uuid) to authenticated';
    execute 'grant execute on function public.coach_join_requests() to authenticated';
  end if;
end $$;

-- ===== 20261118090000_leads.sql =====
-- Leads: the enquiry form on a coach's public page, a pipeline (new, contacted, trial, client, lost)
-- for people who aren't clients yet, and an automatic welcome email for each new enquiry.
-- Builds on join_requests from 20261110090000_growth.sql. Mirrors packages/core/src/leads.ts.
-- Safe to run more than once.

alter table public.join_requests
  add column if not exists stage        text not null default 'new',
  add column if not exists phone        text not null default '',
  add column if not exists how          text not null default '',
  add column if not exists source       text not null default 'page',
  add column if not exists notes        text not null default '',
  add column if not exists follow_up    date,
  add column if not exists welcomed_at  timestamptz,
  add column if not exists coach_told_at timestamptz,
  add column if not exists added_by_coach boolean not null default false,
  add column if not exists updated_at   timestamptz not null default now();

alter table public.join_requests drop constraint if exists join_requests_stage_check;
alter table public.join_requests add constraint join_requests_stage_check check (stage in ('new', 'contacted', 'trial', 'client', 'lost'));
alter table public.join_requests drop constraint if exists join_requests_phone_check;
alter table public.join_requests add constraint join_requests_phone_check check (phone = '' or phone ~ '^\+?[0-9][0-9 ()-]{5,22}$');
alter table public.join_requests drop constraint if exists join_requests_how_check;
alter table public.join_requests add constraint join_requests_how_check check (how in ('', 'online', 'hybrid', 'in_person'));
alter table public.join_requests drop constraint if exists join_requests_source_check;
alter table public.join_requests add constraint join_requests_source_check check (source ~ '^[a-z0-9-]{2,24}$');
alter table public.join_requests drop constraint if exists join_requests_notes_check;
alter table public.join_requests add constraint join_requests_notes_check check (length(notes) <= 1000);
-- Leads the coach adds by hand (added_by_coach) may have no email (they came by DM or at the gym).
alter table public.join_requests drop constraint if exists join_requests_email_check;
alter table public.join_requests add constraint join_requests_email_check check (email = '' or (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200));

-- First run only (before lead_settings exists): put earlier requests on the matching stage, and never email them now.
do $$
begin
  if to_regclass('public.lead_settings') is null then
    update public.join_requests
    set stage = case status when 'invited' then 'contacted' when 'joined' then 'client' when 'declined' then 'lost' else 'new' end;
    update public.join_requests set welcomed_at = created_at, coach_told_at = created_at;
  end if;
end $$;

create index if not exists join_requests_follow_up_idx on public.join_requests (coach_id, follow_up) where follow_up is not null;

-- Stage and invite status move together, so referral counts and "joined" stay right whichever one changes.
create or replace function public.join_request_stage_sync()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'joined' then new.stage := 'client';
    elsif new.status = 'declined' then new.stage := 'lost';
    elsif new.status = 'invited' and old.stage = 'new' then new.stage := 'contacted';
    elsif new.status = 'new' and old.stage = 'lost' then new.stage := 'new';
    end if;
  elsif new.stage is distinct from old.stage then
    if new.stage = 'lost' and new.status in ('new', 'invited') then new.status := 'declined';
    elsif new.stage = 'client' then new.status := 'joined';
    elsif new.stage not in ('lost', 'client') and new.status in ('declined', 'joined') then
      new.status := case when new.invite_token is not null then 'invited' else 'new' end;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists join_request_stage_sync on public.join_requests;
create trigger join_request_stage_sync before update on public.join_requests
  for each row execute function public.join_request_stage_sync();

-- Coach: add a lead by hand.
drop policy if exists "coach adds own leads" on public.join_requests;
create policy "coach adds own leads" on public.join_requests for insert
  with check (coach_id = auth.uid() and added_by_coach and ref_client is null and invite_token is null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

-- Each coach's welcome email and alert settings.
create table if not exists public.lead_settings (
  coach_id      uuid primary key references public.profiles (id) on delete cascade,
  welcome_on    boolean not null default true,
  welcome_text  text not null default '' check (length(welcome_text) <= 800),
  notify_on     boolean not null default true,
  updated_at    timestamptz not null default now()
);
alter table public.lead_settings enable row level security;
drop policy if exists "coach manages own lead settings" on public.lead_settings;
create policy "coach manages own lead settings" on public.lead_settings for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

-- Anyone: ask to train, now with an optional phone, how they'd like to train, and where the link was shared.
-- Replaces the six-argument version; calls with those six named arguments still work.
drop function if exists public.request_to_train(text, text, text, text, text, text);
create or replace function public.request_to_train(p_slug text, p_name text, p_email text, p_goal text default '', p_message text default '',
  p_ref text default null, p_phone text default '', p_how text default '', p_source text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_ref uuid;
  v_email text := lower(trim(p_email));
  v_source text := lower(trim(coalesce(p_source, '')));
begin
  select cp.coach_id into v_coach from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published;
  if v_coach is null then
    raise exception 'This coach page is not open right now.' using errcode = 'P0002';
  end if;
  if v_email = '' then
    raise exception 'Add an email your coach can reply to.' using errcode = '23514';
  end if;
  if exists (select 1 from public.join_requests r where r.coach_id = v_coach and r.email = v_email and r.stage in ('new', 'contacted', 'trial')) then
    raise exception 'You have already asked. Your coach will be in touch.' using errcode = '23505';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.created_at > now() - interval '1 hour' and not r.added_by_coach) >= 20 then
    raise exception 'Lots of people are asking right now. Try again in an hour.' using errcode = '54000';
  end if;
  if p_ref is not null then
    select rc.client_id into v_ref from public.referral_codes rc where rc.code = p_ref and rc.coach_id = v_coach;
  end if;
  if v_source !~ '^[a-z0-9-]{2,24}$' then
    v_source := case when v_ref is not null then 'referral' else 'page' end;
  end if;
  insert into public.join_requests (coach_id, name, email, goal, message, ref_client, phone, how, source)
  values (v_coach, trim(p_name), v_email, left(coalesce(trim(p_goal), ''), 40), coalesce(trim(p_message), ''), v_ref,
    coalesce(trim(p_phone), ''), case when p_how in ('online', 'hybrid', 'in_person') then p_how else '' end, v_source);
end;
$$;

-- Coach: the pipeline, with the inviting client's short name. New columns, so the old function is replaced.
drop function if exists public.coach_join_requests();
create function public.coach_join_requests()
returns table (id uuid, name text, email text, goal text, message text, status text, created_at timestamptz, referred_by text, invite_token uuid,
  stage text, phone text, how text, source text, notes text, follow_up date, welcomed_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.email, r.goal, r.message, r.status, r.created_at,
    case when r.ref_client is not null then public.team_name(p.full_name) end, r.invite_token,
    r.stage, r.phone, r.how, r.source, r.notes, r.follow_up, r.welcomed_at
  from public.join_requests r
  left join public.profiles p on p.id = r.ref_client
  where r.coach_id = auth.uid()
  order by r.created_at desc
  limit 500;
$$;

-- For the email-alerts function only: new enquiries from the last two days that still need their welcome
-- email (to the person who asked) or their alert (to the coach). One row per email to send.
create or replace function public.pending_lead_emails(p_now timestamptz default now())
returns table (request_id uuid, kind text, to_email text, reply_to text, coach_name text, lead_name text, goal text, message text,
  phone text, how text, source text, welcome_text text)
language sql stable security definer set search_path = ''
as $$
  select r.id, 'welcome', r.email, cu.email::text, cp.full_name, r.name, r.goal, r.message, r.phone, r.how, r.source, coalesce(ls.welcome_text, '')
  from public.join_requests r
  join public.profiles cp on cp.id = r.coach_id
  left join auth.users cu on cu.id = r.coach_id
  left join public.lead_settings ls on ls.coach_id = r.coach_id
  where r.welcomed_at is null and not r.added_by_coach and r.email <> ''
    and r.created_at > p_now - interval '2 days' and coalesce(ls.welcome_on, true)
  union all
  select r.id, 'coach', cu.email::text, case when r.email <> '' then r.email end, cp.full_name, r.name, r.goal, r.message, r.phone, r.how, r.source, ''
  from public.join_requests r
  join public.profiles cp on cp.id = r.coach_id
  join auth.users cu on cu.id = r.coach_id
  left join public.lead_settings ls on ls.coach_id = r.coach_id
  where r.coach_told_at is null and not r.added_by_coach and cu.email is not null
    and r.created_at > p_now - interval '2 days' and coalesce(ls.notify_on, true)
  limit 100;
$$;

create or replace function public.mark_lead_emails_sent(p_welcomed uuid[], p_told uuid[])
returns void language sql security definer set search_path = ''
as $$
  update public.join_requests set welcomed_at = now() where id = any(p_welcomed) and welcomed_at is null;
  update public.join_requests set coach_told_at = now() where id = any(p_told) and coach_told_at is null;
$$;

revoke execute on function public.join_request_stage_sync() from public;
revoke execute on function public.coach_join_requests() from public;
revoke all on function public.pending_lead_emails(timestamptz) from public;
revoke all on function public.mark_lead_emails_sent(uuid[], uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.pending_lead_emails(timestamptz) from anon, authenticated';
    execute 'revoke all on function public.mark_lead_emails_sent(uuid[], uuid[]) from anon, authenticated';
    execute 'grant execute on function public.request_to_train(text, text, text, text, text, text, text, text, text) to anon, authenticated';
    execute 'grant execute on function public.coach_join_requests() to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.pending_lead_emails(timestamptz) to service_role';
    execute 'grant execute on function public.mark_lead_emails_sent(uuid[], uuid[]) to service_role';
  end if;
end $$;

-- ===== 20261119090000_sessions.sql =====
-- 1:1 sessions: cancellation policy, session packs (credits), the register, weekly slots and booking reminders.
-- Mirrors packages/core/src/sessions.ts. Needs 20261103180000_bookings.sql first; the reminders part needs
-- 20261117090000_reminders.sql. Safe to run more than once.

-- Policy: clients cancel for free until cancel_hours before; later, a training session still uses a credit.
alter table public.coach_booking_settings add column if not exists cancel_hours smallint not null default 24;
alter table public.coach_booking_settings add column if not exists require_credits boolean not null default false;
alter table public.coach_booking_settings drop constraint if exists coach_booking_settings_cancel_hours_check;
alter table public.coach_booking_settings add constraint coach_booking_settings_cancel_hours_check check (cancel_hours between 0 and 168);

-- What happened to each booking.
alter table public.bookings add column if not exists attendance   text;
alter table public.bookings add column if not exists cancelled_by text;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists late         boolean not null default false;
alter table public.bookings add column if not exists waived       boolean not null default false;
alter table public.bookings add column if not exists repeat_id    uuid;
alter table public.bookings drop constraint if exists bookings_attendance_check;
alter table public.bookings add constraint bookings_attendance_check check (attendance in ('attended', 'no_show'));
alter table public.bookings drop constraint if exists bookings_cancelled_by_check;
alter table public.bookings add constraint bookings_cancelled_by_check check (cancelled_by in ('client', 'coach'));

-- Clients book plain bookings only: no outcome, no waiver.
drop policy if exists "client books with own coach" on public.bookings;
create policy "client books with own coach" on public.bookings for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id) and starts_at > now() and status = 'booked'
              and attendance is null and cancelled_by is null and not late and not waived);

-- A client can only cancel, and the database decides whether that was late. The coach can change anything;
-- when the coach cancels, it is recorded as theirs and never late.
create or replace function public.guard_booking_change()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r     public.bookings;
  hours smallint;
begin
  if auth.uid() is null or current_setting('apex.moving_booking', true) = 'on' then return new; end if;
  if auth.uid() = old.coach_id then
    if new.status = 'cancelled' and old.status = 'booked' then
      new.cancelled_by := 'coach'; new.cancelled_at := now(); new.late := false;
    end if;
    return new;
  end if;
  r := old;
  if new.status = 'cancelled' and old.status = 'booked' then
    select s.cancel_hours into hours from public.coach_booking_settings s where s.coach_id = old.coach_id;
    hours := coalesce(hours, 24);
    r.status := 'cancelled';
    r.cancelled_by := 'client';
    r.cancelled_at := now();
    r.late := old.kind = 'session' and hours > 0 and old.starts_at - now() < make_interval(hours => hours);
  end if;
  return r;
end;
$$;

-- Move a booking to another time instead of cancelling it. Clients can move until the cancel window closes
-- (calls any time before they start); the coach can always move. A taken slot fails with unique_violation.
create or replace function public.move_booking(p_id uuid, p_starts timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b     public.bookings;
  hours smallint;
begin
  select * into b from public.bookings where id = p_id and status = 'booked' and (client_id = auth.uid() or coach_id = auth.uid()) for update;
  if not found then raise exception 'booking not found' using errcode = '42501'; end if;
  if p_starts <= now() then raise exception 'pick a time in the future' using errcode = '22023'; end if;
  if auth.uid() <> b.coach_id then
    if not public.is_my_coach(b.coach_id) then raise exception 'not your coach' using errcode = '42501'; end if;
    select s.cancel_hours into hours from public.coach_booking_settings s where s.coach_id = b.coach_id;
    hours := coalesce(hours, 24);
    if b.starts_at <= now() or (b.kind = 'session' and hours > 0 and b.starts_at - now() < make_interval(hours => hours)) then
      raise exception 'too late to move this booking' using errcode = '42501';
    end if;
  end if;
  perform set_config('apex.moving_booking', 'on', true);
  update public.bookings set starts_at = p_starts, ends_at = p_starts + (b.ends_at - b.starts_at) where id = p_id;
  perform set_config('apex.moving_booking', 'off', true);
end;
$$;
revoke all on function public.move_booking(uuid, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.move_booking(uuid, timestamptz) from anon';
    execute 'grant execute on function public.move_booking(uuid, timestamptz) to authenticated';
  end if;
end $$;

-- Session packs: sessions a client paid for (or was given). Each booked training session uses one.
create table if not exists public.session_packs (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  sessions    smallint not null check (sessions between 1 and 100),
  price_pence integer not null default 0 check (price_pence between 0 and 10000000),
  paid_via    text not null default 'cash' check (paid_via in ('cash', 'bank', 'card', 'free')),
  source      text not null default 'purchase' check (source in ('purchase', 'referral', 'intro', 'gift')),
  bought_at   timestamptz not null default now(),
  expires_at  timestamptz,
  note        text check (length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (expires_at is null or expires_at > bought_at)
);
create index if not exists session_packs_client_idx on public.session_packs (client_id, bought_at);
create index if not exists session_packs_coach_idx on public.session_packs (coach_id, bought_at);

alter table public.session_packs enable row level security;
drop policy if exists "coach manages packs" on public.session_packs;
create policy "coach manages packs" on public.session_packs for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
drop policy if exists "client reads own packs" on public.session_packs;
create policy "client reads own packs" on public.session_packs for select
  using (client_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'session_packs') then
    alter publication supabase_realtime add table public.session_packs;
  end if;
end $$;

-- Booking reminders: the push function already calls take_checkin_alerts every minute, so they ride along there.
-- Clients get one the day before (24 h) and one 2 hours before, unless they booked inside that time.
alter table public.push_reminder_sends drop constraint if exists push_reminder_sends_kind_check;
alter table public.push_reminder_sends add constraint push_reminder_sends_kind_check check (kind in ('workout', 'habits', 'checkin', 'booking'));

create or replace function public.take_checkin_alerts(p_now timestamptz default now())
returns table (user_id uuid, kind text, title text, body text, url text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r     record;
  tag   text;
  local timestamp;
  today date;
begin
  for r in
    select ci.id, cc.coach_id, split_part(p.full_name, ' ', 1) as first_name, ci.weight_kg,
           (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = cc.coach_id) as subs
    from public.check_ins ci
    join public.coach_clients cc on cc.client_id = ci.client_id and cc.status <> 'ended'
    join public.profiles p on p.id = ci.client_id
    left join public.push_reminders pr on pr.user_id = cc.coach_id
    where ci.submitted_at > p_now - interval '1 hour'
      and coalesce(pr.alerts_on, true)
      and exists (select 1 from public.push_subscriptions s where s.user_id = cc.coach_id)
  loop
    insert into public.push_reminder_sends (user_id, kind, ref) values (r.coach_id, 'checkin', r.id::text) on conflict do nothing;
    if found then
      user_id := r.coach_id; kind := 'checkin';
      title := r.first_name || ' sent a check-in';
      body := coalesce('Weight ' || r.weight_kg::text || ' kg. ', '') || 'Tap to review it.';
      url := '/coach/?open=clients'; subscriptions := r.subs;
      return next;
    end if;
  end loop;

  for r in
    select b.id, b.client_id, b.kind as bkind, b.starts_at, b.created_at,
           split_part(c.full_name, ' ', 1) as coach_first,
           coalesce(pr.timezone, 'Europe/London') as tz,
           (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = b.client_id) as subs
    from public.bookings b
    join public.profiles c on c.id = b.coach_id
    left join public.push_reminders pr on pr.user_id = b.client_id
    where b.status = 'booked' and b.starts_at > p_now and b.starts_at <= p_now + interval '24 hours'
      and coalesce(pr.alerts_on, true)
      and exists (select 1 from public.push_subscriptions s where s.user_id = b.client_id)
  loop
    tag := null;
    if r.starts_at <= p_now + interval '2 hours' then
      if r.created_at < r.starts_at - interval '2 hours' then tag := '2h'; end if;
    elsif r.created_at < r.starts_at - interval '24 hours' then
      tag := '24h';
    end if;
    continue when tag is null;
    insert into public.push_reminder_sends (user_id, kind, ref) values (r.client_id, 'booking', r.id::text || ':' || tag) on conflict do nothing;
    if found then
      begin
        local := r.starts_at at time zone r.tz; today := (p_now at time zone r.tz)::date;
      exception when others then
        local := r.starts_at at time zone 'Europe/London'; today := (p_now at time zone 'Europe/London')::date;
      end;
      user_id := r.client_id; kind := 'booking';
      title := (case when r.bkind = 'session' then 'Session' else 'Call' end)
               || (case when local::date = today then ' today at ' else ' tomorrow at ' end) || to_char(local, 'HH24:MI');
      body := 'With ' || coalesce(nullif(r.coach_first, ''), 'your coach') || '. '
              || (case when tag = '2h' then 'See you soon.' else 'Can''t make it? Tap to move or cancel it.' end);
      url := '/client/?open=more'; subscriptions := r.subs;
      return next;
    end if;
  end loop;
end $$;

revoke all on function public.take_checkin_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.take_checkin_alerts(timestamptz) to service_role;

-- ===== 20261125090000_growth_tools.sql =====
-- Growing the business: a free intro session offer, referral rewards, client reviews (on the public page and Google).
-- Mirrors packages/core/src/growthTools.ts. Needs 20261110090000_growth.sql and 20261119090000_sessions.sql first.
-- Safe to run more than once.

-- The coach's offers, kept with their public page.
alter table public.coach_pages add column if not exists intro_offer boolean not null default false;
alter table public.coach_pages add column if not exists referral_reward smallint not null default 1;
alter table public.coach_pages add column if not exists google_review_url text not null default '';
alter table public.coach_pages drop constraint if exists coach_pages_referral_reward_check;
alter table public.coach_pages add constraint coach_pages_referral_reward_check check (referral_reward between 0 and 5);
alter table public.coach_pages drop constraint if exists coach_pages_google_review_url_check;
alter table public.coach_pages add constraint coach_pages_google_review_url_check check (google_review_url = '' or (google_review_url ~ '^https://' and length(google_review_url) <= 300));

-- Which pack paid the referral reward, so each friend is rewarded once.
alter table public.join_requests add column if not exists reward_pack_id uuid references public.session_packs (id) on delete set null;

-- Reviews: one per client per coach. The coach decides which ones show on the public page.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  body        text not null check (length(trim(body)) between 20 and 600),
  show_name   boolean not null default true,
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (coach_id, client_id)
);
alter table public.reviews enable row level security;
drop policy if exists "client writes own review" on public.reviews;
create policy "client writes own review" on public.reviews for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id) and not approved);
drop policy if exists "client reads own review" on public.reviews;
create policy "client reads own review" on public.reviews for select using (client_id = auth.uid());
drop policy if exists "client edits own review" on public.reviews;
create policy "client edits own review" on public.reviews for update using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "client removes own review" on public.reviews;
create policy "client removes own review" on public.reviews for delete using (client_id = auth.uid());
drop policy if exists "coach reads reviews" on public.reviews;
create policy "coach reads reviews" on public.reviews for select using (coach_id = auth.uid());
drop policy if exists "coach shows or hides reviews" on public.reviews;
create policy "coach shows or hides reviews" on public.reviews for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach removes reviews" on public.reviews;
create policy "coach removes reviews" on public.reviews for delete using (coach_id = auth.uid());

-- The coach can only show or hide; a client edit goes back for approval.
create or replace function public.guard_review_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  if auth.uid() = old.coach_id then
    new.stars := old.stars; new.body := old.body; new.show_name := old.show_name; new.client_id := old.client_id; new.coach_id := old.coach_id;
    return new;
  end if;
  new.coach_id := old.coach_id; new.client_id := old.client_id; new.updated_at := now();
  if new.body is distinct from old.body or new.stars is distinct from old.stars or new.show_name is distinct from old.show_name then
    new.approved := false;
  else
    new.approved := old.approved;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_review_change on public.reviews;
create trigger guard_review_change before update on public.reviews for each row execute function public.guard_review_change();

-- "Priya Sharma" → "Priya S."
create or replace function public.short_name(p_full text)
returns text
language sql immutable set search_path = ''
as $$
  select case when cardinality(x.parts) > 1 then x.parts[1] || ' ' || upper(left(x.parts[cardinality(x.parts)], 1)) || '.' else x.parts[1] end
  from (select regexp_split_to_array(trim(coalesce(p_full, '')), '\s+') as parts) x;
$$;

-- The coach's view: every review with the client's short name ("Priya S.").
create or replace function public.coach_reviews()
returns table (id uuid, client_id uuid, name text, stars smallint, body text, approved boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.client_id,
         public.short_name(p.full_name),
         r.stars, r.body, r.approved, r.created_at
  from public.reviews r join public.profiles p on p.id = r.client_id
  where r.coach_id = auth.uid()
  order by r.created_at desc;
$$;

-- Anyone: a published page's offer and its approved reviews. Names only when the client allowed it.
create or replace function public.public_coach_extras(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'intro_offer', cp.intro_offer,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stars', r.stars, 'body', r.body, 'at', r.created_at,
        'name', case when r.show_name then public.short_name(p.full_name) end
      ) order by r.created_at desc)
      from (select * from public.reviews where coach_id = cp.coach_id and approved order by created_at desc limit 12) r
      join public.profiles p on p.id = r.client_id
    ), '[]'::jsonb))
  from public.coach_pages cp
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- A client: their coach's offer and Google link, for the invite-a-friend screen and after writing a review.
create or replace function public.my_coach_offer(p_coach uuid)
returns table (intro_offer boolean, referral_reward smallint, google_review_url text)
language sql stable security definer set search_path = ''
as $$
  select cp.intro_offer, cp.referral_reward, cp.google_review_url from public.coach_pages cp
  where cp.coach_id = p_coach and (auth.uid() = p_coach or public.is_my_coach(p_coach));
$$;

revoke all on function public.coach_reviews() from public;
revoke all on function public.public_coach_extras(text) from public;
revoke all on function public.my_coach_offer(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.coach_reviews() from anon';
    execute 'revoke all on function public.my_coach_offer(uuid) from anon';
    execute 'grant execute on function public.coach_reviews() to authenticated';
    execute 'grant execute on function public.my_coach_offer(uuid) to authenticated';
    execute 'grant execute on function public.public_coach_extras(text) to anon, authenticated';
  end if;
end $$;

-- ===== 20261126090000_marketing.sql =====
-- Marketing: happiness check (NPS), places left this month, a time-limited offer, page visits by source,
-- and the coach's "proof in numbers" (real totals from their clients' training).
-- Mirrors packages/core/src/marketing.ts. Needs 20261110090000_growth.sql, 20261118090000_leads.sql and
-- 20261119090000_sessions.sql first. Safe to run more than once.

-- ---------- Places left and the offer, kept with the public page ----------
alter table public.coach_pages add column if not exists spots_month smallint;
alter table public.coach_pages add column if not exists campaign_title text not null default '';
alter table public.coach_pages add column if not exists campaign_text text not null default '';
alter table public.coach_pages add column if not exists campaign_ends date;
alter table public.coach_pages drop constraint if exists coach_pages_spots_month_check;
alter table public.coach_pages add constraint coach_pages_spots_month_check check (spots_month is null or spots_month between 0 and 50);
alter table public.coach_pages drop constraint if exists coach_pages_campaign_check;
alter table public.coach_pages add constraint coach_pages_campaign_check check (length(campaign_title) <= 40 and length(campaign_text) <= 160);

-- Anyone: places left this month and the offer while it runs. Places left = places set less clients who started this month.
create or replace function public.public_coach_marketing(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'spots', cp.spots_month,
    'joined', (select count(*)::int from public.coach_clients cc
               where cc.coach_id = cp.coach_id and cc.status <> 'invited' and cc.started_at >= date_trunc('month', now())),
    'campaign', case when cp.campaign_ends is not null and cp.campaign_ends >= current_date and cp.campaign_title <> ''
      then jsonb_build_object('title', cp.campaign_title, 'text', cp.campaign_text, 'ends', cp.campaign_ends) end)
  from public.coach_pages cp
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- ---------- Page visits: one counter per coach, day and source. No personal data, no cookies. ----------
create table if not exists public.page_visits (
  coach_id  uuid not null references public.profiles (id) on delete cascade,
  day       date not null default current_date,
  source    text not null default 'page' check (source ~ '^[a-z0-9-]{2,24}$'),
  visits    int not null default 0 check (visits >= 0),
  primary key (coach_id, day, source)
);
alter table public.page_visits enable row level security;
drop policy if exists "coach reads own visits" on public.page_visits;
create policy "coach reads own visits" on public.page_visits for select using (coach_id = auth.uid());

-- Anyone opening a published page adds one visit. The coach's own visits don't count. Capped so a script can't run it up forever.
create or replace function public.count_page_visit(p_slug text, p_source text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_source text := lower(coalesce(nullif(trim(p_source), ''), 'page'));
begin
  select cp.coach_id into v_coach from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published;
  if v_coach is null or v_coach = auth.uid() then return; end if;
  if v_source !~ '^[a-z0-9-]{2,24}$' then v_source := 'page'; end if;
  insert into public.page_visits (coach_id, day, source, visits) values (v_coach, current_date, v_source, 1)
  on conflict (coach_id, day, source) do update set visits = least(public.page_visits.visits + 1, 100000);
end;
$$;

-- ---------- Happiness check: "How likely are you to recommend your coach to a friend?" 0–10 ----------
create table if not exists public.happiness_checks (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  score       smallint not null check (score between 0 and 10),
  comment     text not null default '' check (length(comment) <= 400),
  created_at  timestamptz not null default now()
);
create index if not exists happiness_checks_coach_idx on public.happiness_checks (coach_id, created_at desc);
create index if not exists happiness_checks_client_idx on public.happiness_checks (client_id, created_at desc);
alter table public.happiness_checks enable row level security;
drop policy if exists "client answers" on public.happiness_checks;
create policy "client answers" on public.happiness_checks for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id));
drop policy if exists "client reads own answers" on public.happiness_checks;
create policy "client reads own answers" on public.happiness_checks for select using (client_id = auth.uid());
drop policy if exists "coach reads answers" on public.happiness_checks;
create policy "coach reads answers" on public.happiness_checks for select using (coach_id = auth.uid());
-- Answers can't be changed or removed by either side (a fair record); they go when the account goes.

-- One answer per client per coach every 30 days, whatever the app does.
create or replace function public.guard_happiness_check()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.created_at := now();
  new.comment := trim(coalesce(new.comment, ''));
  if exists (select 1 from public.happiness_checks h where h.coach_id = new.coach_id and h.client_id = new.client_id and h.created_at > now() - interval '30 days') then
    raise exception 'You answered recently. Thank you.' using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_happiness_check on public.happiness_checks;
create trigger guard_happiness_check before insert on public.happiness_checks for each row execute function public.guard_happiness_check();

-- The coach's view, with short names ("Priya S.").
create or replace function public.coach_happiness()
returns table (id uuid, client_id uuid, name text, score smallint, comment text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.client_id, public.team_name(p.full_name), h.score, h.comment, h.created_at
  from public.happiness_checks h join public.profiles p on p.id = h.client_id
  where h.coach_id = auth.uid()
  order by h.created_at desc
  limit 500;
$$;

-- ---------- Proof in numbers: real totals from the coach's clients over the last p_days ----------
create or replace function public.coach_proof(p_days int default 30)
returns table (clients int, workouts int, kg numeric, bests int, sessions int)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select cc.client_id from public.coach_clients cc where cc.coach_id = auth.uid() and cc.status <> 'invited'
  ),
  since as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as t),
  done as (
    select s.id, s.client_id from public.sessions s
    where s.client_id in (select client_id from mine) and s.finished_at is not null and s.started_at >= (select t from since)
  ),
  sets as (
    select s.client_id, ls.exercise_id, ls.load_kg, ls.reps, ls.completed_at,
      max(ls.load_kg) over (partition by s.client_id, ls.exercise_id order by ls.completed_at rows between unbounded preceding and 1 preceding) as before
    from public.logged_sets ls join public.sessions s on s.id = ls.session_id
    where s.client_id in (select client_id from mine) and s.finished_at is not null and ls.load_kg > 0
  )
  select
    (select count(distinct client_id)::int from done),
    (select count(*)::int from done),
    coalesce((select sum(ls.load_kg * coalesce(ls.reps, 0)) from public.logged_sets ls where ls.session_id in (select id from done)), 0),
    (select count(*)::int from (
       select distinct client_id, exercise_id, completed_at::date from sets
       where completed_at >= (select t from since) and before is not null and load_kg > before) b),
    (select count(*)::int from public.bookings b
       where b.coach_id = auth.uid() and b.kind = 'session' and b.status = 'booked' and b.attendance = 'attended'
         and b.starts_at >= (select t from since) and b.starts_at <= now());
$$;

revoke all on function public.public_coach_marketing(text) from public;
revoke all on function public.count_page_visit(text, text) from public;
revoke all on function public.coach_happiness() from public;
revoke all on function public.coach_proof(int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_coach_marketing(text) to anon, authenticated';
    execute 'grant execute on function public.count_page_visit(text, text) to anon, authenticated';
    execute 'revoke all on function public.coach_happiness() from anon';
    execute 'revoke all on function public.coach_proof(int) from anon';
    execute 'grant execute on function public.coach_happiness() to authenticated';
    execute 'grant execute on function public.coach_proof(int) to authenticated';
  end if;
end $$;

-- ===== public_programmes() from 20261115093000_programmes.sql (it needs coach_pages, so it may not have been created) =====
create or replace function public.public_programmes(p_slug text)
returns table (id uuid, title text, tagline text, level text, goal text, cover text, price_pence int, weeks int, per_week int)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.title, l.tagline, l.level, l.goal, l.cover, l.price_pence, l.weeks,
    (select count(distinct (d->>'dayIndex'))::int from jsonb_array_elements(l.days) d
      where (d->>'week')::int = (select min((d2->>'week')::int) from jsonb_array_elements(l.days) d2))
  from public.programme_listings l
  join public.coach_pages cp on cp.coach_id = l.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published and l.status = 'live' and l.on_page
  order by l.created_at desc
  limit 12;
$$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_programmes(text) to anon, authenticated';
  end if;
end $$;

-- ===== Check: every line should say true =====
select 'coach_pages' as item, to_regclass('public.coach_pages') is not null as ok
union all select 'join_requests', to_regclass('public.join_requests') is not null
union all select 'lead_settings', to_regclass('public.lead_settings') is not null
union all select 'session_packs', to_regclass('public.session_packs') is not null
union all select 'reviews', to_regclass('public.reviews') is not null
union all select 'happiness_checks', to_regclass('public.happiness_checks') is not null
union all select 'page_visits', to_regclass('public.page_visits') is not null
union all select 'public_programmes', to_regprocedure('public.public_programmes(text)') is not null;
