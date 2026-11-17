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
