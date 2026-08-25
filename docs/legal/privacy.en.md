# Privacy policy

*Updated 25 August 2026*

What Vinha stores, where it stays, and what never leaves your phone.

## The short version

Vinha keeps your training data on your phone. We do not see your workouts, and we cannot — nothing about their content is uploaded unless you turn on the AI coach in its online mode, and even then only training numbers are sent, never your identity. The app does send anonymous usage statistics (which screens were reached, never what was in them), described in their own section below.

If you uninstall the app, that data is gone from the phone. The only copies that can exist elsewhere are the one your own Google account keeps in Android backup, if you have that turned on, and the optional cloud backup described below — which exists only if you chose to sign in, and which you can delete from Settings at any time.

## Who is responsible

Santeri Ylönen (Finland) publishes Vinha Fitness (“Vinha”) and is the data controller for the limited processing described below.

Questions about this policy or your data: santeriylonen@gmail.com.

## What the app stores

Everything below is entered by you, or produced by the app from what you entered. It is stored in the app’s own storage on your device.

- Profile: age, height, weight, training goal, experience level, available days and equipment.
- Training log: exercises, sets, reps, weights, times and dates of your sessions.
- Body data you choose to add: bodyweight entries and body measurements.
- Preferences: language, units, notification and sound settings, exercises you asked to avoid.
- Purchase state: whether Pro is active, and a redeemed promo code if you used one.

## Where it is stored

In the app’s local storage on your device, under three keys — one for your training log, one for the workout you have in progress, and one small one for your settings. If you sign in for cloud backup, a fourth small key holds your account identity (Google id, email, last backup time). Apart from the optional cloud backup below, nothing is synced to a server we run, and we have no way to read your device remotely.

A fifth small key holds the outgoing queue of the anonymous usage events described below — event names and timestamps, nothing more — until they are sent.

If the app ever finds that storage unreadable, it moves the damaged copy aside under a third key instead of deleting it, and starts a fresh one — so a broken file is not the same thing as a lost training log. That copy stays on your device like everything else, and erasing the app’s data removes it too.

Android backup is switched on for this app. That means your device can copy Vinha’s local data — your training log, bodyweight and measurement entries, programmes and settings — into the backup of your own Google account, so a new phone can restore it. Unless you sign in for the optional cloud backup below, this is the only way your history survives changing devices.

That copy is between you and Google. We never see it, we cannot read it, and nothing is sent to any server we run. Google encrypts it, and on current Android versions the key is tied to your device PIN. You can switch it off at any time in Android settings under Google → Backup, and Vinha keeps working exactly the same.

Cloud backup (optional): if the app offers sign-in and you sign in with Google, a copy of the same training data is sent over an encrypted connection to our backup endpoint and stored there, so a new phone can restore it after you sign in again. Signing in is never required — every feature works without it. From your Google account we receive and keep only its identifier and email address, used solely to know which backup is yours; the backup is never used for anything except giving it back to you. Delete the cloud copy at any time in Settings (“Delete cloud backup”), or by signing out and asking us to remove it.

Deleting the data is immediate and total: Settings → My data → reset, or uninstalling the app.

## The AI coach

The AI coach has two modes.

On-device mode (the default): answers are generated on your phone from your own training log. Nothing leaves the device — not the question, not the answer.

Online mode: when a version enables it, your question and a numeric summary of your recent training (exercise names, sets, reps, kilograms, session dates) are sent over an encrypted connection to our endpoint and from there to Anthropic’s API, which produces the answer. Your name, email, device identifiers and body measurements are not part of that summary. The data is used to answer that one question. It is not used to train models, and we do not keep a copy.

The app tells you the first time you open the coach in online mode, before any question is sent, and nothing is sent until you have read it.

## Usage statistics

To see whether the app works — for example, whether some step of the setup is so hard that people give up there — the app sends anonymous usage events to our own server: things like "setup step 3 reached", "a workout was completed", "the coach was asked a question".

Each install gets a random identifier, generated on your phone. It is not connected to your name, email, account or any advertising identity, and it resets if you reinstall the app.

The events carry no content: never an exercise name, a weight, a measurement or anything you typed. The full list of events is fixed in the app code, and the server refuses anything outside it.

These events go to the same server as the AI coach traffic and nowhere else. They are not shared, not sold, and not used for advertising.

## What the app does not do

- No third-party analytics and no crash-reporting SDKs. The only usage data is the anonymous statistics described above, sent to our own server and no one else.
- No advertising and no ad networks.
- No third-party trackers or social SDKs.
- No advertising profile, and no identity attached to your training. Signing in and entering a competition are the only features that need an account, and they collect only what they need to work.
- No access to location, contacts, microphone or your files. Photos are opened only when you yourself pick an image to import a program from, and only that image is read.
- Your data is never sold, rented or shared. There is no one to share it with.

## Notifications

Rest timers and reminders are scheduled locally by your phone. They are not push notifications, so no server is involved and no device token exists. Turn them off in Settings or in Android.

## Payments

If you buy Pro, the payment is handled entirely by Google Play. We never see your card number, billing address or any payment detail — the app only learns whether your subscription is active.

## Your rights

Under the GDPR you have the right to access your data, correct it, delete it, and take it with you. Because your data lives on your device, you exercise these rights directly and without asking us — and if you signed in for cloud backup, the one server copy is deleted by you too, from Settings → Delete cloud backup:

- See it: Settings → My data shows what is stored.
- Correct it: edit your profile, or edit any logged session.
- Delete it: Settings → My data → reset all data, or uninstall the app.
- Ask a question or complain: santeriylonen@gmail.com. You also have the right to lodge a complaint with your national data protection authority (in Finland, the Office of the Data Protection Ombudsman).

## Children

Vinha is not intended for children under 16. We do not knowingly process the data of children — and since we receive no data at all, there is nothing for us to identify or delete.

## Changes to this policy

If this policy changes in a way that affects you, the app will show the change before it takes effect. The date at the top of this page always tells you which version you are reading.
