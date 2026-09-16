# Google Play Data Safety — Vinha

Last reviewed: 16 September 2026 · app 1.1.0 · package `app.vinha`

The working draft for the Play Console **Data safety** form. It is derived from
the privacy policy (`src/lib/legalDocuments.ts`, the single source of truth) and
the code that policy describes. Not legal advice — verify every answer in Play
Console before submitting, and re-review whenever the policy's date changes.

## 1. What actually leaves the device (verified in code, 2026-09-16)

`src/` has exactly three outbound request sites; `tests/lib/legalDocuments.test.cjs`
fails if a fourth appears. The policy names all three.

| Feature | Client → endpoint | Sent | Stored server-side | Processor |
|---|---|---|---|---|
| Cloud backup (optional, Google sign-in) | `src/features/account/backupApi.ts` → `api/backup.ts` | Google ID token + the whole app database (profile, log, body data, programmes, preferences) | The backup JSON, filed under HMAC(Google `sub`) in a **private** Vercel Blob store (EU region per `docs/account-backup.md`). No email, no name, no logs of payloads. | Vercel (function + storage), Google (token verification) |
| AI coach online mode, programme composer, photo import | `src/lib/aiCoachClient.ts` → `api/ai-coach.ts` | Question + conversation history + training summary **including latest weight, measurements, height, age, gender, goals and setup answers**; the composer brief; the downscaled photo | **Nothing by default. With consent, three separate lines each starting at no** (`aiLogChatConsent` / `aiLogComposerConsent` / `aiLogPhotoConsent`): `keepTranscript()` files the question and its answer, the brief and the proposal it produced, or the photo itself plus the rows read out of it, as `transcripts/<day>/<aiLogId>--…`. **Never the training summary** — that is sent, answered from, and dropped. Swept at 24 months by `api/prune-events.ts`; turning any one line off calls a forget route that deletes every copy under the label, whichever line made it. The same prefix also holds entries a development log wrote **before #92**, without consent, and chat copies written before #128 carry the signed-in email — both cleaned by hand before release, §3 | Vercel (function; storage in the EU — function region unconfirmed), Anthropic (model; deletes within 30 days, no training) |
| Anonymous usage events | `src/features/analytics/analyticsClient.ts` → `api/events.ts` | Random install id + event names, timestamps, `step` / `path` | Batches as private blobs (Vercel, EU); deleted after 24 months by the daily cron (`api/prune-events.ts`, `docs/usage-events.md`) | Vercel |

Everything else stays on the device: eight AsyncStorage keys (`@vinha/account`,
`analytics`, `coach/memory`, `database`, `database/corrupt`, `preferences`,
`workout`, `workout/corrupt` — the two `corrupt` slots hold a quarantined copy of
the reader's own data) plus the home-screen widget's summary file. The list is
guarded by `tests/lib/legalDocuments.test.cjs`, which fails on a ninth.

And it stays on the device: Android's own backup is **off** (#117 —
`app.json` → `android.allowBackup: false`), and `plugins/withDataExtractionRules.js`
excludes every domain from both the cloud-backup and the device-to-device
channel. Nothing of the app's data reaches Google's backup, so no answer here
depends on it.

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
| Personal info → Email address, Name | Transient — **only after the §3 cleanup** | No | Yes | App functionality | Arrive inside the Google token; the backup never stores them (`api/backup.ts` reads only `sub`) and they are otherwise kept on the device. **But the email has been stored:** from 23 August until #128, every coach question from a signed-in reader carried it as `reporter`; a consented chat copy filed it next to the question, and so did the pre-#92 development log. Until those are gone, the honest answer for Email is *collected and retained*. The name was never sent |
| Health and fitness → Fitness info, Health info | Yes | No | Yes | App functionality | Workout log, body weight, measurements — sent for the backup and the coach. The structured training summary is never stored by us; a coach question the reader consented to keep is stored, and a reader may have written health details into its text |
| Photos and videos → Photos | Yes | No | Yes | App functionality | Programme import. Ephemeral **unless** the reader ticks the photo line of the coach's consent sheet; then the image and the rows read from it are kept up to 24 months. **Declare as collected and retained** — the ephemeral-processing exemption does not cover a copy kept for two years |
| Messages / Other user-generated content | Yes | No | Yes | App functionality | Coach questions, their answers, and composer briefs. Anthropic ≤ 30 days either way. Kept by us **only** under the matching consent line, then up to 24 months or until the reader withdraws, whichever comes first |
| App activity → App interactions | Yes | No | Yes | Analytics | The eight usage events. Settings → Usage statistics switches them off; off drops the queue |
| Device or other IDs | Yes | No | Yes | Analytics; App functionality | Two random ids, minted separately and linked to nothing — including to each other. The install id (analytics) resets on reinstall and is discarded when the switch is off. `aiLogId` is the coach-log label, minted on the first yes and dropped once the last line goes off; it exists only so a withdrawal can find the consented copies again |
| Financial info, Location, Contacts, Audio, Files and docs, Calendar, Web browsing, Installed apps | No | No | — | — | — |

