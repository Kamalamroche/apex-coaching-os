# Sign-in providers

The sign-in screen offers Google, Apple and an email link. Each provider is switched on in Supabase
(Authentication → Sign In / Providers). Until a provider is switched on, its button shows
"provider is not enabled". The email link always works.

Supabase callback URL (needed by Google and Apple):
`https://ptxtshirthnzovfbdyav.supabase.co/auth/v1/callback`

## Google (free)

1. Google Cloud Console → create a project "APEX".
2. Google Auth Platform → Branding: app name APEX, support email, authorised domain `supabase.co`
   and `vercel.app` (or your own domain later). Audience: External.
3. Clients → Create client → Web application.
   - Authorised JavaScript origins: `https://apex-coaching-os-web.vercel.app`
   - Authorised redirect URIs: the Supabase callback URL above.
4. Copy the Client ID and Client secret into Supabase → Sign In / Providers → Google, switch it on, save.

## Apple (needs an Apple Developer account)

1. developer.apple.com → Certificates, Identifiers & Profiles.
2. Identifiers → App ID with "Sign in with Apple" ticked.
3. Identifiers → Services ID (for example `com.apex.signin`), tick "Sign in with Apple", configure:
   - Domains: `ptxtshirthnzovfbdyav.supabase.co`
   - Return URL: the Supabase callback URL above.
4. Keys → new key with "Sign in with Apple" → download the `.p8` file (only downloadable once).
5. Supabase → Sign In / Providers → Apple: enter the Services ID as Client ID, plus Team ID,
   Key ID and the `.p8` contents (Supabase generates the secret). Switch it on and save.
   Apple secrets expire every 6 months; renew before then.

## Email

The built-in Supabase email sender allows only a few emails per hour. Before real clients join,
connect a mail provider under Authentication → Emails → SMTP settings.
