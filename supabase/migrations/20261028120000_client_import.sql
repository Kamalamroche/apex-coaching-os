-- Importing clients from other apps.
-- An imported client waits in imported_clients, with their program, training history and
-- check-ins, until they accept their invite link. Then the coach's app writes that data into
-- the normal tables. Sessions and check-ins brought in this way are marked source = 'import',
-- the only kind a coach may write for a client.

create table if not exists public.imported_clients (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  full_name     text not null check (length(full_name) between 1 and 200),
  email         text,
  goal          text,
  mode          public.training_mode not null default 'online',
  -- Program, sessions and check-ins in the APEX transfer format (packages/core/src/transfer.ts).
  data          jsonb not null default '{}',
  invite_token  uuid unique references public.invites (token) on delete set null,
  -- Set when the client accepts the invite.
  client_id     uuid references public.profiles (id) on delete set null,
  applied_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists imported_clients_coach_idx on public.imported_clients (coach_id);

alter table public.imported_clients enable row level security;
drop policy if exists "coach manages own imports" on public.imported_clients;
create policy "coach manages own imports" on public.imported_clients for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

alter table public.sessions  add column if not exists source text not null default 'app' check (source in ('app', 'import'));
alter table public.check_ins add column if not exists source text not null default 'app' check (source in ('app', 'import'));

drop policy if exists "coach imports client sessions" on public.sessions;
create policy "coach imports client sessions" on public.sessions for insert
  with check (source = 'import' and public.is_coach_of(client_id));

drop policy if exists "coach imports client sets" on public.logged_sets;
create policy "coach imports client sets" on public.logged_sets for insert
  with check (exists (select 1 from public.sessions s where s.id = logged_sets.session_id and s.source = 'import' and public.is_coach_of(s.client_id)));

drop policy if exists "coach imports client check-ins" on public.check_ins;
create policy "coach imports client check-ins" on public.check_ins for insert
  with check (source = 'import' and public.is_coach_of(client_id));

-- accept_invite now also links an imported client to the account that accepted, and carries
-- their goal and training mode across.
create or replace function public.accept_invite(p_token uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_coach uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'client') then
    raise exception 'Only a client account can accept an invite' using errcode = '42501';
  end if;
  select i.coach_id into v_coach from public.invites i
   where i.token = p_token and (i.accepted_by is null or i.accepted_by = auth.uid())
   for update;
  if v_coach is null then
    raise exception 'This invite link is invalid or has already been used' using errcode = 'P0002';
  end if;
  insert into public.coach_clients (coach_id, client_id, status)
  values (v_coach, auth.uid(), 'active')
  on conflict (coach_id, client_id) do update set status = 'active';
  update public.invites set accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now())
   where token = p_token;
  update public.imported_clients ic set client_id = auth.uid()
   where ic.invite_token = p_token and ic.client_id is null;
  update public.coach_clients cc set goal = coalesce(cc.goal, ic.goal), mode = ic.mode
    from public.imported_clients ic
   where ic.invite_token = p_token and cc.coach_id = v_coach and cc.client_id = auth.uid();
  return v_coach;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;
