-- APEX Coaching OS: initial schema.
-- One versioned program per client. Prescriptions (workout_items) and what the client
-- actually did (logged_sets) live in separate tables so history is never overwritten.
-- Every table has row level security: coaches see their own clients, clients see themselves.

create extension if not exists "pgcrypto";

-- ───────────── people ─────────────

create type public.user_role as enum ('coach', 'client');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  full_name   text not null,
  units       text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at  timestamptz not null default now()
);

create type public.training_mode as enum ('online', 'hybrid', 'in_person');

create table public.coach_clients (
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'active' check (status in ('invited', 'active', 'paused', 'ended')),
  mode        public.training_mode not null default 'online',
  goal        text,
  started_at  timestamptz not null default now(),
  primary key (coach_id, client_id)
);
create index coach_clients_client_idx on public.coach_clients (client_id);

-- True when the signed-in user coaches this client. SECURITY DEFINER so policies can
-- call it without recursing into coach_clients' own policy.
create function public.is_coach_of(p_client uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = auth.uid() and cc.client_id = p_client and cc.status <> 'ended'
  );
$$;

-- ───────────── exercise library ─────────────

create type public.movement_pattern as enum ('squat', 'hinge', 'push', 'pull', 'isolation', 'core', 'carry', 'conditioning');

create table public.exercises (
  id              bigint generated always as identity primary key,
  -- null = the shared APEX library, otherwise a coach's custom exercise
  owner_coach_id  uuid references public.profiles (id) on delete cascade,
  name            text not null,
  aliases         text[] not null default '{}',
  pattern         public.movement_pattern not null,
  body_area       text not null,
  equipment       text not null,
  muscles         text[] not null default '{}',
  cues            text[] not null default '{}',
  common_mistake  text,
  video_url       text,
  created_at      timestamptz not null default now()
);
create index exercises_owner_idx on public.exercises (owner_coach_id);
create index exercises_name_idx on public.exercises (lower(name));
create index exercises_aliases_idx on public.exercises using gin (aliases);

-- ───────────── programs ─────────────

create table public.programs (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references public.profiles (id) on delete cascade,
  client_id        uuid not null references public.profiles (id) on delete cascade,
  name             text not null,
  weeks            int not null default 8 check (weeks between 1 and 52),
  current_version  int not null default 1,
  created_at       timestamptz not null default now()
);
create index programs_client_idx on public.programs (client_id);

-- Publishing creates a new version; the client always trains from the latest published one
-- and old sessions keep pointing at the version they were done on.
create table public.program_versions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs (id) on delete cascade,
  version       int not null,
  published_at  timestamptz,
  published_by  uuid references public.profiles (id),
  change_note   text,
  unique (program_id, version)
);

create table public.workouts (
  id                  uuid primary key default gen_random_uuid(),
  program_version_id  uuid not null references public.program_versions (id) on delete cascade,
  name                text not null,
  week                int not null check (week >= 1),
  day_index           int not null check (day_index between 0 and 6),
  est_minutes         int
);
create index workouts_version_idx on public.workouts (program_version_id);

-- The prescription. group_label is "A" for a straight set, "B1"/"B2" for a superset.
create table public.workout_items (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.workouts (id) on delete cascade,
  position      int not null,
  group_label   text not null,
  exercise_id   bigint not null references public.exercises (id),
  sets          int not null check (sets between 1 and 20),
  reps          text not null,
  load_kg       numeric(6, 2),
  target_rpe    numeric(3, 1) check (target_rpe between 1 and 10),
  rest_seconds  int not null default 90 check (rest_seconds >= 0),
  notes         text,
  unique (workout_id, position)
);

-- ───────────── training log ─────────────

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  workout_id   uuid references public.workouts (id) on delete set null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  session_rpe  numeric(3, 1) check (session_rpe between 1 and 10),
  note         text
);
create index sessions_client_idx on public.sessions (client_id, started_at desc);

create table public.logged_sets (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions (id) on delete cascade,
  workout_item_id  uuid references public.workout_items (id) on delete set null,
  exercise_id      bigint not null references public.exercises (id),
  set_index        int not null,
  load_kg          numeric(6, 2),
  reps             int,
  seconds          int,
  rpe              numeric(3, 1) check (rpe between 1 and 10),
  completed_at     timestamptz not null default now()
);
create index logged_sets_session_idx on public.logged_sets (session_id);
create index logged_sets_exercise_idx on public.logged_sets (exercise_id);

create table public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  weight_kg     numeric(5, 2),
  energy        int check (energy between 1 and 5),
  mood          int check (mood between 1 and 5),
  sleep_hours   numeric(3, 1),
  note          text
);
create index check_ins_client_idx on public.check_ins (client_id, submitted_at desc);

-- ───────────── communication and AI ─────────────

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id),
  body        text not null check (length(body) between 1 and 4000),
  ai_drafted  boolean not null default false,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  check (sender_id in (coach_id, client_id))
);
create index messages_thread_idx on public.messages (coach_id, client_id, created_at);

