-- Booking calendar: the coach sets weekly hours; their clients book a call or a training session in a free slot.
-- Clients can see which slots are taken (public.booking_busy) but never who took them.
-- Mirrors packages/core/src/booking.ts.

create function public.is_my_coach(p_coach uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.coach_clients cc
    where cc.client_id = auth.uid() and cc.coach_id = p_coach and cc.status <> 'ended'
  );
$$;

create table public.coach_booking_settings (
  coach_id      uuid primary key references public.profiles (id) on delete cascade,
  slot_min      smallint not null default 30 check (slot_min in (15, 30, 45, 60)),
  notice_hours  smallint not null default 12 check (notice_hours between 0 and 168),
  timezone      text not null default 'Europe/London' check (length(timezone) between 1 and 64),
  -- [{ "weekday": 0-6 (0 = Monday), "start_min": minutes after midnight, "end_min": … }]
  windows       jsonb not null default '[]' check (jsonb_typeof(windows) = 'array' and jsonb_array_length(windows) <= 50),
  updated_at    timestamptz not null default now()
);

alter table public.coach_booking_settings enable row level security;
create policy "coach manages own hours" on public.coach_booking_settings for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "client reads coach hours" on public.coach_booking_settings for select
  using (public.is_my_coach(coach_id));

create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  kind        text not null default 'call' check (kind in ('call', 'session')),
  note        text check (length(note) <= 500),
  status      text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '4 hours')
);
-- One booking per slot: a second person booking the same time gets an error instead of a double booking.
create unique index bookings_one_per_slot on public.bookings (coach_id, starts_at) where status = 'booked';
create index bookings_client_idx on public.bookings (client_id, starts_at);

alter table public.bookings enable row level security;
create policy "coach manages own bookings" on public.bookings for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
create policy "client reads own bookings" on public.bookings for select
  using (client_id = auth.uid());
create policy "client books with own coach" on public.bookings for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id) and starts_at > now() and status = 'booked');
create policy "client cancels own bookings" on public.bookings for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- A client can only cancel: everything else stays as it was.
create function public.guard_booking_change()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.bookings;
begin
  if auth.uid() is null or auth.uid() = old.coach_id then return new; end if;
  r := old;
  if new.status = 'cancelled' then r.status := 'cancelled'; end if;
  return r;
end;
$$;
create trigger guard_booking_change before update on public.bookings
  for each row execute function public.guard_booking_change();

-- Taken slots of a coach, without who took them. Only the coach and their clients can ask.
create function public.booking_busy(p_coach uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select b.starts_at, b.ends_at from public.bookings b
  where b.coach_id = p_coach and b.status = 'booked' and b.ends_at > p_from and b.starts_at < p_to
    and (auth.uid() = p_coach or public.is_my_coach(p_coach))
  order by b.starts_at;
$$;
revoke execute on function public.booking_busy(uuid, timestamptz, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.booking_busy(uuid, timestamptz, timestamptz) from anon';
    execute 'grant execute on function public.booking_busy(uuid, timestamptz, timestamptz) to authenticated';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
