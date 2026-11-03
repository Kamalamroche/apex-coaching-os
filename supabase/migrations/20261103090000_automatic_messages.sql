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
