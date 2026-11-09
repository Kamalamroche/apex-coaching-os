# Push notifications

Phones and computers that switch notifications on (Account screen, or the "Never miss a message" card on
Today and Brief) get a notification about a minute after a new message arrives, if it is still unread.
Tapping it opens the app on Messages.

The same function also sends:
- **Workout reminders** (clients): on training days at the time they choose, naming the session ("Lower A today, 45 min").
- **Evening log** (clients, off by default): a nudge to log food, water and habits.
- **Check-in alerts** (coaches): when a client sends their weekly check-in.

Each person sets these under Account, Notifications. They need `20261117090000_reminders.sql`.

No keys or secrets to copy: the push function makes its signing keys on first use and keeps them in
`public.push_config`, and the every-minute cron job reads its secret from the same table.

## Setup (once)

1. **SQL.** Run `supabase/migrations/20261115090000_push_notifications.sql`, then `20261117090000_reminders.sql`, in the
   [SQL Editor](https://supabase.com/dashboard/project/ptxtshirthnzovfbdyav/sql/new). Expect
   "Success. No rows returned".
2. **Function.** Supabase dashboard, **Edge Functions**, **Deploy a new function**, **Via Editor**.
   Name it `push` (exactly), replace the sample code with all of `supabase/functions/push/index.ts`, and press
   **Deploy function**.
3. **Turn off "Verify JWT"** in the `push` function's **Details** (settings), then **Save**. The cron job calls it
   with its own secret rather than a sign-in, and the function checks sign-ins itself.

Optional: set an `APP_URL` secret if the app moves off https://apex-coaching-os-web.vercel.app.

## iPhone

Apple only allows web notifications for apps added to the Home Screen (iOS 16.4 or later). The app explains
the three taps when someone opens it in Safari.

## Checking it works

Account, Notifications, switch on, then **Send a test**. The cron job's runs are listed under
Integrations, Cron, `apex-push`.

## Updating the function

When `supabase/functions/push/index.ts` changes, open the `push` function in the dashboard, replace its code with
the new file and deploy again. Verify JWT stays off.
