-- Contracts and waivers, group classes with a waitlist, the gym team inbox, fibre/sugar/salt on food entries,
-- and the coach's quick answers for clients. Safe to run more than once.

-- ───────────── 1. contracts and waivers ─────────────

create table if not exists public.coach_agreements (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 2 and 80),
  body        text not null check (length(trim(body)) between 20 and 8000),
  required    boolean not null default true,
  version     integer not null default 1 check (version between 1 and 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists coach_agreements_coach_idx on public.coach_agreements (coach_id);

-- New wording is a new version: clients who signed the old one are asked again.
create or replace function public.agreement_version()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := old.version + case when new.title is distinct from old.title or new.body is distinct from old.body then 1 else 0 end;
    new.coach_id := old.coach_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists agreement_version on public.coach_agreements;
create trigger agreement_version before insert or update on public.coach_agreements
  for each row execute function public.agreement_version();

alter table public.coach_agreements enable row level security;
drop policy if exists "coach manages own agreements" on public.coach_agreements;
create policy "coach manages own agreements" on public.coach_agreements for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "client reads coach agreements" on public.coach_agreements;
create policy "client reads coach agreements" on public.coach_agreements for select
  using (active and public.is_my_coach(coach_id));

-- A signature keeps a copy of exactly what was signed, so it stands even if the coach edits or deletes the agreement.
create table if not exists public.agreement_signatures (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid references public.coach_agreements (id) on delete set null,
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  client_id     uuid not null references public.profiles (id) on delete cascade,
  version       integer not null,
  title         text not null,
  body          text not null,
  typed_name    text not null check (length(trim(typed_name)) between 2 and 80),
  signed_at     timestamptz not null default now(),
  unique (agreement_id, client_id, version)
);
create index if not exists agreement_signatures_coach_idx on public.agreement_signatures (coach_id, signed_at desc);
create index if not exists agreement_signatures_client_idx on public.agreement_signatures (client_id);

alter table public.agreement_signatures enable row level security;
-- Read only. Signing goes through sign_agreement; nobody can change or remove a signature.
drop policy if exists "both sides read signatures" on public.agreement_signatures;
create policy "both sides read signatures" on public.agreement_signatures for select
  using (client_id = auth.uid() or coach_id = auth.uid());

create or replace function public.sign_agreement(p_agreement uuid, p_name text)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  a public.coach_agreements;
  at timestamptz;
begin
  select * into a from public.coach_agreements where id = p_agreement and active;
  if not found or not public.is_my_coach(a.coach_id) then raise exception 'agreement not found' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'type your full name to sign' using errcode = '22023'; end if;
  insert into public.agreement_signatures (agreement_id, coach_id, client_id, version, title, body, typed_name)
  values (a.id, a.coach_id, auth.uid(), a.version, a.title, a.body, trim(p_name))
  on conflict (agreement_id, client_id, version) do nothing
  returning signed_at into at;
  return coalesce(at, now());
end;
$$;
revoke all on function public.sign_agreement(uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.sign_agreement(uuid, text) from anon';
    execute 'grant execute on function public.sign_agreement(uuid, text) to authenticated';
  end if;
end $$;

-- ───────────── 2. group classes with a waitlist ─────────────

create table if not exists public.group_classes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 2 and 60),
  starts_at   timestamptz not null,
  minutes     smallint not null default 45 check (minutes between 10 and 240),
  capacity    smallint not null check (capacity between 1 and 200),
  place       text not null default '' check (length(place) <= 120),
  note        text not null default '' check (length(note) <= 300),
  cancelled   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists group_classes_coach_idx on public.group_classes (coach_id, starts_at);

alter table public.group_classes enable row level security;
drop policy if exists "coach manages own classes" on public.group_classes;
create policy "coach manages own classes" on public.group_classes for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "client sees coach classes" on public.group_classes;
create policy "client sees coach classes" on public.group_classes for select
  using (public.is_my_coach(coach_id));

create table if not exists public.class_spots (
  class_id    uuid not null references public.group_classes (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  status      text not null check (status in ('booked', 'waitlist', 'cancelled')),
  joined_at   timestamptz not null default now(),
  primary key (class_id, client_id)
);
create index if not exists class_spots_client_idx on public.class_spots (client_id);

alter table public.class_spots enable row level security;
-- Read only: joining and leaving go through join_class and leave_class, so the waitlist stays fair.
drop policy if exists "read own or own class spots" on public.class_spots;
create policy "read own or own class spots" on public.class_spots for select
  using (client_id = auth.uid() or exists (select 1 from public.group_classes g where g.id = class_spots.class_id and g.coach_id = auth.uid()));

-- Moves people up from the waitlist, first come first served, while there's room.
create or replace function public.promote_waitlist(p_class uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cap smallint;
  taken int;
begin
  select capacity into cap from public.group_classes where id = p_class and not cancelled;
  if not found then return; end if;
  select count(*) into taken from public.class_spots where class_id = p_class and status = 'booked';
  if taken >= cap then return; end if;
  update public.class_spots s set status = 'booked'
   where s.class_id = p_class and s.client_id in (
     select w.client_id from public.class_spots w where w.class_id = p_class and w.status = 'waitlist' order by w.joined_at, w.client_id limit cap - taken);
end;
$$;
revoke all on function public.promote_waitlist(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.promote_waitlist(uuid) from anon, authenticated';
  end if;
end $$;

-- More room after the coach raises the capacity: the waitlist moves up.
create or replace function public.class_capacity_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.capacity > old.capacity then perform public.promote_waitlist(new.id); end if;
  return new;
end;
$$;
drop trigger if exists class_capacity_changed on public.group_classes;
create trigger class_capacity_changed after update of capacity on public.group_classes
  for each row execute function public.class_capacity_changed();

-- Client: book a place, or join the waitlist when it's full. Returns 'booked' or 'waitlist'.
create or replace function public.join_class(p_class uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  g public.group_classes;
  cur text;
  taken int;
  st text;
begin
  select * into g from public.group_classes where id = p_class for update;
  if not found or not public.is_my_coach(g.coach_id) then raise exception 'class not found' using errcode = '42501'; end if;
  if g.cancelled then raise exception 'this class is cancelled' using errcode = '22023'; end if;
  if g.starts_at <= now() then raise exception 'this class has already started' using errcode = '22023'; end if;
  select status into cur from public.class_spots where class_id = p_class and client_id = auth.uid();
  if cur in ('booked', 'waitlist') then return cur; end if;
  select count(*) into taken from public.class_spots where class_id = p_class and status = 'booked';
  st := case when taken < g.capacity then 'booked' else 'waitlist' end;
  insert into public.class_spots (class_id, client_id, status, joined_at) values (p_class, auth.uid(), st, now())
  on conflict (class_id, client_id) do update set status = excluded.status, joined_at = excluded.joined_at;
  return st;
end;
$$;

-- Client: give up a place (or leave the waitlist). Coach: take a client off (p_client). The next person moves up.
create or replace function public.leave_class(p_class uuid, p_client uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.group_classes;
  who uuid := coalesce(p_client, auth.uid());
begin
  select * into g from public.group_classes where id = p_class for update;
  if not found then raise exception 'class not found' using errcode = '42501'; end if;
  if p_client is not null and g.coach_id <> auth.uid() then raise exception 'not your class' using errcode = '42501'; end if;
  if p_client is null and not public.is_my_coach(g.coach_id) then raise exception 'class not found' using errcode = '42501'; end if;
  update public.class_spots set status = 'cancelled' where class_id = p_class and client_id = who and status <> 'cancelled';
  perform public.promote_waitlist(p_class);
end;
$$;

-- Client: upcoming classes from their coach, with how full each one is and their own place. No other names.
create or replace function public.class_list()
returns table (id uuid, title text, starts_at timestamptz, minutes smallint, capacity smallint, place text, note text, cancelled boolean,
               booked int, waiting int, my_status text, my_place int)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.title, g.starts_at, g.minutes, g.capacity, g.place, g.note, g.cancelled,
         (select count(*)::int from public.class_spots s where s.class_id = g.id and s.status = 'booked'),
         (select count(*)::int from public.class_spots s where s.class_id = g.id and s.status = 'waitlist'),
         me.status,
         case when me.status = 'waitlist' then
           (select count(*)::int from public.class_spots w where w.class_id = g.id and w.status = 'waitlist'
             and (w.joined_at, w.client_id) <= (me.joined_at, me.client_id)) end
    from public.group_classes g
    left join public.class_spots me on me.class_id = g.id and me.client_id = auth.uid()
   where public.is_my_coach(g.coach_id) and g.starts_at > now() - interval '2 hours'
   order by g.starts_at
   limit 60;
$$;

revoke all on function public.join_class(uuid) from public;
revoke all on function public.leave_class(uuid, uuid) from public;
revoke all on function public.class_list() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.join_class(uuid) from anon';
    execute 'revoke all on function public.leave_class(uuid, uuid) from anon';
    execute 'revoke all on function public.class_list() from anon';
    execute 'grant execute on function public.join_class(uuid) to authenticated';
    execute 'grant execute on function public.leave_class(uuid, uuid) to authenticated';
    execute 'grant execute on function public.class_list() to authenticated';
  end if;
end $$;

-- ───────────── 3. gym team inbox ─────────────

create table if not exists public.gym_messages (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists gym_messages_gym_idx on public.gym_messages (gym_id, created_at desc);

alter table public.gym_messages enable row level security;
drop policy if exists "gym reads team chat" on public.gym_messages;
create policy "gym reads team chat" on public.gym_messages for select
  using (gym_id = public.my_gym_id());
drop policy if exists "gym member writes team chat" on public.gym_messages;
create policy "gym member writes team chat" on public.gym_messages for insert
  with check (gym_id = public.my_gym_id() and sender_id = auth.uid());
drop policy if exists "sender deletes own team message" on public.gym_messages;
create policy "sender deletes own team message" on public.gym_messages for delete
  using (sender_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'gym_messages') then
    alter publication supabase_realtime add table public.gym_messages;
  end if;
end $$;

-- ───────────── 4. fibre, sugar and salt ─────────────

alter table public.food_entries add column if not exists fibre_g numeric(6, 1);
alter table public.food_entries add column if not exists sugar_g numeric(6, 1);
alter table public.food_entries add column if not exists salt_g  numeric(5, 2);
alter table public.food_entries drop constraint if exists food_entries_micros_check;
alter table public.food_entries add constraint food_entries_micros_check check (
  (fibre_g is null or fibre_g between 0 and 300) and (sugar_g is null or sugar_g between 0 and 1000) and (salt_g is null or salt_g between 0 and 100));

-- ───────────── 5. quick answers ─────────────

create table if not exists public.coach_answers (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  question    text not null check (length(trim(question)) between 4 and 160),
  answer      text not null check (length(trim(answer)) between 4 and 1500),
  created_at  timestamptz not null default now()
);
create index if not exists coach_answers_coach_idx on public.coach_answers (coach_id);

alter table public.coach_answers enable row level security;
drop policy if exists "coach manages own answers" on public.coach_answers;
create policy "coach manages own answers" on public.coach_answers for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "client reads coach answers" on public.coach_answers;
create policy "client reads coach answers" on public.coach_answers for select
  using (public.is_my_coach(coach_id));
