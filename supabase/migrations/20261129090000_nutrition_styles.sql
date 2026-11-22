-- Nutrition upgrades:
--   1. coach_clients: how the coach wants each client to track food (full macros, protein and calories,
--      hand portions or a photo diary), and the client's daily hand portions.
--   2. food_entries: hand portions and a meal photo on a logged food.
--   3. saved_meals: a client's usual meals, logged again in one tap.
--   4. meal-photos: a private bucket, one folder per client. The client adds and removes; their coach can look.
-- Safe to run more than once.

-- ───────────── 1. tracking style ─────────────
alter table public.coach_clients add column if not exists nutrition_style text not null default 'macros';
alter table public.coach_clients add column if not exists nutrition_portions jsonb;
alter table public.coach_clients drop constraint if exists coach_clients_nutrition_style_check;
alter table public.coach_clients add constraint coach_clients_nutrition_style_check check (nutrition_style in ('macros', 'protein', 'portions', 'photos'));

-- ───────────── 2. portions and photos on food ─────────────
alter table public.food_entries add column if not exists portions jsonb;
alter table public.food_entries add column if not exists photo_path text;
alter table public.food_entries drop constraint if exists food_entries_photo_path_check;
alter table public.food_entries add constraint food_entries_photo_path_check check (photo_path is null or (length(photo_path) <= 300 and split_part(photo_path, '/', 1) = client_id::text));

-- ───────────── 3. saved meals ─────────────
create table if not exists public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(name) between 1 and 60),
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  items       jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30),
  created_at  timestamptz not null default now()
);
create index if not exists saved_meals_client_idx on public.saved_meals (client_id, created_at desc);
alter table public.saved_meals enable row level security;
drop policy if exists "client manages own saved meals" on public.saved_meals;
create policy "client manages own saved meals" on public.saved_meals for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach reads client saved meals" on public.saved_meals;
create policy "coach reads client saved meals" on public.saved_meals for select
  using (public.is_coach_of(client_id));

-- ───────────── 4. meal photos ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "client uploads own meal photos" on storage.objects;
create policy "client uploads own meal photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "client reads own meal photos" on storage.objects;
create policy "client reads own meal photos" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "client deletes own meal photos" on storage.objects;
create policy "client deletes own meal photos" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "coach reads client meal photos" on storage.objects;
create policy "coach reads client meal photos" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and public.is_coach_of_folder((storage.foldername(name))[1]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'saved_meals') then
    alter publication supabase_realtime add table public.saved_meals;
  end if;
end $$;
