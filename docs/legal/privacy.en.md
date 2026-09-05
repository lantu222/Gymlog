# Privacy policy

*Updated 5 September 2026*

What Vinha stores, what leaves your phone, and what you can do about it.

## The short version

Vinha keeps your training data on your phone. By default nothing about your training leaves it: not your workouts, not your weight, not your programmes.

Two things leave your phone only if you choose them: the optional cloud backup (you sign in with Google) and the AI coach’s online mode (you read a notice and then send a question, ask for a programme, or import one from a photo). A third thing, anonymous usage statistics, is sent by the app itself unless you switch it off in Settings — it carries no content and no identity, and it is described in full below.

No ads, no trackers, no selling of data. If something in this policy is unclear, write to us — the address is in the next section.

## Who is responsible

Santeri Ylönen (Finland) publishes Vinha Fitness (“Vinha”) and is the data controller — the one responsible for how your data is handled — for everything described in this policy.

Questions about this policy or your data: santeriylonen@gmail.com.

## What the app stores on your phone

Everything below is either entered by you or worked out by the app from what you entered. It is kept in the app’s own storage on your phone.

- Your profile from setup: gender, age, height, weight, goals, experience level, days per week, equipment, the areas you want to focus on, and any injuries or limitations you ticked.
- Your training log: workouts and cardio sessions with their exercises, sets, reps, weights, notes, dates, durations and how the session felt.
- Body data you add yourself: weight entries and tape measurements.
- Your programmes: the ones you build, import from a CSV file or a photo, and the exercise names you teach the app.
- Goals you set with the coach, and the milestones and seasons the app counts from your log.
- What the coach has advised you in the last three weeks: the one-sentence summary of each answer and the date it was given, at most ten of them. It is kept so the coach does not repeat advice you have already had, it is deleted as it ages past three weeks, and it stays on this phone — the cloud backup below does not carry it.
- Preferences: language, units, theme, notification and sound settings, default rest time, training breaks.
- Pro status: whether Pro is on, when it was bought or cancelled, and the date until which a promo code keeps it on.
- Small bookkeeping: whether the rating prompt or the online-coach notice has been shown, the summary file the home-screen widget reads, the queue of usage events waiting to be sent, and a copy of a damaged data file if the app ever finds one — it is set aside rather than deleted, so a broken file is not a lost training log.

## Android backup

Android’s own backup is switched on for this app. That means your phone can copy Vinha’s data into the backup of your own Google account, so a new phone can restore it. Unless you use the cloud backup below, this is the only way your history survives changing phones.

That copy is between you and Google. We never see it and cannot read it. Google encrypts it, and on current Android versions the key is tied to your device PIN. You can switch it off at any time in Android settings under Google → Backup, and Vinha keeps working exactly the same.

## Cloud backup (optional)

If you sign in with Google, a copy of everything listed under “What the app stores on your phone” — except a workout still in progress — is sent over an encrypted connection to our server and kept there, so a new phone can restore it after you sign in again. Signing in is never required; every feature works without it.

From Google we receive your Google account’s identifier, your email address and your name. These stay on your phone, so the app can show which account is signed in. On the server the backup is filed under a scrambled version of the identifier; your email and name are not stored there.

A backup is sent shortly after you log training, and whenever you press Back up now. The server checks your sign-in with Google on every request, stores the file, and hands it back only to the same Google account. It does not read, analyse or log the contents.

The backup is stored by Vercel, our hosting provider, in the European Union. It is kept until you delete it.

Settings → Delete cloud backup removes the server copy immediately. Signing out does not delete it, and neither does resetting the phone’s data — a reset signs you out first, precisely so that an empty backup never overwrites a full one. The copy waits until you sign in again. If you can no longer open the app, sign in on any Android phone with the same Google account and delete it there, or write to us.

## The AI coach

The coach has two modes. In on-device mode, the default, answers are put together on your phone from your own log, and nothing leaves the device — not the question, not the answer.

In online mode, which a version of the app switches on, the app shows you a notice before your first question, and nothing is sent until you have read it. After that, each question you send carries three things: the question, the earlier messages of the same conversation, and a summary of your training.

