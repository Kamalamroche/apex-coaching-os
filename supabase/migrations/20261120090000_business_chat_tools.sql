-- Business dashboard, client health and chat tools.
--   1. coach_clients: what each client pays a month, and when coaching ended (for churn and retention).
--   2. saved_replies: the coach's saved chat replies.
--   3. messages: voice notes, stored in a private bucket under the client's folder so both sides can play them.
-- Safe to run more than once.

-- ───────────── 1. fees and end dates ─────────────

alter table public.coach_clients add column if not exists monthly_fee_pence integer not null default 0;
alter table public.coach_clients add column if not exists ended_at timestamptz;
alter table public.coach_clients drop constraint if exists coach_clients_monthly_fee_check;
alter table public.coach_clients add constraint coach_clients_monthly_fee_check check (monthly_fee_pence between 0 and 10000000);

-- Stamps when coaching ends, and clears it if the client comes back.
create or replace function public.coach_client_ended_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'ended' and (tg_op = 'INSERT' or old.status is distinct from 'ended') then
    new.ended_at := coalesce(new.ended_at, now());
  elsif new.status <> 'ended' then
    new.ended_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists coach_client_ended_at on public.coach_clients;
create trigger coach_client_ended_at before insert or update of status on public.coach_clients
  for each row execute function public.coach_client_ended_at();

-- ───────────── 2. saved replies ─────────────

create table if not exists public.saved_replies (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 40),
  body        text not null check (length(trim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists saved_replies_coach_idx on public.saved_replies (coach_id, created_at);

alter table public.saved_replies enable row level security;
drop policy if exists "coach manages own saved replies" on public.saved_replies;
create policy "coach manages own saved replies" on public.saved_replies for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

-- ───────────── 3. voice notes ─────────────

alter table public.messages add column if not exists voice_path text;
alter table public.messages add column if not exists voice_seconds smallint;
alter table public.messages drop constraint if exists messages_voice_check;
-- A voice note sits in its own thread's client folder and runs 1 second to 2 minutes.
alter table public.messages add constraint messages_voice_check check (
  (voice_path is null and voice_seconds is null)
  or (voice_path is not null and split_part(voice_path, '/', 1) = client_id::text and length(voice_path) <= 200
      and voice_seconds between 1 and 120)
);

-- Private bucket, 5 MB a note, the formats phones and browsers record in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 5242880, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/mpeg', 'audio/x-m4a'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Client: their own folder. Coach: the folders of clients they coach.
drop policy if exists "chat voice notes upload" on storage.objects;
create policy "chat voice notes upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-notes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach_of_folder((storage.foldername(name))[1])));
drop policy if exists "chat voice notes play" on storage.objects;
create policy "chat voice notes play" on storage.objects for select to authenticated
  using (bucket_id = 'voice-notes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach_of_folder((storage.foldername(name))[1])));
