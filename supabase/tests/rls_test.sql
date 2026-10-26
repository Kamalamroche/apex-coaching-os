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
-- invites: a coach's link links exactly one client, once
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000c3'),('00000000-0000-0000-0000-0000000000c4');
insert into profiles values ('00000000-0000-0000-0000-0000000000c3','client','New'),('00000000-0000-0000-0000-0000000000c4','client','Late');
insert into invites (token, coach_id) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from invites) = 0, 'rival cannot see invites';
  begin
    perform public.accept_invite('40000000-0000-0000-0000-000000000001');
    raise exception 'a coach account accepted an invite';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select public.accept_invite('40000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from coach_clients where client_id = auth.uid() and coach_id = '00000000-0000-0000-0000-00000000000c') = 1, 'invite links client to coach';
  assert (select count(*) from profiles where full_name = 'Kamal') = 1, 'client can now see their coach';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
do $$ begin
  begin
    perform public.accept_invite('40000000-0000-0000-0000-000000000001');
    raise exception 'an invite was used twice';
  exception when no_data_found then null; end;
end $$;

-- check-ins, measurements and photos
reset role;
insert into check_ins (id, client_id, weight_kg, energy) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1',62.0,4);
insert into body_measurements (client_id, waist_cm) values ('00000000-0000-0000-0000-0000000000c1',71),('00000000-0000-0000-0000-0000000000c2',80);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into check_ins (client_id, weight_kg, coach_reply) values ('00000000-0000-0000-0000-0000000000c1',61.8,'self-praise');
update check_ins set coach_reply = 'forged', energy = 5 where id = '50000000-0000-0000-0000-000000000001';
insert into progress_photos (client_id, pose, storage_path) values ('00000000-0000-0000-0000-0000000000c1','front','00000000-0000-0000-0000-0000000000c1/a/front.jpg');
insert into storage.objects (bucket_id, name) values ('progress-photos','00000000-0000-0000-0000-0000000000c1/a/front.jpg');
do $$ begin
  assert (select count(*) from check_ins where coach_reply is not null) = 0, 'client cannot write a coach reply';
  assert (select energy from check_ins where id = '50000000-0000-0000-0000-000000000001') = 5, 'client can edit own check-in';
  assert (select count(*) from body_measurements) = 1, 'client sees only own measurements';
  begin
    insert into progress_photos (client_id, pose, storage_path) values ('00000000-0000-0000-0000-0000000000c1','side','00000000-0000-0000-0000-0000000000c2/x.jpg');
    raise exception 'client registered a photo in someone else''s folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('progress-photos','00000000-0000-0000-0000-0000000000c2/x.jpg');
    raise exception 'client uploaded into someone else''s folder';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update check_ins set coach_reply = 'Great week', reviewed_at = now(), weight_kg = 99 where id = '50000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select coach_reply from check_ins where id = '50000000-0000-0000-0000-000000000001') = 'Great week', 'coach replies to a check-in';
  assert (select weight_kg from check_ins where id = '50000000-0000-0000-0000-000000000001') = 62.0, 'coach cannot change what the client reported';
  assert (select count(*) from body_measurements) = 1, 'coach sees own client measurements only';
  assert (select count(*) from progress_photos) = 1, 'coach sees client photos';
  assert (select count(*) from storage.objects) = 1, 'coach can open client photo files';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update check_ins set coach_reply = 'poach' where id = '50000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from progress_photos) = 0, 'rival sees no photos';
  assert (select count(*) from storage.objects) = 0, 'rival opens no photo files';
end $$;
reset role;
do $$ begin
  assert (select coach_reply from check_ins where id = '50000000-0000-0000-0000-000000000001') = 'Great week', 'rival cannot reply';
end $$;

select 'RLS checks passed';
