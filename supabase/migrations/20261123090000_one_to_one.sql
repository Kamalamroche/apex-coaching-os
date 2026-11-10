-- One-to-one sessions run by the coach.
-- 1. The coach can log a session for a client on their own phone or tablet. It lands in the client's
--    history like any other session, marked source = 'coach' and coached_by = the coach.
-- 2. Session notes: the coach writes one after a session (or any time). Private by default; a shared
--    note is also readable by the client.
-- 3. In-person check: the coach can add the client's weight, measurements and progress photos.
-- Safe to run more than once.

-- ───────────── sessions the coach runs ─────────────

-- The source column came with the client-import update; add it here too in case that one wasn't run.
alter table public.sessions add column if not exists source text not null default 'app';
alter table public.sessions drop constraint if exists sessions_source_check;
alter table public.sessions add constraint sessions_source_check check (source in ('app', 'import', 'coach'));
alter table public.sessions add column if not exists coached_by uuid references public.profiles (id) on delete set null;

drop policy if exists "coach logs client sessions" on public.sessions;
create policy "coach logs client sessions" on public.sessions for insert
  with check (source = 'coach' and coached_by = auth.uid() and public.is_coach_of(client_id));

drop policy if exists "coach logs client sets" on public.logged_sets;
create policy "coach logs client sets" on public.logged_sets for insert
  with check (exists (
    select 1 from public.sessions s
    where s.id = logged_sets.session_id and s.source = 'coach' and s.coached_by = auth.uid() and public.is_coach_of(s.client_id)
  ));

-- ───────────── session notes ─────────────

create table if not exists public.session_notes (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references public.profiles (id) on delete cascade,
  client_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (length(btrim(body)) between 2 and 1000),
  shared         boolean not null default false,
  -- "Lower A · 14 sets · 2,340 kg", when the note came with a session the coach ran.
  session_label  text check (session_label is null or length(session_label) <= 200),
  created_at     timestamptz not null default now()
);
create index if not exists session_notes_client_idx on public.session_notes (client_id, created_at desc);

alter table public.session_notes enable row level security;
drop policy if exists "coach manages own session notes" on public.session_notes;
create policy "coach manages own session notes" on public.session_notes for all
  using (coach_id = auth.uid() and public.is_coach_of(client_id))
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
drop policy if exists "client reads shared session notes" on public.session_notes;
create policy "client reads shared session notes" on public.session_notes for select
  using (client_id = auth.uid() and shared);

-- ───────────── in-person check: weight, measurements, photos ─────────────

drop policy if exists "coach adds client measurements" on public.body_measurements;
create policy "coach adds client measurements" on public.body_measurements for insert
  with check (public.is_coach_of(client_id));

drop policy if exists "coach adds client photos" on public.progress_photos;
create policy "coach adds client photos" on public.progress_photos for insert
  with check (public.is_coach_of(client_id) and split_part(storage_path, '/', 1) = client_id::text);

drop policy if exists "coach uploads client progress photos" on storage.objects;
create policy "coach uploads client progress photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and public.is_coach_of_folder((storage.foldername(name))[1]));

-- If an upload's row then fails, the app removes the file again, so the coach may delete what they can read.
drop policy if exists "coach removes client progress photo uploads" on storage.objects;
create policy "coach removes client progress photo uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and public.is_coach_of_folder((storage.foldername(name))[1]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'session_notes') then
    alter publication supabase_realtime add table public.session_notes;
  end if;
end $$;
