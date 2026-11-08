-- Growth: a coach's public page (the "Train with me" link points at it), requests to train from people who
-- aren't clients yet, and clients inviting a friend with their own code so the coach sees who sent them.
-- The public page shows only what the coach wrote. Nothing about clients ever leaves the database through it.
-- Mirrors packages/core/src/growth.ts. Needs public.is_my_coach() from 20261103180000_bookings.sql
-- and public.team_name() from 20261109090000_team.sql.

create table if not exists public.coach_pages (
  coach_id      uuid primary key references public.profiles (id) on delete cascade,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 30),
  headline      text not null default '' check (length(headline) <= 80),
  bio           text not null default '' check (length(bio) <= 600),
  city          text not null default '' check (length(city) <= 60),
  specialties   text[] not null default '{}' check (cardinality(specialties) <= 6),
  modes         text[] not null default '{online}' check (modes <@ array['online', 'hybrid', 'in_person']),
  show_clients  boolean not null default false,
  published     boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.coach_pages enable row level security;
drop policy if exists "coach manages own page" on public.coach_pages;
create policy "coach manages own page" on public.coach_pages for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "clients read their coach's page" on public.coach_pages;
create policy "clients read their coach's page" on public.coach_pages for select
  using (public.is_my_coach(coach_id));

-- A client's own friend code, one per coach. The link carries the code, never the client's id.
create table if not exists public.referral_codes (
  client_id   uuid not null references public.profiles (id) on delete cascade,
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at  timestamptz not null default now(),
  primary key (client_id, coach_id)
);

alter table public.referral_codes enable row level security;
drop policy if exists "client sees own code" on public.referral_codes;
create policy "client sees own code" on public.referral_codes for select
  using (client_id = auth.uid());

create table if not exists public.join_requests (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 60),
  email         text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 200),
  goal          text not null default '' check (length(goal) <= 40),
  message       text not null default '' check (length(message) <= 400),
  ref_client    uuid references public.profiles (id) on delete set null,
  status        text not null default 'new' check (status in ('new', 'invited', 'joined', 'declined')),
  invite_token  uuid references public.invites (token) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists join_requests_coach_idx on public.join_requests (coach_id, created_at desc);
create index if not exists join_requests_ref_idx on public.join_requests (ref_client);

alter table public.join_requests enable row level security;
-- No insert policy: people send requests through request_to_train(), which checks and limits them.
drop policy if exists "coach reads own requests" on public.join_requests;
create policy "coach reads own requests" on public.join_requests for select
  using (coach_id = auth.uid());
drop policy if exists "coach answers own requests" on public.join_requests;
create policy "coach answers own requests" on public.join_requests for update
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach removes own requests" on public.join_requests;
create policy "coach removes own requests" on public.join_requests for delete
  using (coach_id = auth.uid());

-- Anyone, signed in or not: a published page by its address.
create or replace function public.public_coach_page(p_slug text)
returns table (slug text, name text, headline text, bio text, city text, specialties text[], modes text[], clients int)
language sql stable security definer set search_path = ''
as $$
  select cp.slug, pr.full_name, cp.headline, cp.bio, cp.city, cp.specialties, cp.modes,
    case when cp.show_clients then (select count(*)::int from public.coach_clients cc where cc.coach_id = cp.coach_id and cc.status = 'active') end
  from public.coach_pages cp
  join public.profiles pr on pr.id = cp.coach_id
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- Anyone: ask to train with a coach. Limited so a page can't be flooded.
create or replace function public.request_to_train(p_slug text, p_name text, p_email text, p_goal text default '', p_message text default '', p_ref text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_coach uuid;
  v_ref uuid;
  v_email text := lower(trim(p_email));
begin
  select cp.coach_id into v_coach from public.coach_pages cp where cp.slug = lower(trim(p_slug)) and cp.published;
  if v_coach is null then
    raise exception 'This coach page is not open right now.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.email = v_email and r.status in ('new', 'invited')) >= 1 then
    raise exception 'You have already asked. Your coach will be in touch.' using errcode = '23505';
  end if;
  if (select count(*) from public.join_requests r where r.coach_id = v_coach and r.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Lots of people are asking right now. Try again in an hour.' using errcode = '54000';
  end if;
  if p_ref is not null then
    select rc.client_id into v_ref from public.referral_codes rc where rc.code = p_ref and rc.coach_id = v_coach;
  end if;
  insert into public.join_requests (coach_id, name, email, goal, message, ref_client)
  values (v_coach, trim(p_name), v_email, left(coalesce(trim(p_goal), ''), 40), coalesce(trim(p_message), ''), v_ref);
end;
$$;

-- Client: my friend code for my coach, made the first time I ask.
create or replace function public.my_referral_code(p_coach uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_my_coach(p_coach) then
    raise exception 'Only your own coach''s clients can invite friends.' using errcode = '42501';
  end if;
  select rc.code into v_code from public.referral_codes rc where rc.client_id = auth.uid() and rc.coach_id = p_coach;
  while v_code is null loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    if exists (select 1 from public.referral_codes rc where rc.code = v_code) then
      v_code := null;
    end if;
  end loop;
  insert into public.referral_codes (client_id, coach_id, code) values (auth.uid(), p_coach, v_code)
  on conflict (client_id, coach_id) do nothing;
  return (select rc.code from public.referral_codes rc where rc.client_id = auth.uid() and rc.coach_id = p_coach);
end;
$$;

-- Client: how many friends I sent asked to train, and how many joined. No names.
create or replace function public.my_referrals(p_coach uuid)
returns table (asked int, joined int)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where r.status <> 'declined')::int, count(*) filter (where r.status = 'joined')::int
  from public.join_requests r
  where r.coach_id = p_coach and r.ref_client = auth.uid();
$$;

-- Coach: requests with the inviting client's short name.
create or replace function public.coach_join_requests()
returns table (id uuid, name text, email text, goal text, message text, status text, created_at timestamptz, referred_by text, invite_token uuid)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.email, r.goal, r.message, r.status, r.created_at,
    case when r.ref_client is not null then public.team_name(p.full_name) end, r.invite_token
  from public.join_requests r
  left join public.profiles p on p.id = r.ref_client
  where r.coach_id = auth.uid()
  order by r.created_at desc
  limit 200;
$$;

-- When the invite sent for a request is accepted, the request shows as joined.
create or replace function public.join_request_joined()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.accepted_by is not null and old.accepted_by is null then
    update public.join_requests set status = 'joined' where invite_token = new.token;
  end if;
  return new;
end;
$$;
drop trigger if exists join_request_joined on public.invites;
create trigger join_request_joined after update of accepted_by on public.invites
  for each row execute function public.join_request_joined();

revoke execute on function public.my_referral_code(uuid) from public;
revoke execute on function public.my_referrals(uuid) from public;
revoke execute on function public.coach_join_requests() from public;
revoke execute on function public.join_request_joined() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_coach_page(text) to anon, authenticated';
    execute 'grant execute on function public.request_to_train(text, text, text, text, text, text) to anon, authenticated';
    execute 'grant execute on function public.my_referral_code(uuid) to authenticated';
    execute 'grant execute on function public.my_referrals(uuid) to authenticated';
    execute 'grant execute on function public.coach_join_requests() to authenticated';
  end if;
end $$;
