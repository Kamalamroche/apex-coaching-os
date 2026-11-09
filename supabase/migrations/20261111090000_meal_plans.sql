-- Meal plans: the coach writes one plan per client (a few day templates such as Training day and Rest day,
-- each with breakfast, lunch, dinner and snacks). The client reads it, logs meals from it and gets a shopping list.
-- Mirrors MealPlan in packages/core/src/mealPlans.ts. Safe to run more than once.
-- Needs the habits SQL (20261102200000_habits_nutrition_intake.sql) first, for is_coach_of.

create table if not exists public.meal_plans (
  client_id   uuid primary key references public.profiles (id) on delete cascade,
  plan        jsonb not null default '{"days": [], "note": ""}'::jsonb check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 200000),
  updated_at  timestamptz not null default now()
);

alter table public.meal_plans enable row level security;
drop policy if exists "coach writes client meal plan" on public.meal_plans;
create policy "coach writes client meal plan" on public.meal_plans for all
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));
drop policy if exists "client reads own meal plan" on public.meal_plans;
create policy "client reads own meal plan" on public.meal_plans for select
  using (client_id = auth.uid());

-- Live updates, so a plan the coach saves shows on the client's phone straight away.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'meal_plans') then
    alter publication supabase_realtime add table public.meal_plans;
  end if;
end $$;
