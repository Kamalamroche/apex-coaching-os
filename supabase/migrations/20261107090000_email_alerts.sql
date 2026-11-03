-- Email alerts: when someone has an unread message for a while, email them once so they open APEX.
-- The email-alerts edge function asks pending_email_alerts() who to email, sends through Resend,
-- then calls mark_email_alerts_sent(). Each person can switch these emails off.

create table public.email_prefs (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  messages_on  boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.email_prefs enable row level security;
create policy "people manage own email prefs" on public.email_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One row per message already covered by an email, so nobody is emailed twice about it.
-- Only the edge function (service role) writes or reads here.
create table public.email_alert_sends (
  message_id  uuid primary key references public.messages (id) on delete cascade,
  sent_at     timestamptz not null default now()
);
alter table public.email_alert_sends enable row level security;

-- Who to email now: unread messages older than p_wait and younger than a day, not emailed yet,
-- whose reader hasn't switched emails off and hasn't been emailed in the last hour. One row per reader.
create function public.pending_email_alerts(p_now timestamptz default now(), p_wait interval default interval '15 minutes')
returns table (
  user_id     uuid,
  email       text,
  first_name  text,
  role        text,
  senders     text[],
  unread      int,
  latest      text,
  message_ids uuid[]
)
language sql stable security definer set search_path = ''
as $$
  with waiting as (
    select m.id, m.body, m.created_at,
           case when m.sender_id = m.coach_id then m.client_id else m.coach_id end as reader,
           m.sender_id
    from public.messages m
    where m.read_at is null
      and m.created_at <= p_now - p_wait
      and m.created_at > p_now - interval '1 day'
      and not exists (select 1 from public.email_alert_sends s where s.message_id = m.id)
  )
  select w.reader,
         u.email::text,
         split_part(p.full_name, ' ', 1),
         p.role::text,
         array_agg(distinct split_part(sp.full_name, ' ', 1)),
         count(*)::int,
         (array_agg(w.body order by w.created_at desc))[1],
         array_agg(w.id)
  from waiting w
  join public.profiles p on p.id = w.reader
  join public.profiles sp on sp.id = w.sender_id
  join auth.users u on u.id = w.reader
  left join public.email_prefs ep on ep.user_id = w.reader
  where coalesce(ep.messages_on, true)
    and u.email is not null
    and not exists (
      select 1 from public.email_alert_sends s join public.messages m2 on m2.id = s.message_id
      where s.sent_at > p_now - interval '1 hour'
        and (case when m2.sender_id = m2.coach_id then m2.client_id else m2.coach_id end) = w.reader
    )
  group by w.reader, u.email, p.full_name, p.role
$$;

create function public.mark_email_alerts_sent(p_ids uuid[])
returns void language sql security definer set search_path = ''
as $$
  insert into public.email_alert_sends (message_id) select unnest(p_ids) on conflict do nothing;
$$;

-- Only the edge function may call these.
revoke all on function public.pending_email_alerts(timestamptz, interval) from public, anon, authenticated;
revoke all on function public.mark_email_alerts_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.pending_email_alerts(timestamptz, interval) to service_role;
grant execute on function public.mark_email_alerts_sent(uuid[]) to service_role;
