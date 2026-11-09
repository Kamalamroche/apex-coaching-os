-- 1:1 sessions: cancellation policy, session packs (credits), the register, weekly slots and booking reminders.
-- Mirrors packages/core/src/sessions.ts. Needs 20261103180000_bookings.sql first; the reminders part needs
-- 20261117090000_reminders.sql. Safe to run more than once.

-- Policy: clients cancel for free until cancel_hours before; later, a training session still uses a credit.
alter table public.coach_booking_settings add column if not exists cancel_hours smallint not null default 24;
alter table public.coach_booking_settings add column if not exists require_credits boolean not null default false;
alter table public.coach_booking_settings drop constraint if exists coach_booking_settings_cancel_hours_check;
alter table public.coach_booking_settings add constraint coach_booking_settings_cancel_hours_check check (cancel_hours between 0 and 168);

-- What happened to each booking.
alter table public.bookings add column if not exists attendance   text;
alter table public.bookings add column if not exists cancelled_by text;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists late         boolean not null default false;
alter table public.bookings add column if not exists waived       boolean not null default false;
alter table public.bookings add column if not exists repeat_id    uuid;
alter table public.bookings drop constraint if exists bookings_attendance_check;
alter table public.bookings add constraint bookings_attendance_check check (attendance in ('attended', 'no_show'));
alter table public.bookings drop constraint if exists bookings_cancelled_by_check;
alter table public.bookings add constraint bookings_cancelled_by_check check (cancelled_by in ('client', 'coach'));

-- Clients book plain bookings only: no outcome, no waiver.
drop policy if exists "client books with own coach" on public.bookings;
create policy "client books with own coach" on public.bookings for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id) and starts_at > now() and status = 'booked'
              and attendance is null and cancelled_by is null and not late and not waived);

-- A client can only cancel, and the database decides whether that was late. The coach can change anything;
-- when the coach cancels, it is recorded as theirs and never late.
create or replace function public.guard_booking_change()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r     public.bookings;
  hours smallint;
begin
  if auth.uid() is null or current_setting('apex.moving_booking', true) = 'on' then return new; end if;
  if auth.uid() = old.coach_id then
    if new.status = 'cancelled' and old.status = 'booked' then
      new.cancelled_by := 'coach'; new.cancelled_at := now(); new.late := false;
    end if;
    return new;
  end if;
  r := old;
  if new.status = 'cancelled' and old.status = 'booked' then
    select s.cancel_hours into hours from public.coach_booking_settings s where s.coach_id = old.coach_id;
    hours := coalesce(hours, 24);
    r.status := 'cancelled';
    r.cancelled_by := 'client';
    r.cancelled_at := now();
    r.late := old.kind = 'session' and hours > 0 and old.starts_at - now() < make_interval(hours => hours);
  end if;
  return r;
end;
$$;

