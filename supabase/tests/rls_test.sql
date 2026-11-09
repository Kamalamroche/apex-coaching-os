-- Row level security checks: a client, their coach and a rival coach each see only what they should.
-- Run by CI against plain Postgres after auth_stub.sql, the migrations and seed.sql.
\set ON_ERROR_STOP 1
grant usage on schema public to authenticated;
grant usage on schema public to service_role;
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

-- cardio: the client logs their own, their coach reads, nobody else sees; tokens stay server-side
reset role;
grant all on public.activities, public.device_connections, public.device_tokens, public.recovery_days to authenticated;
insert into device_connections (client_id, provider, athlete_name) values ('00000000-0000-0000-0000-0000000000c1', 'strava', 'Priya S.');
insert into device_tokens (client_id, provider, access_token, refresh_token, expires_at) values ('00000000-0000-0000-0000-0000000000c1', 'strava', 'secret', 'secret', now());
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into activities (sport, name, started_at, distance_m, moving_seconds, source, external_id, detail)
  values ('run', 'Morning run', now(), 5012.3, 1500, 'strava', '123', '{"splits":[]}');
do $$ begin
  assert (select count(*) from activities) = 1, 'client sees own activity';
  assert (select client_id from activities) = '00000000-0000-0000-0000-0000000000c1', 'client_id defaults to the signed-in client';
  assert (select count(*) from device_connections) = 1, 'client sees own connection';
  assert (select count(*) from device_tokens) = 0, 'client cannot read tokens';
  begin
    insert into activities (sport, name, started_at, source, external_id) values ('run', 'Twice', now(), 'strava', '123');
    raise exception 'same Strava activity saved twice';
  exception when unique_violation then null; end;
  begin
    insert into activities (client_id, sport, name, started_at) values ('00000000-0000-0000-0000-0000000000c2', 'run', 'forged', now());
    raise exception 'client logged an activity for someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into activities (sport, name, started_at) values ('parkour', 'x', now());
    raise exception 'unknown sport accepted';
  exception when check_violation then null; end;
  begin
    insert into device_connections (client_id, provider) values ('00000000-0000-0000-0000-0000000000c1', 'strava');
    raise exception 'client wrote a connection';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from activities) = 1, 'coach reads client activity';
  assert (select count(*) from device_connections) = 1, 'coach sees client connection';
  assert (select count(*) from device_tokens) = 0, 'coach cannot read tokens';
  update activities set name = 'edited by coach';
  assert (select name from activities) = 'Morning run', 'coach cannot edit client activity';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from activities) = 0, 'rival sees no activities';
  assert (select count(*) from device_connections) = 0, 'rival sees no connections';
end $$;
reset role;

-- recovery: same rules as cardio
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into recovery_days (day, source, sleep_minutes, hrv_ms, resting_hr) values (current_date, 'oura', 432, 61.5, 52);
insert into recovery_days (day, source, sleep_minutes, hrv_ms) values (current_date, 'oura', 440, 63)
  on conflict (client_id, day, source) do update set sleep_minutes = excluded.sleep_minutes, hrv_ms = excluded.hrv_ms;
do $$ begin
  assert (select count(*) from recovery_days) = 1, 'one row per morning per source';
  assert (select sleep_minutes from recovery_days) = 440, 'a re-sync updates the morning';
  begin
    insert into recovery_days (client_id, day, source) values ('00000000-0000-0000-0000-0000000000c2', current_date, 'manual');
    raise exception 'client wrote recovery for someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into recovery_days (day, source, hrv_ms) values (current_date - 1, 'manual', 900);
    raise exception 'impossible HRV accepted';
  exception when check_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from recovery_days) = 1, 'coach reads client recovery';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from recovery_days) = 0, 'rival sees no recovery';
end $$;
reset role;
insert into device_connections (client_id, provider) values ('00000000-0000-0000-0000-0000000000c1', 'whoop');
do $$ begin
  begin
    insert into device_connections (client_id, provider) values ('00000000-0000-0000-0000-0000000000c1', 'myspace');
    raise exception 'unknown provider accepted';
  exception when check_violation then null; end;
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


-- habits, nutrition and the questionnaire
reset role;
insert into client_habits (id, client_id, title) values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','Rival client habit');
set role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into client_habits (id, client_id, kind, title) values ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','water','Drink 2.5 L of water');
insert into nutrition_targets (client_id, kcal, protein_g, carbs_g, fat_g) values ('00000000-0000-0000-0000-0000000000c1',1900,120,210,60);
do $$ begin
  assert (select count(*) from client_habits) = 1, 'coach sees own client habits only';
  begin
    insert into client_habits (client_id, title) values ('00000000-0000-0000-0000-0000000000c2','poach');
    raise exception 'coach set a habit for a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into habit_ticks (habit_id, client_id, day) values ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','2026-11-02');
insert into food_entries (client_id, day, meal, name, kcal, protein_g) values ('00000000-0000-0000-0000-0000000000c1','2026-11-02','lunch','Chicken and rice',600,45);
insert into intake_forms (client_id, answers, health_flags) values ('00000000-0000-0000-0000-0000000000c1','{"goal":"Lose 5 kg"}',1);
do $$ begin
  assert (select count(*) from client_habits) = 1, 'client reads own habits';
  assert (select kcal from nutrition_targets) = 1900, 'client reads own targets';
  begin
    insert into habit_ticks (habit_id, client_id, day) values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','2026-11-02');
    raise exception 'client ticked someone else''s habit';
  exception when insufficient_privilege then null; end;
  begin
    insert into client_habits (client_id, title) values ('00000000-0000-0000-0000-0000000000c1','self-made');
    raise exception 'client created a habit';
  exception when insufficient_privilege then null; end;
  begin
    insert into nutrition_targets (client_id, kcal, protein_g, carbs_g, fat_g) values ('00000000-0000-0000-0000-0000000000c1',5000,1,1,1);
    raise exception 'client set own targets';
  exception when insufficient_privilege or unique_violation then null; end;
end $$;
update nutrition_targets set kcal = 5000;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from habit_ticks) = 1, 'coach sees client ticks';
  assert (select count(*) from food_entries) = 1, 'coach sees client food log';
  assert (select health_flags from intake_forms) = 1, 'coach reads the questionnaire';
  assert (select kcal from nutrition_targets) = 1900, 'client cannot change targets';
end $$;

-- rest-day targets: the coach sets them, bad numbers are refused
update nutrition_targets set rest_day = '{"kcal":1600,"protein_g":120,"carbs_g":145,"fat_g":60}';
do $$ begin
  assert (select (rest_day->>'carbs_g')::int from nutrition_targets) = 145, 'coach sets rest-day targets';
  begin
    update nutrition_targets set rest_day = '{"kcal":99999,"protein_g":1,"carbs_g":1,"fat_g":1}';
    raise exception 'bad rest day accepted';
  exception when check_violation then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from habit_ticks) = 0, 'rival sees no ticks';
  assert (select count(*) from food_entries) = 0, 'rival sees no food log';
  assert (select count(*) from intake_forms) = 0, 'rival sees no questionnaire';
  assert (select count(*) from nutrition_targets) = 0, 'rival sees no targets';
