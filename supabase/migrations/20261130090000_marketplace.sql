-- Find a trainer: the public directory, the verified badge and the people who check certificates.
-- Mirrors packages/core/src/marketplace.ts. Needs the growth, services and growth tools migrations first.
-- Safe to run more than once.

-- 1. A trainer chooses to be listed. Only published pages ever show.
alter table public.coach_pages add column if not exists listed boolean not null default false;
alter table public.coach_pages add column if not exists listed_at timestamptz;

-- 2. The APEX team who check certificates. Added by hand in the SQL Editor; nobody can add themselves.
create table if not exists public.platform_admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- No policies: only the functions below read it.

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

-- 3. Certificates a trainer sends for checking. The file sits in a private bucket under "<coach id>/...".
create table if not exists public.coach_credentials (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('qualification', 'insurance', 'first_aid')),
  title        text not null check (length(trim(title)) between 3 and 80),
  issuer       text not null check (length(trim(issuer)) between 2 and 80),
  expires      date,
  file_path    text not null check (split_part(file_path, '/', 1) = coach_id::text),
  file_name    text not null default '' check (length(file_name) <= 200),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note         text not null default '' check (length(note) <= 200),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (kind <> 'insurance' or expires is not null)
);
create index if not exists coach_credentials_coach_idx on public.coach_credentials (coach_id, created_at desc);
create index if not exists coach_credentials_pending_idx on public.coach_credentials (created_at) where status = 'pending';

