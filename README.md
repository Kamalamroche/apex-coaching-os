# APEX Coaching OS

Coach OS and client app for personal trainers. Simple for the client, powerful for the coach.

Built with React, TypeScript and Vite. Supabase (database, auth, realtime) and Stripe (billing) come next. The design system is **Athletic Tech**: navy field, HELIX orange for actions, blue for structure, cyan for data, violet for AI.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

- `/` launcher, with a "Reset demo data" button
- `/coach/` Coach OS: Brief, Clients, Builder, Nutrition, Business
- `/client/` Client app: Today, Train (guided player), Progress, Messages, More

Open the coach and client in two tabs. Edit Priya's workout in the Builder and the client tab updates straight away. Finish the workout as Priya and it appears on the coach's Brief.

## Checks

```bash
npm run check      # typecheck + unit tests + production build
supabase/tests/run.sh   # schema + row level security tests (needs DATABASE_URL to an empty Postgres)
```

Both run on every pull request.

## Layout

```
apps/web            Vite app. One origin, three pages, each with its own bundle
  src/launcher      App picker
  src/coach         Coach OS screens
  src/client        Client app screens, including the workout player
packages/core       Domain types, sample data and pure logic (search, builder edits,
                    AI adjustment diffs, session maths, the shared store). No UI.
packages/ui         Athletic Tech tokens, styles and shared components
supabase            Migrations, seed library and RLS tests
```

### Why the apps share one origin for now

Until Supabase is connected, the coach and client share data through the demo store in `packages/core/src/store.ts`, which uses localStorage. Browsers only share localStorage within one origin, so both apps are served side by side. The store's `get / update / subscribe` shape is what the Supabase version will implement, backed by the database and Realtime. When the client app is wrapped for the app stores, `src/client` moves into its own app with no screen changes.

## Data model

See `supabase/migrations`. The short version:

- **One versioned program per client.** Publishing creates a new `program_versions` row. Clients only ever see published versions.
- **Prescribed vs logged.** `workout_items` is what the coach prescribed; `logged_sets` is what the client did. History is never overwritten.
- **AI is always a proposal.** Every AI draft or adjustment is an `ai_suggestions` row with its evidence, and nothing reaches a client until the coach accepts it.
- **Row level security on every table.** Coaches see their own clients; clients see themselves; nobody sees another coach's data. `supabase/tests/rls_test.sql` proves it.

## Roadmap

Product audit, competitor analysis and roadmap live in the APEX product doc. Next steps:

1. Connect Supabase: auth (coach and client sign-in), replace the demo store with the Supabase store
2. Import the full 620-movement library
3. Check-ins and messaging on real data
4. Stripe Billing for coach subscriptions, Stripe Connect for client payments
