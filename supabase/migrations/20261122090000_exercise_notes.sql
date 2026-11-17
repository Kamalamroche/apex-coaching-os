-- A short note from the coach on each exercise ("each side", "tempo 3-1-1"), shown to the client.
-- PDF import fills it from the source. Safe to run more than once.
alter table public.workout_items add column if not exists coach_note text;
alter table public.workout_items drop constraint if exists workout_items_coach_note_check;
alter table public.workout_items add constraint workout_items_coach_note_check check (coach_note is null or length(coach_note) <= 300);