end $$;
reset role;

-- water tracker
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into water_entries (client_id, day, ml) values ('00000000-0000-0000-0000-0000000000c1','2026-11-02',250);
do $$ begin
  assert (select count(*) from water_entries) = 1, 'client logs own water';
  begin
    insert into water_entries (client_id, day, ml) values ('00000000-0000-0000-0000-0000000000c2','2026-11-02',250);
    raise exception 'client logged water for someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into water_entries (client_id, day, ml) values ('00000000-0000-0000-0000-0000000000c1','2026-11-02',0);
    raise exception 'logged an empty drink';
  exception when check_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select sum(ml) from water_entries) = 250, 'coach sees client water';
end $$;
delete from water_entries;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from water_entries) = 1, 'coach cannot delete client water';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from water_entries) = 0, 'rival sees no water';
end $$;
reset role;

-- meal plans: the coach writes their own client's plan, the client only reads it, nobody else sees it
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into meal_plans (client_id, plan) values ('00000000-0000-0000-0000-0000000000c1','{"days":[{"id":"d1","name":"Training day","meals":{"breakfast":[],"lunch":[],"dinner":[],"snack":[]}}],"note":"Eat well"}');
do $$ begin
  assert (select plan->>'note' from meal_plans) = 'Eat well', 'coach writes client plan';
  begin
    insert into meal_plans (client_id, plan) values ('00000000-0000-0000-0000-0000000000c2','{"days":[],"note":""}');
    raise exception 'coach wrote a plan for a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
update meal_plans set plan = '{"days":[],"note":"hacked"}';
do $$ begin
  assert (select plan->>'note' from meal_plans) = 'Eat well', 'client cannot change the plan';
  begin
    insert into meal_plans (client_id, plan) values ('00000000-0000-0000-0000-0000000000c1','{"days":[],"note":""}');
    raise exception 'client wrote own plan';
  exception when insufficient_privilege or unique_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from meal_plans) = 0, 'rival sees no meal plan';
end $$;
reset role;

-- automatic messages
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into coach_automations (coach_id, welcome_on, welcome_body, missed_on, missed_body, checkin_on, checkin_body, send_hour, timezone)
values ('00000000-0000-0000-0000-00000000000c', true, 'Welcome {first_name}! {coach}', true, 'Hi {first_name}, {days} days since your last session', true, 'Check-in today, {first_name}', 9, 'Europe/London');
do $$ begin
  begin
    insert into coach_automations (coach_id) values ('00000000-0000-0000-0000-00000000000d');
    raise exception 'coach wrote another coach''s automations';
  exception when insufficient_privilege then null; end;
  begin
    perform public.run_automations();
    raise exception 'a signed-in user ran the automations';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Priya joined today with no coach message yet, check-in day Monday, no workouts. Monday 2026-11-09 10:00 London.
delete from messages where coach_id = '00000000-0000-0000-0000-00000000000c' and sender_id = '00000000-0000-0000-0000-00000000000c';
update coach_clients set started_at = '2026-11-08 09:00+00', check_in_day = 0 where client_id = '00000000-0000-0000-0000-0000000000c1';
delete from check_ins where client_id = '00000000-0000-0000-0000-0000000000c1';
delete from sessions where client_id = '00000000-0000-0000-0000-0000000000c1';
-- Other clients of this coach get their own reminders; these checks count Priya's sends only.
create function pg_temp.priya_sends() returns bigint language sql as $$ select count(*) from automation_sends where client_id = '00000000-0000-0000-0000-0000000000c1' $$;
do $$ begin
  perform public.run_automations('2026-11-09 10:00+00');
  assert pg_temp.priya_sends() = 2, format('welcome and check-in reminder go, got %s', pg_temp.priya_sends());
  assert (select count(*) from messages where body = 'Welcome Priya! Kamal') = 1, 'welcome filled in';
  assert (select count(*) from messages where body = 'Check-in today, Priya') = 1, 'reminder filled in';
  perform public.run_automations('2026-11-09 11:00+00');
  assert pg_temp.priya_sends() = 2, 'nothing goes twice';
  -- Six days later, still no workout: the missed nudge goes once, and not the welcome again.
  perform public.run_automations('2026-11-14 10:00+00');
  assert pg_temp.priya_sends() = 3, 'missed nudge goes';
  assert (select count(*) from messages where body like 'Hi Priya, 6 days since%') = 1, 'missed nudge counts days';
  perform public.run_automations('2026-11-15 10:00+00');
  assert pg_temp.priya_sends() = 3, 'one nudge per gap';
  -- Next Monday before the send hour: the reminder waits.
  perform public.run_automations('2026-11-16 07:00+00');
  assert pg_temp.priya_sends() = 3, 'reminder waits for the send hour';
  perform public.run_automations('2026-11-16 09:30+00');
  assert pg_temp.priya_sends() = 4, 'next week''s reminder goes at the send hour';
  assert (select count(*) from messages where client_id = '00000000-0000-0000-0000-0000000000c2' and sender_id = '00000000-0000-0000-0000-00000000000d') = 0, 'rival client untouched';
end $$;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from automation_sends) = 0, 'client cannot see the send log';
  assert (select count(*) from coach_automations) = 0, 'client cannot read coach settings';
end $$;
reset role;
-- Low-protein nudge: three logged days under 80% of the 120 g target sends once; a good day or a recent send stops it.
update coach_automations set protein_on = true, protein_body = 'Protein low, {first_name}' where coach_id = '00000000-0000-0000-0000-00000000000c';
delete from food_entries where client_id = '00000000-0000-0000-0000-0000000000c1';
insert into food_entries (client_id, day, meal, name, kcal, protein_g) values
  ('00000000-0000-0000-0000-0000000000c1','2026-11-20','lunch','Pasta',600,40),
  ('00000000-0000-0000-0000-0000000000c1','2026-11-21','lunch','Pasta',600,40),
  ('00000000-0000-0000-0000-0000000000c1','2026-11-22','lunch','Steak',600,110);
create function pg_temp.protein_sends() returns bigint language sql as $$ select count(*) from automation_sends where client_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'protein' $$;
do $$ begin
  perform public.run_automations('2026-11-23 10:00+00');
  assert pg_temp.protein_sends() = 0, 'a good protein day stops the nudge';
  update food_entries set protein_g = 50 where day = '2026-11-22';
  perform public.run_automations('2026-11-23 07:00+00');
  assert pg_temp.protein_sends() = 0, 'protein nudge waits for the send hour';
  perform public.run_automations('2026-11-23 10:00+00');
  assert pg_temp.protein_sends() = 1, 'three low days send the protein nudge';
  assert (select count(*) from messages where body = 'Protein low, Priya') = 1, 'protein nudge filled in';
  insert into food_entries (client_id, day, meal, name, kcal, protein_g) values ('00000000-0000-0000-0000-0000000000c1','2026-11-23','lunch','Pasta',600,40);
  perform public.run_automations('2026-11-24 10:00+00');
  assert pg_temp.protein_sends() = 1, 'protein nudge at most once a week';
  delete from food_entries where client_id = '00000000-0000-0000-0000-0000000000c1' and day >= '2026-11-20';
