-- Client feature switches: the coach chooses which parts of the app each client sees.
-- Stored as the keys the coach has hidden, so anything new shows for everyone by default.
-- The coach already manages coach_clients and the client can already read their own row, so no new policies.
-- Safe to run more than once.

alter table public.coach_clients add column if not exists hidden_features text[] not null default '{}';
alter table public.coach_clients drop constraint if exists coach_clients_hidden_features_check;
alter table public.coach_clients add constraint coach_clients_hidden_features_check check (cardinality(hidden_features) <= 40);
