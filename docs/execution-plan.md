# GAINER - Execution Plan

**Type:** Execution plan - ordered, dependency-aware task list
**Status:** Active. This is the working plan.
**Supersedes:** conflicting sequencing advice in `Gainer_Audit/` and `long-term-vision.md`. Where those documents disagree with this one on *what to do next*, this wins. Where they disagree on *technical facts*, they win.
**Covers:** Step 1 (ship to store) and Step 2 (make the AI coach as good as possible). Stages 3-5 stay in `long-term-vision.md`.
**Assumed capacity:** solo, approx. 10 h / week.

---

## How To Use This

Steps are numbered in dependency order. Do not reorder them - several later steps are physically impossible before earlier ones. Each step has a **Done when** line; a step is not finished until that sentence is true.

Estimates are working hours, not calendar time. At 10 h/week, divide by 10 for weeks.

---

## Verified Current State

Checked against the codebase on 26 July 2026, not assumed:

| Area | State | Evidence |
|---|---|---|
| App code | Mature. 207 TS/TSX files, ~79k hand-written lines, 502 test cases across 75 test files | `tests/`, `src/` |
| Release signing | **Signed with the debug keystore** | `android/app/build.gradle` - `release { signingConfig signingConfigs.debug }` |
| Auth UI | **Non-functional.** "Continue with Google", "Continue with Apple", "Sign up with email" and "I already have an account" all call the same `onContinue` | `src/screens/WelcomeScreen.tsx` |
| Premium UI | Preview toggle only, no purchase path. Comparison table marks coach lanes `Live` | `src/screens/PremiumScreen.tsx` |
| Analytics / crash reporting | **None.** No PostHog, Sentry, Firebase or `track()` layer anywhere | `package.json`, `src/` |
| Android backup | `allowBackup="true"` - health data can leave the device via Google backup | `android/app/src/main/AndroidManifest.xml` |
| Secrets | `.env.local` and `.env.openai.local` are correctly gitignored and were **never committed**. Working-tree risk only | `.gitignore:36`, `git log --all` |
| Persistence | Whole database serialised as one JSON blob to AsyncStorage on write | `src/storage/database.ts:833` |
| AI endpoint | Real: 307 lines, IP rate limiting, JSON response schema, timeout. **Not deployed, not authenticated** | `api/ai-coach.ts` |
| AI client layer | Substantial: `aiCoachPlan.ts` 1003 lines, plus context builders and preview mode | `src/lib/aiCoach*.ts` |
| Localisation | EN + FI, full key parity, EN is source of truth | `src/lib/i18n.ts` |
| iOS | **No `ios/` directory, no `eas.json`.** Android is far ahead | repo root |

**Reading of this:** the product is not the bottleneck. The bottleneck is a short list of release-engineering and honesty problems, plus store admin.

---

# PART 1 - Ship GAINER

Target: GAINER live on Google Play, with working measurement.

**Android first, iOS second.** iOS has no project directory, no EAS config, needs a paid Apple Developer account, and faces stricter review. Shipping Android proves the funnel; adding iOS afterwards is a build-config task, not a rewrite.

---

## Wave A - Store account and the clock

Do these in week 1 even though they are boring, because one of them may contain a two-week wait.

### S1. Open the Google Play developer account and find out which testing rules apply to you

Personal (non-organisation) Play developer accounts registered in recent years must run a **closed test with a minimum number of testers for a continuous period** before production access is granted. If that applies to you, it is a hard calendar gate that no amount of coding removes - and it is the single largest schedule risk to a "1-2 months to store" estimate.

- Register the developer account
- Read the exact requirement shown in *your* Play Console
- If closed testing is required: recruit the testers now, in parallel with Wave B

**Done when:** you have written down, from your own Play Console, the exact production-access requirement and its start date.
**Effort:** 2 h + a fixed waiting period you do not control.

### S2. Decide the public identity

Publisher name, support email, and whether the store listing says GAINER AI is Beta.

**Done when:** `docs/manual-launch-tasks.md` items 1-2 are answered in writing.
**Effort:** 1 h.

---

## Wave B - The honesty fixes

These are launch blockers on both policy and principle grounds. `gainer-philosophy.md` already forbids UI that promises what the product does not do; the store review guidelines agree.

### S3. Remove the non-functional auth UI

Four controls on the welcome screen imply accounts that do not exist. Apple rejects sign-in affordances that do not sign in; Play treats it as misleading. It is also the first thing a new user touches.

- Remove "Continue with Google", "Continue with Apple", "Sign up with email", "I already have an account"
- Replace with a single honest primary action ("Start training" / "Aloita")
- Add a one-line note that data stays on the device and accounts arrive later

**Done when:** no control on the welcome screen suggests an account, and `tests/screens/` covers the new structure.
**Effort:** 3-4 h.

### S4. Make the premium screen truthful

The comparison table marks coach lanes `Live` while the coach runs in preview. Rename premium framing to Preview, and make every row reflect what actually ships.

