-- Weekly check-ins, body measurements and progress photos.
-- The client writes all three; their coach reads them and replies to a check-in.
-- Photos live in a private storage bucket under "<client id>/...", so a file's first folder
-- says whose it is and the policies below need no extra lookup table.

-- ───────────── check-ins: the full weekly form ─────────────

alter table public.check_ins
  add column stress       int check (stress between 1 and 5),
  add column hunger       int check (hunger between 1 and 5),
  add column training     int check (training between 1 and 5),
  add column nutrition    int check (nutrition between 1 and 5),
  add column wins         text check (length(wins) <= 2000),
  add column struggles    text check (length(struggles) <= 2000),
  add column coach_reply  text check (length(coach_reply) <= 4000),
  add column reviewed_at  timestamptz;

-- Which day the client's weekly check-in is due. 0 = Monday … 6 = Sunday, as workouts.day_index.
alter table public.coach_clients
  add column check_in_day smallint not null default 0 check (check_in_day between 0 and 6);

-- A client can't write their coach's reply, and a coach can only add a reply, never change
-- what the client reported. Runs with no signed-in user (SQL Editor) untouched.
create function public.guard_check_in_review()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.check_ins;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.coach_reply := null;
    new.reviewed_at := null;
    return new;
  end if;
  if auth.uid() = old.client_id then
    new.coach_reply := old.coach_reply;
    new.reviewed_at := old.reviewed_at;
    return new;
  end if;
  r := old;
  r.coach_reply := new.coach_reply;
  r.reviewed_at := new.reviewed_at;
  return r;
end;
$$;
create trigger guard_check_in_review before insert or update on public.check_ins
  for each row execute function public.guard_check_in_review();

create policy "coach reviews client check-ins" on public.check_ins for update
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));

-- ───────────── body measurements ─────────────

create table public.body_measurements (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  check_in_id   uuid references public.check_ins (id) on delete set null,
  measured_at   timestamptz not null default now(),
  weight_kg     numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct  numeric(4, 1) check (body_fat_pct between 2 and 70),
  chest_cm      numeric(5, 1) check (chest_cm between 20 and 300),
  waist_cm      numeric(5, 1) check (waist_cm between 20 and 300),
  hips_cm       numeric(5, 1) check (hips_cm between 20 and 300),
  arm_cm        numeric(5, 1) check (arm_cm between 10 and 100),
  thigh_cm      numeric(5, 1) check (thigh_cm between 10 and 150)
);
create index body_measurements_client_idx on public.body_measurements (client_id, measured_at desc);

alter table public.body_measurements enable row level security;
create policy "client manages own measurements" on public.body_measurements for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "coach reads client measurements" on public.body_measurements for select
  using (public.is_coach_of(client_id));

-- ───────────── progress photos ─────────────

create table public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  check_in_id   uuid references public.check_ins (id) on delete set null,
  pose          text not null check (pose in ('front', 'side', 'back')),
  storage_path  text not null unique,
  taken_at      timestamptz not null default now()
);
create index progress_photos_client_idx on public.progress_photos (client_id, taken_at desc);

alter table public.progress_photos enable row level security;
create policy "client manages own photos" on public.progress_photos for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and split_part(storage_path, '/', 1) = auth.uid()::text);
create policy "coach reads client photos" on public.progress_photos for select
  using (public.is_coach_of(client_id));

-- Private bucket, 10 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- True when the signed-in user coaches the client whose id is this folder name. Compares as
-- text, so a folder that isn't a uuid simply doesn't match instead of raising an error.
create function public.is_coach_of_folder(p_folder text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = auth.uid() and cc.client_id::text = p_folder and cc.status <> 'ended'
  );
$$;

create policy "client uploads own progress photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client reads own progress photos" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client deletes own progress photos" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach reads client progress photos" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and public.is_coach_of_folder((storage.foldername(name))[1]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.body_measurements, public.progress_photos;
  end if;
end $$;
