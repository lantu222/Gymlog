# Google Play Data Safety — Vinha

Last reviewed: 4 September 2026 · app 1.1.0 · package `app.vinha`

The working draft for the Play Console **Data safety** form. It is derived from
the privacy policy (`src/lib/legalDocuments.ts`, the single source of truth) and
the code that policy describes. Not legal advice — verify every answer in Play
Console before submitting, and re-review whenever the policy's date changes.

## 1. What actually leaves the device (verified in code, 2026-09-04)

`src/` has exactly three outbound request sites; `tests/lib/legalDocuments.test.cjs`
fails if a fourth appears. The policy names all three.

| Feature | Client → endpoint | Sent | Stored server-side | Processor |
|---|---|---|---|---|
| Cloud backup (optional, Google sign-in) | `src/features/account/backupApi.ts` → `api/backup.ts` | Google ID token + the whole app database (profile, log, body data, programmes, preferences) | The backup JSON, filed under HMAC(Google `sub`) in a **private** Vercel Blob store (EU region per `docs/account-backup.md`). No email, no name, no logs of payloads. | Vercel (function + storage), Google (token verification) |
| AI coach online mode, programme composer, photo import | `src/lib/aiCoachClient.ts` → `api/ai-coach.ts` | Question + conversation history + training summary **including latest weight, measurements, height, age, gender, goals and setup answers**; the composer brief; the downscaled photo | Nothing, once the development transcript log is off (`src/lib/aiCoachDebug.ts` → `false`; `tests/releaseReadiness.test.cjs` blocks the release otherwise) | Vercel (function), Anthropic (model; deletes within 30 days, no training) |
| Anonymous usage events | `src/features/analytics/analyticsClient.ts` → `api/events.ts` | Random install id + event names, timestamps, `step` / `path` | Batches as private blobs (Vercel, EU); deleted after 24 months by the monthly cron (`api/prune-events.ts`, `docs/usage-events.md`) | Vercel |

Everything else stays on the device: six AsyncStorage keys plus the home-screen
widget's summary file. Android Auto Backup is on (`allowBackup` default), which
is between the user and Google and is disclosed in the policy.

Not present, and must stay absent from the merged manifest: location, contacts,
microphone (`RECORD_AUDIO` is stripped from expo-audio — verify in
`android/app/build/intermediates/merged_manifests/release/.../AndroidManifest.xml`),
camera, Health Connect, ads, third-party analytics or crash SDKs.

## 2. Form answers

**Does your app collect or share any of the required user data types?** → **Yes.**
"Collected" means transmitted off the device. Processing by a service provider
on our behalf (Vercel, Anthropic) is *not* "sharing" under Play's definition.

| Category → data type | Collected | Shared | Optional for the user | Purpose | Notes |
|---|---|---|---|---|---|
| Personal info → User IDs | Yes | No | Yes (only with sign-in) | App functionality (backup) | Google account id, stored hashed on the server |
| Personal info → Email address, Name | Transient | No | Yes | App functionality | Arrive inside the Google token, never stored server-side; kept on the device only. Play's ephemeral-processing exemption applies; declare if you prefer to be conservative |
| Health and fitness → Fitness info, Health info | Yes | No | Yes | App functionality | Workout log, body weight, measurements — sent for the backup and the coach |
| Photos and videos → Photos | Yes | No | Yes | App functionality | Programme import; not stored (ephemeral) |
| Messages / Other user-generated content | Yes | No | Yes | App functionality | Coach questions and composer briefs; not stored by us, Anthropic ≤ 30 days |
| App activity → App interactions | Yes | No | Yes | Analytics | The eight usage events. Settings → Usage statistics switches them off; off drops the queue |
| Device or other IDs | Yes | No | Yes | Analytics | Random install id, reset on reinstall and discarded when the switch is off |
| Financial info, Location, Contacts, Audio, Files and docs, Calendar, Web browsing, Installed apps | No | No | — | — | — |

**Security practices**
- Data encrypted in transit: **Yes** (the app talks HTTPS to Vercel; Vercel talks HTTPS to Anthropic and Google).
- Users can request data deletion: **Yes** — in the app (Settings → Delete cloud backup; Settings → Reset all data) and by email to the address in the policy.
- Committed to the Play Families policy: No. Independent security review (MASA): No.

**Account creation and deletion.** Google sign-in for the cloud backup counts as
account creation → answer **Yes, optional**. Play requires an in-app deletion
path (exists: Settings → Delete cloud backup, then Sign out) **and a public
account-deletion URL** entered in the form. The URL can be a page on the legal
site saying: sign in on any Android phone and press Delete cloud backup, or
email us. This page does not exist yet.

**Is collection optional?** Yes, all of it. Backup, coach and photo import sit
behind the user's own action, and usage events plus the install id can be
switched off in Settings → Usage statistics (2026-09-04): off means the client
sends nothing and discards its queue and install id, and nothing leaves before
the stored preference has been read at startup.

## 3. True on the day of submission

- `AI_COACH_DEBUG_TRANSCRIPTS = false` in `src/lib/aiCoachDebug.ts`, the Vercel
  variable and `TRANSCRIPT_READ_SECRET` unset, `api/transcripts.ts` deleted,
  `transcripts/` emptied in the Blob store. (`releaseReadiness` enforces the
  constant once `demoBuild` is cleared.)
- `demoBuild` removed from `app.json`.
- Vercel Blob store region confirmed **EU** in the Vercel dashboard — the policy
  says so in both languages.
- Privacy policy URL in Play Console points at the published policy, and the
  in-app text is the same version (`LEGAL_LAST_UPDATED`).
- The store listing's target audience matches the policy's "not for under 16".
