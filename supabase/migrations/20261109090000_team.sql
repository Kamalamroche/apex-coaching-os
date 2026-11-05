-- Team: a private feed for one coach and the clients who choose to join it. Clients post what they did (a workout,
-- a milestone, their week's distance) and give each other high fives. No body numbers, no photos, nothing public.
-- The effort board ranks effort (workouts and active minutes this week), never weight or measurements.
-- Names show as first name and initial only. Mirrors packages/core/src/team.ts.
-- Needs public.is_my_coach() from 20261103180000_bookings.sql.

create table if not exists public.team_members (
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  client_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (coach_id, client_id)
);

alter table public.team_members enable row level security;
drop policy if exists "client joins own coach team" on public.team_members;
create policy "client joins own coach team" on public.team_members for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id));
drop policy if exists "client sees and leaves own membership" on public.team_members;
create policy "client sees and leaves own membership" on public.team_members for select
  using (client_id = auth.uid() or coach_id = auth.uid());
drop policy if exists "client leaves team" on public.team_members;
create policy "client leaves team" on public.team_members for delete
  using (client_id = auth.uid());

-- In the team: the coach, or a current client who joined.
create or replace function public.in_team(p_coach uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_coach = auth.uid()
    or (public.is_my_coach(p_coach) and exists (select 1 from public.team_members m where m.coach_id = p_coach and m.client_id = auth.uid()));
$$;

create table if not exists public.team_posts (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('workout', 'milestone', 'distance', 'streak', 'level', 'note')),
  title       text not null check (length(trim(title)) between 1 and 80),
  detail      text check (length(detail) <= 160),
  created_at  timestamptz not null default now()
);
create index if not exists team_posts_coach_idx on public.team_posts (coach_id, created_at desc);

alter table public.team_posts enable row level security;
drop policy if exists "team reads posts" on public.team_posts;
create policy "team reads posts" on public.team_posts for select
  using (public.in_team(coach_id));
drop policy if exists "team member posts as self" on public.team_posts;
create policy "team member posts as self" on public.team_posts for insert
  with check (author_id = auth.uid() and public.in_team(coach_id));
drop policy if exists "author or coach removes post" on public.team_posts;
create policy "author or coach removes post" on public.team_posts for delete
  using (author_id = auth.uid() or coach_id = auth.uid());

create table if not exists public.team_high_fives (
  post_id     uuid not null references public.team_posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.team_high_fives enable row level security;
drop policy if exists "team reads high fives" on public.team_high_fives;
create policy "team reads high fives" on public.team_high_fives for select
  using (exists (select 1 from public.team_posts p where p.id = post_id and public.in_team(p.coach_id)));
drop policy if exists "team gives high fives" on public.team_high_fives;
create policy "team gives high fives" on public.team_high_fives for insert
  with check (user_id = auth.uid() and exists (select 1 from public.team_posts p where p.id = post_id and public.in_team(p.coach_id)));
drop policy if exists "take back own high five" on public.team_high_fives;
create policy "take back own high five" on public.team_high_fives for delete
  using (user_id = auth.uid());

-- Short name: "Priya S." from "Priya Sharma".
create or replace function public.team_name(p_full text)
returns text
language sql immutable set search_path = ''
as $$
  select case when position(' ' in trim(coalesce(p_full, ''))) > 0
    then split_part(trim(p_full), ' ', 1) || ' ' || upper(left(regexp_replace(trim(p_full), '^.*\s', ''), 1)) || '.'
    else coalesce(nullif(trim(p_full), ''), 'Someone') end;
$$;

-- The feed, newest first, with names, high five counts and whether I gave one.
create or replace function public.team_feed(p_coach uuid, p_limit int default 50)
returns table (id uuid, kind text, title text, detail text, created_at timestamptz, author text, is_coach boolean, is_me boolean, fives int, i_fived boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.kind, p.title, p.detail, p.created_at,
    public.team_name(a.full_name), p.author_id = p.coach_id, p.author_id = auth.uid(),
    (select count(*)::int from public.team_high_fives f where f.post_id = p.id),
    exists (select 1 from public.team_high_fives f where f.post_id = p.id and f.user_id = auth.uid())
  from public.team_posts p
  join public.profiles a on a.id = p.author_id
  where p.coach_id = p_coach and public.in_team(p_coach)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- This week's effort for everyone in the team: finished workouts and active minutes (workouts plus cardio).
create or replace function public.team_effort(p_coach uuid, p_since date)
returns table (name text, workouts int, minutes int, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  select public.team_name(pr.full_name),
    (select count(*)::int from public.sessions s where s.client_id = m.client_id and s.finished_at >= p_since::timestamptz),
    (select coalesce(sum(extract(epoch from (s.finished_at - s.started_at)) / 60), 0)::int from public.sessions s
       where s.client_id = m.client_id and s.finished_at >= p_since::timestamptz and s.finished_at - s.started_at < interval '6 hours')
      + (select coalesce(sum(a.moving_seconds) / 60, 0)::int from public.activities a where a.client_id = m.client_id and a.started_at >= p_since::timestamptz),
    m.client_id = auth.uid()
  from public.team_members m
  join public.profiles pr on pr.id = m.client_id
  where m.coach_id = p_coach and public.in_team(p_coach)
  order by 2 desc, 3 desc, 1;
$$;

revoke execute on function public.team_feed(uuid, int) from public;
revoke execute on function public.team_effort(uuid, date) from public;
revoke execute on function public.in_team(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.team_feed(uuid, int) from anon';
    execute 'revoke execute on function public.team_effort(uuid, date) from anon';
    execute 'revoke execute on function public.in_team(uuid) from anon';
    execute 'grant execute on function public.team_feed(uuid, int) to authenticated';
    execute 'grant execute on function public.team_effort(uuid, date) to authenticated';
    execute 'grant execute on function public.in_team(uuid) to authenticated';
  end if;
end $$;
