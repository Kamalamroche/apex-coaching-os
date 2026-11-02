-- Video form checks: the client films a set and sends it; the coach watches and replies.
-- Videos live in a private bucket under "<client id>/...", like progress photos. Mirrors packages/core/src/formChecks.ts.

create table public.form_checks (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles (id) on delete cascade,
  exercise_id    bigint references public.exercises (id) on delete set null,
  exercise_name  text not null check (length(exercise_name) between 1 and 120),
  note           text check (length(note) <= 1000),
  storage_path   text not null unique,
  created_at     timestamptz not null default now(),
  coach_reply    text check (length(coach_reply) <= 4000),
  reviewed_at    timestamptz
);
create index form_checks_client_idx on public.form_checks (client_id, created_at desc);

alter table public.form_checks enable row level security;
create policy "client manages own form checks" on public.form_checks for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and split_part(storage_path, '/', 1) = auth.uid()::text);
create policy "coach reads client form checks" on public.form_checks for select
  using (public.is_coach_of(client_id));
create policy "coach replies to client form checks" on public.form_checks for update
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));

-- A client can't write the coach's reply, and a coach can only add a reply, never change what the client sent.
create function public.guard_form_check_review()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.form_checks;
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
create trigger guard_form_check_review before insert or update on public.form_checks
  for each row execute function public.guard_form_check_review();

-- Private bucket, 50 MB per video, the formats phones film in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-videos', 'form-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "client uploads own form videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client reads own form videos" on storage.objects for select to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client deletes own form videos" on storage.objects for delete to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach watches client form videos" on storage.objects for select to authenticated
  using (bucket_id = 'form-videos' and public.is_coach_of_folder((storage.foldername(name))[1]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.form_checks;
  end if;
end $$;
