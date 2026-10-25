-- Row level security checks: a client, their coach and a rival coach each see only what they should.
-- Run by CI against plain Postgres after auth_stub.sql, the migrations and seed.sql.
\set ON_ERROR_STOP 1
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000c2'),('00000000-0000-0000-0000-00000000000d');
insert into profiles values ('00000000-0000-0000-0000-00000000000c','coach','Kamal'),('00000000-0000-0000-0000-0000000000c1','client','Priya'),('00000000-0000-0000-0000-0000000000c2','client','Other'),('00000000-0000-0000-0000-00000000000d','coach','Rival');
insert into coach_clients (coach_id, client_id) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-0000000000c2');
insert into programs (id, coach_id, client_id, name) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','Foundations');
insert into program_versions (id, program_id, version, published_at) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,now()),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',2,null);
insert into workouts (id, program_version_id, name, week, day_index) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Lower A',4,5),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Draft',4,5);
insert into check_ins (client_id, weight_kg) values ('00000000-0000-0000-0000-0000000000c1',62.3),('00000000-0000-0000-0000-0000000000c2',70);

create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false); $$;
set role authenticated;

-- client: sees own published program only
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from programs) = 1, 'client sees own program';
  assert (select count(*) from program_versions) = 1, 'client must not see unpublished draft';
  assert (select count(*) from workouts) = 1, 'client sees only published workouts';
  assert (select count(*) from check_ins) = 1, 'client sees only own check-ins';
  assert (select count(*) from exercises) = 15, 'client reads shared library';
  assert (select count(*) from profiles) = 2, 'client sees self and own coach';
end $$;
insert into messages (coach_id, client_id, sender_id, body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c1','Hip felt fine');
do $$ begin
  begin
    insert into messages (coach_id, client_id, sender_id, body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000000c','spoofed');
    raise exception 'client could send as coach';
  exception when insufficient_privilege then null; end;
  begin
    insert into programs (coach_id, client_id, name) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c1','self-made');
    raise exception 'client created a program';
  exception when insufficient_privilege then null; end;
end $$;

-- coach: sees own client including drafts, nothing of the rival's client
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from program_versions) = 2, 'coach sees drafts';
  assert (select count(*) from workouts) = 2, 'coach sees draft workouts';
  assert (select count(*) from check_ins) = 1, 'coach sees only own client check-ins';
  assert (select count(*) from messages) = 1, 'coach sees thread';
  assert (select count(*) from profiles where full_name = 'Other') = 0, 'coach cannot see rival client';
  begin
    insert into programs (coach_id, client_id, name) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c2','poach');
    raise exception 'coach wrote a program for a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;

-- rival coach: sees none of Kamal's data
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from programs) = 0, 'rival sees no programs';
  assert (select count(*) from messages) = 0, 'rival sees no messages';
  assert (select count(*) from check_ins) = 1, 'rival sees only own client';
end $$;
select 'RLS checks passed';