**Done when:** every `Live` marker in `PremiumScreen.tsx` corresponds to shipped behaviour.
**Effort:** 2-3 h.

### S5. Audit the rest of the settings surface

`project-context.md` already commits to this: profile/settings must only expose controls that work now or are clearly framed as upcoming. Walk every screen once with that rule.

**Done when:** you have opened every settings row and either it works, says "coming", or is gone.
**Effort:** 3 h.

---

## Wave C - Release engineering

### S6. Create a real upload keystore

`release` currently inherits `signingConfigs.debug`, and `debug.keystore` is committed with the standard public password. Shipping that means anyone who clones the repo can sign builds that Play accepts as yours, and you can never rotate it.

- Generate an upload keystore, store it outside the repo
- Put its credentials in `android/gradle.properties` (gitignored) or Play App Signing
- Point `release` at it
- Confirm `.gitignore` covers the keystore and any properties file holding its password

**Done when:** `assembleRelease` produces an artifact signed by a key that is not in git, and you have a backup of that key somewhere you will still have in five years.
**Effort:** 2 h. Getting this wrong later is unrecoverable, so do not rush it.

### S7. Decide the Android backup posture

`allowBackup="true"` means training and health data can be copied into a user's Google account backup. Either set it to `false`, or keep it and disclose it accurately in the privacy policy and Data Safety form. Do not leave it undeclared.

**Done when:** the manifest value and the Data Safety answers say the same thing.
**Effort:** 1 h.

### S8. Rotate the OpenAI key

The key was never committed, so this is precaution rather than incident response - but it has lived in a working tree through many sessions and screen shares.

**Done when:** the old key is revoked in the OpenAI dashboard and the new one exists only in the deployment environment.
**Effort:** 30 min.

---

## Wave D - Measurement

This is the step most likely to be skipped and the one that decides whether the next six months are informed or guessed.

### S9. Add crash reporting and product analytics

Sentry for crashes, one analytics tool for events. Keep the event set deliberately small - roughly eight events beat eighty:

- onboarding started / completed
- first workout started / completed
- workout completed (with session ordinal)
- reached session 2, 3, 4
- save failed

Put them behind a thin `track()` wrapper in `src/lib/` so the vendor is swappable and so the call sites stay testable.

**Done when:** you can answer "what share of installs finish onboarding, and what share reach workout #4" from a dashboard rather than a guess.
**Effort:** 12-15 h. This is the largest single item in Part 1 and it is worth every hour.

### S10. Add the first-workout acknowledgement

The current design silences insights for the first three sessions. That protects trust but it also means the most motivating moment in the product - finishing the first workout ever - returns nothing. One honest, forward-looking sentence, no fake enthusiasm.

**Done when:** finishing workout #1 produces exactly one sentence, and `ai-trust-system.md` is updated to record this as a deliberate exception rather than a violation.
**Effort:** 3-4 h.

---

## Wave E - Store admin

### S11. Publish the privacy policy at a stable public URL

`docs/privacy-policy.md` exists but a document in a repo is not a published policy. GitHub Pages is sufficient and free.

**Done when:** the URL loads for a logged-out visitor and is linked both in Play Console and inside the app.
**Effort:** 2 h.

### S12. Complete the Play Console paperwork

Data Safety form, App Content declarations, content rating questionnaire, store listing text, screenshots, feature graphic. You already have hundreds of device screenshots in the repo root - most of what is needed is selection and framing, not capture.

**Done when:** Play Console shows no outstanding required items.
**Effort:** 8-10 h.

### S13. Soft launch

Ship to roughly 20 real people - gym friends, Finnish lifters - before any public push. Watch them onboard without helping. Every question they ask out loud is a defect.

**Done when:** 20 people have installed it and at least 10 have completed a workout.
**Effort:** 4 h plus patience.

### S14. Public Finnish release

Finnish-language store listing and ASO. The bilingual FI/EN positioning is a real advantage in a category where the incumbents are English-only.

**Done when:** the app is in production on Google Play.

**Part 1 total: roughly 45-55 hours of work, plus any mandatory closed-testing period.** At 10 h/week that is 5-6 weeks of work, and the calendar gate may extend it.

---

## THE GATE

Do not start Part 2 on the day Part 1 ships. Spend 4-8 weeks watching the funnel and talking to users, then answer one question:

> **Do people reach workout #4?**

If they do not, no amount of AI quality fixes it - a better coach for people who leave after session two is a better coach nobody hears. Fix the drop first.

If they do, Part 2 is the right investment, and you will have the one thing that makes an AI coach good: real training histories to test it against.

---

# PART 2 - Make GAINER AI As Good As Possible

Target: a coach that a serious lifter would keep, not a chat window bolted onto a logger.

## The key realisation

The investment memo says premium, sync and AI memory require a backend rebuild. That is true for **premium and multi-device**. It is not true for **coach quality**.

