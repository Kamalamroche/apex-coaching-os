# Sign-in options

The sign-in screen offers, in this order:

1. **Continue with Google** and **Continue with Apple**: one tap, straight into the app.
2. **Email + password**: "Create account" or "Sign in". With email confirmation switched off (step 1 below)
   a new account opens the app straight away, no email to wait for.
3. **Email me a sign-in link**: the old way, kept for forgotten passwords and people without a password.

The one-tap buttons come first; the email form opens from "Continue with email" (it opens straight away
in app browsers, where one tap can't work). The button used last time on that device is marked
"Last used". After Google or Apple, the name they share is saved automatically, so people land in
the app with no extra screen. Only email sign-ups are asked their name.

The screen reads Supabase's public settings, so a button only shows once its provider is switched on.
Nothing needs changing in Vercel.

Supabase callback URL (Google and Apple both need it):
`https://ptxtshirthnzovfbdyav.supabase.co/auth/v1/callback`

## 1. No confirmation email (2 minutes)

Supabase → Authentication → Sign In / Providers → **Email**:

- Email provider: on.
- **Confirm email: off.** Save.

New email + password accounts now go straight into the app. Trade-off: nobody proves they own the
email address. Client accounts still need the coach's invite link, so a stranger can't join a coach.

Also check Authentication → URL Configuration: Site URL `https://apex-coaching-os-web.vercel.app`
and redirect URL `https://apex-coaching-os-web.vercel.app/**` (already set in October).

## 2. Google (free, about 10 minutes)

1. Open https://console.cloud.google.com and sign in with your Google account.
2. Top bar → project picker → **New project** → name it `APEX` → Create. Make sure it's selected.
3. Menu → **Google Auth Platform** → Get started.
   - App name `APEX`, user support email: yours. Next.
   - Audience: **External**. Next.
   - Contact email: yours. Next, tick the agreement, **Create**.
4. Google Auth Platform → **Branding** → Authorised domains → add `supabase.co` and `vercel.app`. Save.
5. Google Auth Platform → **Clients** → **Create client**:
   - Application type: **Web application**, name `APEX web`.
   - Authorised JavaScript origins: `https://apex-coaching-os-web.vercel.app`
   - Authorised redirect URIs: the Supabase callback URL above.
   - Create. Copy the **Client ID** and **Client secret** (keep the secret private).
6. Google Auth Platform → **Audience** → **Publish app** (otherwise only test users you list can sign in).
7. Supabase → Authentication → Sign In / Providers → **Google**: switch on, paste Client ID and
   Client secret, Save.

Test: open `/coach/` in Safari or Chrome → Continue with Google. If you already have an APEX account
with the same Gmail address, Google signs you into that same account.

## 3. Apple (needs the Apple Developer Program, about £79 a year)

Only worth it once you're ready to pay for the developer account (the same account the Apple Watch
and iPhone app will need later). Until then the Apple button stays hidden.

1. developer.apple.com → Certificates, Identifiers & Profiles.
2. Identifiers → App ID with "Sign in with Apple" ticked.
3. Identifiers → Services ID (for example `com.apex.signin`), tick "Sign in with Apple", Configure:
   - Domains: `ptxtshirthnzovfbdyav.supabase.co`
   - Return URL: the Supabase callback URL above.
4. Keys → new key with "Sign in with Apple" → download the `.p8` file (it can only be downloaded once).
5. Supabase → Sign In / Providers → Apple: Services ID as Client ID, plus Team ID, Key ID and the
   `.p8` contents. Switch on, Save. Apple's secret expires every 6 months: renew before then.

## In-app browsers

Google blocks sign-in inside app browsers (a link opened from Gmail, Instagram, WhatsApp…). The
screen spots these, says so, and offers a "Copy this page's link" button to open it in Safari or
Chrome. Email + password works everywhere, and the session survives in those browsers for the tab.

## Email limits

The built-in Supabase sender allows only a few emails per hour. Sign-in links and password resets
use it, so connect Resend under Authentication → Emails → SMTP settings (see `docs/email.md`).
