-- Challenges: the coach runs a challenge for their clients; clients join, log numbers and see a leaderboard.
-- Session challenges count finished workouts; logged ones add up one number a day per person.
-- The leaderboard (public.challenge_board) shows first names and an initial only. Mirrors packages/core/src/challenges.ts.
-- Needs public.is_my_coach() from 20261103180000_bookings.sql.

create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 80),
  description  text check (length(description) <= 500),
  metric       text not null check (metric in ('sessions', 'logged')),
  unit         text not null check (length(unit) between 1 and 16),
  goal         numeric check (goal > 0),
  starts_on    date not null,
  ends_on      date not null,
  created_at   timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on < 92)
);
create index challenges_coach_idx on public.challenges (coach_id, ends_on desc);

alter table public.challenges enable row level security;
create policy "coach manages own challenges" on public.challenges for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "client reads coach challenges" on public.challenges for select
  using (public.is_my_coach(coach_id));

create table public.challenge_members (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  client_id     uuid not null references public.profiles (id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (challenge_id, client_id)
);

alter table public.challenge_members enable row level security;
create policy "client joins coach challenges" on public.challenge_members for insert
  with check (client_id = auth.uid() and exists (select 1 from public.challenges c where c.id = challenge_id and public.is_my_coach(c.coach_id)));
create policy "client sees own memberships" on public.challenge_members for select
  using (client_id = auth.uid());
create policy "client leaves" on public.challenge_members for delete
  using (client_id = auth.uid());
create policy "coach sees members" on public.challenge_members for select
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.coach_id = auth.uid()));

create table public.challenge_logs (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  client_id     uuid not null references public.profiles (id) on delete cascade,
  day           date not null,
  value         numeric not null check (value >= 0 and value <= 1000000),
  primary key (challenge_id, client_id, day)
);

alter table public.challenge_logs enable row level security;
-- Members log their own numbers, on days inside the challenge.
create policy "member logs own numbers" on public.challenge_logs for all
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and exists (select 1 from public.challenge_members m where m.challenge_id = challenge_logs.challenge_id and m.client_id = auth.uid())
    and exists (select 1 from public.challenges c where c.id = challenge_logs.challenge_id and c.metric = 'logged' and challenge_logs.day between c.starts_on and c.ends_on)
  );
create policy "coach reads logs" on public.challenge_logs for select
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.coach_id = auth.uid()));

-- The leaderboard: members, first name and initial, and their total. Only the coach and their clients can see it.
create function public.challenge_board(p_challenge uuid)
returns table (name text, total numeric, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  select
    case when position(' ' in trim(p.full_name)) > 0
      then split_part(trim(p.full_name), ' ', 1) || ' ' || upper(left(regexp_replace(trim(p.full_name), '^.*\s', ''), 1)) || '.'
      else trim(p.full_name) end as name,
    case when c.metric = 'sessions' then (
      select count(*)::numeric from public.sessions s
      where s.client_id = m.client_id and s.finished_at is not null
        and s.finished_at >= c.starts_on::timestamptz and s.finished_at < (c.ends_on + 1)::timestamptz
    ) else (
      select coalesce(sum(l.value), 0) from public.challenge_logs l where l.challenge_id = c.id and l.client_id = m.client_id
    ) end as total,
    m.client_id = auth.uid() as is_me
  from public.challenges c
  join public.challenge_members m on m.challenge_id = c.id
  join public.profiles p on p.id = m.client_id
  where c.id = p_challenge and (c.coach_id = auth.uid() or public.is_my_coach(c.coach_id))
  order by total desc, name;
$$;
revoke execute on function public.challenge_board(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.challenge_board(uuid) from anon';
    execute 'grant execute on function public.challenge_board(uuid) to authenticated';
  end if;
end $$;
