-- Growing the business: a free intro session offer, referral rewards, client reviews (on the public page and Google).
-- Mirrors packages/core/src/growthTools.ts. Needs 20261110090000_growth.sql and 20261119090000_sessions.sql first.
-- Safe to run more than once.

-- The coach's offers, kept with their public page.
alter table public.coach_pages add column if not exists intro_offer boolean not null default false;
alter table public.coach_pages add column if not exists referral_reward smallint not null default 1;
alter table public.coach_pages add column if not exists google_review_url text not null default '';
alter table public.coach_pages drop constraint if exists coach_pages_referral_reward_check;
alter table public.coach_pages add constraint coach_pages_referral_reward_check check (referral_reward between 0 and 5);
alter table public.coach_pages drop constraint if exists coach_pages_google_review_url_check;
alter table public.coach_pages add constraint coach_pages_google_review_url_check check (google_review_url = '' or (google_review_url ~ '^https://' and length(google_review_url) <= 300));

-- Which pack paid the referral reward, so each friend is rewarded once.
alter table public.join_requests add column if not exists reward_pack_id uuid references public.session_packs (id) on delete set null;

-- Reviews: one per client per coach. The coach decides which ones show on the public page.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  body        text not null check (length(trim(body)) between 20 and 600),
  show_name   boolean not null default true,
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (coach_id, client_id)
);
alter table public.reviews enable row level security;
drop policy if exists "client writes own review" on public.reviews;
create policy "client writes own review" on public.reviews for insert
  with check (client_id = auth.uid() and public.is_my_coach(coach_id) and not approved);
drop policy if exists "client reads own review" on public.reviews;
create policy "client reads own review" on public.reviews for select using (client_id = auth.uid());
drop policy if exists "client edits own review" on public.reviews;
create policy "client edits own review" on public.reviews for update using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "client removes own review" on public.reviews;
create policy "client removes own review" on public.reviews for delete using (client_id = auth.uid());
drop policy if exists "coach reads reviews" on public.reviews;
create policy "coach reads reviews" on public.reviews for select using (coach_id = auth.uid());
drop policy if exists "coach shows or hides reviews" on public.reviews;
create policy "coach shows or hides reviews" on public.reviews for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach removes reviews" on public.reviews;
create policy "coach removes reviews" on public.reviews for delete using (coach_id = auth.uid());

-- The coach can only show or hide; a client edit goes back for approval.
create or replace function public.guard_review_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  if auth.uid() = old.coach_id then
    new.stars := old.stars; new.body := old.body; new.show_name := old.show_name; new.client_id := old.client_id; new.coach_id := old.coach_id;
    return new;
  end if;
  new.coach_id := old.coach_id; new.client_id := old.client_id; new.updated_at := now();
  if new.body is distinct from old.body or new.stars is distinct from old.stars or new.show_name is distinct from old.show_name then
    new.approved := false;
  else
    new.approved := old.approved;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_review_change on public.reviews;
create trigger guard_review_change before update on public.reviews for each row execute function public.guard_review_change();

-- "Priya Sharma" → "Priya S."
create or replace function public.short_name(p_full text)
returns text
language sql immutable set search_path = ''
as $$
  select case when cardinality(x.parts) > 1 then x.parts[1] || ' ' || upper(left(x.parts[cardinality(x.parts)], 1)) || '.' else x.parts[1] end
  from (select regexp_split_to_array(trim(coalesce(p_full, '')), '\s+') as parts) x;
$$;

-- The coach's view: every review with the client's short name ("Priya S.").
create or replace function public.coach_reviews()
returns table (id uuid, client_id uuid, name text, stars smallint, body text, approved boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.client_id,
         public.short_name(p.full_name),
         r.stars, r.body, r.approved, r.created_at
  from public.reviews r join public.profiles p on p.id = r.client_id
  where r.coach_id = auth.uid()
  order by r.created_at desc;
$$;

-- Anyone: a published page's offer and its approved reviews. Names only when the client allowed it.
create or replace function public.public_coach_extras(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'intro_offer', cp.intro_offer,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stars', r.stars, 'body', r.body, 'at', r.created_at,
        'name', case when r.show_name then public.short_name(p.full_name) end
      ) order by r.created_at desc)
      from (select * from public.reviews where coach_id = cp.coach_id and approved order by created_at desc limit 12) r
      join public.profiles p on p.id = r.client_id
    ), '[]'::jsonb))
  from public.coach_pages cp
  where cp.slug = lower(trim(p_slug)) and cp.published;
$$;

-- A client: their coach's offer and Google link, for the invite-a-friend screen and after writing a review.
create or replace function public.my_coach_offer(p_coach uuid)
returns table (intro_offer boolean, referral_reward smallint, google_review_url text)
language sql stable security definer set search_path = ''
as $$
  select cp.intro_offer, cp.referral_reward, cp.google_review_url from public.coach_pages cp
  where cp.coach_id = p_coach and (auth.uid() = p_coach or public.is_my_coach(p_coach));
$$;

revoke all on function public.coach_reviews() from public;
revoke all on function public.public_coach_extras(text) from public;
revoke all on function public.my_coach_offer(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.coach_reviews() from anon';
    execute 'revoke all on function public.my_coach_offer(uuid) from anon';
    execute 'grant execute on function public.coach_reviews() to authenticated';
    execute 'grant execute on function public.my_coach_offer(uuid) to authenticated';
    execute 'grant execute on function public.public_coach_extras(text) to anon, authenticated';
  end if;
end $$;
