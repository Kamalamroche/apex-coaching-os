-- Catch-up: the public "Train with me" page, Leads and the team feed, for a database where
-- 20261109090000_team.sql, 20261110090000_growth.sql, 20261115093000_programmes.sql or 20261118090000_leads.sql
-- never ran. Without them the booking link can't open (no coach_pages) and guest bookings can't reach Leads.
-- Runs those four in order, then links guest bookings to Leads. Safe to run more than once, and safe where
-- some or all of them already ran. Needs the earlier migrations (bookings, invites, sessions, activities,
-- program builder) and 20261124090000_services.sql for the last step.

-- ===== 1. Team (20261109090000_team.sql) =====
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

-- ===== 2. Public page, friend codes, join requests (20261110090000_growth.sql) =====
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
-- (Leads, step 4, changes what this returns, so drop it first or a second run fails.)
drop function if exists public.coach_join_requests();
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

-- ===== 3. On-demand programmes on the public page (20261115093000_programmes.sql) =====
create table if not exists public.programme_listings (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  template_id  uuid references public.program_templates (id) on delete set null,
  title        text not null check (length(trim(title)) between 1 and 60),
  tagline      text not null default '' check (length(tagline) <= 90),
  description  text not null default '' check (length(description) <= 2000),
  level        text not null default 'All levels' check (level in ('Beginner', 'Intermediate', 'Advanced', 'All levels')),
  goal         text not null default 'Strength' check (goal in ('Strength', 'Muscle', 'Fat loss', 'Hybrid', 'Running', 'Mobility')),
  cover        text not null default 'squat' check (cover ~ '^[a-z-]{2,20}$'),
  -- Whole pence, GBP. 0 = free; paid starts at £1, tops out at £500.
  price_pence  int not null default 0 check (price_pence = 0 or price_pence between 100 and 50000),
  includes     text[] not null default '{}' check (cardinality(includes) <= 6),
  status       text not null default 'draft' check (status in ('draft', 'live')),
  on_page      boolean not null default true,
  weeks        int not null check (weeks between 1 and 52),
  -- TemplateDay[] with every week written out (packages/core/src/types.ts).
  days         jsonb not null check (jsonb_typeof(days) = 'array' and jsonb_array_length(days) between 1 and 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists programme_listings_coach_idx on public.programme_listings (coach_id, created_at desc);

alter table public.programme_listings enable row level security;
drop policy if exists "coach manages own programmes" on public.programme_listings;
create policy "coach manages own programmes" on public.programme_listings for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "clients see their coach's live programmes" on public.programme_listings;
create policy "clients see their coach's live programmes" on public.programme_listings for select
  using (status = 'live' and public.is_my_coach(coach_id));

create table if not exists public.programme_enrolments (
  id             uuid primary key default gen_random_uuid(),
  -- Restrict: a programme people have joined can be unpublished, not deleted, so sales history stays.
  listing_id     uuid not null references public.programme_listings (id) on delete restrict,
  coach_id       uuid not null references public.profiles (id) on delete cascade,
  client_id      uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'requested' check (status in ('requested', 'active', 'declined')),
  paid_pence     int not null default 0 check (paid_pence between 0 and 50000),
  paid_via       text check (paid_via in ('free', 'manual', 'gift', 'stripe')),
  stripe_session text check (length(stripe_session) <= 200),
  program_id     uuid references public.programs (id) on delete set null,
  started_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (listing_id, client_id)
);
create index if not exists programme_enrolments_coach_idx on public.programme_enrolments (coach_id, created_at desc);
create index if not exists programme_enrolments_client_idx on public.programme_enrolments (client_id);

alter table public.programme_enrolments enable row level security;
-- Clients never write here directly: request_programme() and start_programme() check the rules.
drop policy if exists "client sees own enrolments" on public.programme_enrolments;
create policy "client sees own enrolments" on public.programme_enrolments for select
  using (client_id = auth.uid());
drop policy if exists "coach sees own enrolments" on public.programme_enrolments;
create policy "coach sees own enrolments" on public.programme_enrolments for select
  using (coach_id = auth.uid());
drop policy if exists "coach answers enrolments" on public.programme_enrolments;
create policy "coach answers enrolments" on public.programme_enrolments for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
-- A coach can also give a programme to a client (paid_via = 'gift').
drop policy if exists "coach gives programmes" on public.programme_enrolments;
create policy "coach gives programmes" on public.programme_enrolments for insert
  with check (coach_id = auth.uid() and public.is_coach_of(client_id)
    and exists (select 1 from public.programme_listings l where l.id = listing_id and l.coach_id = auth.uid()));
drop policy if exists "coach removes enrolments" on public.programme_enrolments;
create policy "coach removes enrolments" on public.programme_enrolments for delete
  using (coach_id = auth.uid());

-- Client: ask for a paid programme. The coach confirms payment, then it unlocks.
create or replace function public.request_programme(p_listing uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_l public.programme_listings;
begin
  select * into v_l from public.programme_listings l where l.id = p_listing and l.status = 'live';
  if v_l.id is null or not public.is_my_coach(v_l.coach_id) then
    raise exception 'This programme isn''t available.' using errcode = 'P0002';
  end if;
  if v_l.price_pence = 0 then
    raise exception 'This one is free: start it straight away.' using errcode = '22023';
  end if;
  insert into public.programme_enrolments (listing_id, coach_id, client_id, status)
  values (v_l.id, v_l.coach_id, auth.uid(), 'requested')
  on conflict (listing_id, client_id) do update set status = 'requested', updated_at = now()
    where public.programme_enrolments.status = 'declined';
end;
$$;

-- Client: start (or go back to) a programme. Free ones start at once; paid ones once the coach has unlocked them.
-- Copies the programme into a new published program for this client and returns its id.
create or replace function public.start_programme(p_listing uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_l public.programme_listings;
  v_e public.programme_enrolments;
  v_program uuid;
  v_version uuid;
  v_workout uuid;
  v_day record;
begin
  select * into v_l from public.programme_listings l where l.id = p_listing and l.status = 'live';
  if v_l.id is null or not public.is_my_coach(v_l.coach_id) then
    raise exception 'This programme isn''t available.' using errcode = 'P0002';
  end if;
  select * into v_e from public.programme_enrolments e where e.listing_id = v_l.id and e.client_id = auth.uid();
  if v_l.price_pence > 0 and (v_e.id is null or v_e.status <> 'active') then
    raise exception 'Your coach needs to unlock this one first.' using errcode = '42501';
  end if;

  insert into public.programs (coach_id, client_id, name, weeks)
  values (v_l.coach_id, auth.uid(), v_l.title, v_l.weeks) returning id into v_program;
  insert into public.program_versions (program_id, version, published_at, published_by, change_note)
  values (v_program, 1, now(), auth.uid(), 'Started on-demand programme') returning id into v_version;

  for v_day in select d.value as day from jsonb_array_elements(v_l.days) as d loop
    insert into public.workouts (program_version_id, name, week, day_index, est_minutes)
    values (
      v_version,
      left(coalesce(nullif(trim(v_day.day->>'name'), ''), 'Session'), 120),
      greatest(1, coalesce((v_day.day->>'week')::int, 1)),
      least(6, greatest(0, coalesce((v_day.day->>'dayIndex')::int, 0))),
      nullif((v_day.day->>'minutes')::int, 0)
    ) returning id into v_workout;
    insert into public.workout_items (workout_id, position, group_label, exercise_id, sets, reps, load_kg, target_rpe, rest_seconds, set_plan, block_style)
    select v_workout, (i.ord - 1)::int,
      left(coalesce(nullif(i.item->>'group', ''), 'A'), 4),
      (i.item->>'exerciseId')::bigint,
      least(20, greatest(1, coalesce((i.item->>'sets')::int, 3))),
      left(coalesce(nullif(i.item->>'reps', ''), '8'), 20),
      nullif((i.item->>'kg')::numeric, 0),
      case when (i.item->>'rpe')::numeric between 1 and 10 then (i.item->>'rpe')::numeric end,
      greatest(0, coalesce((i.item->>'restSeconds')::int, 90)),
      case when jsonb_typeof(i.item->'setPlan') = 'array' then i.item->'setPlan' end,
      case when i.item->>'blockStyle' = 'circuit' then 'circuit' end
    from jsonb_array_elements(coalesce(v_day.day->'items', '[]'::jsonb)) with ordinality as i (item, ord)
    where (i.item->>'exerciseId') ~ '^\d+$'
      and exists (select 1 from public.exercises x where x.id = (i.item->>'exerciseId')::bigint);
  end loop;

  insert into public.programme_enrolments (listing_id, coach_id, client_id, status, paid_pence, paid_via, program_id, started_at)
  values (v_l.id, v_l.coach_id, auth.uid(), 'active', 0, 'free', v_program, now())
  on conflict (listing_id, client_id) do update
    set status = 'active', program_id = excluded.program_id, started_at = now(), updated_at = now(),
        paid_via = coalesce(public.programme_enrolments.paid_via, 'free');
  return v_program;
end;
$$;

-- Anyone, signed in or not: the live programmes a coach shows on their published page. No prices hidden, no people.
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

revoke execute on function public.request_programme(uuid) from public;
revoke execute on function public.start_programme(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.request_programme(uuid) to authenticated';
    execute 'grant execute on function public.start_programme(uuid) to authenticated';
    execute 'grant execute on function public.public_programmes(text) to anon, authenticated';
  end if;
end $$;

-- ===== 4. Leads (20261118090000_leads.sql) =====
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

-- ===== 5. Guest bookings link to their row in Leads (20261124090000_services.sql, now that Leads exists) =====
do $$
begin
  if to_regclass('public.guest_bookings') is not null
     and not exists (select 1 from pg_constraint where conname = 'guest_bookings_lead_id_fkey') then
    alter table public.guest_bookings add constraint guest_bookings_lead_id_fkey foreign key (lead_id) references public.join_requests (id) on delete set null;
  end if;
end $$;