The summary contains your recent workouts (exercise names, sets, reps, kilograms, dates, durations), your current programme and its week, your goals, your setup answers (goal, level, days per week, equipment, limitations), the coach’s own answers from the last three weeks in one sentence each, so it does not repeat advice you have already had, and — if you have logged them — your latest weight, tape measurements, height, age and gender.

It does not contain your name, your email, your Google account or any identifier of your phone. The question cannot be tied to you. Our server sees the phone’s internet address, which it holds briefly in memory to limit how many requests one connection can make; it is not stored.

Our server forwards the question to Anthropic, the company behind the Claude model, which writes the answer in the United States. Under Anthropic’s commercial terms the data is not used to train its models and is deleted within 30 days. We keep no copy of questions or answers.

The programme composer works the same way: when you ask the app to build a programme from a written brief, the brief and the same summary are sent along the same route.

Importing a programme from a photo also uses this route. The photo you picked is scaled down and sent so the table in it can be read; it is used for that one import and is not kept.

## Usage statistics

To see whether the app works — for example whether some step of the setup is so hard that people give up there — the app sends anonymous usage events to our own server.

An event is a name and a time, plus for setup steps the step number and which path you took. Never the content: no exercise name, no weight, no measurement, no question text. The full list of events is fixed in the app’s code, and the server refuses anything outside it.

Each install gets a random identifier, generated on your phone. It is not connected to your name, email, Google account or any advertising identity, and it resets if you reinstall the app.

The events go to our own server and nowhere else. They are kept for up to 24 months and then deleted automatically, and they are not shared, not sold and not used for advertising. You can switch them off at any time in Settings → Usage statistics; the app then sends nothing and throws away whatever was waiting to be sent. These are the events:

- The app was opened.
- A setup step was reached, and which one.
- Setup was finished, and whether you built a programme or picked a ready one.
- A programme was taken into use.
- A workout was started.
- A workout was saved.
- The Pro page was viewed.
- A question was sent to the coach — the fact that one was sent, never the text.

## Who helps us run this

We run no servers of our own. Three companies process data for us, under contracts that bind them to handle it only on our instructions and only for the purposes described here.

- Vercel (United States): runs our server and stores the cloud backups and the usage events. The storage is in the European Union.
- Anthropic (United States): answers coach questions, composes programmes and reads programme photos, as described above.
- Google (United States): verifies your Google sign-in, keeps the Android backup of your own account, and handles Google Play payments. Your relationship with Google is covered by Google’s own privacy policy.

## Data outside the European Union

Where data goes outside the European Union — the coach traffic to Anthropic, and possibly Vercel’s processing — the transfer rests on the European Commission’s standard contractual clauses, which are part of each provider’s data processing agreement with us.

## Why we may process your data

The GDPR requires a lawful basis for each kind of processing. These are ours.

- Providing the app you asked for (contract): keeping your data on your phone, running Pro, and showing you your own history.
- Your consent: the cloud backup (you sign in), the coach’s online mode (you read the notice and send a question), the programme composer and the photo import (you ask for them). Training and body data count as health data, so for anything that leaves your phone we rely on your explicit consent. You can withdraw it at any time: delete the backup and sign out, and simply stop sending questions.
- Our legitimate interest: the anonymous usage statistics, so we can see where the app fails people, and the brief rate limiting that protects the server from abuse. You can object by switching the statistics off in Settings, or by writing to us.
- Legal obligations: none of ours involve your personal data today. Google Play is the seller of record for Pro and keeps the purchase records; the sales reports we receive from Google contain no personal data.

## What the app does not do

- No third-party analytics and no crash-reporting tools from other companies. The only usage data is the anonymous statistics described above, sent to our own server and no one else.
- No ads, no ad networks, no advertising identifier.
- No trackers and no social media components. There is no feed, no followers and no public profile.
- No access to your location, contacts, microphone, camera or files. A photo is read only when you pick one yourself, through the phone’s own picker, and only that photo.
- No advertising profile. The app does tailor programmes and suggestions from your answers and your log, but that happens on your phone, and nothing is decided about you automatically in a way that has legal or similar effects.
- No selling, renting or sharing of your data with anyone, beyond the three providers named above who work for us.
- No account needed. Sign-in exists only to key the optional cloud backup.