-- Move a booking to another time instead of cancelling it. Clients can move until the cancel window closes
-- (calls any time before they start); the coach can always move. A taken slot fails with unique_violation.
create or replace function public.move_booking(p_id uuid, p_starts timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b     public.bookings;
  hours smallint;
begin
  select * into b from public.bookings where id = p_id and status = 'booked' and (client_id = auth.uid() or coach_id = auth.uid()) for update;
  if not found then raise exception 'booking not found' using errcode = '42501'; end if;
  if p_starts <= now() then raise exception 'pick a time in the future' using errcode = '22023'; end if;
  if auth.uid() <> b.coach_id then
    if not public.is_my_coach(b.coach_id) then raise exception 'not your coach' using errcode = '42501'; end if;
    select s.cancel_hours into hours from public.coach_booking_settings s where s.coach_id = b.coach_id;
    hours := coalesce(hours, 24);
    if b.starts_at <= now() or (b.kind = 'session' and hours > 0 and b.starts_at - now() < make_interval(hours => hours)) then
      raise exception 'too late to move this booking' using errcode = '42501';
    end if;
  end if;
  perform set_config('apex.moving_booking', 'on', true);
  update public.bookings set starts_at = p_starts, ends_at = p_starts + (b.ends_at - b.starts_at) where id = p_id;
  perform set_config('apex.moving_booking', 'off', true);
end;
$$;
revoke all on function public.move_booking(uuid, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.move_booking(uuid, timestamptz) from anon';
    execute 'grant execute on function public.move_booking(uuid, timestamptz) to authenticated';
  end if;
end $$;

-- Session packs: sessions a client paid for (or was given). Each booked training session uses one.
create table if not exists public.session_packs (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  sessions    smallint not null check (sessions between 1 and 100),
  price_pence integer not null default 0 check (price_pence between 0 and 10000000),
  paid_via    text not null default 'cash' check (paid_via in ('cash', 'bank', 'card', 'free')),
  source      text not null default 'purchase' check (source in ('purchase', 'referral', 'intro', 'gift')),
  bought_at   timestamptz not null default now(),
  expires_at  timestamptz,
  note        text check (length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (expires_at is null or expires_at > bought_at)
);
create index if not exists session_packs_client_idx on public.session_packs (client_id, bought_at);
create index if not exists session_packs_coach_idx on public.session_packs (coach_id, bought_at);

alter table public.session_packs enable row level security;
drop policy if exists "coach manages packs" on public.session_packs;
create policy "coach manages packs" on public.session_packs for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
drop policy if exists "client reads own packs" on public.session_packs;
create policy "client reads own packs" on public.session_packs for select
  using (client_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'session_packs') then
    alter publication supabase_realtime add table public.session_packs;
  end if;
end $$;

-- Booking reminders: the push function already calls take_checkin_alerts every minute, so they ride along there.
-- Clients get one the day before (24 h) and one 2 hours before, unless they booked inside that time.
alter table public.push_reminder_sends drop constraint if exists push_reminder_sends_kind_check;
alter table public.push_reminder_sends add constraint push_reminder_sends_kind_check check (kind in ('workout', 'habits', 'checkin', 'booking'));

create or replace function public.take_checkin_alerts(p_now timestamptz default now())
returns table (user_id uuid, kind text, title text, body text, url text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r     record;
  tag   text;
  local timestamp;
  today date;
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

  for r in
    select b.id, b.client_id, b.kind as bkind, b.starts_at, b.created_at,
           split_part(c.full_name, ' ', 1) as coach_first,
           coalesce(pr.timezone, 'Europe/London') as tz,
           (select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = b.client_id) as subs
    from public.bookings b
    join public.profiles c on c.id = b.coach_id
    left join public.push_reminders pr on pr.user_id = b.client_id
    where b.status = 'booked' and b.starts_at > p_now and b.starts_at <= p_now + interval '24 hours'
      and coalesce(pr.alerts_on, true)
      and exists (select 1 from public.push_subscriptions s where s.user_id = b.client_id)
  loop
    tag := null;
    if r.starts_at <= p_now + interval '2 hours' then
      if r.created_at < r.starts_at - interval '2 hours' then tag := '2h'; end if;
    elsif r.created_at < r.starts_at - interval '24 hours' then
      tag := '24h';
    end if;
    continue when tag is null;
    insert into public.push_reminder_sends (user_id, kind, ref) values (r.client_id, 'booking', r.id::text || ':' || tag) on conflict do nothing;
    if found then
      begin
        local := r.starts_at at time zone r.tz; today := (p_now at time zone r.tz)::date;
      exception when others then
        local := r.starts_at at time zone 'Europe/London'; today := (p_now at time zone 'Europe/London')::date;
      end;
      user_id := r.client_id; kind := 'booking';
      title := (case when r.bkind = 'session' then 'Session' else 'Call' end)
               || (case when local::date = today then ' today at ' else ' tomorrow at ' end) || to_char(local, 'HH24:MI');
      body := 'With ' || coalesce(nullif(r.coach_first, ''), 'your coach') || '. '
              || (case when tag = '2h' then 'See you soon.' else 'Can''t make it? Tap to move or cancel it.' end);
      url := '/client/?open=more'; subscriptions := r.subs;
      return next;
    end if;
  end loop;
end $$;

revoke all on function public.take_checkin_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.take_checkin_alerts(timestamptz) to service_role;
