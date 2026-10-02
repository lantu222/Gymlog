# Google sign-in & cloud backup — setup runbook

Last updated: 22 August 2026

**Deployed state (2026-08-22):** project `vinha-fit/vinha`, production URL
`https://vinha-azure.vercel.app/api/backup` (the bare `vinha.vercel.app` was
taken by someone else). Server env complete, smoke-tested: a nonsense token
answers `INVALID_TOKEN`. `.vercelignore` limits the upload to api/ + src/ —
without it the CLI tried to push the whole 1.4 GB working tree.

Optional Google sign-in that backs the training data up to a server, so a new
phone restores it. Offered on the post-onboarding hand-off screen and in
Settings → YOUR DATA. Free and Pro alike (decision 2026-08-22). On iPhone,
Sign in with Apple sits beside Google (2026-10-01, App Review guideline 4.8) —
see "Sign in with Apple" below.

The whole feature is configuration-gated: a build without
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_BACKUP_API_URL` shows no
sign-in anywhere. No dead buttons.

## Files

- `api/backup.ts` — serverless endpoint: verify Google ID token, store/fetch/delete one blob per account
- `src/features/account/accountAuth.ts` — which sign-in the backup uses (the hook's only auth import)
- `src/features/account/googleAuth.ts` — the only file that touches Google Sign-In
- `src/features/account/appleAuth.ts` — the only file that touches Sign in with Apple (iPhone)
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

1. In the Vercel project: **Storage → Create → Blob** (EU region). Creating it
   from inside the project connects it automatically — `BLOB_STORE_ID` appears
   in the env list, and the SDK authenticates via the function's OIDC identity.
   There is no `BLOB_READ_WRITE_TOKEN` in this flow.
2. Environment variables (production):
   - `GOOGLE_WEB_CLIENT_ID` — the web client id from step 1
   - `BACKUP_PATH_SECRET` — any long random string (e.g. `openssl rand -hex 32`).
     Changing it later orphans every stored backup.
   - `BACKUP_MAX_BYTES` — optional, default 4 MB. Leave it unset: Vercel refuses
     bodies over 4.5 MB anyway, and the app gzips a backup whose JSON passes
     1 MB (`ACCOUNT_BACKUP_COMPRESS_ABOVE_CHARS`), so the cap is compressed bytes.
3. Deploy (`npx vercel`). Smoke test:
   `curl -X PUT https://vinha-azure.vercel.app/api/backup -H 'authorization: Bearer nonsense' -d '{}'`
   must answer `401 INVALID_TOKEN` — not 500 (500 = missing env).

### 3. App build

1. Build env:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>`
   - `EXPO_PUBLIC_BACKUP_API_URL=https://vinha-azure.vercel.app/api/backup`
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
- Every upload names the cloud copy it replaces: the version (blob ETag) this
  phone last wrote or restored, or `none` for a first backup, in the
  `x-backup-expected-version` header. The endpoint writes only over that copy
  and otherwise answers 412 `BACKUP_CHANGED` without writing, so a second
  phone on the account can no longer replace newer data with older. The
  automatic backup then stops for that run of the app; "Back up now" asks
  restore-or-keep about the copy that is there. An upload without the header
  (a build from before 2026-09-21) still overwrites, so installed phones keep
  backing up until they update. Deploy the endpoint before shipping the build:
  against an endpoint that sends no versions, the new build reads the copy
  before every upload.
- Auto-backup after logged work changes (8 s debounce), only while signed in.
- Backup success is only shown after the server accepted the write.
- Sign-out keeps local data; "Delete cloud backup" removes the server copy.
- "Reset all data" signs out FIRST, so the wipe cannot auto-backup an empty
  database over the cloud copy — the reset stays recoverable by signing in.
- The endpoint verifies the token audience on every request and never logs
  payloads (guarded in tests/releaseReadiness.test.cjs).
- The privacy policy describes the feature in both languages; the release
  guard fails if the plugin ships without that text.

## Sign in with Apple (iPhone)

An Apple identity token lives ten minutes and Apple has no silent refresh, so
the phone trades it once for an **Apple session** issued by `api/backup.ts`:

1. `POST /api/backup` with `x-backup-action: apple-session` and the Apple
   identity token as the bearer. The server checks the signature against
   Apple's published keys, the issuer, the expiry, and that the audience is
   `APPLE_BUNDLE_ID` (default `app.vinha`).
2. It answers `{ sessionToken: "vs1.…", expiresAt }` — 180 days, signed with a
   key derived from `BACKUP_PATH_SECRET`. The phone keeps it in
   `@vinha/account/apple/v1` and sends it as the bearer from then on.
3. Before each use the phone asks Apple (`getCredentialStateAsync`) whether
   the reader has removed Vinha from their Apple ID; revoked means signed out.
   In its last 30 days the phone renews it first (`x-backup-action:
   apple-renew`, the session as the bearer), so a reader who keeps training is
   never timed out. Only a session that has actually run out — months offline —
   counts as signed out, and the reader signs in again with one Face ID.

**Delete account (2026-10-02).** Settings → Delete account sends `DELETE` with
`x-backup-action: delete-account`. The server deletes the copy first, then
writes `revoked/<hmac>.json` — `{ "revokedAtMs": <unix ms> }`, under a hash
of the account that is not the backup's pathname — and from then on every
Apple session issued at or before that millisecond is refused
(`verifyAppleSession` on every request, `apple-renew` included, which looks a
second time just before answering so a delete that landed meanwhile is caught).
Sessions carry `iatMs` (and `iat` in seconds); one with only `iat` counts from
the start of that second, one with neither as issued at `exp − 180 days`. A new
Apple sign-in afterwards is a later session and works, in the same second.
A marker that cannot be parsed is read as revoked at the store's own write
time (`uploadedAt`), or as nothing if the store gives none, so it can never
lock an account out for good.

**On the phone**, an `INVALID_TOKEN` answer to a request made with a `vs1.`
session (upload, download, delete) signs the phone out like the Sign out row:
so the other phones of a deleted Apple account stop saying "Signed in". A
Google token's 401 and any 502 do not. The copy goes first so a failed marker
write leaves the session alive and the reader can ask again. A plain `DELETE`
("Delete cloud backup") writes no marker: it keeps the reader signed in. A store
that cannot read the marker answers 502, not 401, so a blip does not sign a
phone out. The app signs out locally (clears the Google or Apple session and
the account record) only after the server said yes, then shows the done
message. Google accounts have no session of ours; only the copy is deleted.
Markers older than 181 days no longer change anything: a request from the
account itself removes its own, and `purgeOldRevocations` (a `list` of
`revoked/`) runs on every Apple sign-in exchange and every account deletion —
so removal comes some time after the 180 days, depending on traffic, which is
what the policy says. **Needs a Vercel
deploy** — until then the app's `delete-account` request is an ordinary
`DELETE` that leaves the Apple sessions alive.

Apple accounts are stored under `apple:<sub>`, so an Apple account and a
Google account never share a blob. Google subjects stay unprefixed — changing
them would orphan every existing backup.

Setup: nothing on the server beyond the existing env (`APPLE_BUNDLE_ID` only if
the bundle id ever changes). On Apple's side, the App ID needs the "Sign in
with Apple" capability; EAS sets it from `ios.usesAppleSignIn`.
