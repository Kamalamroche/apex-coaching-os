-- Catch-up: runs the check-ins, automatic messages and form checks SQL, but only the parts
-- that are not in the database yet. Safe to run more than once: anything already set up is skipped.
-- Paste the whole file into the Supabase SQL Editor and press Run.

-- 1. Check-ins, measurements and progress photos (20261029120000_check_ins_measurements_photos.sql)
do $outer$
begin
  if to_regclass('public.progress_photos') is null then
    execute $step1$
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
$step1$;
    raise notice 'Check-ins, measurements and progress photos: added';
  else
    raise notice 'Check-ins, measurements and progress photos: already set up, skipped';
  end if;
end $outer$;

-- 2. Automatic messages (20261103090000_automatic_messages.sql)
do $outer$
begin
  if to_regclass('public.coach_automations') is null then
    execute $step2$
-- Automatic messages: a welcome when a client joins, a nudge after missed workouts, a check-in reminder.
-- The coach turns each one on and writes the wording (one row per coach). An hourly job,
-- public.run_automations(), sends them as ordinary messages from the coach. automation_sends
-- remembers what went out, so nothing is sent twice. Mirrors packages/core/src/automations.ts.

create table public.coach_automations (
  coach_id      uuid primary key references public.profiles (id) on delete cascade,
  welcome_on    boolean not null default false,
  welcome_body  text not null default '' check (length(welcome_body) <= 1000),
  missed_on     boolean not null default false,
  missed_days   smallint not null default 4 check (missed_days between 2 and 14),
  missed_body   text not null default '' check (length(missed_body) <= 1000),
  checkin_on    boolean not null default false,
  checkin_body  text not null default '' check (length(checkin_body) <= 1000),
  send_hour     smallint not null default 9 check (send_hour between 0 and 23),
  timezone      text not null default 'Europe/London' check (length(timezone) between 1 and 64),
  updated_at    timestamptz not null default now(),
  check (not welcome_on or length(trim(welcome_body)) > 0),
  check (not missed_on or length(trim(missed_body)) > 0),
  check (not checkin_on or length(trim(checkin_body)) > 0)
);

alter table public.coach_automations enable row level security;
create policy "coach manages own automations" on public.coach_automations for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

create table public.automation_sends (
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('welcome', 'missed', 'checkin')),
  -- What this send is for: 'once' for the welcome, the last workout for a nudge, the date for a reminder.
  period      text not null,
  sent_at     timestamptz not null default now(),
  primary key (coach_id, client_id, kind, period)
);
create index automation_sends_recent_idx on public.automation_sends (coach_id, sent_at desc);

alter table public.automation_sends enable row level security;
-- Only the job writes here; the coach reads what went out.
create policy "coach reads own sends" on public.automation_sends for select
  using (coach_id = auth.uid());

-- Sends whatever is due at p_now. Safe to run as often as you like: each message goes once.
create function public.run_automations(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  a        public.coach_automations;
  c        record;
  local_ts timestamp;
  sent     int := 0;
  coach    text;
  last_at  timestamptz;
  days     int;
  body     text;
begin
  for a in select * from public.coach_automations where welcome_on or missed_on or checkin_on loop
    begin
      local_ts := p_now at time zone a.timezone;
    exception when others then
      local_ts := p_now at time zone 'Europe/London';
    end;
    select split_part(full_name, ' ', 1) into coach from public.profiles where id = a.coach_id;

    for c in
      select cc.client_id, cc.started_at, cc.check_in_day, split_part(p.full_name, ' ', 1) as first_name
      from public.coach_clients cc join public.profiles p on p.id = cc.client_id
      where cc.coach_id = a.coach_id and cc.status = 'active'
    loop
      -- Welcome: joined in the last three days, and the coach hasn't written to them yet.
      if a.welcome_on and c.started_at > p_now - interval '3 days'
         and not exists (select 1 from public.messages m where m.coach_id = a.coach_id and m.client_id = c.client_id and m.sender_id = a.coach_id) then
        insert into public.automation_sends (coach_id, client_id, kind, period) values (a.coach_id, c.client_id, 'welcome', 'once') on conflict do nothing;
        if found then
          body := replace(replace(replace(a.welcome_body, '{first_name}', c.first_name), '{coach}', coalesce(coach, '')), '{days}', '');
          insert into public.messages (coach_id, client_id, sender_id, body) values (a.coach_id, c.client_id, a.coach_id, body);
          sent := sent + 1;
        end if;
      end if;

      if extract(hour from local_ts) < a.send_hour then continue; end if;

      -- Missed workouts: nothing finished for missed_days, and they have a program to do. Once per gap.
      if a.missed_on and exists (select 1 from public.programs pr where pr.client_id = c.client_id and pr.coach_id = a.coach_id) then
        select max(s.started_at) into last_at from public.sessions s where s.client_id = c.client_id and s.finished_at is not null;
        if coalesce(last_at, c.started_at) < p_now - make_interval(days => a.missed_days) then
          insert into public.automation_sends (coach_id, client_id, kind, period)
          values (a.coach_id, c.client_id, 'missed', coalesce(last_at::text, 'never')) on conflict do nothing;
          if found then
            days := floor(extract(epoch from p_now - coalesce(last_at, c.started_at)) / 86400);
            body := replace(replace(replace(a.missed_body, '{first_name}', c.first_name), '{coach}', coalesce(coach, '')), '{days}', days::text);
            insert into public.messages (coach_id, client_id, sender_id, body) values (a.coach_id, c.client_id, a.coach_id, body);
            sent := sent + 1;
          end if;
        end if;
      end if;

      -- Check-in reminder: today is their check-in day (0 = Monday) and nothing sent since yesterday.
      if a.checkin_on and (extract(isodow from local_ts)::int - 1) = c.check_in_day
         and not exists (select 1 from public.check_ins ci where ci.client_id = c.client_id and ci.submitted_at > p_now - interval '36 hours') then
        insert into public.automation_sends (coach_id, client_id, kind, period)
        values (a.coach_id, c.client_id, 'checkin', local_ts::date::text) on conflict do nothing;
        if found then
          body := replace(replace(replace(a.checkin_body, '{first_name}', c.first_name), '{coach}', coalesce(coach, '')), '{days}', '');
          insert into public.messages (coach_id, client_id, sender_id, body) values (a.coach_id, c.client_id, a.coach_id, body);
          sent := sent + 1;
        end if;
      end if;
    end loop;
  end loop;
  return sent;
end;
$$;
revoke execute on function public.run_automations(timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.run_automations(timestamptz) from anon, authenticated';
  end if;
end $$;

-- Every hour at five past, on Supabase (pg_cron). Skipped where pg_cron isn't available, e.g. the test database.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $job$select cron.schedule('apex-automatic-messages', '5 * * * *', 'select public.run_automations()')$job$;
  end if;
end $$;
$step2$;
    raise notice 'Automatic messages: added';
  else
    raise notice 'Automatic messages: already set up, skipped';
  end if;
end $outer$;

-- 3. Video form checks (20261103120000_form_checks.sql)
do $outer$
begin
  if to_regclass('public.form_checks') is null then
    execute $step3$
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
$step3$;
    raise notice 'Video form checks: added';
  else
    raise notice 'Video form checks: already set up, skipped';
  end if;
end $outer$;

-- What is in place now: every column should say true.
select
  to_regclass('public.progress_photos') is not null as check_ins,
  to_regclass('public.coach_automations') is not null as automatic_messages,
  to_regclass('public.form_checks') is not null as form_checks,
  (select count(*) = 2 from storage.buckets where id in ('progress-photos','form-videos')) as storage;
