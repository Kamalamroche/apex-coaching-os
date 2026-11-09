-- Reminders and coach alerts, sent by the push function (needs 20261115090000_push_notifications.sql first).
--   Clients: a reminder on training days at a time they choose ("Lower A today · 45 min"), and an optional
--   evening nudge to log water, food and habits.
--   Coaches: a notification when a client sends their weekly check-in.
-- Safe to run more than once.

-- One row per person who changed a reminder setting; without a row the defaults below apply.
create table if not exists public.push_reminders (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  workout_on   boolean not null default true,
  -- Minutes after midnight in the person's time zone.
  workout_at   smallint not null default 450 check (workout_at between 0 and 1439),
  habits_on    boolean not null default false,
  habits_at    smallint not null default 1200 check (habits_at between 0 and 1439),
  alerts_on    boolean not null default true,
  timezone     text not null default 'Europe/London' check (length(timezone) between 1 and 64),
  updated_at   timestamptz not null default now()
);
alter table public.push_reminders enable row level security;
drop policy if exists "people manage own reminders" on public.push_reminders;
create policy "people manage own reminders" on public.push_reminders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What has been sent, so each reminder goes once a day and each check-in alert once.
create table if not exists public.push_reminder_sends (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  kind     text not null check (kind in ('workout', 'habits', 'checkin')),
  ref      text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.push_reminder_sends enable row level security;

-- Today's workout for a client: newest program, its newest published version, today's weekday in the week
-- that has passed since the program started (or any week with that weekday). Null on a rest day.
create or replace function public.todays_workout(p_client uuid, p_day date)
returns table (name text, minutes int)
language sql stable security definer set search_path = '' as $$
  with prog as (
    select pr.id, pr.weeks, pr.created_at from public.programs pr where pr.client_id = p_client order by pr.created_at desc limit 1
  ), ver as (
    select v.id from public.program_versions v join prog on v.program_id = prog.id
    where v.published_at is not null order by v.version desc limit 1
  ), wk as (
    select least(prog.weeks, greatest(1, ((p_day - prog.created_at::date) / 7) + 1)) as n from prog
  )
  select w.name, w.est_minutes from public.workouts w, ver, wk
  where w.program_version_id = ver.id and w.day_index = (extract(isodow from p_day)::int - 1)
  order by (w.week = wk.n) desc, abs(w.week - wk.n), w.week
  limit 1;
$$;

-- Reminders due now. Each one is recorded as it's handed out, so a second run in the same minute sends nothing.
create or replace function public.take_push_reminders(p_now timestamptz default now())
returns table (user_id uuid, kind text, title text, body text, url text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r        record;
  local_ts timestamp;
  mins     int;
  w        record;
begin
  for r in
    select p.id, p.role::text as role,
           coalesce(pr.workout_on, true) as workout_on, coalesce(pr.workout_at, 450) as workout_at,
           coalesce(pr.habits_on, false) as habits_on, coalesce(pr.habits_at, 1200) as habits_at,
           coalesce(pr.timezone, 'Europe/London') as tz,
           (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = p.id) as subs
    from public.profiles p
    left join public.push_reminders pr on pr.user_id = p.id
    where p.role = 'client' and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  loop
    begin
      local_ts := p_now at time zone r.tz;
    exception when others then
      local_ts := p_now at time zone 'Europe/London';
    end;
    mins := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;

    -- Workout: from the chosen time until 3 hours after, on a training day, unless they've already trained today.
    if r.workout_on and mins >= r.workout_at and mins < r.workout_at + 180 then
      select * into w from public.todays_workout(r.id, local_ts::date);
      if w.name is not null
         and not exists (select 1 from public.sessions s where s.client_id = r.id and s.finished_at is not null
                         and (s.finished_at at time zone r.tz)::date = local_ts::date) then
        insert into public.push_reminder_sends (user_id, kind, ref) values (r.id, 'workout', local_ts::date::text) on conflict do nothing;
        if found then
          user_id := r.id; kind := 'workout';
          title := w.name || ' today';
          body := coalesce(w.minutes::text || ' min. ', '') || 'Tap to see your session.';
          url := '/client/?open=today'; subscriptions := r.subs;
          return next;
        end if;
      end if;
    end if;

    -- Evening log: food, water and habits.
    if r.habits_on and mins >= r.habits_at and mins < r.habits_at + 180 then
      insert into public.push_reminder_sends (user_id, kind, ref) values (r.id, 'habits', local_ts::date::text) on conflict do nothing;
      if found then
        user_id := r.id; kind := 'habits';
        title := 'Close out your day';
        body := 'Log your food, water and habits. It takes a minute.';
        url := '/client/?open=today'; subscriptions := r.subs;
        return next;
      end if;
    end if;
  end loop;
end $$;

-- Check-ins sent in the last hour that the coach hasn't been told about.
create or replace function public.take_checkin_alerts(p_now timestamptz default now())
returns table (user_id uuid, kind text, title text, body text, url text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select ci.id, cc.coach_id, split_part(p.full_name, ' ', 1) as first_name, ci.weight_kg,
           (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = cc.coach_id) as subs
    from public.check_ins ci
    join public.coach_clients cc on cc.client_id = ci.client_id and cc.status <> 'ended'
    join public.profiles p on p.id = ci.client_id
    left join public.push_reminders pr on pr.user_id = cc.coach_id
    where ci.submitted_at > p_now - interval '1 hour'
      and coalesce(pr.alerts_on, true)
      and exists (select 1 from public.push_subscriptions s where s.user_id = cc.coach_id)
  loop
    insert into public.push_reminder_sends (user_id, kind, ref) values (r.coach_id, 'checkin', r.id::text) on conflict do nothing;
    if found then
      user_id := r.coach_id; kind := 'checkin';
      title := r.first_name || ' sent a check-in';
      body := coalesce('Weight ' || r.weight_kg::text || ' kg. ', '') || 'Tap to review it.';
      url := '/coach/?open=clients'; subscriptions := r.subs;
      return next;
    end if;
  end loop;
end $$;

revoke all on function public.todays_workout(uuid, date) from public, anon, authenticated;
revoke all on function public.take_push_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.take_checkin_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.todays_workout(uuid, date) to service_role;
grant execute on function public.take_push_reminders(timestamptz) to service_role;
grant execute on function public.take_checkin_alerts(timestamptz) to service_role;
