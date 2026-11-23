# Find a trainer

The public directory at `/trainers/`, the match quiz, the verified badge and Google-ready trainer pages.

## Setting it up

1. Run `supabase/migrations/20261130090000_marketplace.sql` in the Supabase SQL Editor.
2. Make yourself a certificate checker (once). Your page address is enough to find your account:

   ```sql
   insert into public.platform_admins (user_id)
   select coach_id from public.coach_pages where slug = 'your-page-address'
   on conflict do nothing;
   ```

3. Trainers join from Business → Your page and leads → Directory.

## How it works

- Only published pages whose trainer turned on "List me in Find a trainer" show (`public_trainers()`).
- Verified = an approved qualification and approved insurance, both in date (`coach_is_verified()`, mirrored by
  `isVerified()` in `packages/core/src/marketplace.ts`). The badge drops by itself when insurance runs out.
- Certificate files sit in the private `credentials` bucket under `<coach id>/`. Only the trainer and checkers can
  open them. Pages show the qualification name, never the file or insurance details.
- Enquiries from the directory are tagged `directory`, from the quiz `match`. Quiz answers prefill the enquiry form.
- `/c/<slug>/` is served by `api/page.ts`, which fills the page title, description and share preview for Google
  and link previews, then serves the same app. If anything fails it serves the plain page. `/sitemap.xml` is
  `api/sitemap.ts`. Both live in `vercel.json`.
