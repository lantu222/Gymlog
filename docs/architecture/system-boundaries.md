# Gainer — System Boundaries

**Type:** Architecture reference
**Status:** Authoritative. Defines what each subsystem may and may not do.
**Related:** `system-architecture.md`, `documentation-architecture.md`, `adr/`

# Launch Critical

Failure in this system blocks launch.

---

## Purpose

This document defines the hard boundaries between Gainer's subsystems. These are not style guidelines — they are constraints enforced at the architectural level. A boundary violation is a bug, not a design choice.

Any proposed feature or implementation that requires crossing a boundary defined here must produce an ADR before proceeding.

---

## Subsystem Map

```
┌──────────────────────────────────────────────────────────────────────┐
│  UI LAYER (screens, components)                                      │
│  Allowed: render state, dispatch actions, call lib functions         │
│  Forbidden: business logic, storage access, scoring, AI calls        │
├──────────────────────────────────────────────────────────────────────┤
│  STATE LAYER (AppProvider, WorkoutProvider)                          │
│  Allowed: persist state, expose context, dispatch to reducers        │
│  Forbidden: business logic, AI calls, recommendation scoring         │
├──────────────────────────────────────────────────────────────────────┤
│  DOMAIN LOGIC LAYER (src/lib/)                                       │
│  Allowed: pure computation, scoring, signal detection, validation    │
│  Forbidden: AsyncStorage, React hooks, network calls, side effects   │
├──────────────────────────────────────────────────────────────────────┤
│  AI COACH LAYER (aiCoachClient, aiCoachPreview)                      │
│  Allowed: format coaching context, call serverless endpoint          │
│  Forbidden: generate programmes, modify templates, run during session│
├──────────────────────────────────────────────────────────────────────┤
│  SERVERLESS LAYER (api/ai-coach.ts)                                  │
│  Allowed: call OpenAI, apply rate limits, return coaching text       │
│  Forbidden: store user data, modify app state, access AsyncStorage   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Onboarding Subsystem

**Owns:** Collecting user inputs for goal, level, equipment, days per week, and optional focus areas.

**Allowed:**
- Display onboarding screens and collect user selections
- Call `buildUserFitnessProfile()` to derive a typed profile from answers
- Pass the completed profile to the recommendation engine
- Store onboarding answers in `AppPreferences` via AppProvider

**Forbidden:**
- Computing recommendation scores (scoring lives in `src/lib/recommendationScoring.ts`)
- Generating programme content (content lives in `workoutCatalog.ts` and `recommendationProgramme.ts`)
- Calling the AI Coach layer for any part of programme selection or construction
- Displaying any premium prompt or paywall during onboarding
- Asking questions whose answers have no visible effect on the recommendation

**Boundary rule:** Onboarding must not generate recommendations. It collects inputs. The recommendation engine consumes them.

---

## 2. Recommendation Engine

**Owns:** Selecting the best-fit programme from the catalog given a `UserFitnessProfile`.

**Allowed:**
- Score all catalog programmes against the `UserFitnessProfile` using the dimensions defined in `onboarding-impact-matrix.md`
- Apply hard constraints (equipment, frequency, beginner safety) as elimination filters
- Return one primary recommendation and up to two alternatives with confidence and fallback metadata
- Produce `RecommendationProgrammeProfile` payload with 4-week block, phase labels, progression rules, and copy fields
- Explain the recommendation in terms of the user's onboarding answers

**Forbidden:**
- Generating free-form programme content (templates are static catalog data)
- Calling the AI Coach layer to select or construct a programme
- Guaranteeing specific outcomes (strength gains, weight loss, muscle gain)
- Returning a recommendation that requires equipment the user does not have
- Pretending a plan exists for a frequency/goal combination that the catalog does not support

**Boundary rule:** The recommendation engine selects from existing catalog content. It does not invent content.

---

## 3. Workout Logging Subsystem

**Owns:** Capturing set-level data during an active training session.

**Allowed:**
- Log sets with weight, reps, and completion status
- Skip exercises with an explicit user action
- Apply the rest timer
- Validate set completion (require weight + reps or explicit skip)
- Show inline validation errors for blocked actions

**Forbidden:**
- Showing any AI coaching output during an active session — absolutely none, including exercise substitution suggestions surfaced without user request
- Triggering `computePostSessionInsight()` while the session is active
- Displaying a completion or saved state before `saveCompletedWorkoutSession` resolves successfully
- Showing a "saved" state when zero sets were logged
- Calling OpenAI or any external service during logging

**Boundary rule — ADR-001:** No AI output of any kind may be surfaced while a workout session is active. This is architecturally enforced: `computePostSessionInsight()` and the AI Coach client must not be called while `WorkoutProvider` has an active session.

**Boundary rule — ADR-002:** The completion screen (`WorkoutCompletionScreen`) may only be entered after `saveCompletedWorkoutSession` resolves successfully. The save flow must expose three explicit states: saving, saved, save failed.

---

## 4. Post-Session Insight System

**Owns:** Computing and delivering one optional coaching insight after a session is saved.

**Allowed:**
- Evaluate four insight types: `personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`
- Return one insight or `null`
- Use deterministic template messages (no LLM generation)
- Apply silence rules before any evaluation
- Store `lastInsightSessionId` and `lastInsightType` in `AppPreferences`

**Forbidden:**
- Running while a session is active (ADR-001)
- Returning more than one insight per session
- Generating messages with LLM calls
- Sending push notifications (post-session surface only)
- Evaluating `progression_ready` in MVP (excluded type)
- Producing any output below the 0.75 confidence threshold
- Delivering an insight for the session immediately following one that already had an insight

**Boundary rule — ADR-003:** The function must return `null` for the majority of sessions. Silence is the correct and expected default. Any implementation pressure to "always show something" is a boundary violation.

---

## 5. Progression Gating System

**Owns:** Computing whether a load increase, hold, or silence is appropriate for a given exercise.

**Allowed:**
- Evaluate `progressionReady` state per exercise using the double progression model
- Compute confidence scores for progression decisions
- Return `'progress' | 'hold' | 'silent'` from `evaluateProgressionGating()`
- Use the fatigue signal enum: `'normal' | 'elevated' | 'high'`
- Apply ACWR thresholds defined in `progression-gating-rules.md`

**Forbidden:**
- Surfacing progression recommendations to the user in MVP (internal computation only)
- Communicating hold decisions to the user (hold is always silent)
- Generating coaching messages from the gating result in MVP
- Modifying the workout template based on progression state
- Running without minimum session history (silence until data thresholds are met)

**Boundary rule:** Progression gating computes internal signals. In MVP, it does not produce user-visible output. The `progression_ready` coaching insight type is explicitly excluded from MVP.

---

## 6. AI Coach Layer

**Owns:** Formatting coaching context and calling the serverless endpoint in live mode, or returning mock responses in preview mode.

**Allowed:**
- Assemble `UserFitnessProfile` and session context into a structured prompt
- Call `EXPO_PUBLIC_AI_COACH_API_URL` in live mode
- Return local mock responses in preview mode
- Clearly label preview vs live mode in the UI

**Forbidden:**
- Selecting or generating workout programmes
- Overriding recommendations from the deterministic recommendation engine
- Calling OpenAI directly from the mobile app (must go through the serverless layer)
- Running during an active workout session (ADR-001)
- Producing output while there is no post-session context (the AI Coach is not a chatbot on-demand for arbitrary queries in MVP)

**Boundary rule:** The AI Coach explains and advises. It does not generate programmes, select templates, or modify the user's training plan directly.

---

## 7. Session Persistence Layer

**Owns:** Saving completed `WorkoutSession` and `ExerciseLog` records to `AppDatabase`.

**Allowed:**
- Persist `WorkoutSession` and `ExerciseLog` after session completion
- Return success/failure status to the calling layer
- Apply append-only semantics (no session is ever modified after save)

**Forbidden:**
- Modifying an existing saved session record
- Showing a success state before the persistence operation resolves
- Silently discarding a save failure without surfacing a retry path
- Triggering post-session insight evaluation before the persistence operation resolves successfully

**Boundary rule — ADR-002:** Session persistence is the gate for all post-session behavior. Nothing post-session may run until persistence has explicitly succeeded.

---

## 8. Domain Logic Layer (`src/lib/`)

**Owns:** All business logic — scoring, signal detection, progression computation, insight evaluation, recommendation construction.

**Allowed:**
- Pure TypeScript functions with typed inputs and typed outputs
- Deterministic computation (same inputs → same outputs, always)
- Throw errors for invalid inputs (do not silently degrade)

**Forbidden:**
- Importing or calling `AsyncStorage`
- Importing or using React hooks
- Making network requests
- Producing side effects of any kind
- Importing from `src/screens/`, `src/components/`, or `src/state/`

**Boundary rule:** If a function in `src/lib/` cannot be tested by importing it directly in a Node.js test without a running app, it violates this boundary. Every non-trivial decision function must have a test in `tests/lib/`.

---

## 9. Data Ownership Boundaries

| Data | Owner | Read access | Mutation |
|---|---|---|---|
| `AppPreferences` | `AppProvider` | Any component via `useAppContext()` | Only through `AppProvider` dispatch |
| `workoutTemplates` (custom) | `AppProvider` | Any component | Only through repository functions |
| `completedSessions` / `exerciseLogs` | `AppProvider` | Any component | Append-only via `saveCompletedWorkoutSession` — never edit |
| Active workout session | `WorkoutProvider` | Any component via `useWorkoutContext()` | Only through `WorkoutAction` dispatch |
| `UserFitnessProfile` | Derived — never stored | Computed fresh from `AppPreferences` | Not stored; always recomputed |
| Coaching signals | Derived — never stored | Computed from `exerciseLogs` | Not stored; always recomputed |
| Exercise library | `generatedExerciseLibrary.ts` | App-wide | Static — seeded on load, stripped on save, never mutated at runtime |
| `lastInsightSessionId` / `lastInsightType` | `AppPreferences` | Post-session insight system | Via `AppProvider` after insight delivery |

---

## 10. Flow Constraints

The following flows have explicit ordering constraints that may not be violated.

### Save flow

```
User presses finish
  → validate session (sets logged > 0)
  → show "Saving..." state
  → call saveCompletedWorkoutSession()
  → on success: navigate to WorkoutCompletionScreen
  → on failure: show "Save failed" with retry
  → NEVER: show completion screen before persistence resolves
  → NEVER: show "saved" for a zero-set session
```

### Post-session insight flow

```
saveCompletedWorkoutSession() resolves successfully
  → compute post-session insight (async, after save confirmed)
  → if insight: display on completion screen
  → if null: display completion screen with no insight panel
  → NEVER: compute insight while session is still active
  → NEVER: display insight before save is confirmed
```

### Onboarding → recommendation flow

```
User completes onboarding inputs
  → buildUserFitnessProfile() derives typed profile
  → recommendation engine scores catalog against profile
  → returns primary recommendation with metadata
  → display recommendation with explanation
  → NEVER: call AI Coach to select or explain the programme during onboarding
  → NEVER: show a programme that requires equipment the user does not have
```

### Navigation context flow

```
Any entry point → program detail → start session → logging → completion
  → back from program detail: returns to entry surface (not home root)
  → post-completion: appropriate continuation screen
  → NEVER: collapse to home root and lose origin context
```

---

## Enforcement

These boundaries are enforced through:

1. **Architecture Decision Records** — `docs/adr/` for permanent decisions
2. **TypeScript types** — pure function contracts prevent misuse at compile time
3. **Test coverage** — every domain decision function in `src/lib/` must have tests
4. **Code review** — any PR that crosses a boundary requires explicit justification
5. **This document** — referenced in code review and PR templates
