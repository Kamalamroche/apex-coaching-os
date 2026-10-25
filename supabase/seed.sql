-- Starter exercise library (shared, owner_coach_id null). Same movements as the demo data.
-- The full 620-movement library is imported from the APEX Movement Library sheet in a later step.
insert into public.exercises (name, aliases, pattern, body_area, equipment, muscles, cues, common_mistake) values
  ('Barbell Back Squat', '{squat,"back squat"}', 'squat', 'Legs', 'Barbell', '{Quads,Glutes}', '{"Brace before you descend","Knees track over toes","Drive the floor away"}', 'Heels lifting at the bottom'),
  ('Romanian Deadlift', '{rdl,"stiff leg",romanian}', 'hinge', 'Legs', 'Barbell', '{Hamstrings,Glutes}', '{"Soft knees, push hips back","Bar stays against thighs","Stop when hips stop"}', 'Rounding the lower back'),
  ('Incline Bench Press', '{"incline press",bench}', 'push', 'Chest', 'Barbell', '{"Upper chest",Triceps}', '{"Shoulder blades pinned","Bar to upper chest","Press up and slightly back"}', 'Flaring elbows to 90°'),
  ('Pull-Up', '{chin,pullup,chin-up}', 'pull', 'Back', 'Bodyweight', '{Lats,Biceps}', '{"Start from a dead hang","Pull elbows to ribs","Chin over bar"}', 'Kipping without control'),
  ('Overhead Press', '{ohp,"military press"}', 'push', 'Shoulders', 'Barbell', '{Delts,Triceps}', '{"Glutes tight","Head through at lockout","Bar over mid-foot"}', 'Leaning back to press'),
  ('Barbell Row', '{"bent over row",row}', 'pull', 'Back', 'Barbell', '{Lats,Rhomboids}', '{"Hinge to 45°","Row to lower ribs","Pause at the top"}', 'Using momentum'),
  ('Dumbbell Lateral Raise', '{lateral,"side raise"}', 'isolation', 'Shoulders', 'Dumbbell', '{"Side delts"}', '{"Lead with elbows","Stop at shoulder height","Control the lowering"}', 'Shrugging'),
  ('Hip Thrust', '{"glute bridge",thrust}', 'hinge', 'Legs', 'Barbell', '{Glutes,Hamstrings}', '{"Chin tucked","Shins vertical at top","Squeeze for one second"}', 'Arching the lower back'),
  ('Goblet Squat', '{goblet}', 'squat', 'Legs', 'Dumbbell', '{Quads,Glutes}', '{"Elbows inside knees","Chest tall","Sit between heels"}', 'Knees caving in'),
  ('Leg Press', '{press}', 'squat', 'Legs', 'Machine', '{Quads,Glutes}', '{"Feet hip width","Lower to 90°","Don''t lock knees"}', 'Hips lifting off the pad'),
  ('Dumbbell Bench Press', '{"db bench",bench}', 'push', 'Chest', 'Dumbbell', '{Chest,Triceps}', '{"Wrists stacked","Lower to chest level","Press together"}', 'Bouncing at the bottom'),
  ('Lat Pulldown', '{pulldown,lat}', 'pull', 'Back', 'Cable', '{Lats,Biceps}', '{"Chest up","Pull to collarbone","Slow return"}', 'Leaning far back'),
  ('Face Pull', '{facepull,"rear delt"}', 'pull', 'Back', 'Cable', '{"Rear delts","Rotator cuff"}', '{"Thumbs back","Pull to eyes","Elbows high"}', 'Arching back'),
  ('Plank', '{"front plank",core}', 'core', 'Core', 'Bodyweight', '{Core}', '{"Ribs down","Squeeze glutes",Breathe}', 'Hips sagging'),
  ('Trap Bar Deadlift', '{"hex bar",deadlift}', 'hinge', 'Legs', 'Trap bar', '{Glutes,Quads,Back}', '{"Handles in line with ankles","Push the floor","Stand tall"}', 'Hips shooting up first');
