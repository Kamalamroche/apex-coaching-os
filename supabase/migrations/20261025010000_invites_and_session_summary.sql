-- Client invites and session summaries.
-- A coach creates an invite link; the client redeems it after signing in, which links them
-- to that coach. The link carries a random token, never the coach's id.

create table public.invites (
  token        uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_by  uuid references public.profiles (id) on delete set null,
  accepted_at  timestamptz
);
create index invites_coach_idx on public.invites (coach_id);

alter table public.invites enable row level security;
create policy "coach manages own invites" on public.invites for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Redeems an unused invite for the signed-in client. Returns the coach's id.
create function public.accept_invite(p_token uuid)
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
  return v_coach;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- What the coach's Brief shows when a client finishes, without re-adding every set.
alter table public.sessions
  add column sets_completed int,
  add column volume_kg numeric(9, 1),
  add column prs int not null default 0;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.workouts;
  end if;
end $$;
