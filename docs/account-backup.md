# Google sign-in & cloud backup — setup runbook

Last updated: 22 August 2026

Optional Google sign-in that backs the training data up to a server, so a new
phone restores it. Offered on the post-onboarding hand-off screen and in
Settings → YOUR DATA. Free and Pro alike (decision 2026-08-22). Apple sign-in
is deferred until an iOS version exists.

The whole feature is configuration-gated: a build without
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_BACKUP_API_URL` shows no
sign-in anywhere. No dead buttons.

## Files

- `api/backup.ts` — serverless endpoint: verify Google ID token, store/fetch/delete one blob per account
- `src/features/account/googleAuth.ts` — the only file that touches Google Sign-In
- `src/features/account/backupApi.ts` — the app's side of the endpoint
- `src/features/account/useAccountBackup.ts` — sign-in / backup / restore state machine
- `src/features/account/accountStore.ts` — `@vinha/account/v1` (identity, last backup time)
- `src/lib/accountBackup.ts` — payload build/parse/describe (pure, tested)

## What is stored where

One JSON blob per Google account in Vercel Blob, at
`backups/hmac_sha256(googleSub, BACKUP_PATH_SECRET).json` — deterministic for
the server, unguessable without the secret, and the URL never leaves the
endpoint. The payload is the app database (exercise library stripped, exactly
like the local save) plus the workout history. The active session is never
backed up.

## Manual steps, in this order

### 1. Google Cloud Console (identity)

1. Create/open a project at console.cloud.google.com.
2. **OAuth consent screen**: External, app name Vinha Fitness, your email.
   Scopes: only the default openid/email/profile.
3. **Credentials → Create credentials → OAuth client ID**, twice:
   - **Web application** → this client id is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
     (yes, the *web* one — the native library exchanges through it) and
     `GOOGLE_WEB_CLIENT_ID` on the server.
   - **Android** → package name `app.vinha`, plus the SHA-1 of BOTH keystores:
     - debug: `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android`
     - release: `keytool -list -v -keystore <release.keystore> -alias <alias>`
   Sign-in fails with DEVELOPER_ERROR when the SHA-1 or package is missing.

### 2. Vercel (storage + endpoint)

1. In the Vercel project (same one as the AI coach): **Storage → Create → Blob**.
   This injects `BLOB_READ_WRITE_TOKEN` automatically.
2. Environment variables (production):
   - `GOOGLE_WEB_CLIENT_ID` — the web client id from step 1
   - `BACKUP_PATH_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
     Changing it later orphans every stored backup.
   - `BACKUP_MAX_BYTES` — optional, default 2 MB
3. Deploy (`npx vercel`). Smoke test:
   `curl -X PUT https://<project>.vercel.app/api/backup -H 'authorization: Bearer nonsense' -d '{}'`
   must answer `401 INVALID_TOKEN` — not 500 (500 = missing env).

### 3. App build

1. Build env:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>`
   - `EXPO_PUBLIC_BACKUP_API_URL=https://<project>.vercel.app/api/backup`
2. The native module needs a prebuild (`npx expo prebuild` — the config plugin
   `@react-native-google-signin/google-signin` is already in app.json).
   Remember the local.properties restore afterwards (see project notes).
   An old dev client without the module degrades gracefully: sign-in reports
   "needs an app update" instead of crashing.

## Behavior contract (what the tests pin)

- Sign-in with no cloud backup → local data uploaded as the first backup.
- Sign-in on a fresh install with a cloud backup → restored automatically.
- Sign-in when BOTH sides hold data → the app asks; nothing is destroyed
  without a choice. "Keep this phone" overwrites the cloud on the spot.
- Auto-backup after logged work changes (8 s debounce), only while signed in.
- Backup success is only shown after the server accepted the write.
- Sign-out keeps local data; "Delete cloud backup" removes the server copy.
- The endpoint verifies the token audience on every request and never logs
  payloads (guarded in tests/releaseReadiness.test.cjs).
- The privacy policy describes the feature in both languages; the release
  guard fails if the plugin ships without that text.
