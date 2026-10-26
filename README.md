# APEX Coaching OS

Coach OS and client app for personal trainers. Simple for the client, powerful for the coach.

Built with React, TypeScript, Vite and Supabase (database, auth, realtime). Stripe (billing) comes next. The design system is **Athletic Tech**: navy field, HELIX orange for actions, blue for structure, cyan for data, violet for AI.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, demo mode
```

- `/` landing page (marketing)
- `/start/` launcher: sign in or open a demo
- `/coach/` Coach OS: Brief, Clients, Builder, Nutrition, Business
- `/client/` Client app: Today, Train (guided player), Progress, Messages, More

### Demo mode

Runs with sample data and no backend: when no Supabase settings are present, or with `?demo` in the URL. Open the coach and client in two tabs, edit Priya's workout in the Builder, and the client tab updates straight away.

### Live mode (Supabase)

With Supabase settings the apps sign people in by email link:

1. A coach signs in at `/coach/` and sets up their account.
2. In Clients they create an invite link and send it to a client.
3. The client opens the link, signs in, and is linked to that coach.
4. The coach creates the client's program in the Builder. Edits save as they type and appear in the client's app live.
5. The client trains in the guided player. The finished session, every logged set, and messages land in the database and on the coach's Brief.

Sections not yet connected to real data (triage, progressions, nutrition, business, progress, habits, community) are marked "Sample data" in live mode.

Local live development:

```bash
npx supabase start           # local Supabase in Docker, applies migrations and seed
cp .env.example apps/web/.env.local   # then fill in the URL and publishable key it prints
npm run dev                  # sign-in emails arrive at http://127.0.0.1:54324
```

Production settings are in `apps/web/.env.production`. The publishable key is meant to be public; row level security protects the data.

## Checks

```bash
npm run check      # typecheck + unit tests + production build
supabase/tests/run.sh   # schema + row level security tests (needs DATABASE_URL to an empty Postgres)
```

Both run on every pull request.

## Layout

```
apps/web            Vite app. One origin, three pages, each with its own bundle
  src/app           Demo/live gate, app context
  src/auth          Email-link sign-in and first-time onboarding
  src/data          Supabase client, live store, coach queries
  src/landing       Marketing landing page
  src/launcher      App picker
  src/coach         Coach OS screens
  src/client        Client app screens, including the workout player
packages/core       Domain types, sample data and pure logic (search, builder edits,
                    AI adjustment diffs, session maths, DB row mapping, the store
                    interface and demo store). No UI.
packages/ui         Athletic Tech tokens, styles and shared components
supabase            Migrations, seed library and RLS tests
```

### One store, two implementations

Screens talk to the `ApexStore` interface in `packages/core/src/store.ts` (`get`, `subscribe`, `saveWorkout`, `finishSession`, `sendMessage`). The demo store keeps data in localStorage; the Supabase store (`apps/web/src/data/supabaseStore.ts`) reads and writes the database and stays live with Realtime. Row ↔ domain conversions live in `packages/core/src/db.ts` and are unit tested.

The demo shares data between tabs through localStorage, which only works within one origin, so the coach and client pages are served side by side. When the client app is wrapped for the app stores, `src/client` moves into its own app with no screen changes.

## Data model

See `supabase/migrations`. The short version:

- **One versioned program per client.** Publishing creates a new `program_versions` row. Clients only ever see published versions.
- **Prescribed vs logged.** `workout_items` is what the coach prescribed; `logged_sets` is what the client did. History is never overwritten.
- **AI is always a proposal.** Every AI draft or adjustment is an `ai_suggestions` row with its evidence, and nothing reaches a client until the coach accepts it.
- **Row level security on every table.** Coaches see their own clients; clients see themselves; nobody sees another coach's data. `supabase/tests/rls_test.sql` proves it.
- **Invites carry a random token, not the coach's id.** `accept_invite()` links one client account, once.

## Roadmap

Product audit, competitor analysis and roadmap live in the APEX product doc. Next steps:

1. Import the full 620-movement library (the app still reads exercise details from the sample library; seeded ids match)
2. Program versions: draft edits and an explicit Publish
3. Brief triage, check-ins, coach-side messaging and progress on real data
4. Stripe Billing for coach subscriptions, Stripe Connect for client payments
