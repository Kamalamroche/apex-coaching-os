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

# Recovery from watches and rings

**Progress → Recovery** shows last night's sleep (with stages), HRV and resting heart rate against the client's own last two weeks, stress, strain and steps. The readiness check before a session fills in sleep, energy and stress from this morning's numbers; the client checks them and always answers soreness.

Sources: Whoop, Oura, Fitbit / Pixel Watch and Polar (connect from Connected apps), Garmin once Garmin approves the app, or numbers typed in by hand.

## Setting up a provider (each is free, do only the ones you want)

For each one: create a developer app, set its redirect address to `https://apex-coaching-os-web.vercel.app/client/`, then copy its two codes (client id and client secret).

| Provider | Where | Codes go in Supabase secrets as | And in Vercel as |
| --- | --- | --- | --- |
| Whoop | developer-dashboard.whoop.com | `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` | `VITE_WHOOP_CLIENT_ID` |
| Oura | cloud.ouraring.com/oauth/applications | `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET` | `VITE_OURA_CLIENT_ID` |
| Fitbit | dev.fitbit.com/apps/new (type: Server) | `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` | `VITE_FITBIT_CLIENT_ID` |
| Polar | admin.polaraccesslink.com | `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET` | `VITE_POLAR_CLIENT_ID` |
| Garmin | developer.garmin.com/gc-developer-program (apply; Garmin reviews) | later | later |

Then deploy once: `npx supabase functions deploy wearables --project-ref ptxtshirthnzovfbdyav`, and redeploy on Vercel.

Code: `packages/core/src/recovery.ts` (mappers, baselines, readiness pre-fill), `packages/core/src/wearables.ts` (sign-in links), `supabase/functions/wearables` (tokens and API calls), `apps/web/src/app/RecoveryView.tsx`.
