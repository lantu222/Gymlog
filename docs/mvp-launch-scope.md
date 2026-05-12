# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

# Launch Critical

Failure in this system blocks launch.

---

# Gainer — MVP Launch Scope

**Type:** Implementation spec — authoritative launch boundary definition
**Status:** Definitive scope reference. Supersedes item-level feature discussions where they conflict.
**Related:** `product-roadmap-phases.md`, `system-architecture.md`, `post-session-single-insight-mvp.md`, `progression-gating-rules.md`, `coaching-architecture.md`, `manual-launch-tasks.md`

---

## Table of Contents

1. [Core MVP Definition](#1-core-mvp-definition)
2. [Must-Have Launch Features](#2-must-have-launch-features)
3. [Nice-to-Have but Delayable Features](#3-nice-to-have-but-delayable-features)
4. [Features Explicitly Excluded from MVP](#4-features-explicitly-excluded-from-mvp)
5. [AI Features Allowed in MVP](#5-ai-features-allowed-in-mvp)
6. [AI Features Not Allowed in MVP](#6-ai-features-not-allowed-in-mvp)
7. [Stability Priorities](#7-stability-priorities)
8. [UX Priorities](#8-ux-priorities)
9. [Technical Priorities](#9-technical-priorities)
10. [Analytics and Metrics Priorities](#10-analytics-and-metrics-priorities)
11. [Anti-Overengineering Rules](#11-anti-overengineering-rules)
12. [Launch-Risk Analysis](#12-launch-risk-analysis)
13. [Recommended Post-Launch Roadmap](#13-recommended-post-launch-roadmap)
14. [What Success Looks Like for v1](#14-what-success-looks-like-for-v1)

---

## 1. Core MVP Definition

**GAINER's MVP is a workout tracker that recommends a structured program, lets the user log sessions reliably, and keeps an honest record of their training history.**

That is the complete core. Everything else — AI coaching, progression intelligence, advanced analytics, social features, premium monetization — is built on top of this foundation, and that foundation must be solid before anything else matters.

The MVP succeeds when a user can complete this loop without friction or confusion:

```
Onboarding → Program recommendation → Start session → Log sets → Finish session → 
See it in History → See progress on tracked exercises → Know what to do next
```

If any step in that loop breaks, confuses, or deceives, the MVP is not done — regardless of how many other features exist.

---

### What MVP is not

MVP is not the minimum the team can ship. It is the minimum that creates a real, honest product relationship with a user. A user who opens GAINER, logs their first workout, and sees their session saved truthfully — with clear next action and visible progress — has received real value. That is the bar.

MVP is also not the first commit. The app already exists and has significant capability. The work remaining for launch is mostly making what exists trustworthy and removing what does not yet work.

---

### The MVP completion test

Before launch, every item in the must-have list (§2) must pass this test:

1. **Does it work correctly for the primary use case?**
2. **Does it fail gracefully and honestly for the edge cases?**
3. **Does it leave the user knowing what to do next?**

If any item fails one of these three questions, it is not launch-ready.

---

## 2. Must-Have Launch Features

These features must be complete, tested, and working correctly before launch. No exceptions. If any item is missing or broken, the launch date moves — not the scope.

---

### 2.1 Onboarding and recommendation flow

**Required:**
- Four core onboarding questions: goal, experience level, equipment, days per week
- Program recommendation produced from onboarding answers
- Recommendation must visibly reflect the user's answers (equipment filter, frequency match, level match)
- Brief recommendation explanation: why this program was selected in 1–2 sentences
- Clear path from recommendation to starting the first session

**Not required at launch:**
- Focus area selection (optional fifth question — good to have, not blocking)
- Editable setup after onboarding (Phase 2 — important but deferrable)

**Launch-blocker failure modes to eliminate before release:**
- Recommendation that does not change based on different equipment answers
- No visible path from onboarding completion to first workout

---

### 2.2 Workout logging

**Required:**
- Start any ready program session from the recommendation or from the program catalog
- Log sets with weight and reps
- Mark sets complete
- Skip exercises
- Finish a session
- Rest timer between sets

**Required to feel correct:**
- `Done` button disabled or blocked when required fields are empty
- Skipped exercise has a visible recovery path (undo skip or explicit discard)
- No silent no-ops on set completion

**Not required at launch:**
- Notes on sets or sessions
- Advanced rest timer controls (audible alerts, custom durations) — basic timer is sufficient
- Drag-to-reorder exercises within a session
- In-session substitution beyond what already works

---

### 2.3 Truthful save and completion flow

This is a Phase 1 priority and a hard launch requirement. The app must not imply a workout was saved before persistence succeeds.

**Required states, all implemented:**
- Explicit "saving" state during persistence
- "Saved" state that only appears after `saveCompletedWorkoutSession` resolves successfully
- Visible "save failed" state with a retry path
- Empty sessions (zero sets logged) must not produce a "Workout saved" screen
- Zero-set sessions: prompt to discard or continue, never silently complete

**Launch-blocker failure modes to eliminate:**
- A completion screen that appears before persistence resolves
- A "saved" message that appears when the session had no logged sets
- A failed save that silently disappears without user recovery path

---

### 2.4 Origin-aware navigation

Navigation must be context-preserving. A user who enters a program from onboarding, logs a session, and finishes must arrive at an appropriate destination — not a root screen that lost their origin.

**Required flows, all working:**
- Onboarding → program recommendation → program detail → logging → completion → appropriate next screen
- Home primary action → program detail → logging → completion → appropriate next screen
- Workout catalog → program detail → logging → completion → appropriate next screen
- Back from program detail → returns to the real entry surface, not a root fallback
- Back from history session detail → returns to history list, not home

**Not required:**
- Full route history with breadcrumbs
- Animated transitions between context-aware routes
- Deep-link handling

---

### 2.5 Program catalog (ready programs)

**Required:**
- Full ready program catalog accessible from the Workout tab
- Program detail screen: description, sessions, exercises, expected frequency and duration
- Ability to start any ready program session from the detail screen
- Programs correctly filtered by equipment on the recommendation screen (equipment filter must work)

**Not required:**
- Search within the catalog
- Filter by goal, time, or difficulty in the browse UI
- Program comparison side-by-side
- Favoriting or bookmarking programs

---

### 2.6 Custom programs

**Required:**
- Create a custom workout template
- Edit an existing custom template
- Delete a custom template
- Start a session from a custom template
- Custom templates persist and appear in the Workout tab alongside ready programs

**Not required:**
- Duplicate a ready program into a custom template (useful but deferrable)
- Export or share custom programs
- Custom program scheduling or calendar integration

---

### 2.7 Training history

**Required:**
- All completed sessions visible in History, ordered by date
- Session detail: exercises, sets logged, weight, reps, date, duration
- History updates immediately after a session is saved (not on next app open)

**Not required:**
- Session notes in history (notes themselves are Phase 3)
- Filters or search in history
- Session highlights or PR markers in history list view
- Calendar view

---

### 2.8 Progress tracking

**Required:**
- Tracked exercises visible in the Progress tab
- For each tracked exercise: top-set weight trend over time
- Clear indication when progress has been made vs plateaued

**Not required:**
- Volume load trends per exercise
- Per-muscle-group progress summaries
- PR badges or achievement markers
- Body weight trend chart (useful, not blocking)

---

### 2.9 Exercise library

**Required:**
- Full exercise library accessible from within a session for substitutions
- Exercise detail: description, how-to, primary muscles
- Substitution suggestions filtered by equipment context

**Not required:**
- Video demonstrations (image or illustration sufficient)
- User-authored exercise notes
- Searchable exercise database outside the context of a session

---

### 2.10 Profile and settings

**Required:**
- Units preference (kg / lb) — must visibly affect all logged values
- Basic app preferences that are actually wired (not cosmetic toggles)

**Required to be clean:**
- Any setting that is not wired must be removed or clearly labeled as "coming soon" — not left as a broken toggle
- No settings that imply features that do not exist

**Not required:**
- Notification preferences (before first session is complete — see §4)
- Social connection settings
- Data export (strongly recommended to add before launch, but see §3)

---

### 2.11 Privacy policy

**Required:**
- Published privacy policy at a stable public URL
- Privacy policy accessible from within the app
- Google Play Data Safety form completed accurately

This is a hard store requirement. It is not optional regardless of how minimal the data collection is.

---

## 3. Nice-to-Have but Delayable Features

These features create genuine user value and are worth building, but they do not block launch. Ship them as fast as possible post-launch — they are not Phase 3 work, they are Phase 1.5.

---

### 3.1 Editable setup after onboarding

Users need a way to revisit their onboarding answers without resetting the app. This is especially important after the first week, when users realize their initial answers were approximate.

**Why it is deferrable:** Users can work around its absence by uninstalling and reinstalling, or by accepting the initial recommendation. The core logging loop works without it.

**Why it should ship fast:** Users who cannot refine their plan will churn when the initial recommendation stops fitting their reality. Target: first post-launch update.

---

### 3.2 Post-session coaching insight

The single post-session insight system defined in `post-session-single-insight-mvp.md` (four insight types: `personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`) is close to launch-ready as a spec.

**Why it is deferrable:** The core logging loop works without it. Sessions save, history records, and progress tracks without any coaching layer.

**Why it should ship fast:** It is GAINER's first differentiating experience beyond generic logging. It demonstrates that the product observes and notices. Without it, GAINER is a logging app, not a coaching app.

**Launch condition:** Deterministic template messages only. No LLM generation. No push notifications. One insight or null, post-session only. See `post-session-single-insight-mvp.md` for the full spec.

---

### 3.3 Personal data export

Users should always be able to export their training history as a file. This is the right thing to do regardless of whether regulations require it.

**Why it is deferrable:** No real training history exists for new users at launch. The need becomes urgent as history accumulates.

**Why it should ship fast:** Launch users will accumulate months of data before this exists. Building it later is harder (more data volume) and worse (users who want to leave can feel trapped). Target: within 90 days of launch.

---

### 3.4 Home: continue vs browse clarity

The home screen's primary action should be one clear thing — not a mix of "continue your current program" and "browse programs." The current mixing of these two modes creates ambiguity about what Home is for.

**Why it is deferrable:** Users can navigate to their program via the Workout tab.

**Why it should ship fast:** Home is the first screen users see every session. Ambiguity here costs sessions.

---

### 3.5 Body weight tracking

A body weight log with a simple trend chart. Useful context for progression decisions and a lightweight habit anchor for users who are monitoring weight change.

**Why it is deferrable:** Not required for the core training loop.

**Why it should ship fast:** It is a natural retention touchpoint (daily logging behavior) and a useful signal for the coaching layer.

---

## 4. Features Explicitly Excluded from MVP

These features must not ship with v1. Building them before the core is stable increases launch risk, maintenance burden, and product complexity without proportional user value at this stage.

---

### 4.1 Push notifications

**Excluded.** Not because notifications are bad, but because the rule is firm: ask for notification permission only after the user has completed their first session and received a coaching insight that demonstrates what a notification would deliver. See `ai-trust-system.md` §5.

Shipping notifications before delivering genuine value is the most reliable way to have them permanently declined. Once declined on iOS or Android, notification permission is functionally gone.

**Post-launch condition for notifications:** User has completed ≥3 sessions and received at least one coaching insight. Then and only then surface the notification permission request.

---

### 4.2 Social features

**Excluded permanently for now.** No friend connections, leaderboards, shared workouts, public profiles, or activity feeds. GAINER is a personal training companion. See `gainer-philosophy.md`.

If social features are ever added, they will not be in onboarding and will not be visible in the core training flow.

---

### 4.3 Nutrition tracking

**Excluded permanently.** Nutrition is adjacent to training. Building adjacent features dilutes what GAINER does well. If a user needs calorie tracking, they already have MyFitnessPal.

---

### 4.4 Wellness and mood tracking

**Excluded permanently.** Sleep score, stress level, mood logging, journaling, breathing exercises, affirmations — none of these are GAINER features. They belong to a different product category. See `gainer-philosophy.md`.

---

### 4.5 Live AI Coach as a primary feature

**Excluded from v1 launch as a prominently marketed feature.** The AI Coach exists in preview mode (local mock responses). It can ship in that state without marketing it as a key differentiator.

**What this means in practice:**
- AI Coach preview mode: ships, accessible, not prominently marketed
- AI Coach live mode (LLM calls): does not ship at launch unless the serverless endpoint, rate limiting, cost controls, and data safety review are complete
- AI Coach as the primary onboarding or session hook: excluded
- AI Coach as a chatbot users are encouraged to interact with continuously: excluded

**Decision required before launch:** Choose whether AI Coach launches in preview-only mode or with live backend enabled. If live backend is enabled, the privacy policy must be updated and Data Safety answers re-checked. See `manual-launch-tasks.md`.

---

### 4.6 Premium paywall

**Excluded from v1.** No subscription gate, no feature lock, no "upgrade to unlock" prompts in the initial experience.

The reason is not that monetization is wrong. The reason is that GAINER cannot ask users to pay for something before they have seen that it works. The premium tier is defined in `premium-philosophy.md` — it exists for when the coaching layer has demonstrated genuine recurring value. Shipping a paywall in v1 before that value exists inverts the trust relationship.

**What this means:** All features in v1 are free. No free/premium distinction yet. The coaching layer, when it exists and demonstrably works, is the natural premium unlock. Build that first.

---

### 4.7 Streak mechanics and gamification

**Excluded permanently.** No streaks, no achievement badges, no points, no "Day 5 of your program!" popups, no consecutive-days counters. Training consistency is the goal. Gamification proxies encourage the appearance of consistency (opening the app) rather than consistency itself (completing training sessions).

See `gainer-philosophy.md` Anti-Bloat Principles for the canonical prohibition list.

---

### 4.8 Calendar and scheduling integration

**Excluded from MVP.** Planned sessions in a calendar view, Google Calendar sync, notification scheduling based on training days — all deferred. The user knows when they train. GAINER does not need to manage their calendar.

---

### 4.9 Search and advanced filtering in the workout catalog

**Excluded from MVP.** The ready program catalog is curated and small enough to browse. Keyword search, multi-dimension filters, and comparison tools are Phase 3 work.

---

### 4.10 Progression gating recommendations (in-app progression prompts)

**Excluded from MVP.** The full `evaluateProgressionGating()` system defined in `progression-gating-rules.md` is a coaching feature that requires sufficient behavioral data to work correctly. Building it correctly takes time. Shipping it incorrectly — recommending progression prematurely — destroys trust.

The progression intelligence should be built and validated internally before being surfaced to users. Post-session insights can include `plateau_detected` as a lightweight first signal. Full progression gating is Phase 2+ work.

---

### 4.11 Program builder with AI assistance

**Excluded from MVP.** AI-assisted workout program generation — "create a 4-day push-pull program for intermediate lifters with a home gym" — is a compelling future feature. It requires a reliable live AI backend, structured output parsing, exercise validation, and significant UX work. This is v3 territory.

---

### 4.12 Long-range analytics and trend detection

**Excluded from MVP.** Periodization analysis, 12-week trend charting, estimated 1RM tracking, recovery rate modeling, ACWR dashboard — all deferred. The system cannot produce meaningful long-range analytics without long-range data. Launch users do not have it yet.

---

### 4.13 Coaching insights in-session

**Excluded permanently from MVP and from post-MVP.** Coaching insights are never delivered during an active session. The user is training. Interrupting a session to deliver a coaching message is architecturally prohibited. See `post-session-single-insight-mvp.md`.

---

### 4.14 Multiple insights per session

**Excluded from MVP.** The post-session surface delivers one insight or null. Multiple insights per session are deferred until sufficient behavioral data exists to rank and sequence them correctly. See `post-session-single-insight-mvp.md`.

---

### 4.15 LLM-generated coaching messages

**Excluded from MVP post-session insight.** MVP post-session insight uses deterministic template messages only. LLM-generated messages add latency, API cost, hallucination risk, and output variance without improving insight quality for the four supported insight types. Templates are sufficient.

LLM generation is appropriate when insights are complex, context-dependent, and require natural language flexibility. The four MVP insight types are simple enough to template correctly.

---

## 5. AI Features Allowed in MVP

The following AI-adjacent features are allowed in v1. "Allowed" means they can ship in their current or planned MVP form.

---

### 5.1 AI Coach in preview mode

The AI Coach exists with local mock responses (`aiCoachPreview.ts`). It provides a realistic preview of the coaching experience without a live backend.

**Allowed because:** It is already implemented, it demonstrates the product's coaching direction, and it works fully offline. It is clearly framed as preview mode in the UI.

**Constraints:**
- Must be visibly labeled as "Preview" or equivalent — not presented as live AI
- Must not promise capabilities it cannot deliver (real-time learning, memory of past sessions in preview mode)
- If live mode is enabled, the constraint is the live backend spec in `docs/ai-coach-backend.md`

---

### 5.2 Post-session single coaching insight (four types, deterministic)

If implemented and tested before launch, the post-session insight system may ship in v1.

**Allowed because:** It is narrowly scoped, fully deterministic, produces `null` for most sessions (silence is the default), and delivers specific, data-backed observations that create genuine user value. See `post-session-single-insight-mvp.md` for the complete spec.

**Constraints:**
- Four types only: `personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`
- No LLM generation — template messages only
- No push notifications — post-session screen only
- `progression_ready` type explicitly excluded until the data flow is validated
- One insight maximum per session
- Silence rules enforced (no back-to-back, minimum session history requirements)

---

### 5.3 Recommendation engine (onboarding)

The scoring-based program recommendation system that runs during onboarding (`recommendationScoring`, `recommendationProfile`, `recommendationProgramme`) is allowed and required.

**Allowed because:** It is already implemented, fully local, and deterministic. It is the core mechanism by which GAINER demonstrates personalization at the first session.

**Constraints:**
- The recommendation must visibly reflect different answers (equipment filter must produce different program lists)
- The recommendation explanation must be honest and specific, not generic

---

### 5.4 Progression signal detection (internal, not surfaced)

Internal computation of progression signals — completion rate, consecutive sessions at rep ceiling, load history — is allowed as internal data preparation, even if the coaching surface is not yet active.

**Allowed because:** Building and validating the signal computation before it is surfaced allows the system to accumulate accurate historical data from launch users, so that when progression gating is surfaced, it has real behavioral data to work from.

**Constraint:** These signals must not be surfaced to users in MVP unless the full gating spec in `progression-gating-rules.md` is implemented correctly.

---

## 6. AI Features Not Allowed in MVP

These AI-related features must not ship with v1, regardless of their development state at the time of launch.

| Feature | Reason not allowed |
|---|---|
| LLM-generated post-session messages | Latency, cost, hallucination risk; templates sufficient |
| Push notifications for coaching insights | Notification permission must follow demonstrated value |
| `progression_ready` coaching insight | Requires template `repsMax` data flow validation; excluded from MVP post-session spec |
| Full progression gating recommendations | Requires sufficient behavioral data; incorrect recommendations destroy trust |
| Weekly or monthly coaching summaries | Requires data volume not present at launch |
| Deload recommendations | Requires ACWR computation over weeks; behavioral data not present at launch |
| Plateau intervention beyond `plateau_detected` | The detection is MVP; the intervention advice is not |
| Per-muscle-group fatigue modeling | Requires reliable volume-load tracking per muscle group; not yet built |
| AI-assisted program generation | Requires live backend, structured output parsing, exercise validation — v3 |
| Chatbot interface (open-ended Q&A) | GAINER is not a chatbot; this is a product identity constraint |
| Coaching insights during active sessions | Architecturally prohibited; see §4.13 |
| Multiple insights per session | Requires ranking and sequencing logic not built in MVP |
| AI personalization of the program catalog | Requires enough behavioral data to personalize; not present at launch |
| Coaching phase-aware message variation | `observation/emerging/active/trusted` phase-based delivery is a future architecture; MVP uses universal 0.75 threshold |

---

## 7. Stability Priorities

These must be addressed before launch. They are not new features — they are correctness requirements for what already exists.

**Priority order: fix these first, in this order.**

---

### 7.1 Save truthfulness (critical)

The app must not display a success state before persistence resolves. This is not a feature — it is a fundamental trust requirement.

**Specific items:**
- Completion screen must only appear after `saveCompletedWorkoutSession` resolves
- Empty sessions (zero sets logged) must not produce a saved state
- Save failure must produce a visible, actionable error state

---

### 7.2 Navigation context preservation (critical)

Back navigation must return to the real entry surface, not a root fallback. Loss of navigation context is the most common source of disorientation in the app.

**Specific items:**
- All flows listed in §2.4 must be verified working
- Back from program detail: returns to the screen that navigated to it
- Post-completion: lands at an appropriate next destination, not the home tab root

---

### 7.3 Logger validation (high)

Invalid actions in the logger must not silently fail. The user must understand why an action is blocked.

**Specific items:**
- Done button disabled with explanation when required inputs are missing
- Set completion requires weight and reps (or explicit skip decision)
- Undo or recovery path for accidentally skipped exercises

---

### 7.4 Settings honesty (medium)

Settings that are not wired must be removed or clearly labeled.

**Specific items:**
- Any toggle that has no effect must be removed before launch
- "Keep screen awake" must be wired or hidden
- No settings that imply features which do not exist

---

### 7.5 Data integrity on load (medium)

The database normalization in `src/storage/database.ts` must handle all edge cases:

- Missing fields from older schema versions (safe defaults required)
- Corrupted AsyncStorage values (recovery path, not crash)
- Exercise library re-seeding must not overwrite user-created custom exercises

---

### 7.6 Exercise library completeness (medium)

The exercise library seeded into the app must cover all exercises referenced in ready programs. A program that references an exercise not in the library is a user-facing bug.

---

## 8. UX Priorities

These are the UX qualities the MVP must achieve. They are not feature specifications — they are experience standards.

---

### 8.1 One clear next action at all times

Every screen must have a primary action. The user must never face an open-ended surface without knowing what to do. Screens that offend against this:

- Home with no active program and no clear CTA
- Post-completion screen that does not suggest a next session
- Onboarding that ends at a home screen rather than at a specific program

**Standard:** If a user could reasonably ask "what do I do now?", the screen has failed.

---

### 8.2 The log loop is fast

A user who knows their exercises, weights, and targets should be able to log a full set in under 3 taps. Logging must feel faster than writing in a notebook.

**Standard:** No modal dialogs before logging a set. No loading states between exercises. No confirmation screens for individual set completion.

---

### 8.3 Silence is not confusion

When the app has nothing to show (no history, no insights, no progress yet), it must communicate absence honestly — not with empty screens, not with fake placeholder data, not with loading spinners.

**Standard:** Empty states explain what will appear once training data exists. They are not errors, they are honest acknowledgments.

---

### 8.4 Coaching restraint

The post-session insight, when implemented, must be:
- Displayed after the session is saved — never before
- One sentence or two — never a paragraph
- Specific to this user's data — never generic
- Absent (null) for most sessions — silence is the correct default

A single accurate insight is worth more than five generic ones. If the system is uncertain, it stays silent. See `post-session-single-insight-mvp.md`.

---

### 8.5 No upsells before value

Premium, upgrade prompts, and subscription gates must not appear:
- During onboarding
- During the first session
- On the post-completion screen of the first session
- In any forced interruption

The user must have received genuine value from the core product before any premium conversation begins.

---

### 8.6 Recommended program is specific, not categorical

Onboarding must terminate at a specific recommended program with a brief explanation, not at a list of programs for the user to choose from.

**Correct:** "Based on your goal and schedule, GAINER recommends Foundational Strength 3-Day. It matches your 3-day week and intermediate level."

**Incorrect:** "Here are programs that might work for you." (followed by five equally-weighted options)

---

### 8.7 Tone is calm and direct

GAINER does not use exclamation marks in coaching output. It does not call sessions "epic" or users "warriors." It does not celebrate opening the app. The tone is that of a knowledgeable training partner who respects that you already know why you are here.

**Standard:** Read any piece of copy before it ships. If it would sound out of place in a calm conversation with a good coach, rewrite it.

---

## 9. Technical Priorities

These technical properties must be maintained at launch and never compromised as post-launch features are added.

---

### 9.1 Full offline functionality

The app must work completely without a network connection. This is not aspirational — it is a hard requirement.

**What offline means:**
- All workout logging: offline
- All history and progress: offline
- All program catalog access: offline
- Recommendation engine: offline
- Post-session insights (MVP, deterministic): offline
- AI Coach in preview mode: offline
- AI Coach in live mode: gracefully degraded (falls back to preview mode, user is informed)

**What online means:**
- AI Coach live mode only, with explicit fallback
- Future: account sync and backup (Supabase, not yet active)

---

### 9.2 Pure domain logic in `src/lib/`

All business logic — progression computation, signal detection, recommendation scoring, insight evaluation — must remain as pure TypeScript functions in `src/lib/` with no React dependencies, no AsyncStorage calls, and no side effects. This is what makes the logic testable in isolation.

**Standard:** Every function in `src/lib/` that makes a non-trivial decision must have a test in `tests/lib/`. If a function cannot be tested without the app running, it is in the wrong place.

---

### 9.3 State through context only

All persisted application state flows through `AppProvider` (AppDatabase) or `WorkoutProvider` (live session). No component-level persistence. No additional AsyncStorage keys introduced without a corresponding schema migration in `database.ts`.

---

### 9.4 Append-only session logging

`WorkoutSession` and `ExerciseLog` records are never modified after save. History is immutable truth. Corrections are new entries, not overwrites. This property is what makes the signal layer trustworthy — computed signals can always be recomputed from the same underlying data.

---

### 9.5 Type safety maintained

TypeScript strict mode. No `any` in new code. No `as` casts that bypass runtime type checking. The types in `src/types/models.ts` must match the actual shape of data stored in AsyncStorage — the normalization in `database.ts` is what enforces this.

---

### 9.6 Tests for every new domain decision

Any new function in `src/lib/` that makes a decision (branching logic, threshold checks, conditional outputs) must have test coverage before it ships. The test suite runs with `npm run test:unit` — it must pass before any commit that touches domain logic.

---

### 9.7 OpenAI never called from the mobile app

The live AI Coach endpoint is serverless (`api/ai-coach.ts`). The mobile app calls its own endpoint. The endpoint calls OpenAI. This indirection is load-bearing: it prevents API keys from being extracted from app binaries, enables rate limiting and cost controls at the server layer, and keeps sensitive data off the device.

**Hard rule:** `openai` package is never imported in `src/`. It belongs only in `api/`.

---

## 10. Analytics and Metrics Priorities

GAINER's v1 analytics must serve one purpose: understand whether users complete the core loop and return to it.

---

### 10.1 Metrics worth collecting at launch

Track only what informs a specific product decision. If a metric cannot inform a decision, do not collect it.

| Metric | What it informs |
|---|---|
| Onboarding completion rate | Whether the onboarding flow is too long or too confusing |
| Step-by-step onboarding drop-off | Which question causes friction |
| Session start rate after onboarding | Whether the recommendation-to-session path works |
| Session completion rate (sessions finished / sessions started) | Whether the logging experience is functional |
| Day 7 retention (users who log ≥2 sessions in first 7 days) | Whether the product created a return habit |
| Day 30 retention | Whether week-two engagement holds |
| Sessions per user per week (week 2–4) | Whether users are actually training on their planned schedule |

---

### 10.2 Metrics that are premature at launch

| Metric | Why premature |
|---|---|
| Insight engagement rate | Post-session insights may not exist at launch; need usage volume first |
| Premium conversion rate | No premium tier in v1 |
| Notification open rate | No notifications in v1 |
| AI Coach interaction rate | Preview mode only; rate reflects curiosity, not value |
| Exercise substitution rate | Data volume too low to be meaningful |
| Feature discovery rate (tabs visited, settings opened) | Vanity metric at v1 scale |
| Daily active users | DAU is meaningless for a training app; sessions per week is the right proxy |

---

### 10.3 What counts as success in the metrics

The only v1 metric that matters for product direction decisions is **Day 30 retention**. If a meaningful portion of users who completed onboarding are still logging sessions at Day 30, the core loop works. Everything else is context.

Secondary proxy: **Sessions per user in weeks 2–4.** A user who logs their first session and then logs nothing for 30 days was not retained. A user who logs 12 sessions in their first 30 days is retained. The training frequency target from onboarding is the benchmark.

---

### 10.4 Privacy-first analytics

GAINER collects training data. It does not need to collect behavioral analytics that include personally identifiable information. Analytics should be:
- Aggregate, not individual
- Opt-in where possible
- Clearly disclosed in the privacy policy
- Never sold or shared with advertising networks

If the analytics tool in use requires personal data to attribute events, evaluate whether the insight gained is worth the privacy cost. In most cases at v1 scale, it is not.

---

## 11. Anti-Overengineering Rules

These rules exist because the most common failure mode for products at this stage is building the right features at the wrong time, which delays launch, increases maintenance burden, and adds complexity that has to be worked around later.

---

**Rule 1: No feature for a problem that does not yet exist.**

Do not build filtering, search, or sorting for a catalog of 20 programs. Do not build a memory tier system before users have enough sessions to populate it. Build the solution for the current scale.

---

**Rule 2: No optimization before measurement.**

Do not optimize recommendation scoring algorithms before knowing whether users complete onboarding. Do not optimize progression logic before knowing whether users return for a second session. Measure the problem first.

---

**Rule 3: No scaffolding ahead of the feature.**

Do not build `ProgressionState`, `SessionPerformanceSignal`, or `AdherenceRecord` before the coaching surface that uses them is being built. Data structures without consumers are debt.

---

**Rule 4: No system that requires a system to understand.**

If explaining how a feature works requires explaining two other systems first, the feature is too complex for MVP. Build the simpler version that creates 80% of the value.

---

**Rule 5: Silence is correct output.**

For every coaching system — post-session insights, progression gating, fatigue detection — the default output is null. No output. Silence. The system only speaks when the data clearly warrants it. Any implementation pressure to "always show something" must be resisted.

---

**Rule 6: Templates before LLM.**

For any coaching message that can be expressed as a deterministic template, use a template. LLMs add latency, cost, failure modes, and output variance. They earn their place when the content genuinely cannot be templated. MVP content can be templated.

---

**Rule 7: No feature that implies another feature.**

Adding a "coaching history" screen implies there is enough coaching to browse. Adding a "notifications" settings screen implies notifications are active. Adding a "social" entry point implies there is a social layer. Do not add UI that implies features that do not exist.

---

**Rule 8: Two fields on AppPreferences before a new table.**

For any new small piece of persistent state, evaluate whether it fits in existing storage first. Adding a new AsyncStorage key or a new database table requires schema migration, normalization updates, and load-time handling. Two fields on `AppPreferences` require none of this.

---

**Rule 9: No A/B testing framework at v1 scale.**

Feature flagging, A/B test infrastructure, and multivariate experiment tracking are meaningful at 10,000+ monthly active users. At v1 scale with initial launch traffic, the overhead of the framework is larger than the insight it produces. Ship one version and iterate.

---

**Rule 10: The exercise library is static.**

`generatedExerciseLibrary.ts` is the source of truth for exercise data. It is generated from a script and seeded into the app. Do not add a CMS, an admin panel, a remote exercise database fetch, or a user-editable exercise library to MVP. The library does not need to be dynamic at this scale.

---

**Rule 11: No "smart" defaults before you know what smart means.**

Default values — progression increments, coaching thresholds, rest timer durations — should be the simplest correct value, not the AI-optimal value. The system will learn what "smart" means from behavioral data. Prematurely optimizing defaults adds complexity and may be wrong.

---

**Rule 12: Do not build what can be observed.**

Training time preference, preferred rest intervals, coaching intensity preference — these are all observable from behavioral data. Do not add onboarding questions or settings for things the system will learn. Build the observation system instead.

---

## 12. Launch-Risk Analysis

These are the failure modes most likely to cause the launch to damage rather than build the product's reputation.

---

### Risk 1: Save truthfulness failure (critical risk)

**Scenario:** A user completes a session. The app shows "Workout saved." The session is not in History because persistence failed silently.

**Impact:** Complete loss of user trust. The user worked out. Their data is gone. They will not return.

**Mitigation:** Truthful save states (§7.1) are a hard launch requirement. Do not ship until `saveCompletedWorkoutSession` failure produces a visible error and retry path, and the completion screen only appears after successful persistence.

---

### Risk 2: Onboarding recommendation does not visibly personalize (high risk)

**Scenario:** A user who selects "home gym" sees the same program recommendation as a user who selects "full gym." The user concludes the app does not actually adapt.

**Impact:** Loss of trust before the first session. Onboarding's primary job — demonstrating that GAINER understood the user — fails.

**Mitigation:** Equipment filter must change the recommendation visibly. Verify this with all equipment configurations before launch.

---

### Risk 3: Navigation context loss on key flows (high risk)

**Scenario:** A user completes their first session via the onboarding recommendation path. After the completion screen, they land on the Home tab root with no clear next action. Their program context is lost.

**Impact:** Confusion and disorientation on the highest-value flow (first session completion). Users who complete their first session and then cannot find their program are likely to churn.

**Mitigation:** Origin-aware navigation (§7.2) must be verified for the onboarding → program → session → completion flow specifically.

---

### Risk 4: AI Coach live mode ships without cost controls (medium risk)

**Scenario:** Live AI Coach is enabled at launch. A subset of engaged users makes hundreds of requests. OpenAI costs spike before any revenue exists.

**Impact:** Financial risk. Potential service interruption if rate limits are not enforced.

**Mitigation:** If live AI Coach ships, enforce rate limiting in `api/ai-coach.ts` (`AI_COACH_RATE_LIMIT_MAX` and `AI_COACH_RATE_LIMIT_WINDOW_MS`). Consider keeping live mode off in v1 and shipping preview mode only. See `manual-launch-tasks.md`.

---

### Risk 5: Privacy policy gap (medium risk, high consequence)

**Scenario:** Google Play Data Safety form does not accurately describe data collection. Especially relevant if live AI Coach ships (training context is sent to OpenAI).

**Impact:** Play Store policy violation, potential removal from store.

**Mitigation:** Complete the Data Safety form accurately. If live AI Coach is enabled, update the privacy policy to disclose that session context is sent to a third-party AI provider. If uncertain, launch with preview-only AI and update after the full policy review.

---

### Risk 6: Post-session insight produces false positives (medium risk)

**Scenario:** The `plateau_detected` or `personal_record` insight triggers incorrectly — e.g., detecting a PR when the user simply entered the same exercise with a different name variant.

**Impact:** The coaching layer's first impression is inaccurate. Users who receive a wrong insight will not trust subsequent correct insights.

**Mitigation:** If post-session insights ship in v1, enforce the silence rules strictly. Disqualify any insight where the exercise match is by name only (no library ID). When uncertain, stay silent. See `post-session-single-insight-mvp.md`.

---

### Risk 7: Exercise library gaps in ready programs (low risk, embarrassing)

**Scenario:** A ready program references an exercise that is not in the generated exercise library. The substitution screen or exercise detail shows a broken or empty state.

**Impact:** Minor but visible quality failure.

**Mitigation:** Audit the exercise library against all ready program exercise references before launch. Run `npm run exercise:sync` and verify.

---

### Risk 8: Settings screen shows non-functional toggles (low risk, trust cost)

**Scenario:** A user opens settings, sees "Keep Screen Awake" toggle, enables it, and notices it has no effect.

**Impact:** Small but cumulative. Users who find broken settings lose confidence in the product's overall quality.

**Mitigation:** Remove non-functional settings before launch. If "Keep Screen Awake" cannot be wired before launch, remove the toggle. See §2.10.

---

## 13. Recommended Post-Launch Roadmap

This is the sequence of work after v1 ships, ordered by user impact and prerequisite dependency. It follows the phasing established in `product-roadmap-phases.md` but anchors that roadmap to the MVP completion boundary.

---

### Immediate post-launch (first 30 days)

**Priority: fix what users report before building anything new.**

No feature is worth building in the first 30 days that competes with fixing what launch users encounter. Monitor the Day 7 retention metric. If it is below target, find out why before adding features.

Likely first-30-day work:
- Editable setup after onboarding (§3.1) — highest user-facing impact
- Home continue vs browse clarity (§3.4) — affects every returning user
- Post-session coaching insight if not shipped at launch (§3.2)
- Any launch bug fixes

---

### 30–90 days post-launch

**Priority: retention and trust depth.**

- Body weight tracking (§3.5)
- Personal data export (§3.3)
- History improvements: session highlights, PR markers
- Home: one clear primary action (session continuation)
- Recommendation explanation improvements (why this program was recommended)

---

### 90–180 days post-launch

**Priority: coaching layer depth.**

- Full `evaluateProgressionGating()` implementation and surfacing (requires 90+ days of behavioral data from real users to validate)
- `progression_ready` coaching insight type (requires progression gating to be validated)
- Weekly or monthly coaching summary surface
- Richer saved-session model (notes, substitution context, partial completion)
- Workout catalog search and basic filtering

---

### 180+ days post-launch

**Priority: premium tier and AI intelligence.**

- Premium subscription tier (AI coaching insights as the primary unlock)
- Live AI Coach as a prominently marketed feature (if not shipped at launch)
- Operational AI Coach with scoped actions (why this plan, adapt to 2 days, swap for home gym)
- Advanced progression analytics and trend detection
- Phase-aware coaching delivery (`observation → trusted` system from `ai-trust-system.md`)

---

### v3 territory (18+ months)

These features require a large active user base, significant behavioral data, and a mature coaching layer. Do not schedule them until the v1 and v2 layers are stable.

- AI-assisted program generation
- Long-range training block planning
- Per-muscle-group fatigue modeling
- Social or community features (if ever)
- Wearable device integration
- Coach marketplace or human coach integration

---

## 14. What Success Looks Like for v1

Success is not download count or app store rating. Success is whether the product creates and keeps a real training relationship with the users who were supposed to benefit from it.

---

### The success benchmark at 30 days

A v1 launch succeeds if, at Day 30:

**Retention:** A meaningful percentage of users who completed onboarding have logged ≥3 sessions.

**Loop integrity:** Users who return are logging sessions (not just opening the app). The training loop is what they return to — not a notification, not a streak, not a badge.

**Trust:** No significant reports of lost sessions, data disappearing, or incorrect saves. The app is honest.

**Direction:** At least one metric points clearly at the next highest-leverage improvement. The launch generated data, not just downloads.

---

### What a v1 user should be able to say after their first week

- "I know what program I'm on."
- "I know what my next session is."
- "I logged my first three sessions without confusion."
- "My history shows what I actually did."
- "The app didn't waste my time."

---

### What a v1 user should not be saying

- "It said my workout was saved but it wasn't there when I checked."
- "I don't know why it recommended me that program."
- "I tried to go back and couldn't find where I was."
- "It keeps showing me things I didn't ask for."
- "The AI told me something that wasn't true."

---

### What v1 is explicitly not trying to prove

- That GAINER is the most feature-complete fitness app
- That the AI coaching layer is fully operational
- That the premium tier is revenue-positive
- That 1,000 users love it

**v1 is trying to prove one thing:** that the core training loop — recommend, start, log, finish, remember — works reliably and honestly. That is the foundation everything else is built on. If it works, everything else is a matter of time. If it does not work, everything else is irrelevant.

---

## Summary Reference

**Core loop (all must work):**
Onboarding → recommendation → log session → save truthfully → appear in history → show progress

**Must-have at launch:**
Onboarding, recommendation engine, workout logging with truthful save states, origin-aware navigation, program catalog, custom programs, training history, progress tracking, exercise library, honest settings, published privacy policy

**Deferrable but high priority:**
Editable setup post-onboarding, post-session coaching insight, personal data export, Home continue/browse clarity, body weight tracking

**Explicitly excluded from MVP:**
Push notifications, social features, nutrition tracking, wellness tracking, premium paywall, streak/gamification mechanics, calendar integration, program catalog search, live AI Coach as primary feature (TBD), LLM-generated coaching messages, progression gating recommendations, AI program builder, long-range analytics, in-session coaching, multiple insights per session

**AI allowed in MVP:**
Recommendation engine, AI Coach preview mode, post-session insight (4 types, deterministic, silence-default), internal progression signal computation

**AI not allowed in MVP:**
LLM-generated messages, push notification delivery, `progression_ready` insight, full progression gating surface, weekly/monthly summaries, deload recommendations, phase-aware coaching delivery, chatbot interface, in-session coaching

**Launch-critical risks:**
Save truthfulness failure, onboarding recommendation not visibly personalizing, navigation context loss, live AI cost without rate controls, privacy policy gap

**v1 success test:**
Users who complete onboarding are still logging sessions at Day 30. The app is honest. The loop works.