end $$;

-- video form checks
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into form_checks (id, client_id, exercise_id, exercise_name, note, storage_path, coach_reply)
values ('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1',1,'Trap Bar Deadlift','Back flat?','00000000-0000-0000-0000-0000000000c1/a.mp4','self-praise');
insert into storage.objects (bucket_id, name) values ('form-videos','00000000-0000-0000-0000-0000000000c1/a.mp4');
do $$ begin
  assert (select coach_reply from form_checks) is null, 'client cannot write a coach reply';
  begin
    insert into form_checks (client_id, exercise_name, storage_path) values ('00000000-0000-0000-0000-0000000000c1','x','00000000-0000-0000-0000-0000000000c2/x.mp4');
    raise exception 'client registered a video in someone else''s folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('form-videos','00000000-0000-0000-0000-0000000000c2/x.mp4');
    raise exception 'client uploaded into someone else''s folder';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update form_checks set coach_reply = 'Flat back, nice. Push the floor away.', reviewed_at = now(), note = 'changed';
do $$ begin
  assert (select coach_reply from form_checks) like 'Flat back%', 'coach replies';
  assert (select note from form_checks) = 'Back flat?', 'coach cannot change what the client sent';
  assert (select count(*) from storage.objects where bucket_id = 'form-videos') = 1, 'coach can watch the video';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update form_checks set coach_reply = 'poach';
do $$ begin
  assert (select count(*) from form_checks) = 0, 'rival sees no form checks';
  assert (select count(*) from storage.objects where bucket_id = 'form-videos') = 0, 'rival cannot watch the video';
end $$;
reset role;
do $$ begin
  assert (select coach_reply from form_checks) like 'Flat back%', 'rival cannot reply';
end $$;

-- goals
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into client_goals (id, client_id, kind, title, exercise_id, target, start_value) values ('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','lift','Trap bar 80 kg',1,80,60);
do $$ begin
  begin
    insert into client_goals (client_id, kind, target) values ('00000000-0000-0000-0000-0000000000c2','bodyweight',60);
    raise exception 'coach set a goal for a client that is not theirs';
  exception when insufficient_privilege then null; end;
  begin
    insert into client_goals (client_id, kind, target, title) values ('00000000-0000-0000-0000-0000000000c1','custom',10,' ');
    raise exception 'custom goal saved without a name';
  exception when check_violation then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into client_goals (client_id, kind, title, target, unit, start_value, current_value) values ('00000000-0000-0000-0000-0000000000c1','custom','Strict pull-ups',5,'reps',0,2);
update client_goals set current_value = 3 where kind = 'custom';
do $$ begin
  assert (select count(*) from client_goals) = 2, 'client sees own goals, coach-set and own';
  begin
    insert into client_goals (client_id, kind, target) values ('00000000-0000-0000-0000-0000000000c2','bodyweight',60);
    raise exception 'client set a goal for someone else';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select current_value from client_goals where kind = 'custom') = 3, 'coach sees the client''s update';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
delete from client_goals;
do $$ begin
  assert (select count(*) from client_goals) = 0, 'rival sees no goals';
end $$;
reset role;
do $$ begin
  assert (select count(*) from client_goals) = 2, 'rival cannot delete goals';
end $$;

