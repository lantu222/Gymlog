# Google Play Data Safety Prep for Gymlog

Last reviewed: 26 March 2026
Version reviewed: 1.1.0
Package: com.lantu66.gymlog

This file is a practical draft for the Google Play Data safety form based on the current codebase.
It is not legal advice. You must verify the final declarations in Play Console.

## 1. Current app behavior observed in code
Gymlog currently:
- stores workout data locally via AsyncStorage
- stores active workout session state locally via AsyncStorage
- stores bodyweight entries locally via AsyncStorage
- does not implement account signup or login
- does not implement analytics or crash reporting SDKs
- does not implement ads, subscriptions, or payments
- does not implement camera, microphone, contacts, or location features
- includes an optional AI Coach backend path:
  - preview mode when no endpoint is configured
  - live mode when the app calls your own endpoint and that endpoint calls OpenAI
- uses bundled local assets for Home artwork instead of loading third-party remote media

Relevant files reviewed:
- D:\Gymlog\src\storage\database.ts
- D:\Gymlog\src\features\workout\workoutPersistence.ts
- D:\Gymlog\src\types\models.ts
- D:\Gymlog\src\state\AppProvider.tsx
- D:\Gymlog\App.tsx
- D:\Gymlog\src\components\AppShell.tsx
- D:\Gymlog\android\app\src\main\AndroidManifest.xml
- D:\Gymlog\package.json
- D:\Gymlog\src\lib\aiCoachClient.ts
- D:\Gymlog\src\lib\aiCoachPreview.ts
- D:\Gymlog\api\ai-coach.ts

## 2. Recommended declaration strategy
Choose one declaration strategy based on how you launch AI Coach.

### Option A: Preview-only AI Coach
Recommended answer:
- No user data collected
- No user data shared

Why this is defensible:
- Workout logs, bodyweight, notes, active sessions, and preferences are stored locally.
- No analytics SDK is present.
- No account system is present.
- Home artwork no longer depends on a third-party remote image host.
- AI Coach stays on preview mode when `EXPO_PUBLIC_AI_COACH_API_URL` is not configured.

### Option B: Live AI Coach enabled
Do not keep the `No user data collected` answer without re-review.

If live AI Coach is enabled, the app transmits at least:
- the prompt the user types
- limited training context such as active workout title, next exercise, recent workout names, tracked lift highlights, and recent training counts

This likely affects at least:
- Health and fitness
- App activity or user-generated content

Because this data leaves the device and is sent through your endpoint to an AI provider, you must review the final Play answers carefully before release.

## 3. Recommended Play Console answers
### Does your app collect or share any of the required user data types?
Recommended answer:
- Preview-only AI Coach launch: No
- Live AI Coach launch: re-evaluate before submitting

### Is all data encrypted in transit?
Recommended answer:
- Preview-only AI Coach launch: Not applicable if you declare no data collected
- Live AI Coach launch: Yes, if your endpoint is HTTPS only

### Can users request deletion of their data?
Recommended answer: Yes, via in-app local deletion / reset.

Notes:
- There is no account-based deletion flow because there are no user accounts.
- The app includes a local reset path.

## 4. Data categories currently present in the app, but stored locally only
These exist in the app's local database:
- Health and fitness: workout logs, load, reps, sets, bodyweight entries, training notes
- App activity / user-generated content: custom workout templates and optional exercise notes
- App info / preferences: unit preference, timer preference, onboarding state, active plan choice

Important:
- Under Google's Data Safety guidance, data processed only on-device and not sent off-device does not need to be disclosed as collected.
- If live AI Coach is enabled, a limited subset of this context is sent off-device for AI Coach responses and should be reviewed for disclosure.

## 5. Data Safety form draft answers
- Preview-only launch:
  - Data collected: No
  - Data shared: No
  - Security practices: local storage only for user workout data
  - Deletion request mechanism: Yes, in-app reset of local data
- Live AI Coach launch:
  - Re-review Data Safety before submission
  - Document AI Coach prompt/context processing in the privacy policy
  - Confirm HTTPS in transit and non-logging stance for prompts/context
  - Deletion request mechanism: local reset for on-device data; clarify any server-side retention if you later add it
- Privacy policy: required, must be published at a public URL and linked in Play Console and inside the app

## 6. If AI Coach Beta is launched live
The Data Safety form and privacy policy must match that release before shipping any version that sends prompts or training context to a server or third-party AI provider.

At that point you will likely need to reassess at least:
- Health and fitness data
- App activity or user-generated content
- Whether data is collected optionally or required
- Encryption in transit
- Retention and deletion practices for server-side data

## 7. Final recommendation
For the first public Play launch:
- if you want the simplest launch path, keep AI Coach in preview mode and launch as a local-first strength logger
- if you enable live AI Coach Beta, update Play declarations and privacy text before release and keep the feature clearly marked as Beta
