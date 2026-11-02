-- Program builder: per-set targets, circuits, and a coach's own template library.
-- Multi-week programs need no change: workouts already carry week and day_index.

-- Different reps and kg per set, e.g. [{"reps":"8","kg":60},{"reps":"6","kg":70}]. Null = every set the same.
alter table public.workout_items add column if not exists set_plan jsonb
  check (set_plan is null or jsonb_typeof(set_plan) = 'array');
-- 'circuit' runs a linked block round by round. Null = straight set, superset, tri-set or giant set.
alter table public.workout_items add column if not exists block_style text
  check (block_style is null or block_style in ('circuit'));

-- Saved programs a coach reuses. `days` is the APEX template format (packages/core/src/types.ts, TemplateDay[]).
-- Assigning a template copies it into a new program for each client, so editing one client never changes another.
create table if not exists public.program_templates (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  note        text check (note is null or length(note) <= 300),
  weeks       int not null default 1 check (weeks between 1 and 52),
  days        jsonb not null default '[]' check (jsonb_typeof(days) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists program_templates_coach_idx on public.program_templates (coach_id);

alter table public.program_templates enable row level security;
drop policy if exists "coach manages own templates" on public.program_templates;
create policy "coach manages own templates" on public.program_templates for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