-- booking calendar
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into coach_booking_settings (coach_id, windows) values ('00000000-0000-0000-0000-00000000000c','[{"weekday":0,"start_min":540,"end_min":600}]');
insert into bookings (coach_id, client_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1', now() + interval '2 days', now() + interval '2 days 30 minutes');
do $$ begin
  begin
    insert into bookings (coach_id, client_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c2', now() + interval '3 days', now() + interval '3 days 30 minutes');
    raise exception 'coach booked a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into bookings (id, coach_id, client_id, starts_at, ends_at, kind, note)
values ('90000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1', date_trunc('hour', now()) + interval '5 days', date_trunc('hour', now()) + interval '5 days 30 minutes', 'session', 'Leg day together');
do $$ begin
  assert (select count(*) from coach_booking_settings) = 1, 'client reads coach hours';
  assert (select count(*) from bookings) = 2, 'client sees own bookings';
  assert (select count(*) from public.booking_busy('00000000-0000-0000-0000-00000000000c', now(), now() + interval '14 days')) = 2, 'client sees taken slots';
  begin
    insert into bookings (coach_id, client_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1', date_trunc('hour', now()) + interval '5 days', date_trunc('hour', now()) + interval '5 days 30 minutes');
    raise exception 'double booking accepted';
  exception when unique_violation then null; end;
  begin
    insert into bookings (coach_id, client_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-0000000000c1', now() + interval '1 day', now() + interval '1 day 30 minutes');
    raise exception 'client booked a coach that is not theirs';
  exception when insufficient_privilege then null; end;
  begin
    insert into bookings (coach_id, client_id, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1', now() - interval '1 day', now() - interval '23 hours');
    raise exception 'client booked in the past';
  exception when insufficient_privilege then null; end;
  begin
    insert into coach_booking_settings (coach_id) values ('00000000-0000-0000-0000-0000000000c1');
    raise exception 'client set booking hours';
  exception when insufficient_privilege then null; end;
end $$;
update bookings set status = 'cancelled', starts_at = starts_at - interval '1 day', note = 'moved' where kind = 'session';
do $$ begin
  assert (select status from bookings where kind = 'session') = 'cancelled', 'client cancels';
  assert (select note from bookings where kind = 'session') = 'Leg day together', 'client can only cancel, not change';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from bookings) = 0, 'rival sees no bookings';
  assert (select count(*) from coach_booking_settings) = 0, 'rival sees no hours';
  assert (select count(*) from public.booking_busy('00000000-0000-0000-0000-00000000000c', now(), now() + interval '14 days')) = 0, 'rival sees no taken slots';
end $$;
reset role;

-- challenges
reset role;
update profiles set full_name = 'Priya Sharma' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into challenges (id, coach_id, title, metric, unit, starts_on, ends_on) values
  ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','Step it up','logged','steps', current_date - 2, current_date + 10),
  ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000c','Most sessions','sessions','sessions', current_date - 2, current_date + 10);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into challenge_members (challenge_id, client_id) values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1'),('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1');
insert into challenge_logs (challenge_id, client_id, day, value) values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1', current_date, 8000),('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1', current_date - 1, 9500);
insert into sessions (client_id, started_at, finished_at) values ('00000000-0000-0000-0000-0000000000c1', now() - interval '1 hour', now());
do $$ begin
  assert (select count(*) from challenges) = 2, 'client sees coach challenges';
  assert (select total from public.challenge_board('a0000000-0000-0000-0000-000000000001')) = 17500, 'logged numbers add up';
  assert (select name from public.challenge_board('a0000000-0000-0000-0000-000000000001')) = 'Priya S.', 'first name and initial only';
  assert (select is_me from public.challenge_board('a0000000-0000-0000-0000-000000000001')), 'client sees which line is theirs';
  assert (select total from public.challenge_board('a0000000-0000-0000-0000-000000000002')) >= 1, 'finished sessions count';
  begin
    insert into challenge_logs (challenge_id, client_id, day, value) values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1', current_date + 30, 5);
    raise exception 'logged a day outside the challenge';
  exception when insufficient_privilege then null; end;
  begin
    insert into challenge_logs (challenge_id, client_id, day, value) values ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1', current_date, 5);
    raise exception 'logged by hand on a session challenge';
  exception when insufficient_privilege then null; end;
  begin
    insert into challenges (coach_id, title, metric, unit, starts_on, ends_on) values ('00000000-0000-0000-0000-0000000000c1','Mine','logged','km', current_date, current_date);
    raise exception 'client created a challenge';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from challenge_members) = 2, 'coach sees who joined';
  assert (select count(*) from public.challenge_board('a0000000-0000-0000-0000-000000000001')) = 1, 'coach sees the board';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
do $$ begin
  assert (select count(*) from challenges) = 0, 'another coach''s client sees no challenges';
  assert (select count(*) from public.challenge_board('a0000000-0000-0000-0000-000000000001')) = 0, 'and no board';
  begin
    insert into challenge_members (challenge_id, client_id) values ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2');
    raise exception 'joined another coach''s challenge';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- resource library, private notes and tags
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into coach_resources (coach_id, title, body) values ('00000000-0000-0000-0000-00000000000c','Protein made simple','A palm of protein at each meal.');
insert into coach_resources (coach_id, client_id, title, url) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','Your knee plan','https://example.com/knee.pdf');
insert into coach_client_notes (coach_id, client_id, body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','Old knee injury');
insert into coach_client_tags (coach_id, client_id, tags) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','{VIP,Injury}');
do $$ begin
  begin
    insert into coach_resources (coach_id, title, url) values ('00000000-0000-0000-0000-00000000000c','Bad','javascript:alert(1)');
    raise exception 'script link accepted';
  exception when check_violation then null; end;
  begin
    insert into coach_client_notes (coach_id, client_id, body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c2','Poach');
    raise exception 'coach noted a client that is not theirs';
  exception when insufficient_privilege then null; end;
  begin
    insert into coach_resources (coach_id, client_id, title, body) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c2','x','y');
    raise exception 'coach shared with a client that is not theirs';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from coach_resources) = 2, 'client sees shared and own resources';
  assert (select count(*) from coach_client_notes) = 0, 'client never sees coach notes';
  assert (select count(*) from coach_client_tags) = 0, 'client never sees coach tags';
  begin
    insert into coach_resources (coach_id, title, body) values ('00000000-0000-0000-0000-00000000000c','Mine','x');
    raise exception 'client added a resource';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from coach_resources) = 0, 'rival sees no resources';
  assert (select count(*) from coach_client_notes) = 0, 'rival sees no notes';
end $$;
reset role;
-- Another coach's client sees neither the shared nor the personal resource.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
do $$ begin
  assert (select count(*) from coach_resources) = 0, 'other client sees no resources';
end $$;
reset role;

-- coach recipes: the coach writes them, their clients read them, nobody else sees them
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into coach_recipes (id, coach_id, recipe) values ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','{"name":"Coach wrap","meal":"lunch","minutes":10,"tags":[],"ingredients":[{"foodId":1,"factor":1}],"steps":["Fill it."]}');
do $$ begin
  begin
    insert into coach_recipes (coach_id, recipe) values ('00000000-0000-0000-0000-00000000000d','{"name":"Fake"}');
    raise exception 'coach wrote a recipe as someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into coach_recipes (coach_id, recipe) values ('00000000-0000-0000-0000-00000000000c','[1]');
    raise exception 'recipe that is not an object accepted';
  exception when check_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from coach_recipes) = 1, 'client reads their coach''s recipes';
  update coach_recipes set recipe = '{"name":"Hacked"}';
  assert (select recipe->>'name' from coach_recipes) = 'Coach wrap', 'client cannot change a recipe';
  begin
    insert into coach_recipes (coach_id, recipe) values ('00000000-0000-0000-0000-00000000000c','{"name":"Mine"}');
    raise exception 'client added a recipe';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from coach_recipes) = 0, 'rival coach sees no recipes';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
do $$ begin
  assert (select count(*) from coach_recipes) = 0, 'another coach''s client sees no recipes';
end $$;
reset role;

-- privacy: consents, a copy of my data, deleting my account
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into user_consents (user_id, kind, version) values ('00000000-0000-0000-0000-0000000000c1','terms','v1'),('00000000-0000-0000-0000-0000000000c1','health','v1');
update user_consents set given_at = now() - interval '1 year';
do $$
declare d jsonb := public.export_my_data();
begin
  assert (select count(*) from user_consents) = 2, 'client sees own consents';
  assert (select count(*) from user_consents where given_at < now() - interval '1 day') = 0, 'client cannot rewrite a consent';
  assert d->'profile'->>'full_name' = 'Priya Sharma', 'export has my profile';
  assert jsonb_array_length(d->'data'->'sessions') = 1, 'export has my sessions';
  assert d->'data' ? 'messages', 'export has my messages';
  assert d->'data' ? 'user_consents', 'export has my consents';
  assert not (d->'data' ? 'coach_client_notes'), 'export leaves out the coach''s private notes';
  assert not (d->'data' ? 'coach_client_tags'), 'export leaves out the coach''s private tags';
  begin
    insert into user_consents (user_id, kind, version) values ('00000000-0000-0000-0000-0000000000c2','health','v1');
    raise exception 'client consented for someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into user_consents (user_id, kind, version, withdrawn_at) values ('00000000-0000-0000-0000-0000000000c1','adult','v1', now());
    raise exception 'client inserted a withdrawn consent';
  exception when insufficient_privilege then null; end;
end $$;
select public.withdraw_consent('health');
do $$ begin
  assert (select withdrawn_at is not null from user_consents where kind = 'health'), 'client withdrew health consent';
end $$;
insert into user_consents (user_id, kind, version) values ('00000000-0000-0000-0000-0000000000c1','health','v1');
do $$ begin
  assert (select count(*) from user_consents where kind = 'health') = 2, 'agreeing again keeps the withdrawn record';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$
declare d jsonb := public.export_my_data();
begin
  assert (select count(*) from user_consents) = 3, 'coach sees own client''s consents';
  assert d->'data' ? 'coach_client_notes', 'coach export has the coach''s own notes';
  assert not (d->'data' ? 'sessions'), 'coach export has no client sessions';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from user_consents) = 0, 'rival sees no consents';
end $$;
select pg_temp.as_user('');
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'signed-out caller deleted something';
  exception when raise_exception then
    if sqlerrm <> 'Sign in first.' then raise; end if;
  end;
