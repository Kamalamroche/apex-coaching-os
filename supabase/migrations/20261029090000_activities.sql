-- Cardio and connected apps: runs, swims, rides, rows, walks and hikes, logged by hand,
-- uploaded from a watch file (GPX, TCX, FIT) or brought in from Strava.

create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  sport             text not null check (sport in ('run', 'swim', 'ride', 'row', 'walk', 'hike', 'other')),
  name              text not null check (length(name) between 1 and 120),
  started_at        timestamptz not null,
  distance_m        numeric(9, 1) not null default 0 check (distance_m >= 0),
  moving_seconds    int not null default 0 check (moving_seconds >= 0),
  elapsed_seconds   int not null default 0 check (elapsed_seconds >= 0),
  elevation_gain_m  numeric(7, 1),
  avg_hr            int check (avg_hr between 20 and 250),
  max_hr            int check (max_hr between 20 and 250),
  calories          int check (calories >= 0),
  rpe               numeric(3, 1) check (rpe between 1 and 10),
  note              text check (note is null or length(note) <= 1000),
  source            text not null default 'manual' check (source in ('manual', 'file', 'strava')),
  -- The provider's own id, so a sync never brings the same activity in twice.
  external_id       text,
  -- Route, chart points, splits, heart-rate zones and best efforts (packages/core/src/activity.ts, ActivityDetail).
  detail            jsonb check (detail is null or jsonb_typeof(detail) = 'object'),
  created_at        timestamptz not null default now(),
  unique (client_id, source, external_id)
);
create index if not exists activities_client_idx on public.activities (client_id, started_at desc);

alter table public.activities enable row level security;
drop policy if exists "client manages own activities" on public.activities;
create policy "client manages own activities" on public.activities for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads client activities" on public.activities;
create policy "coach reads client activities" on public.activities for select using (public.is_coach_of(client_id));

-- Which apps a client has connected. Written by the edge functions (service role); the client and coach read it.
create table if not exists public.device_connections (
  client_id     uuid not null references public.profiles (id) on delete cascade,
  provider      text not null check (provider in ('strava')),
  athlete_id    text,
  athlete_name  text,
  connected_at  timestamptz not null default now(),
  last_sync_at  timestamptz,
  primary key (client_id, provider)
);
alter table public.device_connections enable row level security;
drop policy if exists "client reads own connections" on public.device_connections;
create policy "client reads own connections" on public.device_connections for select using (client_id = auth.uid());
drop policy if exists "coach reads client connections" on public.device_connections;
create policy "coach reads client connections" on public.device_connections for select using (public.is_coach_of(client_id));

-- The provider's tokens. Row level security is on with no policies, so only the edge functions
-- (service role) can read them: never the browser, not even the client's own.
create table if not exists public.device_tokens (
  client_id      uuid not null references public.profiles (id) on delete cascade,
  provider       text not null check (provider in ('strava')),
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text,
  primary key (client_id, provider)
);
alter table public.device_tokens enable row level security;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activities') then
    alter publication supabase_realtime add table public.activities;
  end if;
end $$;
