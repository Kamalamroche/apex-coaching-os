# Cardio and connected apps

Clients log runs, swims, rides, rows, walks and hikes in **Train → Cardio**. The coach sees them on the Brief.

## What works now

- **Log by hand**: sport, distance, time, average heart rate, how it felt.
- **Upload a watch file**: GPX, TCX or FIT (Garmin, Coros, Polar, Suunto, Wahoo, Zwift, Strava exports). Read in the browser, no upload to a third party. Gives the route map coloured by pace, pace / heart-rate / elevation chart, splits, heart-rate zones and best efforts (400 m to marathon) with PBs.
- **Strava** (once set up below): the client taps Connect, says yes on Strava, and their last 60 days come in. New activities come in each time they open Cardio (at most every 15 minutes) or tap Sync now.

## One-off setup

1. Run `supabase/migrations/20261029090000_activities.sql` in the Supabase SQL Editor.
2. Create a Strava API app (free): <https://www.strava.com/settings/api>
   - Authorization Callback Domain: `apex-coaching-os-web.vercel.app`
   - Read Strava's API Agreement first. It limits how one athlete's data can be shown to other people, so check that coach viewing is allowed for your use.
3. Deploy the edge function: `npx supabase functions deploy strava --project-ref ptxtshirthnzovfbdyav`
4. Supabase dashboard → Edge Functions → Secrets: add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.
5. Vercel → Settings → Environment Variables: add `VITE_STRAVA_CLIENT_ID` (the same id; it's public), then redeploy.

Until step 5 the Strava row says "Soon" and everything else works.

## How it fits together

- `packages/core/src/activity.ts`: distance, moving time, splits, zones, best efforts, formatting. Pure and tested.
- `packages/core/src/activityFiles.ts`: GPX, TCX and FIT readers, no library.
- `packages/core/src/strava.ts`: Strava activity → APEX activity, polyline decoding.
- `supabase/functions/strava`: swaps the code for tokens, refreshes them, fetches activities. Tokens live in `device_tokens`, which the browser can never read (RLS on, no policies).
- `apps/web/src/data/supabaseActivities.ts`: the live store; `ActivityContext.tsx` hands it to screens.

## Next

- Garmin Connect (needs Garmin's developer programme approval), Whoop, Oura, Polar and Fitbit: the same pattern as Strava (OAuth in an edge function). Whoop and Oura bring sleep, HRV and recovery, which can pre-fill the readiness check.
- Apple Health and Android Health Connect need a native phone app.
