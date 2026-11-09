-- Low-protein nudge for automatic messages. The coach turns it on and writes the wording in Automations.
-- Sends when a client has logged food on each of the last 3 days and every day is under 80% of their
-- protein target, at the coach's send hour, at most once a week. Mirrors packages/core/src/automations.ts.
-- Needs 20261103090000_automatic_messages.sql and the habits SQL (food_entries, nutrition_targets) first.
-- Safe to run more than once.

alter table public.coach_automations add column if not exists protein_on boolean not null default false;
alter table public.coach_automations add column if not exists protein_body text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'coach_automations_protein_body_len') then
    alter table public.coach_automations add constraint coach_automations_protein_body_len check (length(protein_body) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coach_automations_protein_needs_body') then
    alter table public.coach_automations add constraint coach_automations_protein_needs_body check (not protein_on or length(trim(protein_body)) > 0);
  end if;
end $$;

alter table public.automation_sends drop constraint if exists automation_sends_kind_check;
alter table public.automation_sends add constraint automation_sends_kind_check check (kind in ('welcome', 'missed', 'checkin', 'protein'));

-- Same job as before, plus the protein nudge at the end of each client.
create or replace function public.run_automations(p_now timestamptz default now())
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
  tgt      numeric;
begin
  for a in select * from public.coach_automations where welcome_on or missed_on or checkin_on or protein_on loop
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
      -- Low protein: each of the last 3 days (before today, local time) has food logged and is under 80% of the
      -- protein target. At most once a week.
      if a.protein_on then
        select t.protein_g into tgt from public.nutrition_targets t where t.client_id = c.client_id;
        if coalesce(tgt, 0) > 0
           and (select count(*) from (
                 select f.day from public.food_entries f
                 where f.client_id = c.client_id and f.day between local_ts::date - 3 and local_ts::date - 1
                 group by f.day having sum(f.protein_g) < tgt * 0.8) low) = 3
           and not exists (select 1 from public.automation_sends s where s.coach_id = a.coach_id and s.client_id = c.client_id
                           and s.kind = 'protein' and s.sent_at > p_now - interval '7 days') then
          insert into public.automation_sends (coach_id, client_id, kind, period, sent_at)
          values (a.coach_id, c.client_id, 'protein', local_ts::date::text, p_now) on conflict do nothing;
          if found then
            body := replace(replace(replace(a.protein_body, '{first_name}', c.first_name), '{coach}', coalesce(coach, '')), '{days}', '3');
            insert into public.messages (coach_id, client_id, sender_id, body) values (a.coach_id, c.client_id, a.coach_id, body);
            sent := sent + 1;
          end if;
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