-- Every AI proposal and the coach's decision on it. Nothing the AI suggests reaches a
-- client without a row here moving to 'accepted'.
create table public.ai_suggestions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('message_draft', 'workout_adjustment', 'progression', 'check_in_summary')),
  evidence    jsonb not null default '{}',
  proposal    jsonb not null,
  status      text not null default 'proposed' check (status in ('proposed', 'accepted', 'edited', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index ai_suggestions_coach_idx on public.ai_suggestions (coach_id, status);

-- ───────────── row level security ─────────────

alter table public.profiles         enable row level security;
alter table public.coach_clients    enable row level security;
alter table public.exercises        enable row level security;
alter table public.programs         enable row level security;
alter table public.program_versions enable row level security;
alter table public.workouts         enable row level security;
alter table public.workout_items    enable row level security;
alter table public.sessions         enable row level security;
alter table public.logged_sets      enable row level security;
alter table public.check_ins        enable row level security;
alter table public.messages         enable row level security;
alter table public.ai_suggestions   enable row level security;

-- profiles
create policy "read own profile or own clients" on public.profiles for select
  using (id = auth.uid() or public.is_coach_of(id)
         or exists (select 1 from public.coach_clients cc where cc.client_id = auth.uid() and cc.coach_id = profiles.id));
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- coach_clients
create policy "see own relationships" on public.coach_clients for select
  using (coach_id = auth.uid() or client_id = auth.uid());
create policy "coach manages relationships" on public.coach_clients for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- exercises: shared library is readable by everyone signed in; custom ones by their coach and that coach's clients
create policy "read library" on public.exercises for select
  using (owner_coach_id is null or owner_coach_id = auth.uid()
         or exists (select 1 from public.coach_clients cc where cc.client_id = auth.uid() and cc.coach_id = exercises.owner_coach_id));
create policy "coach manages custom exercises" on public.exercises for all
  using (owner_coach_id = auth.uid()) with check (owner_coach_id = auth.uid());

-- programs and their children
create policy "coach manages programs" on public.programs for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and public.is_coach_of(client_id));
create policy "client reads own programs" on public.programs for select using (client_id = auth.uid());

create function public.can_read_program(p_program uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.programs p where p.id = p_program and (p.coach_id = auth.uid() or p.client_id = auth.uid())); $$;

create function public.can_edit_program(p_program uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.programs p where p.id = p_program and p.coach_id = auth.uid()); $$;

-- Clients only see versions once published.
create policy "read program versions" on public.program_versions for select
  using (public.can_edit_program(program_id) or (published_at is not null and public.can_read_program(program_id)));
create policy "coach edits program versions" on public.program_versions for all
  using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));

-- The exists() subqueries below run under the caller's own RLS, so a workout is visible
-- exactly when its program version is.
create policy "read workouts" on public.workouts for select
  using (exists (select 1 from public.program_versions v where v.id = workouts.program_version_id));
create policy "coach edits workouts" on public.workouts for all
  using (exists (select 1 from public.program_versions v where v.id = workouts.program_version_id and public.can_edit_program(v.program_id)))
  with check (exists (select 1 from public.program_versions v where v.id = workouts.program_version_id and public.can_edit_program(v.program_id)));

create policy "read workout items" on public.workout_items for select
  using (exists (select 1 from public.workouts w where w.id = workout_items.workout_id));
create policy "coach edits workout items" on public.workout_items for all
  using (exists (select 1 from public.workouts w join public.program_versions v on v.id = w.program_version_id
                 where w.id = workout_items.workout_id and public.can_edit_program(v.program_id)))
  with check (exists (select 1 from public.workouts w join public.program_versions v on v.id = w.program_version_id
                      where w.id = workout_items.workout_id and public.can_edit_program(v.program_id)));

-- sessions and sets: the client writes, their coach reads
create policy "client manages own sessions" on public.sessions for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coach reads client sessions" on public.sessions for select using (public.is_coach_of(client_id));

create policy "client manages own sets" on public.logged_sets for all
  using (exists (select 1 from public.sessions s where s.id = logged_sets.session_id and s.client_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = logged_sets.session_id and s.client_id = auth.uid()));
create policy "coach reads client sets" on public.logged_sets for select
  using (exists (select 1 from public.sessions s where s.id = logged_sets.session_id and public.is_coach_of(s.client_id)));

-- check-ins
create policy "client manages own check-ins" on public.check_ins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coach reads client check-ins" on public.check_ins for select using (public.is_coach_of(client_id));

-- messages: either side of the thread reads; you can only send as yourself, inside a real coaching relationship
create policy "read own threads" on public.messages for select
  using (coach_id = auth.uid() or client_id = auth.uid());
create policy "send as yourself" on public.messages for insert
  with check (sender_id = auth.uid()
              and exists (select 1 from public.coach_clients cc where cc.coach_id = messages.coach_id and cc.client_id = messages.client_id and cc.status <> 'ended'));
create policy "recipient marks read" on public.messages for update
  using ((coach_id = auth.uid() or client_id = auth.uid()) and sender_id <> auth.uid())
  with check (coach_id = auth.uid() or client_id = auth.uid());

-- AI suggestions are coach-only
create policy "coach owns ai suggestions" on public.ai_suggestions for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and (client_id is null or public.is_coach_of(client_id)));

-- Live updates for the apps (replaces the demo store's localStorage sync).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workout_items, public.sessions, public.logged_sets, public.messages, public.check_ins;
  end if;
end $$;
