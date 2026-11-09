# Email: sign-in links and message alerts

Supabase's built-in email only sends a few emails an hour and is meant for testing. Before real clients sign in, send email through **Resend** (free up to 3,000 emails a month, 100 a day).

There are two parts:

1. **Sign-in and invite emails** go through Resend as Supabase's mail server. This is settings only, no code.
2. **New message emails**: if a message waits unread for 15 minutes, APEX emails the person once (at most once an hour). People can switch these off under **Privacy and account → Emails**.

## 1. Resend account and your domain

1. Sign up at <https://resend.com> (free).
2. **Domains → Add domain**. Use a domain you own (for example `helixcoaching.co.uk`). A `vercel.app` address can't be used.
   - Resend shows a few DNS records (TXT and MX). Add them where you bought the domain, then click **Verify**. It usually takes minutes, sometimes a few hours.
   - Until the domain is verified, Resend only delivers to your own sign-up email address. That's fine for testing.
3. **API Keys → Create API key** (permission: Sending access). Copy it. It starts with `re_` and is only shown once.

## 2. Sign-in emails through Resend

Supabase dashboard → **Authentication → Emails → SMTP Settings** (<https://supabase.com/dashboard/project/ptxtshirthnzovfbdyav/auth/smtp>):

| Setting | Value |
| --- | --- |
| Enable custom SMTP | on |
| Sender email | `hello@yourdomain` (on the verified domain) |
| Sender name | `APEX` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `re_…` API key |

Save, then raise the limit under **Authentication → Rate Limits → emails sent per hour** (for example to 100).

## 3. New message emails

1. Run `supabase/migrations/20261107090000_email_alerts.sql` in the SQL Editor.
2. Deploy the function: `npx supabase functions deploy email-alerts --project-ref ptxtshirthnzovfbdyav`
3. Supabase dashboard → **Edge Functions → Secrets**, add:
   - `RESEND_API_KEY`: the `re_…` key
   - `EMAIL_FROM`: `APEX <hello@yourdomain>`
   - `APP_URL`: `https://apex-coaching-os-web.vercel.app`
   - `CRON_SECRET`: any long random text (a password generator is fine)
4. Run this in the SQL Editor to check every 10 minutes, putting your `CRON_SECRET` in place of the capitals:

```sql
create extension if not exists pg_net;
select cron.schedule('apex-email-alerts', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://ptxtshirthnzovfbdyav.supabase.co/functions/v1/email-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PASTE-YOUR-CRON-SECRET'),
    body := '{}'::jsonb
  )
$job$);
```

To stop it: `select cron.unschedule('apex-email-alerts');`

## 4. New enquiries (lead tools)

The same `email-alerts` function and cron job also send two emails for each new enquiry from a coach's form:

- **A welcome email to the person who asked**, in the coach's own words (Messages → Train with me → Enquiry form). It comes from `EMAIL_FROM`, is signed by the coach, and replies go to the coach's sign-in email.
- **An alert to the coach** with the person's goal, message and phone, and a link to their leads.

Steps: run `supabase/migrations/20261115090000_leads.sql`, then deploy the function again (`npx supabase functions deploy email-alerts --project-ref ptxtshirthnzovfbdyav`). No new secrets. Leads a coach adds by hand are never emailed, and enquiries older than two days are skipped, so switching this on never emails old leads. Both emails can be switched off per coach.

Until the domain is verified in Resend, these emails only reach your own Resend sign-up address; the pipeline and form work either way.

## How it fits together

- `supabase/migrations/20261107090000_email_alerts.sql`:
  - `email_prefs` holds each person's on/off switch.
  - `email_alert_sends` remembers which messages were already emailed.
  - `pending_email_alerts()` and `mark_email_alerts_sent()` can only be called by the function, never from the browser.
- `supabase/functions/email-alerts/content.ts` builds the email (subject, text and HTML in the app's colours). It is pure and tested in `content.test.ts`.
- `supabase/functions/email-alerts/index.ts` asks who is due an email, sends through Resend, and marks only what actually went, so a failed send is tried again next run.
- Emails only cover messages from the last 24 hours, so switching the job on never emails about old history.
