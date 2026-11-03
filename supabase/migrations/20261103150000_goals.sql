-- Goals: a lift, a body weight, or anything else with a number. The coach or the client can set them.
-- Lift and body weight goals fill themselves in from logged sets and measurements, so only custom goals
-- store a current value. Badges are worked out in the app from existing data: no table.
-- Mirrors packages/core/src/goals.ts.

create table public.client_goals (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles (id) on delete cascade,
  kind           text not null check (kind in ('lift', 'bodyweight', 'custom')),
  title          text not null default '' check (length(title) <= 120),
  exercise_id    bigint references public.exercises (id) on delete set null,
  target         numeric not null check (target > 0 and target <= 100000),
  unit           text not null default 'kg' check (length(unit) between 1 and 16),
  start_value    numeric,
  current_value  numeric,
  due_on         date,
  created_at     timestamptz not null default now(),
  check (kind <> 'custom' or length(trim(title)) > 0)
);
create index client_goals_client_idx on public.client_goals (client_id);

alter table public.client_goals enable row level security;
create policy "coach manages client goals" on public.client_goals for all
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));
create policy "client manages own goals" on public.client_goals for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.client_goals;
  end if;
end $$;
