# Gymlog Privacy Policy

Last updated: 26 March 2026
App: Gymlog
Package: com.lantu66.gymlog

Note: Replace the bracketed placeholders before publishing this policy publicly.

## 1. Who we are
Gymlog is a workout logging and strength training app.

Developer / publisher: [Your name or company name]
Privacy contact: [Your support email]
Support URL (optional): [Your support page URL]

## 2. What this app does
Gymlog lets users:
- create and edit workout templates
- log completed workouts, sets, reps, load, and notes
- track bodyweight entries
- view local progress and training history
- use Vallu Beta, a coaching feature for training questions

Vallu Beta can operate in two modes depending on how the app is configured:
- Preview mode: prompts stay in the app and Vallu shows a local preview-style response.
- Live mode: prompts and limited training context are sent to Gymlog's own backend endpoint, which then requests a response from an AI provider.

## 3. What data Gymlog stores
Gymlog stores the following data on the device:
- workout templates and exercise templates
- workout plans
- completed workout sessions
- exercise logs, including set data, tracked lifts, and optional exercise notes
- bodyweight entries
- app preferences, such as units, default rest timer, and workout logging preferences
- active workout session state, so users can resume an in-progress workout

## 4. How Gymlog uses this data
Gymlog uses this data to:
- save workouts and custom programs
- restore in-progress sessions
- calculate progress, streaks, and training history
- show progress charts and summaries
- support in-app features such as program selection and workout resume

## 5. Data collection and sharing
Gymlog is designed to work primarily with local, on-device storage.

As of version 1.1.0:
- Gymlog does not require account creation.
- Gymlog does not sell user data.
- Gymlog does not use advertising SDKs.
- Gymlog does not include analytics, crash reporting, social sharing, contacts access, camera access, microphone access, or location access.
- Outside live Vallu Beta requests, Gymlog does not intentionally transmit workout logs, bodyweight data, exercise notes, or profile data to the developer's servers.
- Gymlog currently uses bundled local assets for Home screen artwork instead of loading third-party remote media.

If live Vallu Beta is enabled, Gymlog may transmit:
- the question the user types for Vallu
- limited training context needed to answer it, such as active workout title, next exercise, recent workout names, tracked lift highlights, and recent training counts

Current Vallu backend policy:
- prompt text is not intentionally logged by the endpoint
- training context is not intentionally logged by the endpoint
- generic error logging may still occur without prompt contents
- Vallu requests are sent over HTTPS

If Gymlog later adds cloud sync, analytics, accounts, or broader server-side retention, this policy must be updated before release.

## 6. Legal basis / consent
Gymlog currently operates as a local utility app. Users choose what training data to enter into the app. If future features require network processing of user data, Gymlog will add appropriate disclosures and update this policy.

## 7. Data retention
Gymlog retains local workout and bodyweight data until:
- the user deletes it inside the app using the reset feature
- the user deletes or overwrites individual entries by changing their saved data
- the app is uninstalled from the device

Important:
- Depending on device or platform backup settings, the operating system or platform provider may back up app data outside the app's direct control.
- If you want the simplest privacy posture before public launch, consider disabling Android backup for the release build or documenting that device-level backups may apply.

## 8. Data deletion
Users can delete their locally stored data by using the in-app "Reset all data" feature.
Users can also remove Gymlog data by uninstalling the app from their device.

Gymlog does not currently provide account-based cloud storage, so there is no server-side account deletion workflow in version 1.1.0.

## 9. Security
Gymlog stores app data locally on the device using app storage.
Gymlog currently does not operate a general user account backend for workout logs or bodyweight entries.
If live Vallu Beta is enabled, Gymlog sends prompts and limited training context over HTTPS to its own endpoint and then to the configured AI provider.

## 10. Children
Gymlog is not designed specifically for children.

## 11. Changes to this policy
This privacy policy may be updated as Gymlog adds features such as live AI, cloud sync, analytics, or account systems. The latest version should be published at a public URL and reflected inside the app.

## 12. Contact
If you have questions about this privacy policy, contact:
- [Your support email]