alter table public.coach_credentials enable row level security;
drop policy if exists "coach reads own credentials" on public.coach_credentials;
create policy "coach reads own credentials" on public.coach_credentials for select using (coach_id = auth.uid());
drop policy if exists "coach sends credentials" on public.coach_credentials;
create policy "coach sends credentials" on public.coach_credentials for insert
  with check (coach_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null and note = ''
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
drop policy if exists "coach removes own credentials" on public.coach_credentials;
create policy "coach removes own credentials" on public.coach_credentials for delete using (coach_id = auth.uid());
-- No update policy: only review_credential() changes a status.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credentials', 'credentials', false, 8388608, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "coach uploads own credential files" on storage.objects;
create policy "coach uploads own credential files" on storage.objects for insert to authenticated
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "coach reads own credential files" on storage.objects;
create policy "coach reads own credential files" on storage.objects for select to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "coach deletes own credential files" on storage.objects;
create policy "coach deletes own credential files" on storage.objects for delete to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "checkers read credential files" on storage.objects;
create policy "checkers read credential files" on storage.objects for select to authenticated
  using (bucket_id = 'credentials' and public.is_platform_admin());

-- 4. Verified = a checked qualification and checked insurance, both in date.
create or replace function public.coach_is_verified(p_coach uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.coach_credentials c where c.coach_id = p_coach and c.kind = 'qualification' and c.status = 'approved' and (c.expires is null or c.expires >= current_date))
     and exists (select 1 from public.coach_credentials c where c.coach_id = p_coach and c.kind = 'insurance' and c.status = 'approved' and c.expires >= current_date);
$$;

-- 5. Anyone: the directory. Listed and published pages only; reviews the trainer approved; prices open to everyone.
create or replace function public.public_trainers()
returns table (slug text, name text, headline text, city text, specialties text[], modes text[], clients int,
  rating numeric, reviews int, from_pence int, verified boolean, intro_offer boolean, listed_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select cp.slug, pr.full_name, cp.headline, cp.city, cp.specialties, cp.modes,
    case when cp.show_clients then (select count(*)::int from public.coach_clients cc where cc.coach_id = cp.coach_id and cc.status = 'active') end,
    (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.coach_id = cp.coach_id and r.approved),
    (select count(*)::int from public.reviews r where r.coach_id = cp.coach_id and r.approved),
    (select min(s.price_pence) from public.coach_services s where s.coach_id = cp.coach_id and s.active and s.audience = 'everyone' and s.price_pence > 0),
    public.coach_is_verified(cp.coach_id), cp.intro_offer, coalesce(cp.listed_at, cp.updated_at), cp.updated_at
  from public.coach_pages cp
  join public.profiles pr on pr.id = cp.coach_id
  where cp.published and cp.listed
  order by cp.listed_at desc nulls last
  limit 500;
$$;

-- Anyone: the badge and the checked certificate names on one page. Never the files.
create or replace function public.public_coach_trust(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'verified', public.coach_is_verified(cp.coach_id),
    'listed', cp.listed,
    'credentials', coalesce((
      select jsonb_agg(jsonb_build_object('kind', c.kind, 'title', c.title, 'issuer', c.issuer) order by c.kind, c.created_at)
      from public.coach_credentials c
      where c.coach_id = cp.coach_id and c.status = 'approved' and (c.expires is null or c.expires >= current_date) and c.kind <> 'insurance'
    ), '[]'::jsonb))
  from public.coach_pages cp
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- 6. Coach: join or leave the directory. The page must be ready (same rules as listingProblem).
create or replace function public.set_listed(p_listed boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_page public.coach_pages;
begin
  select * into v_page from public.coach_pages where coach_id = auth.uid();
  if v_page.coach_id is null then
    raise exception 'Set up your page first.' using errcode = 'P0002';
  end if;
  if p_listed then
    if not v_page.published then raise exception 'Publish your page first.' using errcode = '23514'; end if;
    if trim(v_page.headline) = '' then raise exception 'Add a headline to your page.' using errcode = '23514'; end if;
    if cardinality(v_page.specialties) = 0 then raise exception 'Pick at least one specialty.' using errcode = '23514'; end if;
    if exists (select 1 from unnest(v_page.modes) m where m <> 'online') and trim(v_page.city) = '' then
      raise exception 'Add your city so people nearby can find you.' using errcode = '23514';
    end if;
  end if;
  update public.coach_pages set listed = p_listed, listed_at = case when p_listed then coalesce(listed_at, now()) else listed_at end
  where coach_id = auth.uid();
end;
$$;

-- 7. Checkers: what's waiting, newest checks last; and approve or decline with a reason.
create or replace function public.admin_credentials(p_status text default 'pending')
returns table (id uuid, coach_id uuid, coach_name text, slug text, kind text, title text, issuer text, expires date,
  file_path text, file_name text, status text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the APEX team can see this.' using errcode = '42501';
  end if;
  return query
    select c.id, c.coach_id, pr.full_name, cp.slug, c.kind, c.title, c.issuer, c.expires, c.file_path, c.file_name, c.status, c.note, c.created_at
    from public.coach_credentials c
    join public.profiles pr on pr.id = c.coach_id
    left join public.coach_pages cp on cp.coach_id = c.coach_id
    where p_status is null or c.status = p_status
    order by c.created_at
    limit 200;
end;
$$;

create or replace function public.review_credential(p_id uuid, p_approve boolean, p_note text default '')
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the APEX team can check certificates.' using errcode = '42501';
  end if;
  if not p_approve and length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'Say why, so the trainer can fix it.' using errcode = '23514';
  end if;
  update public.coach_credentials
  set status = case when p_approve then 'approved' else 'rejected' end,
      note = case when p_approve then '' else left(trim(p_note), 200) end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if not found then
    raise exception 'That certificate was removed.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.coach_is_verified(uuid) from public;
revoke all on function public.public_trainers() from public;
revoke all on function public.public_coach_trust(text) from public;
revoke all on function public.set_listed(boolean) from public;
revoke all on function public.admin_credentials(text) from public;
revoke all on function public.review_credential(uuid, boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.public_trainers() to anon, authenticated';
    execute 'grant execute on function public.public_coach_trust(text) to anon, authenticated';
    execute 'grant execute on function public.is_platform_admin() to authenticated';
    execute 'grant execute on function public.set_listed(boolean) to authenticated';
    execute 'grant execute on function public.admin_credentials(text) to authenticated';
    execute 'grant execute on function public.review_credential(uuid, boolean, text) to authenticated';
  end if;
end $$;
