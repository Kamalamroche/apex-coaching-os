-- Cardio, recovery and connected apps: runs, swims, rides, rows, walks and hikes (by hand, from a
-- watch file or Strava), and sleep, HRV, resting heart rate and stress from Whoop, Oura, Garmin, Polar or Fitbit.
-- Safe to run more than once.

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
  provider      text not null,
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
  provider       text not null,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text,
  primary key (client_id, provider)
);
alter table public.device_tokens enable row level security;

-- Providers a client can connect. Kept as a named constraint so adding one later is a one-line change.
alter table public.device_connections drop constraint if exists device_connections_provider_check;
alter table public.device_connections add constraint device_connections_provider_check check (provider in ('strava', 'whoop', 'oura', 'garmin', 'polar', 'fitbit'));
alter table public.device_tokens drop constraint if exists device_tokens_provider_check;
alter table public.device_tokens add constraint device_tokens_provider_check check (provider in ('strava', 'whoop', 'oura', 'garmin', 'polar', 'fitbit'));

-- One row per morning per source: what the watch or ring measured overnight, or what the client typed in.
create table if not exists public.recovery_days (
  client_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day               date not null,
  source            text not null check (source in ('whoop', 'oura', 'garmin', 'polar', 'fitbit', 'manual')),
  sleep_minutes     int check (sleep_minutes between 0 and 1440),
  deep_minutes      int check (deep_minutes >= 0),
  rem_minutes       int check (rem_minutes >= 0),
  light_minutes     int check (light_minutes >= 0),
  awake_minutes     int check (awake_minutes >= 0),
  sleep_score       int check (sleep_score between 0 and 100),
  hrv_ms            numeric(5, 1) check (hrv_ms between 0 and 400),
  resting_hr        int check (resting_hr between 20 and 150),
  recovery_score    int check (recovery_score between 0 and 100),
  stress            int check (stress between 0 and 100),
  strain            numeric(4, 1) check (strain between 0 and 21),
  steps             int check (steps >= 0),
  respiratory_rate  numeric(4, 1),
  bed_start         timestamptz,
  bed_end           timestamptz,
  hypnogram         text check (hypnogram ~ '^[dlra]{0,288}$'),
  updated_at        timestamptz not null default now(),
  primary key (client_id, day, source)
);
-- Bed and wake times and the stage timeline (added after the first draft of this file; safe to re-run).
alter table public.recovery_days add column if not exists bed_start timestamptz;
alter table public.recovery_days add column if not exists bed_end timestamptz;
alter table public.recovery_days add column if not exists hypnogram text check (hypnogram ~ '^[dlra]{0,288}$');
alter table public.recovery_days enable row level security;
drop policy if exists "client manages own recovery" on public.recovery_days;
create policy "client manages own recovery" on public.recovery_days for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads client recovery" on public.recovery_days;
create policy "coach reads client recovery" on public.recovery_days for select using (public.is_coach_of(client_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activities') then
    alter publication supabase_realtime add table public.activities;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'recovery_days') then
    alter publication supabase_realtime add table public.recovery_days;
  end if;
end $$;
