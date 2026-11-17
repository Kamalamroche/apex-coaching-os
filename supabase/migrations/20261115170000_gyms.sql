-- Gyms: several trainers under one business account, with owner, manager and trainer roles.
-- The owner starts the gym and invites trainers and managers by link. Owner and managers see every trainer's clients
-- (a summary: sessions, programme name, last check-in date, never body numbers or photos), hand a client over to another
-- trainer, and share a client with a second trainer. Trainers see their own clients and the ones shared with them.
-- Nothing here widens the existing per-coach rules: a shared trainer or a manager reads the summary through the
-- functions below, and only the client's main trainer changes their plan or chats with them.
-- Every write goes through a function that checks the caller's role. Mirrors packages/core/src/gym.ts.
-- Safe to run more than once.

create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 60),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- One gym per trainer.
create table if not exists public.gym_members (
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  coach_id   uuid not null unique references public.profiles (id) on delete cascade,
  role       text not null check (role in ('owner', 'manager', 'trainer')),
  joined_at  timestamptz not null default now(),
  primary key (gym_id, coach_id)
);

create table if not exists public.gym_invites (
  token        uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  role         text not null check (role in ('manager', 'trainer')),
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_by  uuid references public.profiles (id) on delete set null,
  accepted_at  timestamptz
);
create index if not exists gym_invites_gym_idx on public.gym_invites (gym_id);

-- A second trainer who can follow a client's progress. The main trainer stays in coach_clients.
create table if not exists public.gym_client_shares (
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  shared_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (client_id, coach_id)
);
create index if not exists gym_client_shares_gym_idx on public.gym_client_shares (gym_id);

-- The signed-in trainer's gym and role. SECURITY DEFINER so policies don't recurse into gym_members.
create or replace function public.my_gym_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select gm.gym_id from public.gym_members gm where gm.coach_id = auth.uid() $$;

create or replace function public.my_gym_role()
returns text language sql stable security definer set search_path = ''
as $$ select gm.role from public.gym_members gm where gm.coach_id = auth.uid() $$;

alter table public.gyms              enable row level security;
alter table public.gym_members       enable row level security;
alter table public.gym_invites       enable row level security;
alter table public.gym_client_shares enable row level security;

-- Read only, and only inside your own gym. No insert, update or delete policies: writes go through the functions.
drop policy if exists "members read own gym" on public.gyms;
create policy "members read own gym" on public.gyms for select using (id = public.my_gym_id());
drop policy if exists "members read own team" on public.gym_members;
create policy "members read own team" on public.gym_members for select using (gym_id = public.my_gym_id());
drop policy if exists "leads read open invites" on public.gym_invites;
create policy "leads read open invites" on public.gym_invites for select
  using (gym_id = public.my_gym_id() and public.my_gym_role() in ('owner', 'manager'));
drop policy if exists "members read shares" on public.gym_client_shares;
create policy "members read shares" on public.gym_client_shares for select using (gym_id = public.my_gym_id());

-- ───── reading ─────

