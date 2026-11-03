-- Safe to run more than once: privacy (20261105090000) and APEX Twin (20261106090000).
-- Skips anything that already exists, and finds the program_versions link by column, not by name.

-- ───────────── privacy: agreements ─────────────
create table if not exists public.user_consents (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('terms', 'adult', 'health', 'coach_duty')),
  version       text not null check (length(version) between 1 and 20),
  given_at      timestamptz not null default now(),
  withdrawn_at  timestamptz
);
create index if not exists user_consents_user_idx on public.user_consents (user_id);
alter table public.user_consents enable row level security;
drop policy if exists "people read own consents" on public.user_consents;
drop policy if exists "people give own consents" on public.user_consents;
drop policy if exists "coach reads client consents" on public.user_consents;
create policy "people read own consents" on public.user_consents for select
  using (user_id = auth.uid());
create policy "people give own consents" on public.user_consents for insert
  with check (user_id = auth.uid() and withdrawn_at is null);
create policy "coach reads client consents" on public.user_consents for select
  using (public.is_coach_of(user_id));

create or replace function public.withdraw_consent(p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.user_consents set withdrawn_at = now()
  where user_id = auth.uid() and kind = p_kind and withdrawn_at is null;
$$;

create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t record;
  rows jsonb;
  out jsonb := '{}'::jsonb;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  for t in
    select c.conrelid::regclass as tbl, c.conrelid::regclass::text as name,
           string_agg(format('%I = $1', a.attname), ' or ') as cond
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
      and c.conrelid::regclass::text <> 'device_tokens'
      and not (c.conrelid::regclass::text in ('coach_client_notes', 'coach_client_tags') and a.attname = 'client_id')
    group by c.conrelid
    order by 2
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %s x where %s', t.tbl, t.cond) into rows using me;
    if rows <> '[]'::jsonb then out := out || jsonb_build_object(t.name, rows); end if;
  end loop;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = me),
    'data', out
  );
end $$;

-- ───────────── privacy: a coach leaving never blocks on published program versions ─────────────
do $$
declare c text;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.conrelid = 'public.program_versions'::regclass and con.contype = 'f' and a.attname = 'published_by'
  loop
    execute format('alter table public.program_versions drop constraint %I', c);
  end loop;
  alter table public.program_versions
    add constraint program_versions_published_by_fkey foreign key (published_by) references public.profiles (id) on delete set null;
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.withdraw_consent(text) from public, anon;
revoke all on function public.export_my_data() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.withdraw_consent(text) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────── APEX Twin ─────────────
create table if not exists public.twin_voice (
  coach_id    uuid primary key references public.profiles (id) on delete cascade,
  sign_off    text not null default '' check (length(sign_off) <= 60),
  phrases     jsonb not null default '{}'::jsonb check (jsonb_typeof(phrases) = 'object' and length(phrases::text) <= 20000),
  updated_at  timestamptz not null default now()
);
alter table public.twin_voice enable row level security;
drop policy if exists "coach manages own twin voice" on public.twin_voice;
create policy "coach manages own twin voice" on public.twin_voice for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

create table if not exists public.twin_decisions (
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
create index if not exists twin_decisions_coach_idx on public.twin_decisions (coach_id, week_of desc);
alter table public.twin_decisions enable row level security;
drop policy if exists "coach manages own twin decisions" on public.twin_decisions;
create policy "coach manages own twin decisions" on public.twin_decisions for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and public.is_coach_of(client_id));

-- Should show four rows of true.
select to_regclass('public.user_consents') is not null as consents_ready,
       to_regprocedure('public.delete_my_account()') is not null as delete_ready,
       to_regclass('public.twin_voice') is not null as twin_voice_ready,
       to_regclass('public.twin_decisions') is not null as twin_decisions_ready;
