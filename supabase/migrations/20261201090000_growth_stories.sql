-- Growth tools: client success stories (the client approves before anything is public), a free starter plan
-- people can ask for from the trainer's page, and the trainer's monthly income goal.
-- Mirrors packages/core/src/stories.ts and packages/core/src/incomeGoal.ts.
-- Needs the growth, leads, programmes, growth tools and marketplace migrations first. Safe to run more than once.

-- 1. The trainer's monthly income goal, and which free programme is their starter plan.
alter table public.coach_pages add column if not exists income_goal_pence int;
alter table public.coach_pages drop constraint if exists coach_pages_income_goal_check;
alter table public.coach_pages add constraint coach_pages_income_goal_check check (income_goal_pence is null or income_goal_pence between 10000 and 10000000);
alter table public.coach_pages add column if not exists starter_id uuid references public.programme_listings (id) on delete set null;

-- 2. Success stories. Numbers are worked out by the database from the client's real training, never typed in.
create table if not exists public.success_stories (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  headline     text not null check (length(trim(headline)) between 3 and 80),
  numbers      jsonb not null default '{}'::jsonb check (jsonb_typeof(numbers) = 'object'),
  shown        text[] not null default '{}' check (shown <@ array['weeks', 'workouts', 'bests', 'lift', 'weight']),
  quote        text not null default '' check (length(quote) <= 300),
  show_name    boolean not null default false,
  status       text not null default 'asked' check (status in ('asked', 'approved', 'declined')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);
create index if not exists success_stories_coach_idx on public.success_stories (coach_id, created_at desc);
create index if not exists success_stories_client_idx on public.success_stories (client_id, created_at desc);

alter table public.success_stories enable row level security;
drop policy if exists "coach reads own stories" on public.success_stories;
create policy "coach reads own stories" on public.success_stories for select using (coach_id = auth.uid());
drop policy if exists "coach removes own stories" on public.success_stories;
create policy "coach removes own stories" on public.success_stories for delete using (coach_id = auth.uid());
drop policy if exists "client reads stories about them" on public.success_stories;
create policy "client reads stories about them" on public.success_stories for select using (client_id = auth.uid());
-- No insert or update policies: create_success_story() and answer_success_story() are the only ways in.

-- The real numbers for one client of the signed-in coach, since they started.
create or replace function public.client_story_numbers(p_client uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_out jsonb;
begin
  select cc.started_at into v_start from public.coach_clients cc
  where cc.coach_id = auth.uid() and cc.client_id = p_client and cc.status <> 'invited';
  if v_start is null then
    raise exception 'Only your own clients.' using errcode = '42501';
  end if;
  with done as (
    select s.id from public.sessions s where s.client_id = p_client and s.finished_at is not null and s.started_at >= v_start
  ),
  sets as (
    select ls.exercise_id, ls.load_kg, ls.completed_at,
      max(ls.load_kg) over (partition by ls.exercise_id order by ls.completed_at rows between unbounded preceding and 1 preceding) as before
    from public.logged_sets ls
    where ls.session_id in (select id from done) and ls.load_kg > 0
  ),
  lifts as (
    select x.exercise_id, x.first_kg, x.best_kg from (
      select ls.exercise_id,
        (array_agg(ls.load_kg order by ls.completed_at))[1] as first_kg,
        max(ls.load_kg) as best_kg,
        count(distinct ls.completed_at::date) as days
      from public.logged_sets ls
      where ls.session_id in (select id from done) and ls.load_kg > 0
      group by ls.exercise_id
    ) x where x.days >= 2 and x.best_kg > x.first_kg
    order by (x.best_kg - x.first_kg) / x.first_kg desc, x.best_kg desc
    limit 1
  ),
  weights as (
    select (array_agg(c.weight_kg order by c.submitted_at))[1] as first_kg,
           (array_agg(c.weight_kg order by c.submitted_at desc))[1] as last_kg,
           count(*) as n
    from public.check_ins c where c.client_id = p_client and c.weight_kg is not null and c.submitted_at >= v_start
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'weeks', greatest(0, floor(extract(epoch from now() - v_start) / 604800))::int,
    'workouts', (select count(*)::int from done),
    'bests', (select count(*)::int from (select distinct exercise_id, completed_at::date from sets where before is not null and load_kg > before) b),
    'lift', (select jsonb_build_object('name', e.name, 'from', l.first_kg, 'to', l.best_kg) from lifts l join public.exercises e on e.id = l.exercise_id),
    'weight', (select case when w.n >= 2 and w.first_kg <> w.last_kg then jsonb_build_object('from', w.first_kg, 'to', w.last_kg) end from weights w)
  )) into v_out;
  return v_out;
end;
$$;

-- Coach: ask a client if their story can be shared. The numbers are a snapshot taken now.
create or replace function public.create_success_story(p_client uuid, p_headline text, p_shown text[])
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_numbers jsonb := public.client_story_numbers(p_client);
  v_shown text[];
  v_id uuid;
begin
  select coalesce(array_agg(k), '{}') into v_shown from unnest(coalesce(p_shown, '{}')) k where v_numbers ? k;
  if cardinality(v_shown) = 0 then
    raise exception 'Pick at least one number to share.' using errcode = '23514';
  end if;
  if exists (select 1 from public.success_stories s where s.coach_id = auth.uid() and s.client_id = p_client and s.status = 'asked') then
    raise exception 'You already asked this client. Wait for their answer.' using errcode = '23505';
  end if;
  insert into public.success_stories (coach_id, client_id, headline, numbers, shown)
  values (auth.uid(), p_client, trim(p_headline), v_numbers, v_shown)
  returning id into v_id;
  return v_id;
end;
$$;

-- Client: say yes (with an optional quote and whether to show their name) or no.
create or replace function public.answer_success_story(p_id uuid, p_approve boolean, p_quote text default '', p_show_name boolean default false)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.success_stories
  set status = case when p_approve then 'approved' else 'declined' end,
      quote = case when p_approve then left(trim(coalesce(p_quote, '')), 300) else '' end,
      show_name = p_approve and coalesce(p_show_name, false),
      answered_at = now()
  where id = p_id and client_id = auth.uid();
  if not found then
    raise exception 'That story is no longer there.' using errcode = 'P0002';
  end if;
end;
$$;

-- Anyone: approved stories on a published page. A name only when the client chose to show it.
create or replace function public.public_coach_stories(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'headline', s.headline, 'quote', s.quote, 'at', s.answered_at,
      'name', case when s.show_name then public.short_name(p.full_name) end,
      'numbers', (select coalesce(jsonb_object_agg(k, s.numbers -> k), '{}'::jsonb) from unnest(s.shown) k where s.numbers ? k)
    ) order by s.answered_at desc)
    from (select * from public.success_stories where coach_id = cp.coach_id and status = 'approved' order by answered_at desc limit 6) s
    join public.profiles p on p.id = s.client_id
  ), '[]'::jsonb)
  from public.coach_pages cp
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- 3. The free starter plan on the trainer's page.
create or replace function public.public_coach_starter(p_slug text)
returns table (id uuid, title text, tagline text, weeks int, cover text)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.title, l.tagline, l.weeks, l.cover
  from public.coach_pages cp
  join public.programme_listings l on l.id = cp.starter_id and l.coach_id = cp.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published and l.status = 'live' and l.price_pence = 0;
