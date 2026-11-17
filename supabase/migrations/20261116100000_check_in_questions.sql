-- Custom check-in questions: the coach writes their own questions, every client answers them in the weekly check-in.
-- Each answer keeps a copy of its question, so editing the form later never changes an old check-in.
-- Safe to run more than once.

create table if not exists public.coach_check_in_forms (
  coach_id    uuid primary key references public.profiles (id) on delete cascade,
  -- [{ "id": "q-…", "text": "Did you hit your step goal?", "kind": "text" | "scale" | "yesno" }]
  questions   jsonb not null default '[]' check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 12 and pg_column_size(questions) < 8000),
  updated_at  timestamptz not null default now()
);

alter table public.coach_check_in_forms enable row level security;
drop policy if exists "coach manages own questions" on public.coach_check_in_forms;
create policy "coach manages own questions" on public.coach_check_in_forms for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "client reads coach questions" on public.coach_check_in_forms;
create policy "client reads coach questions" on public.coach_check_in_forms for select
  using (public.is_my_coach(coach_id));

-- The client's answers, written with the check-in. The existing guard stops the coach changing them.
alter table public.check_ins add column if not exists answers jsonb not null default '[]';
alter table public.check_ins drop constraint if exists check_ins_answers_check;
alter table public.check_ins add constraint check_ins_answers_check
  check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 20 and pg_column_size(answers) < 40000);