end $$;
reset role;
update program_versions set published_by = '00000000-0000-0000-0000-00000000000c';

-- team: only the coach and clients who joined see the feed; names are short; high fives are one each
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 0, 'not in the team yet: no feed';
  begin
    insert into team_posts (coach_id, author_id, kind, title) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','workout','Before joining');
    raise exception 'posted without joining';
  exception when insufficient_privilege then null; end;
end $$;
insert into team_members (coach_id, client_id) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1');
insert into team_posts (id, coach_id, author_id, kind, title, detail) values ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','workout','Lower A done','18 sets');
insert into team_high_fives (post_id, user_id) values ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1');
do $$ begin
  assert (select count(*) from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 1, 'member sees the feed';
  assert (select author from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 'Priya S.', 'short name only';
  assert (select fives from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 1, 'high five counted';
  assert (select i_fived and is_me from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)), 'my post, my high five';
  assert (select count(*) from public.team_effort('00000000-0000-0000-0000-00000000000c', current_date - 6)) = 1, 'effort board lists members';
  begin
    insert into team_posts (coach_id, author_id, kind, title) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000c','note','Spoofed coach');
    raise exception 'posted as the coach';
  exception when insufficient_privilege then null; end;
  begin
    insert into team_members (coach_id, client_id) values ('00000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-0000000000c1');
    raise exception 'joined another coach''s team';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into team_posts (coach_id, author_id, kind, title) values ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000c','note','Great week, team');
insert into team_high_fives (post_id, user_id) values ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 2, 'coach sees the whole feed';
  assert (select fives from public.team_feed('00000000-0000-0000-0000-00000000000c', 20) where kind = 'workout') = 2, 'two high fives';
  assert (select is_coach from public.team_feed('00000000-0000-0000-0000-00000000000c', 20) where kind = 'note'), 'coach post marked';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
do $$ begin
  assert (select count(*) from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 0, 'another coach''s client sees no feed';
  assert (select count(*) from team_posts) = 0, 'and no posts';
  assert (select count(*) from public.team_effort('00000000-0000-0000-0000-00000000000c', current_date - 6)) = 0, 'and no effort board';
  begin
    insert into team_high_fives (post_id, user_id) values ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2');
    raise exception 'high-fived a post they cannot see';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
delete from team_members where client_id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  assert (select count(*) from public.team_feed('00000000-0000-0000-0000-00000000000c', 20)) = 0, 'left the team: feed gone';
end $$;
reset role;

-- Each account type deletes cleanly: the rival's client, then Kamal (with programs, messages, notes),
-- then Priya, whose own history survives her coach leaving.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select public.delete_my_account();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from auth.users where id in ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000c')) = 0, 'both sign-ins gone';
  assert (select count(*) from profiles where id in ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-00000000000c')) = 0, 'both profiles gone';
  assert (select count(*) from check_ins where client_id = '00000000-0000-0000-0000-0000000000c2') = 0, 'deleted client''s check-ins gone';
  assert (select count(*) from programs) = 0 and (select count(*) from coach_client_notes) = 0, 'coach''s programs and notes gone';
  assert (select count(*) from sessions where client_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'client keeps own sessions when the coach leaves';
end $$;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000c1') = 0, 'client deleted';
  assert (select count(*) from user_consents) = 0, 'consents go with the account';
end $$;

-- APEX Twin: voice and decisions are the coach's own; clients never see them
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1'),('00000000-0000-0000-0000-0000000000e2'),('00000000-0000-0000-0000-0000000000e3');
insert into profiles values ('00000000-0000-0000-0000-0000000000e1','coach','Twin Coach'),('00000000-0000-0000-0000-0000000000e2','client','Twin Client'),('00000000-0000-0000-0000-0000000000e3','client','Not Mine');
insert into coach_clients (coach_id, client_id) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into twin_voice (coach_id, sign_off, phrases) values ('00000000-0000-0000-0000-0000000000e1','Kamal','{"missed":"{first}, let''s go {coach}"}');
insert into twin_decisions (coach_id, client_id, week_of, situation, adjust, status, drafted, sent) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','2026-11-02','progress','progress','approved','Hi','Hi');
do $$ begin
  begin
    insert into twin_decisions (coach_id, client_id, week_of, situation, adjust, status) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e3','2026-11-02','steady','hold','approved');
    raise exception 'coach decided for a client that is not theirs';
  exception when insufficient_privilege then null; end;
  begin
    insert into twin_decisions (coach_id, client_id, week_of, situation, adjust, status) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','2026-11-02','steady','hold','approved');
    raise exception 'two decisions for one client in one week';
  exception when unique_violation then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  assert (select count(*) from twin_decisions) = 0, 'client never sees twin decisions';
  assert (select count(*) from twin_voice) = 0, 'client never sees the coach''s voice';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from twin_decisions) = 0, 'rival sees no twin decisions';
end $$;
reset role;

-- Email alerts: only the edge function sees who to email; people switch their own emails off
reset role;
update auth.users set email = 'twin.client@example.com' where id = '00000000-0000-0000-0000-0000000000e2';
update auth.users set email = 'twin.coach@example.com' where id = '00000000-0000-0000-0000-0000000000e1';
insert into messages (coach_id, client_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e1','Old news', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e1','First', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e1','Great work today', now() - interval '30 minutes'),
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e2','Too fresh', now() - interval '2 minutes');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
do $$ begin
  begin
    perform public.pending_email_alerts();
    raise exception 'a signed-in user listed email alerts';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mark_email_alerts_sent(array[]::uuid[]);
    raise exception 'a signed-in user marked email alerts';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from email_alert_sends;
    assert (select count(*) from email_alert_sends) = 0, 'people cannot see email sends';
  end;
end $$;
set role service_role;
do $$ declare r record; begin
  select * into r from public.pending_email_alerts();
  assert r.user_id = '00000000-0000-0000-0000-0000000000e2', 'the client is due an email';
  assert r.email = 'twin.client@example.com' and r.first_name = 'Twin', 'email and first name';
  assert r.unread = 2 and r.latest = 'Great work today', 'two waiting messages, newest first';
  assert (select count(*) from public.pending_email_alerts()) = 1, 'coach has nothing old enough yet';
  perform public.mark_email_alerts_sent(r.message_ids);
  assert (select count(*) from public.pending_email_alerts()) = 0, 'nothing twice';
end $$;
reset role;
insert into messages (coach_id, client_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e1','Another', now() - interval '20 minutes');
set role service_role;
do $$ begin
  assert (select count(*) from public.pending_email_alerts()) = 0, 'at most one email an hour';
  assert (select count(*) from public.pending_email_alerts(now() + interval '2 hours', interval '15 minutes') where user_id = '00000000-0000-0000-0000-0000000000e2') = 1, 'next hour it goes';
end $$;
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into email_prefs (user_id, messages_on) values ('00000000-0000-0000-0000-0000000000e2', false);
do $$ begin
  begin
    insert into email_prefs (user_id) values ('00000000-0000-0000-0000-0000000000e1');
    raise exception 'set someone else''s email prefs';
  exception when insufficient_privilege then null; end;
end $$;
set role service_role;
do $$ begin
  assert (select count(*) from public.pending_email_alerts(now() + interval '2 hours', interval '15 minutes') where user_id = '00000000-0000-0000-0000-0000000000e2') = 0, 'switched off means no email';
end $$;
reset role;



-- Growth: public coach page, requests to train, friend codes
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000f1'),('00000000-0000-0000-0000-0000000000f2'),('00000000-0000-0000-0000-0000000000f3');
insert into profiles values ('00000000-0000-0000-0000-0000000000f1','coach','Grow Coach'),('00000000-0000-0000-0000-0000000000f2','client','Fiona Client'),('00000000-0000-0000-0000-0000000000f3','client','Not Theirs');
insert into coach_clients (coach_id, client_id) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2');
grant execute on function public.public_coach_page(text) to anon;
grant execute on function public.request_to_train(text, text, text, text, text, text) to anon;
grant usage on schema public to anon;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin
  begin
    insert into coach_pages (coach_id, slug, headline) values ('00000000-0000-0000-0000-0000000000f2','fiona','Me');
    raise exception 'a client made a coach page';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into coach_pages (coach_id, slug, headline, bio, show_clients) values ('00000000-0000-0000-0000-0000000000f1','grow-coach','Get strong','Hi', true);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.public_coach_page('grow-coach')) = 0, 'unpublished page is hidden';
end $$;
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
update coach_pages set published = true where coach_id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ declare c text; begin
  c := public.my_referral_code('00000000-0000-0000-0000-0000000000f1');
  assert c ~ '^[a-z0-9]{8}$', 'friend code made';
  assert public.my_referral_code('00000000-0000-0000-0000-0000000000f1') = c, 'same code next time';
  perform set_config('test.ref', c, false);
  begin
    perform public.my_referral_code('00000000-0000-0000-0000-00000000000d');
    raise exception 'friend code for someone else''s coach';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
do $$ begin
  assert (select count(*) from referral_codes) = 0, 'other people''s codes are hidden';
  assert (select count(*) from coach_pages) = 0, 'not their coach: page row hidden';
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare p record; begin
  select * into p from public.public_coach_page('Grow-Coach');
  assert p.name = 'Grow Coach' and p.headline = 'Get strong' and p.clients = 1, 'published page is public';
  perform public.request_to_train('grow-coach', 'Leo Martin', 'Leo@Example.com', 'Run further', 'Half marathon', current_setting('test.ref'));
  perform public.request_to_train('grow-coach', 'Hana Ito', 'hana@example.com');
  begin
    perform public.request_to_train('grow-coach', 'Leo Again', 'leo@example.com');
    raise exception 'asked twice';
  exception when unique_violation then null; end;
  begin
    perform public.request_to_train('nobody-here', 'Leo', 'leo@example.com');
    raise exception 'asked a page that does not exist';
  exception when no_data_found then null; end;
  begin
    perform 1 from join_requests;
    raise exception 'anon read requests';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into invites (token, coach_id) values ('f0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f1');
update join_requests set status = 'invited', invite_token = 'f0000000-0000-0000-0000-000000000001' where email = 'leo@example.com';
do $$ begin
  assert (select count(*) from public.coach_join_requests()) = 2, 'coach sees both requests';
  assert (select referred_by from public.coach_join_requests() where email = 'leo@example.com') = 'Fiona C.', 'coach sees who sent the friend';
  assert (select referred_by from public.coach_join_requests() where email = 'hana@example.com') is null, 'no referrer';
end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000f4');
insert into profiles values ('00000000-0000-0000-0000-0000000000f4','client','Leo Martin');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select public.accept_invite('f0000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
do $$ begin
  assert (select asked from public.my_referrals('00000000-0000-0000-0000-0000000000f1')) = 1, 'my friend asked';
  assert (select joined from public.my_referrals('00000000-0000-0000-0000-0000000000f1')) = 1, 'and joined';
  assert (select count(*) from join_requests) = 0, 'clients never read requests';
  assert (select slug from coach_pages) = 'grow-coach', 'client reads own coach''s page for the invite link';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.coach_join_requests()) = 0, 'rival sees no requests';
  begin
    update coach_pages set headline = 'Hacked';
    assert (select count(*) from coach_pages) = 0, 'rival sees no page rows';
  end;
end $$;
reset role;


-- gyms: owner a1, manager a2, trainers a3 and a4, outside coach a5. Clients b1 (a1's), b2 (a3's), b3 (a5's).
insert into auth.users values ('00000000-0000-0000-0000-0000000009a1'),('00000000-0000-0000-0000-0000000009a2'),('00000000-0000-0000-0000-0000000009a3'),('00000000-0000-0000-0000-0000000009a4'),('00000000-0000-0000-0000-0000000009a5'),('00000000-0000-0000-0000-0000000009b1'),('00000000-0000-0000-0000-0000000009b2'),('00000000-0000-0000-0000-0000000009b3');
insert into profiles values ('00000000-0000-0000-0000-0000000009a1','coach','Gym Owner'),('00000000-0000-0000-0000-0000000009a2','coach','Gym Manager'),('00000000-0000-0000-0000-0000000009a3','coach','Trainer Three'),('00000000-0000-0000-0000-0000000009a4','coach','Trainer Four'),('00000000-0000-0000-0000-0000000009a5','coach','Outside Coach'),('00000000-0000-0000-0000-0000000009b1','client','Bea One'),('00000000-0000-0000-0000-0000000009b2','client','Ben Two'),('00000000-0000-0000-0000-0000000009b3','client','Bo Three');
insert into coach_clients (coach_id, client_id) values ('00000000-0000-0000-0000-0000000009a1','00000000-0000-0000-0000-0000000009b1'),('00000000-0000-0000-0000-0000000009a3','00000000-0000-0000-0000-0000000009b2'),('00000000-0000-0000-0000-0000000009a5','00000000-0000-0000-0000-0000000009b3');
insert into programs (coach_id, client_id, name) values ('00000000-0000-0000-0000-0000000009a1','00000000-0000-0000-0000-0000000009b1','Gym plan');
insert into sessions (client_id, started_at, finished_at) values ('00000000-0000-0000-0000-0000000009b2', now() - interval '2 days', now() - interval '2 days');
set role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000009b1');
do $$ begin
  begin perform public.create_gym('Client Gym'); raise exception 'a client started a gym'; exception when insufficient_privilege then null; end;
end $$;

create temp table gym_tokens (role text, token uuid);
grant all on gym_tokens to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
select public.create_gym('Test Gym');
insert into gym_tokens select 'manager', public.create_gym_invite('manager');
insert into gym_tokens select 'trainer3', public.create_gym_invite('trainer');
insert into gym_tokens select 'trainer4', public.create_gym_invite('trainer');
do $$ begin
  assert (select my_role from public.my_gym()) = 'owner', 'creator owns the gym';
  assert (select count(*) from gym_invites) = 3, 'owner sees open invites';
  begin perform public.create_gym('Second'); raise exception 'joined two gyms'; exception when unique_violation then null; end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000009a2');
select public.accept_gym_invite((select token from gym_tokens where role = 'manager'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a3');
select public.accept_gym_invite((select token from gym_tokens where role = 'trainer3'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a4');
select public.accept_gym_invite((select token from gym_tokens where role = 'trainer4'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a5');
do $$ begin
  begin perform public.accept_gym_invite((select token from gym_tokens where role = 'trainer3')); raise exception 'used invite worked twice'; exception when no_data_found then null; end;
  assert (select count(*) from public.gym_clients()) = 0, 'outside coach sees no gym clients';
  assert (select count(*) from public.gym_team()) = 0, 'outside coach sees no team';
  assert (select count(*) from gyms) = 0, 'outside coach sees no gym';
  assert (select count(*) from gym_members) = 0, 'outside coach sees no members';
  begin perform public.hand_over_gym_client('00000000-0000-0000-0000-0000000009b1','00000000-0000-0000-0000-0000000009a5'); raise exception 'outsider handed a client over'; exception when insufficient_privilege then null; end;
end $$;

-- trainer: own clients only, can't invite, can't hand over, can't read invites
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a3');
do $$ begin
  assert (select my_role from public.my_gym()) = 'trainer', 'joined as trainer';
  assert (select count(*) from public.gym_team()) = 4, 'trainer sees the team';
  assert (select count(*) from public.gym_clients()) = 1, 'trainer sees own client only';
  assert (select sessions_7 from public.gym_clients()) = 1, 'session counted';
  assert (select count(*) from gym_invites) = 0, 'trainer reads no invites';
  begin perform public.create_gym_invite('trainer'); raise exception 'trainer invited'; exception when insufficient_privilege then null; end;
  begin perform public.hand_over_gym_client('00000000-0000-0000-0000-0000000009b2','00000000-0000-0000-0000-0000000009a4'); raise exception 'trainer handed over'; exception when insufficient_privilege then null; end;
  begin perform public.share_gym_client('00000000-0000-0000-0000-0000000009b1','00000000-0000-0000-0000-0000000009a3', true); raise exception 'trainer shared someone else''s client'; exception when insufficient_privilege then null; end;
  begin perform public.remove_gym_member('00000000-0000-0000-0000-0000000009a4'); raise exception 'trainer removed a teammate'; exception when insufficient_privilege then null; end;
  assert (select count(*) from profiles where full_name = 'Bea One') = 0, 'gym does not open other trainers'' client profiles';
end $$;
-- trainer shares own client with a teammate, who then sees them
select public.share_gym_client('00000000-0000-0000-0000-0000000009b2','00000000-0000-0000-0000-0000000009a4', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a4');
do $$ begin
  assert (select count(*) from public.gym_clients()) = 1, 'shared trainer sees the shared client';
  assert (select client_name from public.gym_clients()) = 'Ben Two', 'the right one';
  assert (select count(*) from programs) = 0, 'sharing does not open the programme tables';
  assert (select count(*) from sessions where client_id = '00000000-0000-0000-0000-0000000009b2') = 0, 'or raw sessions';
end $$;

-- manager: every client, invites trainers but not managers, can't change roles or remove the owner
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a2');
do $$ begin
  assert (select count(*) from public.gym_clients()) = 2, 'manager sees every trainer''s clients';
  assert (select jsonb_array_length(shared_with) from public.gym_clients() where client_name = 'Ben Two') = 1, 'manager sees the share';
  perform public.create_gym_invite('trainer');
  begin perform public.create_gym_invite('manager'); raise exception 'manager made a manager'; exception when insufficient_privilege then null; end;
  begin perform public.set_gym_role('00000000-0000-0000-0000-0000000009a3','manager'); raise exception 'manager changed a role'; exception when insufficient_privilege then null; end;
  begin perform public.remove_gym_member('00000000-0000-0000-0000-0000000009a1'); raise exception 'manager removed the owner'; exception when insufficient_privilege then null; end;
  begin perform public.hand_over_gym_client('00000000-0000-0000-0000-0000000009b3','00000000-0000-0000-0000-0000000009a3'); raise exception 'manager took an outside client'; exception when no_data_found then null; end;
end $$;
-- manager hands b1 from the owner to trainer a3: a3 becomes their coach and owns the programme
select public.hand_over_gym_client('00000000-0000-0000-0000-0000000009b1','00000000-0000-0000-0000-0000000009a3');
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a3');
do $$ begin
  assert (select count(*) from public.gym_clients()) = 2, 'new trainer sees the handed-over client';
  assert (select count(*) from programs where name = 'Gym plan') = 1, 'new trainer owns the programme';
  assert public.is_coach_of('00000000-0000-0000-0000-0000000009b1'), 'new trainer coaches them';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
do $$ begin
  assert not public.is_coach_of('00000000-0000-0000-0000-0000000009b1'), 'old trainer no longer coaches them';
  assert (select count(*) from programs where name = 'Gym plan') = 0, 'old trainer no longer edits the programme';
  assert (select count(*) from public.gym_clients()) = 2, 'owner still sees both through the gym';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009b1');
do $$ begin
  assert (select coach_id from coach_clients where status <> 'ended') = '00000000-0000-0000-0000-0000000009a3', 'client now has the new trainer';
  assert (select count(*) from programs) = 1, 'client still trains from the same programme';
end $$;

-- owner: changes a role, removes a trainer (shares end), can't leave, closes the gym
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
select public.set_gym_role('00000000-0000-0000-0000-0000000009a4','manager');
select public.remove_gym_member('00000000-0000-0000-0000-0000000009a3');
do $$ begin
  assert (select role from public.gym_team() where full_name = 'Trainer Four') = 'manager', 'role changed';
  assert (select count(*) from public.gym_team()) = 3, 'trainer removed';
  assert (select count(*) from gym_client_shares) = 0, 'their shares ended';
  assert (select count(*) from public.gym_clients()) = 0, 'their clients left with them';
  begin perform public.remove_gym_member('00000000-0000-0000-0000-0000000009a1'); raise exception 'owner left'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a3');
do $$ begin
  assert (select count(*) from public.my_gym()) = 0, 'removed trainer is out';
  assert public.is_coach_of('00000000-0000-0000-0000-0000000009b2'), 'and keeps their own client';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009a1');
select public.close_gym();
do $$ begin
  assert (select count(*) from public.my_gym()) = 0, 'gym closed';
end $$;
reset role;

-- Push notifications: people manage only their own devices; the sending functions are service-role only.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000a3');
insert into profiles values ('00000000-0000-0000-0000-0000000000a1','coach','Push Coach'),('00000000-0000-0000-0000-0000000000a2','client','Priya Push'),('00000000-0000-0000-0000-0000000000a3','client','Other Push');
insert into coach_clients (coach_id, client_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
insert into messages (coach_id, client_id, sender_id, body) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2','Hip felt fine');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.save_push_subscription('https://push.example.com/coach-phone', repeat('p', 87), repeat('a', 22), 'iPhone');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.save_push_subscription('https://push.example.com/priya-phone', repeat('p', 87), repeat('a', 22), 'Android');
do $$ begin
  assert (select count(*) from push_subscriptions) = 1, 'client sees only own device';
  assert (select count(*) from push_config) = 0, 'nobody reads the signing keys';
  perform public.remove_push_subscription('https://push.example.com/coach-phone');
  begin
    perform public.pending_push_alerts();
    raise exception 'client called a sending function';
  exception when insufficient_privilege then null; end;
  begin
    perform public.push_config_get();
    raise exception 'client read the push config';
  exception when insufficient_privilege then null; end;
end $$;
-- A shared phone moves to whoever turns notifications on last.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select public.save_push_subscription('https://push.example.com/priya-phone', repeat('q', 87), repeat('b', 22), 'Android');
reset role;
do $$ begin
  assert (select count(*) from push_subscriptions where endpoint = 'https://push.example.com/coach-phone') = 1, 'someone else could not remove the coach''s device';
  assert (select user_id from push_subscriptions where endpoint = 'https://push.example.com/priya-phone') = '00000000-0000-0000-0000-0000000000a3', 'shared device moved';
end $$;
set role service_role;
do $$ declare r record; begin
  select * into r from public.pending_push_alerts() where user_id = '00000000-0000-0000-0000-0000000000a1';
  assert r.unread >= 1, 'coach has an unread message to hear about';
  assert 'Priya' = any(r.senders), 'sender named';
  assert jsonb_array_length(r.subscriptions) = 1, 'sent to the coach''s phone';
  perform public.mark_push_sent(r.message_ids);
  assert not exists (select 1 from public.pending_push_alerts() where user_id = '00000000-0000-0000-0000-0000000000a1'), 'never pushed twice';
  assert (select public_key from public.push_config_set_keys('pub1', 'priv1')) = 'pub1', 'keys saved';
  assert (select public_key from public.push_config_set_keys('pub2', 'priv2')) = 'pub1', 'keys never swapped once set';
  assert length((select cron_secret from public.push_config_get())) = 64, 'cron secret made';
end $$;
reset role;

-- Video calls: the coach's own meeting link must be https.
insert into coach_booking_settings (coach_id, video_link) values ('00000000-0000-0000-0000-0000000000a1', 'https://zoom.us/j/123');
do $$ begin
  begin
    update coach_booking_settings set video_link = 'javascript:alert(1)' where coach_id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'saved a non-https link';
  exception when check_violation then null; end;
end $$;

-- Custom check-in questions: the coach writes them, their client reads and answers, nobody else sees them.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into coach_check_in_forms (coach_id, questions) values ('00000000-0000-0000-0000-0000000000a1', '[{"id":"q-1","text":"Steps ok?","kind":"yesno"}]');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into check_ins (id, client_id, weight_kg, answers) values ('c0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 60, '[{"id":"q-1","question":"Steps ok?","kind":"yesno","value":true}]');
do $$ begin
  assert (select jsonb_array_length(questions) from coach_check_in_forms) = 1, 'client reads own coach''s questions';
  begin
    update coach_check_in_forms set questions = '[]';
    assert (select jsonb_array_length(questions) from coach_check_in_forms) = 1, 'client cannot change the questions';
  end;
  begin
    insert into coach_check_in_forms (coach_id) values ('00000000-0000-0000-0000-0000000000a2');
    raise exception 'client made a question form';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  assert (select count(*) from coach_check_in_forms) = 0, 'other clients see nothing';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update check_ins set answers = '[]', coach_reply = 'Great' where id = 'c0000000-0000-0000-0000-0000000000a2';
do $$ begin
  assert (select answers->0->>'value' from check_ins where id = 'c0000000-0000-0000-0000-0000000000a2') = 'true', 'coach cannot change answers';
  assert (select coach_reply from check_ins where id = 'c0000000-0000-0000-0000-0000000000a2') = 'Great', 'coach can still reply';
end $$;
reset role;

-- Reminders: a client's own settings only; a workout reminder on a training day, once; a check-in alert for the coach, once.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.save_push_subscription('https://push.example.com/priya-new', repeat('p', 87), repeat('a', 22), 'Android');
insert into push_reminders (user_id, workout_at, timezone) values ('00000000-0000-0000-0000-0000000000a2', 420, 'Europe/London');
do $$ begin
  begin
    insert into push_reminders (user_id) values ('00000000-0000-0000-0000-0000000000a1');
    raise exception 'set someone else''s reminders';
  exception when insufficient_privilege then null; end;
  begin
    perform public.take_push_reminders();
    raise exception 'client took reminders';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.save_push_subscription('https://push.example.com/coach-new', repeat('p', 87), repeat('a', 22), 'iPhone');
reset role;
-- A program for Priya with Lower A on Mondays. 2026-11-16 is a Monday; 07:05 in London is 07:05 UTC in November.
insert into programs (id, coach_id, client_id, name, weeks, created_at) values ('10000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','Push test',4,'2026-11-02');
insert into program_versions (id, program_id, version, published_at) values ('20000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2',1,now());
insert into workouts (program_version_id, name, week, day_index, est_minutes) values ('20000000-0000-0000-0000-0000000000a2','Lower A',3,0,45),('20000000-0000-0000-0000-0000000000a2','Upper A',3,2,40);
set role service_role;
do $$ declare r record; begin
  assert (select count(*) from public.take_push_reminders('2026-11-16 06:50+00')) = 0, 'not before the chosen time';
  select * into r from public.take_push_reminders('2026-11-16 07:05+00') where user_id = '00000000-0000-0000-0000-0000000000a2';
  assert r.title = 'Lower A today', 'names today''s workout';
  assert r.body like '45 min.%', 'says how long';
  assert jsonb_array_length(r.subscriptions) = 1, 'to the client''s phone';
  assert (select count(*) from public.take_push_reminders('2026-11-16 07:06+00')) = 0, 'once a day';
  assert (select count(*) from public.take_push_reminders('2026-11-17 07:05+00')) = 0, 'no reminder on a rest day';
  assert (select count(*) from public.take_checkin_alerts()) >= 0, 'runs';
end $$;
reset role;
insert into check_ins (client_id, weight_kg) values ('00000000-0000-0000-0000-0000000000a2', 61.5);
set role service_role;
do $$ declare r record; begin
  select * into r from public.take_checkin_alerts() where user_id = '00000000-0000-0000-0000-0000000000a1';
  assert r.title = 'Priya sent a check-in', 'coach told';
  assert r.body like 'Weight 61.5%', 'with the weight';
  assert not exists (select 1 from public.take_checkin_alerts() where user_id = '00000000-0000-0000-0000-0000000000a1'), 'once per check-in';
end $$;
reset role;
