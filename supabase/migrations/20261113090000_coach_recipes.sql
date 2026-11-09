-- Coach recipes: a coach writes their own recipes (ingredients from the APEX food list, method, optional small photo)
-- and their clients see them next to the APEX recipe library and in meal plans.
-- Mirrors CoachRecipeRow in packages/core/src/mealPlans.ts. Safe to run more than once.
-- Needs public.is_my_coach() from 20261103180000_bookings.sql.

create table if not exists public.coach_recipes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  recipe      jsonb not null check (jsonb_typeof(recipe) = 'object' and pg_column_size(recipe) < 200000),
  updated_at  timestamptz not null default now()
);
create index if not exists coach_recipes_coach_idx on public.coach_recipes (coach_id, updated_at desc);

alter table public.coach_recipes enable row level security;
drop policy if exists "coach manages own recipes" on public.coach_recipes;
create policy "coach manages own recipes" on public.coach_recipes for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "client reads coach recipes" on public.coach_recipes;
create policy "client reads coach recipes" on public.coach_recipes for select
  using (public.is_my_coach(coach_id));
