-- Post-workout summary: muscles worked, personal bests and the comparison with the last
-- session, exactly as the client saw it when they finished. The coach's Brief reads it.
-- The app still works before this runs; it just saves sessions without the summary.

alter table public.sessions
  add column if not exists summary jsonb;
