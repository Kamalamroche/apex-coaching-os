-- Rest-day nutrition targets: the coach can set different calories and macros for days with no workout.
-- Null = the same targets every day. Mirrors NutritionTargetsRow.rest_day in packages/core/src/lifestyle.ts.
-- The existing nutrition_targets policies cover the new column. Safe to run more than once.

alter table public.nutrition_targets add column if not exists rest_day jsonb;

alter table public.nutrition_targets drop constraint if exists nutrition_targets_rest_day_check;
alter table public.nutrition_targets add constraint nutrition_targets_rest_day_check check (
  rest_day is null or (
    jsonb_typeof(rest_day) = 'object'
    and (rest_day->>'kcal')::numeric between 0 and 10000
    and (rest_day->>'protein_g')::numeric between 0 and 1000
    and (rest_day->>'carbs_g')::numeric between 0 and 2000
    and (rest_day->>'fat_g')::numeric between 0 and 1000
  )
);
