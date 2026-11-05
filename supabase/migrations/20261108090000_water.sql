-- Water tracker: each drink the client logs. The water habit ticks itself when the day's goal is reached.
-- Mirrors WaterEntry in packages/core/src/lifestyle.ts. Safe to run more than once.
-- Needs the habits SQL (20261102200000_habits_nutrition_intake.sql) first, for is_coach_of.

create table if not exists public.water_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  ml          int not null check (ml between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index if not exists water_entries_client_idx on public.water_entries (client_id, day desc);

alter table public.water_entries enable row level security;
drop policy if exists "client manages own water" on public.water_entries;
create policy "client manages own water" on public.water_entries for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads client water" on public.water_entries;
create policy "coach reads client water" on public.water_entries for select
  using (public.is_coach_of(client_id));

-- Live updates for the coach's view.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'water_entries') then
    alter publication supabase_realtime add table public.water_entries;
  end if;
end $$;
