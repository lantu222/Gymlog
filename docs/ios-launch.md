# iOS launch — same day as Android

Goal: Android and iOS go live on the same day. The JS app is shared; this
lists what iOS needs beyond it.

## Done in the repo

- `app.json` → `ios.bundleIdentifier` `app.vinha`, `buildNumber`, and
  `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance question
  on every upload; the app only uses HTTPS).
- `eas.json` → `preview` (internal / TestFlight-style device build) and
  `production` profiles.
- `app.config.js` → turns `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` into the Google
  Sign-In URL scheme. Without it, iOS has no sign-in (googleAuth.ts) and
  prebuild still succeeds.
- Android-only native pieces already degrade on iOS without code changes:
  `modules/home-widget` (no widget card), `modules/exact-alarm` (iOS needs no
  grant; rest alerts go through expo-notifications).

## Manual steps

1. **Apple Developer Program** (99 USD / year). Create the App ID
   `app.vinha` and the App Store Connect record "Vinha Fitness".
2. **Google Cloud Console** → same project as the Android client → create an
   **iOS** OAuth client for bundle id `app.vinha`. Its id goes to
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (EAS env for the iOS profiles).
3. **Sign in with Apple — decide before submitting.** App Review guideline 4.8
   expects an equivalent privacy-focused login when an app offers a
   third-party one. Either add Apple sign-in to the backup flow, or ship iOS
   1.0 without `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (backup hidden on iOS).
4. Build: `npx eas build -p ios --profile production`, then
   `npx eas submit -p ios` → TestFlight.
5. Store listing: 6.7" and 6.5" iPhone screenshots (iPad too, since
   `supportsTablet` is on), privacy nutrition labels (mirror
   `docs/play-data-safety.md`), support URL, privacy policy URL.
6. After approval set `APP_STORE_URL_IOS` (docs/app-updates.md).
7. Use "Manual release" in App Store Connect and press release the same
   moment the Play release goes to production.

## Not in iOS 1.0

- Home-screen widget (needs a WidgetKit extension in Swift).
