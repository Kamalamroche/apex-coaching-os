-- Posture and mobility assessments: the coach sends one, the client takes the photos and videos and answers a few
-- simple measures, the coach scores each test and picks the focus areas. Photos and videos live in a private bucket
-- under "<client id>/...", like form check videos. Mirrors packages/core/src/assessments.ts.
-- The client's part (answers) and the coach's part (review, summary, focus) are separate columns, so each side can
-- only ever change its own.

create table public.assessments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (length(title) between 1 and 80),
  tests         text[] not null check (cardinality(tests) between 1 and 12),
  status        text not null default 'requested' check (status in ('requested', 'submitted', 'reviewed')),
  answers       jsonb not null default '{}'::jsonb check (pg_column_size(answers) < 200000),
  review        jsonb not null default '{}'::jsonb check (pg_column_size(review) < 50000),
  summary       text check (length(summary) <= 2000),
  focus         text[] not null default '{}' check (cardinality(focus) <= 12),
  retest_weeks  int not null default 0 check (retest_weeks between 0 and 52),
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  reviewed_at   timestamptz
);
create index assessments_client_idx on public.assessments (client_id, created_at desc);

alter table public.assessments enable row level security;
create policy "coach sends assessments" on public.assessments for insert
  with check (public.is_coach_of(client_id));
create policy "coach reads client assessments" on public.assessments for select
  using (public.is_coach_of(client_id));
create policy "coach reviews client assessments" on public.assessments for update
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));
create policy "coach takes back unsent assessments" on public.assessments for delete
  using (public.is_coach_of(client_id) and status = 'requested');
create policy "client reads own assessments" on public.assessments for select
  using (client_id = auth.uid());
create policy "client answers own assessments" on public.assessments for update
  using (client_id = auth.uid() and status = 'requested') with check (client_id = auth.uid());

-- The client only fills in answers and sends it; the coach only reviews. Neither can change the other's part.
create function public.guard_assessment()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.assessments;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.answers := '{}'::jsonb;
    new.review := '{}'::jsonb;
    new.summary := null;
    new.focus := '{}';
    new.submitted_at := null;
    new.reviewed_at := null;
    new.created_at := now();
    return new;
  end if;
  r := old;
  if auth.uid() = old.client_id then
    r.answers := new.answers;
    if new.status = 'submitted' and old.status = 'requested' then
      r.status := 'submitted';
      r.submitted_at := now();
    end if;
    return r;
  end if;
  -- The coach: scores, notes and focus, and marking it reviewed once the client has sent it.
  r.review := new.review;
  r.summary := new.summary;
  r.focus := new.focus;
  r.retest_weeks := new.retest_weeks;
  if new.status = 'reviewed' and old.status in ('submitted', 'reviewed') then
    r.status := 'reviewed';
    r.reviewed_at := coalesce(old.reviewed_at, now());
    if old.status = 'submitted' then r.reviewed_at := now(); end if;
  end if;
  return r;
end;
$$;
create trigger guard_assessment before insert or update on public.assessments
  for each row execute function public.guard_assessment();

-- Private bucket, 50 MB per file, the photo and video formats phones use.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assessments', 'assessments', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "client uploads own assessment media" on storage.objects for insert to authenticated
  with check (bucket_id = 'assessments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client reads own assessment media" on storage.objects for select to authenticated
  using (bucket_id = 'assessments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "client deletes own assessment media" on storage.objects for delete to authenticated
  using (bucket_id = 'assessments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "coach sees client assessment media" on storage.objects for select to authenticated
  using (bucket_id = 'assessments' and public.is_coach_of_folder((storage.foldername(name))[1]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.assessments;
  end if;
end $$;