create or replace function public.my_gym()
returns table (id uuid, name text, my_role text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, gm.role from public.gym_members gm join public.gyms g on g.id = gm.gym_id where gm.coach_id = auth.uid();
$$;

create or replace function public.gym_team()
returns table (coach_id uuid, full_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select gm.coach_id, p.full_name, gm.role, gm.joined_at
    from public.gym_members gm join public.profiles p on p.id = gm.coach_id
   where gm.gym_id = public.my_gym_id();
$$;

-- Leads: every trainer's clients. Trainers: their own and the ones shared with them.
create or replace function public.gym_clients()
returns table (
  client_id uuid, client_name text, trainer_id uuid, trainer_name text, mode text, started_at timestamptz,
  last_session timestamptz, sessions_7 int, sessions_28 int, program_name text, last_check_in timestamptz, shared_with jsonb
)
language sql stable security definer set search_path = ''
as $$
  with me as (select gm.gym_id, gm.role from public.gym_members gm where gm.coach_id = auth.uid()),
  linked as (
    select cc.client_id, cc.coach_id, cc.mode::text as mode, cc.started_at, me.gym_id
      from public.coach_clients cc
      join public.gym_members gm on gm.coach_id = cc.coach_id
      join me on me.gym_id = gm.gym_id
     where cc.status <> 'ended'
       and (me.role in ('owner', 'manager') or cc.coach_id = auth.uid()
            or exists (select 1 from public.gym_client_shares s where s.gym_id = me.gym_id and s.client_id = cc.client_id and s.coach_id = auth.uid()))
  )
  select l.client_id, pc.full_name, l.coach_id, pt.full_name, l.mode, l.started_at,
    (select max(s.finished_at) from public.sessions s where s.client_id = l.client_id and s.finished_at is not null),
    (select count(*)::int from public.sessions s where s.client_id = l.client_id and s.finished_at >= now() - interval '7 days'),
    (select count(*)::int from public.sessions s where s.client_id = l.client_id and s.finished_at >= now() - interval '28 days'),
    (select p.name from public.programs p where p.client_id = l.client_id order by p.created_at desc limit 1),
    (select max(ci.submitted_at) from public.check_ins ci where ci.client_id = l.client_id),
    coalesce((select jsonb_agg(jsonb_build_object('id', sh.coach_id, 'name', ps.full_name) order by ps.full_name)
                from public.gym_client_shares sh join public.profiles ps on ps.id = sh.coach_id
               where sh.gym_id = l.gym_id and sh.client_id = l.client_id), '[]'::jsonb)
    from linked l
    join public.profiles pc on pc.id = l.client_id
    join public.profiles pt on pt.id = l.coach_id;
$$;

-- ───── running the gym ─────

create or replace function public.create_gym(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_gym uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach') then
    raise exception 'Only a coach account can start a gym' using errcode = '42501';
  end if;
  if exists (select 1 from public.gym_members gm where gm.coach_id = auth.uid()) then
    raise exception 'You are already in a gym' using errcode = '23505';
  end if;
  insert into public.gyms (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_gym;
  insert into public.gym_members (gym_id, coach_id, role) values (v_gym, auth.uid(), 'owner');
  return v_gym;
end;
$$;

create or replace function public.rename_gym(p_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_gym_role() is distinct from 'owner' then raise exception 'Only the owner can rename the gym' using errcode = '42501'; end if;
  update public.gyms set name = trim(p_name) where id = public.my_gym_id();
end;
$$;

-- Closes the gym. Every trainer keeps their own clients.
create or replace function public.close_gym()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_gym_role() is distinct from 'owner' then raise exception 'Only the owner can close the gym' using errcode = '42501'; end if;
  delete from public.gyms where id = public.my_gym_id();
end;
$$;

create or replace function public.create_gym_invite(p_role text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_role text := public.my_gym_role(); v_token uuid;
begin
  if p_role not in ('manager', 'trainer') then raise exception 'Unknown role' using errcode = '22023'; end if;
  if v_role is null or v_role = 'trainer' or (p_role = 'manager' and v_role <> 'owner') then
    raise exception 'You can''t invite a %', p_role using errcode = '42501';
  end if;
  if (select count(*) from public.gym_invites i where i.gym_id = public.my_gym_id() and i.accepted_by is null and i.expires_at > now()) >= 20 then
    raise exception 'You have 20 open invites. Cancel some first.' using errcode = '54000';
  end if;
  insert into public.gym_invites (gym_id, role, created_by) values (public.my_gym_id(), p_role, auth.uid()) returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.revoke_gym_invite(p_token uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(public.my_gym_role(), '') not in ('owner', 'manager') then raise exception 'Only the owner or a manager can cancel invites' using errcode = '42501'; end if;
  delete from public.gym_invites where token = p_token and gym_id = public.my_gym_id() and accepted_by is null;
end;
$$;

-- A coach opening an invite link joins the gym. Returns the gym's name.
create or replace function public.accept_gym_invite(p_token uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_inv public.gym_invites%rowtype; v_mine uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach') then
    raise exception 'Only a coach account can join a gym' using errcode = '42501';
  end if;
  select * into v_inv from public.gym_invites i where i.token = p_token for update;
  select gm.gym_id into v_mine from public.gym_members gm where gm.coach_id = auth.uid();
  if v_inv.token is not null and v_mine = v_inv.gym_id then
    return (select g.name from public.gyms g where g.id = v_inv.gym_id);
  end if;
  if v_inv.token is null or v_inv.accepted_by is not null or v_inv.expires_at < now() then
    raise exception 'This gym invite has expired or has already been used. Ask for a new link.' using errcode = 'P0002';
  end if;
  if v_mine is not null then
    raise exception 'You are already in another gym. Leave it first.' using errcode = '23505';
  end if;
  insert into public.gym_members (gym_id, coach_id, role) values (v_inv.gym_id, auth.uid(), v_inv.role);
  update public.gym_invites set accepted_by = auth.uid(), accepted_at = now() where token = p_token;
  return (select g.name from public.gyms g where g.id = v_inv.gym_id);
end;
$$;

create or replace function public.set_gym_role(p_coach uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_gym_role() is distinct from 'owner' then raise exception 'Only the owner can change roles' using errcode = '42501'; end if;
  if p_role not in ('manager', 'trainer') then raise exception 'Unknown role' using errcode = '22023'; end if;
  update public.gym_members set role = p_role
   where gym_id = public.my_gym_id() and coach_id = p_coach and role <> 'owner';
  if not found then raise exception 'That trainer isn''t in your gym' using errcode = 'P0002'; end if;
end;
$$;

-- Removes a trainer (or yourself, to leave). They keep their own clients; shares to and from them end.
create or replace function public.remove_gym_member(p_coach uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_gym uuid := public.my_gym_id(); v_me text := public.my_gym_role(); v_them text;
begin
  select gm.role into v_them from public.gym_members gm where gm.gym_id = v_gym and gm.coach_id = p_coach;
  if v_gym is null or v_them is null then raise exception 'That trainer isn''t in your gym' using errcode = 'P0002'; end if;
  if v_them = 'owner' then raise exception 'The owner can''t leave. Close the gym instead.' using errcode = '42501'; end if;
  if p_coach <> auth.uid() and not (v_me = 'owner' or (v_me = 'manager' and v_them = 'trainer')) then
    raise exception 'You can''t remove this person' using errcode = '42501';
  end if;
  delete from public.gym_client_shares s
   where s.gym_id = v_gym
     and (s.coach_id = p_coach
          or s.client_id in (select cc.client_id from public.coach_clients cc where cc.coach_id = p_coach and cc.status <> 'ended'));
  delete from public.gym_members where gym_id = v_gym and coach_id = p_coach;
end;
$$;

-- Hands a client over to another trainer in the gym: the new trainer becomes their coach and takes over their
-- programme, so the client keeps training from it. The chat with the old trainer stays private to them.
create or replace function public.hand_over_gym_client(p_client uuid, p_to uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_gym uuid := public.my_gym_id(); v_from uuid; v_mode public.training_mode; v_goal text;
begin
  if coalesce(public.my_gym_role(), '') not in ('owner', 'manager') then raise exception 'Only the owner or a manager can hand clients over' using errcode = '42501'; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id = v_gym and gm.coach_id = p_to) then
    raise exception 'That trainer isn''t in your gym' using errcode = 'P0002';
  end if;
  select cc.coach_id, cc.mode, cc.goal into v_from, v_mode, v_goal
    from public.coach_clients cc join public.gym_members gm on gm.coach_id = cc.coach_id and gm.gym_id = v_gym
   where cc.client_id = p_client and cc.status <> 'ended'
   order by cc.started_at desc limit 1;
  if v_from is null then raise exception 'That client isn''t coached in your gym' using errcode = 'P0002'; end if;
  if v_from = p_to then return; end if;
  update public.coach_clients set status = 'ended' where coach_id = v_from and client_id = p_client;
  insert into public.coach_clients (coach_id, client_id, status, mode, goal, started_at)
  values (p_to, p_client, 'active', v_mode, v_goal, now())
  on conflict (coach_id, client_id) do update set status = 'active', mode = excluded.mode, goal = coalesce(excluded.goal, public.coach_clients.goal), started_at = now();
  update public.programs set coach_id = p_to where client_id = p_client and coach_id = v_from;
  delete from public.gym_client_shares where client_id = p_client and coach_id = p_to;
end;
$$;

-- Shares a client with a second trainer, or stops sharing. Leads share anyone; a trainer shares their own clients.
create or replace function public.share_gym_client(p_client uuid, p_with uuid, p_on boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_gym uuid := public.my_gym_id(); v_main uuid;
begin
  if v_gym is null then raise exception 'You aren''t in a gym' using errcode = '42501'; end if;
  select cc.coach_id into v_main
    from public.coach_clients cc join public.gym_members gm on gm.coach_id = cc.coach_id and gm.gym_id = v_gym
   where cc.client_id = p_client and cc.status <> 'ended'
   order by cc.started_at desc limit 1;
  if v_main is null then raise exception 'That client isn''t coached in your gym' using errcode = 'P0002'; end if;
  if public.my_gym_role() = 'trainer' and v_main <> auth.uid() then
    raise exception 'Only their trainer or a manager can share this client' using errcode = '42501';
  end if;
  if not p_on then
    delete from public.gym_client_shares where client_id = p_client and coach_id = p_with and gym_id = v_gym;
    return;
  end if;
  if p_with = v_main then return; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id = v_gym and gm.coach_id = p_with) then
    raise exception 'That trainer isn''t in your gym' using errcode = 'P0002';
  end if;
  insert into public.gym_client_shares (gym_id, client_id, coach_id, shared_by) values (v_gym, p_client, p_with, auth.uid())
  on conflict (client_id, coach_id) do nothing;
end;
$$;

-- Signed-in coaches only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_gym_id()', 'public.my_gym_role()', 'public.my_gym()', 'public.gym_team()', 'public.gym_clients()',
    'public.create_gym(text)', 'public.rename_gym(text)', 'public.close_gym()', 'public.create_gym_invite(text)',
    'public.revoke_gym_invite(uuid)', 'public.accept_gym_invite(uuid)', 'public.set_gym_role(uuid, text)',
    'public.remove_gym_member(uuid)', 'public.hand_over_gym_client(uuid, uuid)', 'public.share_gym_client(uuid, uuid, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
