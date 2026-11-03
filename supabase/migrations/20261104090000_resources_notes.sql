-- Resource library (guides and links the coach shares) and private coach notes and tags on each client.
-- Notes and tags are the coach's alone: clients can never read them.
-- Mirrors packages/core/src/resources.ts and packages/core/src/clientNotes.ts.
-- Needs public.is_my_coach() from 20261103180000_bookings.sql.

create table public.coach_resources (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  -- Null: every client. Otherwise only this client.
  client_id   uuid references public.profiles (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 120),
  category    text not null default 'Getting started' check (length(category) <= 40),
  body        text check (length(body) <= 8000),
  url         text check (url ~ '^https?://' and length(url) <= 2000),
  created_at  timestamptz not null default now(),
  check (body is not null or url is not null)
);
create index coach_resources_coach_idx on public.coach_resources (coach_id, created_at desc);

alter table public.coach_resources enable row level security;
create policy "coach manages own resources" on public.coach_resources for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and (client_id is null or public.is_coach_of(client_id)));
create policy "client reads coach resources" on public.coach_resources for select
  using (public.is_my_coach(coach_id) and (client_id is null or client_id = auth.uid()));

create table public.coach_client_notes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 4000),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index coach_client_notes_idx on public.coach_client_notes (coach_id, client_id, created_at desc);

alter table public.coach_client_notes enable row level security;
create policy "coach keeps private notes" on public.coach_client_notes for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));

create table public.coach_client_tags (
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  tags        text[] not null default '{}' check (cardinality(tags) <= 8),
  primary key (coach_id, client_id)
);

alter table public.coach_client_tags enable row level security;
create policy "coach keeps private tags" on public.coach_client_tags for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and public.is_coach_of(client_id));
