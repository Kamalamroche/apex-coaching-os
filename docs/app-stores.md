# APEX in the App Store and Google Play

`apps/mobile` wraps the APEX web app (the same build Vercel serves) in a real iPhone and Android app
using Capacitor. Coaches and clients then download "APEX Coaching" from the stores instead of using
a website. The website keeps working exactly as before.

**Why Capacitor (new dependency):** it puts the existing web app inside a native app with one shared
codebase, so nothing is rebuilt twice. It's free and open source. Versions are pinned to 8.6.0.

## What it costs

| What | Cost | When |
|---|---|---|
| Apple Developer Program | about £79 a year ($99) | Before the first iPhone upload |
| Google Play Console | about £20 once ($25) | Before the first Android upload |
| Xcode (Mac) and Android Studio | Free | To build the apps |

## Before the first upload (can't be changed later)

- **App ID** `com.apexcoaching.app` in `apps/mobile/capacitor.config.json`. Once an app is in a store,
  its ID is permanent. If the app is renamed first, change this, then run `npx cap sync` again.
- **App name** "APEX Coaching" (the same config file). This one can change later.

## Build it (on Kamal's Mac)

1. Install Xcode from the Mac App Store, and Android Studio from developer.android.com.
2. In the repository folder, run `npm install`.
3. iPhone: `npm run ios -w @apex/mobile`. This builds the web app, copies it in and opens Xcode.
   In Xcode, choose your Apple team under Signing, pick a phone, and press Run.
4. Android: `npm run android -w @apex/mobile`. Android Studio opens. Press Run.
5. To upload: in Xcode use Product → Archive → Distribute App (App Store Connect). In Android Studio use
   Build → Generate Signed Bundle and upload the .aab file in the Play Console.

After any change to the web app, `npm run sync -w @apex/mobile` copies the latest build into both apps.

## Store listing checklist

- Screenshots from a real phone (6.7" iPhone and an Android phone). The demo mode works well for this.
- Privacy policy link: https://apex-coaching-os-web.vercel.app/legal/ (the legal details are still parked).
- Health data: the App Store asks about health and fitness data; answer that it's used for coaching only
  and never sold or used for adverts.
- Apple review: Apple rejects apps that are only a website in a box (guideline 4.2). APEX is a full
  signed-in coaching tool, which usually passes. Adding native push
  notifications (below) makes it safer.

## Known gaps (next steps)

- **Notifications:** web push doesn't run inside a store app on iPhone. The app hides the web
  notification switch there (`isNativeApp()` in `apps/web/src/app/native.ts`). Native push needs the
  `@capacitor/push-notifications` plugin, an Apple push key and Firebase for Android.
- **Email sign-in links** (magic links) point back to the app's own address, so they won't open the app. Signing in with email and
  password inside the app works. Universal links can fix this later.
- **Shared trainer pages** (`/c/<name>`) stay on the website, which is where people find them anyway.