One purpose to settle in Play Console rather than here: the consented copies are
kept for one stated reason — making the coach better at writing programmes. Play's
list has no "product improvement" entry, so it lands under **App functionality**
or **Analytics** depending on how the Console words it that quarter. Pick one,
and make sure the policy's sentence and the form agree on it.

**Security practices**
- Data encrypted in transit: **Yes** (the app talks HTTPS to Vercel; Vercel talks HTTPS to Anthropic and Google).
- Users can request data deletion: **Yes** — in the app (Settings → Delete cloud backup; Settings → Reset all data) and by email to the address in the policy.
- Committed to the Play Families policy: No. Independent security review (MASA): No.

**Account creation and deletion.** Google sign-in for the cloud backup counts as
account creation → answer **Yes, optional**. Play requires an in-app deletion
path (exists: Settings → Delete cloud backup, then Sign out) **and a public
account-deletion URL** entered in the form. The URL can be a page on the legal
site saying: sign in on any Android phone and press Delete cloud backup, or
email us. Not published yet (in progress, 2026-09-16) — the form cannot be
submitted without the URL.

**Is collection optional?** Yes, all of it. Backup, coach and photo import sit
behind the user's own action, and usage events plus the install id can be
switched off in Settings → Usage statistics (2026-09-16): off means the client
sends nothing and discards its queue and install id, and nothing leaves before
the stored preference has been read at startup. Retention is optional on top of
that: the three consent lines start at no, and switching any one of them off
deletes every copy kept for the reader — including those made under the lines
left on — rather than only stopping new ones. (`forgetTranscripts` matches on the
label, not on the line; the policy says the same since 2026-09-16.)

## 3. True on the day of submission

- The development switch is off: `AI_COACH_DEBUG_TRANSCRIPTS = false` in
  `src/lib/aiCoachDebug.ts`, the Vercel variable and `TRANSCRIPT_READ_SECRET`
  unset, `api/transcripts.ts` and `scripts/coach-transcripts.cjs` deleted. Since
  #92 the switch writes nothing; what it still turns on is the effort and model
  overrides and the endpoint that reads the folder back.

  **Clean `transcripts/` by name, not wholesale.** Two kinds of entry live there:

  | Name | What it is | On submission day |
  |---|---|---|
  | `transcripts/<day>/<label>--<time>.json` | A copy the reader allowed (#92 on) | Stays — the 24-month cron sweeps it, the Settings switch deletes it |
  | `transcripts/<day>/<time>-<random>.json` — no `--`, dated 2026-09-11 or earlier | The pre-#92 development log, kept without asking | Deleted |

  Emptying the folder would delete reader data on the way to the store.

  One more pass over the kind that stays: a chat copy written before #128 was
  deployed carries the signed-in email in a `reporter` field. Strip the field, or
  delete those entries, before the Email row in §2 can be answered as transient.

  And do not read a green suite as the answer here: `releaseReadiness` only
  enforces the constant once `demoBuild` is cleared, so today the suite passes
  with the switch on (verified 2026-09-16). Open the file and look at the value.
- #128 deployed to Vercel — the endpoint stops accepting an email on the next
  deploy, not on merge.
- `demoBuild` removed from `app.json`.
- Pro can actually be bought through Google Play, or the copy stops saying it can.
  The policy says the payment "is handled entirely by Google Play" and that Play
  "is the seller of record"; the terms say payment "is charged through Google Play",
  that subscriptions renew until cancelled there ("Cancel in Google Play — the End
  membership screen in the app takes you there"), that refunds follow Play's
  policy, and that a price change is announced "in advance through Google Play".
  No billing library is installed — the paywall is deliberately device-side
  until Play Billing lands — so on submission day either the billing exists or
  those sentences do not.
- Vercel Blob store region confirmed **EU** in the Vercel dashboard — the policy
  says so in both languages.
- Privacy policy URL in Play Console points at the published policy, and the
  in-app text is the same version (`LEGAL_LAST_UPDATED`).
- The public account-deletion URL is live and entered in the form (§2).
- The store listing's target audience matches the policy's "not for under 16".
