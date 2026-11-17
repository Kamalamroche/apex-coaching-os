-- On-demand programmes: a coach publishes a program once and many clients start it on their own, free or for a price.
-- Starting copies the programme into a new program for that client (like assigning a template), so every client
-- has their own copy and the old program stays in their history.
-- Paid programmes: the client asks, the coach confirms payment (bank transfer, cash) or gifts it. When card payments
-- go live, the Stripe webhook sets status = 'active', paid_via = 'stripe' and stripe_session the same way.
-- Mirrors packages/core/src/onDemand.ts. Needs public.is_my_coach() (20261103180000_bookings.sql),
-- public.coach_pages (20261110090000_growth.sql) and the set_plan/block_style columns (20261028190000_program_builder.sql).

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