## Permissions the app asks for

The app asks your phone for very little. What it does use:

- Notifications: asked the first time a rest timer needs to alert you, or when you switch notifications on in Settings. Refuse, and everything else keeps working.
- Photos: the phone’s own picker hands the app the one photo you chose. No permission to your photo library is asked.
- Internet: only for the three things above — backup, coach, statistics. Logging a workout never needs a connection.
- Keeping the screen on during a workout, if you switch that on in Settings.
- Vibration, for the haptic ticks — which you can switch off.

## Notifications

Notifications come in three groups: while you train (the rest timer and the live session), wins and recaps after a workout, and reminders such as a weigh-in day or a training day. Every one of them is scheduled on your phone by the app itself. They are not push notifications: no server is involved and no device token exists.

Turn any group, or all of them, off in Settings → Notifications, or in Android’s own notification settings.

## Payments and promo codes

If you buy Pro, the payment is handled entirely by Google Play. We never see your card number, billing address or any payment detail. The app learns only whether Pro is active, which plan, and until when.

A promo code is checked on your phone, and the app stores only the date until which it keeps Pro on. Nothing about it is sent anywhere.

## Feedback, rating and sharing

Send feedback opens your own mail app with our address and the app version filled in. You decide what to write. We then see your email address and your message, and keep them only as long as it takes to handle the feedback.

Rate Vinha opens the app’s page on Google Play. The app itself sends nothing.

Exporting a programme or your training log as CSV, and inviting a friend, go through your phone’s share menu to the app you pick. We never see where they go.

## Security

Everything that leaves your phone travels over an encrypted connection. On the server, every backup request is checked against Google before anything is read or written, backups are filed under a scrambled identifier in private storage, training data is never written to logs, and request rates are limited.

On your phone, the app’s data is protected by the phone’s own lock and the separation Android keeps between apps; the app adds no encryption of its own. Anyone who can unlock your phone can open Vinha and see your training data, so keep the phone locked.

## How long we keep it

- On your phone: until you reset the app’s data or uninstall it.
- Android backup: as long as your Google account keeps it — that is Google’s setting, not ours.
- Cloud backup: until you delete it in Settings, or ask us to.
- Coach questions, briefs and photos: not kept by us at all. Anthropic deletes them within 30 days.
- Usage statistics: up to 24 months, then deleted automatically.
- Feedback emails: as long as it takes to handle them.

## Your rights

Under the GDPR you have the right to see the data we hold about you, to correct it, to delete it, to take it with you, to withdraw a consent you gave, and to object to processing based on our legitimate interest.

Most of these you exercise yourself, inside the app, without asking anyone. For the rest, write to us — we answer within a month.

- See it: Settings → My data shows your profile, and Progress shows your log. The cloud backup is the same data, so there is nothing more on our side to show.
- Correct it: edit your profile, or any logged session or entry.
- Delete it: Settings → Reset all data clears the phone, and Settings → Delete cloud backup clears the server. Uninstalling the app removes the phone copy too. Usage statistics cannot be traced back to you, so there is nothing of yours to find in them.
- Take it with you: Settings → Export plan (CSV) sends your programme, or every logged set, as CSV text to any app you choose.
- Withdraw consent or object: delete the cloud backup and sign out; stop sending questions to the coach; switch usage statistics off in Settings.
- Complain: write to santeriylonen@gmail.com first, so we can put it right. You also have the right to complain to the data protection authority — in Finland, the Office of the Data Protection Ombudsman (tietosuoja.fi).

## Children

Vinha is not intended for children under 16, and we do not knowingly process their data. Because nothing reaches us with a name attached, we cannot tell a child’s data from anyone else’s — if you believe a child has signed in for the cloud backup, write to us and we will delete it.

## Changes to this policy

If this policy changes in a way that affects you, the app shows the change before it takes effect. The date at the top always tells you which version you are reading, and earlier versions are available on request.