The app already holds the user's complete training history on the device. The endpoint is stateless: the app sends context, the model answers. That means you can build a genuinely excellent coach on the architecture you have today, and defer the backend until you are charging money.

**Sequence accordingly: quality first on the current architecture, backend only when it becomes the actual constraint.**

---

## Wave F - Make it real

### A1. Deploy the endpoint

`api/ai-coach.ts` already has rate limiting, a JSON response schema and a timeout. It has never been deployed. Any serverless host works.

**Done when:** `EXPO_PUBLIC_AI_COACH_API_URL` points at a live endpoint and the app leaves preview mode.
**Effort:** 3-4 h.

### A2. Close the denial-of-wallet hole

IP-based rate limiting does not survive contact with mobile carrier NAT or a motivated stranger. Before the URL ships inside a public binary it needs a per-install token, a server-side daily cap, and a hard monthly spend ceiling with an alert.

**Done when:** you can state the maximum euros the endpoint can cost you in a month, and you would be comfortable if someone posted the URL publicly.
**Effort:** 6-8 h. Non-negotiable before A1 reaches production.

---

## Wave G - Make it good

This is the actual work, and it is not prompt engineering.

### A3. Build an evaluation set before tuning anything

Take 20-30 real anonymised training histories - your own, your testers' - and write down, by hand, what a good coach should say about each. This is slow and unglamorous and it is the only thing that separates a coach that is actually good from one that sounds good.

**Done when:** you can change a prompt and get a number back telling you whether it got better or worse.
**Effort:** 10-12 h.

### A4. Define what the coach is allowed to say

`ai-trust-system.md` and `ADR-003` already establish that silence is a valid output. Extend that into a concrete contract: which claims require how much history, what confidence threshold triggers speech, and what the coach must never assert. A coach that says nothing when it knows nothing is more trustworthy than one that always has an opinion - and this is exactly the differentiator the competitive analysis says you are missing.

**Done when:** every response type has a documented minimum-evidence rule.
**Effort:** 6 h.

### A5. Make the context you send worth reasoning over

`aiTrainingContext.ts` is 126 lines. This is the highest-leverage file in the entire coaching stack: model quality is bounded by what you tell it. Volume trends, stalled lifts, session-to-session load changes, consistency patterns, deviation from the planned programme.

**Done when:** a domain-expert reader could reconstruct the user's last eight weeks of training from the context payload alone.
**Effort:** 10-15 h.

### A6. Ship the post-session insight properly

Per `ADR-001`, nothing speaks during a workout. After the session is where the coach earns its subscription. One observation, grounded in a specific number from the session just finished, plus one concrete action for next time.

**Done when:** the insight cites actual figures from the session and passes the A3 eval set.
**Effort:** 8-10 h.

### A7. Adaptive programme adjustment

The genuine differentiator, and the thing Fitbod and Alpha Progression are already known for - which means table stakes, not innovation. `progression-gating-rules.md` and `ADR-004` define the deterministic layer. The AI's job is to explain and to handle what the rules cannot, not to replace them.

**Done when:** a stalled lift produces a specific, explained change to next week's plan.
**Effort:** 15-20 h.

### A8. Close the loop

Let the user say whether the advice was useful. Store it locally. Feed it into A3. Without this the coach is frozen at launch quality forever.

**Done when:** every insight can be marked useful or not, and you can see the ratio.
**Effort:** 4 h.

---

## Wave H - Only after the gate reopens

Start these when the coach is good and people are asking to pay - not before.

### A9. Backend, accounts, sync
Now it is genuinely required: purchase validation cannot live on a device, and paying users expect their data to survive a new phone. This is the point where the JSON-blob persistence becomes a real ceiling and SQLite migration is justified.
**Effort:** weeks, not hours. Budget honestly.

### A10. Premium with IAP and server-side validation
Paywall timed to arrive after the first genuinely useful AI insight - value first, then the ask. `premium-philosophy.md` owns the ethics; do not violate it for conversion.

---

## What This Plan Deliberately Does Not Do

- no backend before the retention gate
- no iOS before Android is live and measured
- no hardware, no lease, no rack (see `long-term-vision.md`)
- no SQLite migration until data volume actually breaks
- no in-session AI (`ADR-001`)

> Removed 28 July 2026: *"no new features during Part 1 - Part 1 is subtraction
> and instrumentation, not addition."* Part 1 work continues, but feature work
> is no longer barred from running alongside it.

---

## Summary

| | Work | Blocked by |
|---|---|---|
| Part 1 | ~45-55 h | possible mandatory closed-testing period |
| Gate | 4-8 weeks of observation | real users existing |
| Part 2 waves F-G | ~60-75 h | the gate opening |
| Part 2 wave H | weeks | people wanting to pay |

The next action is S1: open the Play Console and find out whether a closed-testing period applies to you. Everything else can be worked around. A fixed waiting period cannot.
