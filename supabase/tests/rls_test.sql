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
  assert (select count(*) from exercises) = 637, 'client reads shared library';
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

-- imports: a coach writes imported history for their own client only, and an invite links the waiting import
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into sessions (id, client_id, started_at, finished_at, source) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1', now() - interval '1 day', now() - interval '23 hours', 'import');
insert into logged_sets (session_id, exercise_id, set_index, load_kg, reps) values ('50000000-0000-0000-0000-000000000001', 1, 0, 60, 8);
insert into check_ins (client_id, weight_kg, source) values ('00000000-0000-0000-0000-0000000000c1', 62, 'import');
insert into invites (token, coach_id) values ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000c');
insert into imported_clients (coach_id, full_name, goal, mode, invite_token) values ('00000000-0000-0000-0000-00000000000c','Jo Import','Run 10k','hybrid','40000000-0000-0000-0000-000000000002');
do $$ begin
  begin
    insert into sessions (client_id, source) values ('00000000-0000-0000-0000-0000000000c1', 'app');
    raise exception 'coach logged a session as if the client did it';
  exception when insufficient_privilege then null; end;
  begin
    insert into sessions (client_id, source) values ('00000000-0000-0000-0000-0000000000c2', 'import');
    raise exception 'coach imported history for a client that is not theirs';
  exception when insufficient_privilege then null; end;
  begin
    insert into check_ins (client_id, source) values ('00000000-0000-0000-0000-0000000000c2', 'import');
    raise exception 'coach imported a check-in for a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from imported_clients) = 0, 'rival cannot see imported clients';
  begin
    insert into imported_clients (coach_id, full_name) values ('00000000-0000-0000-0000-00000000000c','planted');
    raise exception 'rival added an import for another coach';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000c5');
insert into profiles values ('00000000-0000-0000-0000-0000000000c5','client','Jo');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
select public.accept_invite('40000000-0000-0000-0000-000000000002');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select client_id from imported_clients where full_name = 'Jo Import') = '00000000-0000-0000-0000-0000000000c5', 'accepting links the import';
  assert (select mode::text || goal from coach_clients where client_id = '00000000-0000-0000-0000-0000000000c5') = 'hybridRun 10k', 'goal and mode carried across';
  insert into sessions (client_id, started_at, finished_at, source) values ('00000000-0000-0000-0000-0000000000c5', now(), now(), 'import');
end $$;

select 'RLS checks passed';

-- program builder: templates are private to their coach; per-set targets and circuits save on items
reset role;
grant all on public.program_templates to authenticated;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into program_templates (name, weeks, days) values ('Upper / lower', 8, '[]');
insert into workout_items (workout_id, position, group_label, exercise_id, sets, reps, set_plan, block_style)
  values ('30000000-0000-0000-0000-000000000001', 50, 'Z1', 1, 3, '8', '[{"reps":"8","kg":60},{"reps":"6","kg":70},{"reps":"4","kg":80}]', 'circuit');
do $$ begin
  assert (select count(*) from program_templates) = 1, 'coach sees own template';
  assert (select jsonb_array_length(set_plan) from workout_items where position = 50) = 3, 'per-set plan saved';
  begin
    insert into program_templates (coach_id, name) values ('00000000-0000-0000-0000-00000000000d', 'forged');
    raise exception 'coach wrote a template for another coach';
  exception when insufficient_privilege then null; end;
  begin
    update workout_items set block_style = 'chaos' where position = 50;
    raise exception 'unknown block style accepted';
  exception when check_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from program_templates) = 0, 'rival cannot see templates';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from program_templates) = 0, 'client cannot see templates';
end $$;
reset role;
