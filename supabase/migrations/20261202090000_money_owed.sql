-- Money paid outside the app: packs can be "to pay later", monthly fees get a paid tick each month, and a client
-- handed to another trainer in a gym takes their sessions and packs with them.
-- Mirrors packages/core/src/sessions.ts and packages/core/src/fees.ts. Needs 20261119090000_sessions.sql,
-- 20261120090000_business_chat_tools.sql (monthly_fee_pence) and 20261115170000_gyms.sql first.

-- 1. Packs: when the client paid. Null = still to pay. Packs already recorded count as paid on the day they were added.
alter table public.session_packs add column if not exists paid_at timestamptz;
update public.session_packs set paid_at = bought_at where paid_at is null;
alter table public.session_packs alter column paid_at set default now();

-- 2. Monthly fees: one row per client per month the coach marked as paid.
create table if not exists public.fee_payments (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  client_id    uuid not null references public.profiles (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  amount_pence integer not null check (amount_pence between 0 and 10000000),
  paid_via     text not null default 'bank' check (paid_via in ('cash', 'bank', 'card')),
  paid_at      timestamptz not null default now(),
  note         text check (length(note) <= 200),
  unique (coach_id, client_id, month)
);
create index if not exists fee_payments_coach_idx on public.fee_payments (coach_id, month);

alter table public.fee_payments enable row level security;
drop policy if exists "coach manages fee payments" on public.fee_payments;
create policy "coach manages fee payments" on public.fee_payments for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
drop policy if exists "client reads own fee payments" on public.fee_payments;
create policy "client reads own fee payments" on public.fee_payments for select
  using (client_id = auth.uid());

-- 3. Gym hand-over: the new trainer takes over the client's packs and sessions too, so sessions left stay right.
-- Same as before, plus the two updates at the end. A future booking that clashes with the new trainer's diary is cancelled.
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

  update public.session_packs set coach_id = p_to where client_id = p_client and coach_id = v_from;
  perform set_config('apex.moving_booking', 'on', true);
  update public.bookings b set status = 'cancelled', cancelled_by = 'coach', cancelled_at = now(), late = false
   where b.client_id = p_client and b.coach_id = v_from and b.status = 'booked' and b.starts_at > now()
     and exists (select 1 from public.bookings o where o.coach_id = p_to and o.status = 'booked' and o.starts_at = b.starts_at);
  update public.bookings set coach_id = p_to where client_id = p_client and coach_id = v_from;
  perform set_config('apex.moving_booking', 'off', true);
end;
$$;
