-- APEX Twin: the coach's own wording for weekly drafts, and what the coach decided on each one.
-- Drafts themselves are worked out in the app each week from sessions, check-ins and messages;
-- only decisions are stored, so the 4-week test can count "approved without edits".
-- Mirrors packages/core/src/twin.ts.

create table public.twin_voice (
  coach_id    uuid primary key references public.profiles (id) on delete cascade,
  sign_off    text not null default '' check (length(sign_off) <= 60),
  phrases     jsonb not null default '{}'::jsonb check (jsonb_typeof(phrases) = 'object' and length(phrases::text) <= 20000),
  updated_at  timestamptz not null default now()
);

alter table public.twin_voice enable row level security;
create policy "coach manages own twin voice" on public.twin_voice for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create table public.twin_decisions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  week_of     date not null,
  situation   text not null check (situation in ('injury', 'quiet', 'missed', 'tired', 'progress', 'steady', 'new', 'noprogram')),
  adjust      text not null check (adjust in ('progress', 'hold', 'lighter', 'deload', 'none')),
  status      text not null check (status in ('approved', 'edited', 'rejected')),
  drafted     text check (length(drafted) <= 4000),
  sent        text check (length(sent) <= 4000),
  decided_at  timestamptz not null default now(),
  unique (coach_id, client_id, week_of)
);
create index twin_decisions_coach_idx on public.twin_decisions (coach_id, week_of desc);

alter table public.twin_decisions enable row level security;
-- Coach only, and only for their own clients. Clients never see drafts or decisions.
create policy "coach manages own twin decisions" on public.twin_decisions for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and public.is_coach_of(client_id));
