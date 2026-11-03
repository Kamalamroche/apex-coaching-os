-- Privacy: the agreements each person gives (terms, age, and for clients explicit consent for health
-- information), a copy of your own data, and deleting your own account.
-- Mirrors packages/core/src/privacy.ts.

-- ───────────── agreements ─────────────

-- One row each time someone agrees. Agreeing again after withdrawing adds a new row, so the history stays.
create table public.user_consents (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('terms', 'adult', 'health', 'coach_duty')),
  version       text not null check (length(version) between 1 and 20),
  given_at      timestamptz not null default now(),
  withdrawn_at  timestamptz
);
create index user_consents_user_idx on public.user_consents (user_id);

alter table public.user_consents enable row level security;
create policy "people read own consents" on public.user_consents for select
  using (user_id = auth.uid());
create policy "people give own consents" on public.user_consents for insert
  with check (user_id = auth.uid() and withdrawn_at is null);
-- A coach can see whether their client agreed to the health information, not change it.
create policy "coach reads client consents" on public.user_consents for select
  using (public.is_coach_of(user_id));

-- Withdrawing is the only change allowed, and it keeps the record of when consent was given.
create function public.withdraw_consent(p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.user_consents set withdrawn_at = now()
  where user_id = auth.uid() and kind = p_kind and withdrawn_at is null;
$$;

-- ───────────── a copy of my data ─────────────

-- Every row in every table that points at me, by table. Built from the foreign keys, so tables added
-- later are included without changing this. Left out: wearable sign-in tokens, and the coach's private
-- notes and tags about a client (a client can still ask for those in writing).
create function public.export_my_data()
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

-- ───────────── delete my account ─────────────

-- Removes the sign-in; everything that belongs to the person goes with it through the foreign keys.
-- The app removes the person's photos and videos from storage first.

-- A coach leaving must not be blocked by a program version they published for someone else's program.
alter table public.program_versions
  drop constraint program_versions_published_by_fkey,
  add constraint program_versions_published_by_fkey foreign key (published_by) references public.profiles (id) on delete set null;

create function public.delete_my_account()
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
