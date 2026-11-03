-- Habits, nutrition targets with a food log, and the onboarding questionnaire.
-- The coach sets habits and targets; the client ticks habits off, logs food and fills in the questionnaire.
-- Mirrors packages/core/src/lifestyle.ts.

-- ───────────── habits ─────────────

create table public.client_habits (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'custom' check (kind in ('water', 'steps', 'sleep', 'protein', 'veg', 'mobility', 'custom')),
  title       text not null check (length(title) between 1 and 120),
  -- 0 = Monday … 6 = Sunday, as workouts.day_index.
  days        smallint[] not null default '{0,1,2,3,4,5,6}' check (days <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(days) between 1 and 7),
  created_at  timestamptz not null default now()
);
create index client_habits_client_idx on public.client_habits (client_id);

alter table public.client_habits enable row level security;
create policy "coach manages client habits" on public.client_habits for all
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));
create policy "client reads own habits" on public.client_habits for select
  using (client_id = auth.uid());

create table public.habit_ticks (
  habit_id    uuid not null references public.client_habits (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  primary key (habit_id, day)
);
create index habit_ticks_client_idx on public.habit_ticks (client_id, day desc);

alter table public.habit_ticks enable row level security;
-- The client ticks only their own habits.
create policy "client ticks own habits" on public.habit_ticks for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and exists (select 1 from public.client_habits h where h.id = habit_id and h.client_id = auth.uid()));
create policy "coach reads client ticks" on public.habit_ticks for select
  using (public.is_coach_of(client_id));

-- ───────────── nutrition ─────────────

create table public.nutrition_targets (
  client_id   uuid primary key references public.profiles (id) on delete cascade,
  kcal        int not null check (kcal between 0 and 10000),
  protein_g   int not null check (protein_g between 0 and 1000),
  carbs_g     int not null check (carbs_g between 0 and 2000),
  fat_g       int not null check (fat_g between 0 and 1000),
  note        text check (length(note) <= 500),
  updated_at  timestamptz not null default now()
);

alter table public.nutrition_targets enable row level security;
create policy "coach sets client targets" on public.nutrition_targets for all
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));
create policy "client reads own targets" on public.nutrition_targets for select
  using (client_id = auth.uid());

create table public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name        text not null check (length(name) between 1 and 120),
  kcal        int not null check (kcal between 0 and 10000),
  protein_g   numeric(6, 1) not null default 0 check (protein_g between 0 and 1000),
  carbs_g     numeric(6, 1) not null default 0 check (carbs_g between 0 and 2000),
  fat_g       numeric(6, 1) not null default 0 check (fat_g between 0 and 1000),
  created_at  timestamptz not null default now()
);
create index food_entries_client_idx on public.food_entries (client_id, day desc);

alter table public.food_entries enable row level security;
create policy "client manages own food log" on public.food_entries for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coach reads client food log" on public.food_entries for select
  using (public.is_coach_of(client_id));

-- ───────────── onboarding questionnaire ─────────────

create table public.intake_forms (
  client_id     uuid primary key references public.profiles (id) on delete cascade,
  answers       jsonb not null check (pg_column_size(answers) <= 20000),
  -- How many health questions were answered yes, so the coach's lists can flag it without reading the JSON.
  health_flags  smallint not null default 0 check (health_flags between 0 and 20),
  submitted_at  timestamptz not null default now()
);

alter table public.intake_forms enable row level security;
create policy "client fills in own questionnaire" on public.intake_forms for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coach reads client questionnaire" on public.intake_forms for select
  using (public.is_coach_of(client_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.client_habits, public.habit_ticks, public.nutrition_targets, public.food_entries, public.intake_forms;
  end if;
end $$;