$$;

-- Anyone: ask for the free starter plan. Lands in Leads with a follow-up 7 days later. The trainer sends the invite.
create or replace function public.request_starter(p_slug text, p_name text, p_email text, p_goal text default '')
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_title text;
  v_email text := lower(trim(p_email));
begin
  select cp.coach_id, l.title into v_coach, v_title
  from public.coach_pages cp join public.programme_listings l on l.id = cp.starter_id and l.coach_id = cp.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published and l.status = 'live' and l.price_pence = 0;
  if v_coach is null then
    raise exception 'This free plan is not available right now.' using errcode = 'P0002';
  end if;
  if v_email = '' then
    raise exception 'Add an email so the plan can reach you.' using errcode = '23514';
  end if;
  if exists (select 1 from public.join_requests r where r.coach_id = v_coach and r.email = v_email and r.stage in ('new', 'contacted', 'trial')) then
    raise exception 'You have already asked. Look out for your invite.' using errcode = '23505';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.created_at > now() - interval '1 hour' and not r.added_by_coach) >= 20 then
    raise exception 'Lots of people are asking right now. Try again in an hour.' using errcode = '54000';
  end if;
  insert into public.join_requests (coach_id, name, email, goal, message, source, follow_up, notes)
  values (v_coach, trim(p_name), v_email, left(coalesce(trim(p_goal), ''), 40), 'Asked for your free starter plan: ' || v_title || '.', 'starter',
    current_date + 7, 'Free starter plan. Invite them so they can start it under Programmes. Day 7: ask how it went and offer to keep going.');
end;
$$;

revoke all on function public.client_story_numbers(uuid) from public;
revoke all on function public.create_success_story(uuid, text, text[]) from public;
revoke all on function public.answer_success_story(uuid, boolean, text, boolean) from public;
revoke all on function public.public_coach_stories(text) from public;
revoke all on function public.public_coach_starter(text) from public;
revoke all on function public.request_starter(text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.client_story_numbers(uuid) to authenticated';
    execute 'grant execute on function public.create_success_story(uuid, text, text[]) to authenticated';
    execute 'grant execute on function public.answer_success_story(uuid, boolean, text, boolean) to authenticated';
    execute 'grant execute on function public.public_coach_stories(text) to anon, authenticated';
    execute 'grant execute on function public.public_coach_starter(text) to anon, authenticated';
    execute 'grant execute on function public.request_starter(text, text, text, text) to anon, authenticated';
  end if;
end $$;
