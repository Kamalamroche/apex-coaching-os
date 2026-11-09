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
