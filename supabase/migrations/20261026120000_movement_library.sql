-- Full APEX movement library: new movement patterns and the sheet's training type and focus.
-- The 622 library rows themselves are in seed.sql.

alter type public.movement_pattern add value if not exists 'power';
alter type public.movement_pattern add value if not exists 'mobility';

alter table public.exercises
  add column if not exists training_type text,
  add column if not exists focus text;

create index if not exists exercises_training_type_idx on public.exercises (training_type);
