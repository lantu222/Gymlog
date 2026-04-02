# Gymlog Product Roadmap

This document turns the current product and UX audit into three implementation phases.

The app already has two strong foundations:

- onboarding that makes plan choices feel concrete
- a workout logger that is fast and opinionated

The next work should protect those strengths while fixing trust, continuity, and long-term usefulness.

## Phase 1: Trust And Flow Integrity

### Goal

Make Gymlog feel reliable from recommendation to saved workout. Users should always know where they came from, what will happen when they finish a workout, and whether data was actually saved.

### Why This Comes First

- completion trust is a product-level requirement
- navigation continuity affects every core flow
- logger quality loses value if save behavior is ambiguous

### Scope

- origin-aware back navigation
- truthful workout completion and persistence states
- clearer validation and recovery inside logging
- remove or hide settings that are not actually wired

### Deliverables

#### 1. Origin-aware navigation

Replace the current root-collapse behavior with explicit origin tracking.

Flows to preserve:

- onboarding recommendation -> program detail -> logging -> summary -> next destination
- home primary action -> program detail -> logging -> summary -> expected return path
- workout list -> program detail -> logging -> summary -> workout flow
- progress detail -> back -> progress list
- history session detail -> back -> history list

Implementation direction:

- add route origin metadata or a lightweight route stack
- stop using only `getBackRoute()` as a root fallback
- persist the intended post-summary route instead of defaulting too early

Likely files:

- [App.tsx](/D:/Gymlog/App.tsx)
- [routes.ts](/D:/Gymlog/src/navigation/routes.ts)

Acceptance criteria:

- back from program detail returns to the real entry surface
- workout summary returns to the intended follow-up path
- onboarding no longer loses context when drilling into detail or logging

#### 2. Truthful finish and save flow

The app must not imply a workout was saved until persistence actually succeeds.

Implementation direction:

- add an explicit finish review state before final save
- treat zero-log sessions as discard or confirm discard, not as successful saves
- show `saving`, `saved`, and `save failed` states explicitly
- only enter [WorkoutCompletionScreen.tsx](/D:/Gymlog/src/screens/WorkoutCompletionScreen.tsx) after successful persistence

Likely files:

- [App.tsx](/D:/Gymlog/App.tsx)
- [WorkoutLoggingScreen.tsx](/D:/Gymlog/src/screens/WorkoutLoggingScreen.tsx)
- [WorkoutCompletionScreen.tsx](/D:/Gymlog/src/screens/WorkoutCompletionScreen.tsx)
- [completedWorkoutPersistence.ts](/D:/Gymlog/src/state/completedWorkoutPersistence.ts)
- [workoutAppAdapter.ts](/D:/Gymlog/src/features/workout/workoutAppAdapter.ts)

Acceptance criteria:

- empty sessions cannot show `Workout saved`
- failed persistence produces a visible retry path
- successful completion always appears in History and Progress where expected

#### 3. Logger validation and recovery

The logger should stay fast, but invalid actions should no longer silently no-op.

Implementation direction:

- disable `Done` when a row does not have valid required input
- add inline reasons for blocked completion
- add clearer skip and undo recovery
- expose slightly richer rest timer controls

Likely files:

- [WorkoutLoggingScreen.tsx](/D:/Gymlog/src/screens/WorkoutLoggingScreen.tsx)
- [WorkoutExerciseCard.tsx](/D:/Gymlog/src/components/WorkoutExerciseCard.tsx)
- [workoutState.ts](/D:/Gymlog/src/features/workout/workoutState.ts)

Acceptance criteria:

- no silent failure on set completion
- skipped exercise can be recovered intentionally
- rest timer feels like an active tool, not a passive countdown

#### 4. Truthful settings surface

Profile should only present controls that either work now or are clearly framed as upcoming.

Implementation direction:

- wire `keep screen awake` for real, or hide it for now
- remove the unused duplicate settings surface from product planning
- tighten copy so utility settings feel deliberate, not placeholder

Likely files:

- [ProfileScreen.tsx](/D:/Gymlog/src/screens/ProfileScreen.tsx)
- [SettingsScreen.tsx](/D:/Gymlog/src/screens/SettingsScreen.tsx)

### Out Of Scope

- big new feature work
- plan discovery redesign
- Vallu interaction redesign

### Exit Criteria

- core flows are context-safe
- saved means saved
- logging has clear validation
- profile does not over-promise

## Phase 2: Activation And Plan Fit

### Goal

Turn onboarding from a one-time wizard into a reusable plan-fit system. The user should feel that Gymlog helps them land on the right plan quickly, then lets them refine it without friction.

### Why This Comes Second

- onboarding is already strong and worth deepening
- BodBot’s biggest reusable lesson is early productization, not more form fields
- this phase improves first-run quality and long-term adaptability at the same time

### Scope

- editable setup after onboarding
- simplified recommendation step with clearer pacing
- stronger distinction between `continue` and `browse`
- better recommendation reasoning

### Deliverables

#### 1. Editable setup and plan fit

Users need a visible way to revisit setup decisions without resetting the app.

Implementation direction:

- add `Edit setup` or `Refine plan` entry point in Profile and possibly Home
- reuse the current first-run model instead of duplicating setup state
- let users revisit:
  - goal
  - days per week
  - equipment
  - guidance mode
  - schedule mode
  - focus areas
- regenerate recommendation from updated preferences

Likely files:

- [OnboardingScreen.tsx](/D:/Gymlog/src/screens/OnboardingScreen.tsx)
- [firstRunSetup.ts](/D:/Gymlog/src/lib/firstRunSetup.ts)
- [App.tsx](/D:/Gymlog/App.tsx)
- [ProfileScreen.tsx](/D:/Gymlog/src/screens/ProfileScreen.tsx)

Acceptance criteria:

- users can revisit setup without data reset
- updated setup changes recommendation logic cleanly
- plan fit feels like a reusable system, not a launch-only funnel

#### 2. Simplify recommendation pacing

Step 6 currently contains too many decisions at once.

Implementation direction:

- show recommended plan first
- show one clear primary CTA first:
  - `Start with this plan`
  - `Continue with this plan`
- demote `Shape the week`, `Make it more yours`, and Vallu to secondary refinement layers
- keep the recommendation screen visually product-like, not form-like

Likely files:

- [OnboardingScreen.tsx](/D:/Gymlog/src/screens/OnboardingScreen.tsx)
- [firstRunSetup.ts](/D:/Gymlog/src/lib/firstRunSetup.ts)

Acceptance criteria:

- recommendation reward appears before secondary tuning
- the user sees a real week before extra controls compete for attention
- setup feels shorter even if total capability remains similar

#### 3. Clarify Home: continue vs browse

Home should be a launcher, not a second discovery feed.

Implementation direction:

- keep one personalized continue card
- make ready/custom cards true browse entry points
- reduce misleading labels that imply direct continuation when the action actually opens detail
- optionally add a small `why this is first` explanation for the primary card

Likely files:

- [HomeScreen.tsx](/D:/Gymlog/src/screens/HomeScreen.tsx)
- [homePrimaryAction.ts](/D:/Gymlog/src/lib/homePrimaryAction.ts)
- [homeProgramSelection.ts](/D:/Gymlog/src/lib/homeProgramSelection.ts)
- [App.tsx](/D:/Gymlog/App.tsx)

Acceptance criteria:

- Home has one clear next-best action
- browse surfaces feel intentionally separate from continue surfaces
- card labels match actual behavior

#### 4. Improve recommendation explanation

Recommendations should be explainable, not just selected.

Implementation direction:

- add small `why this fits` copy to recommendation and ready-detail
- explain recommendation using:
  - goal
  - schedule reality
  - equipment
  - side outcomes
- keep this concise and skimmable

Likely files:

- [firstRunSetup.ts](/D:/Gymlog/src/lib/firstRunSetup.ts)
- [programDetails.ts](/D:/Gymlog/src/lib/programDetails.ts)
- [OnboardingScreen.tsx](/D:/Gymlog/src/screens/OnboardingScreen.tsx)
- [ProgramDetailScreen.tsx](/D:/Gymlog/src/screens/ProgramDetailScreen.tsx)

### Out Of Scope

- full search and advanced plan comparison
- major Vallu workflow integration

### Exit Criteria

- onboarding recommendation feels like the first product moment
- setup is editable after launch
- Home no longer mixes continue and browse semantics

## Phase 3: Depth, Retention, And Product Intelligence

### Goal

Make Gymlog more useful after week one. This phase is about giving users better discovery, richer history/progress, and more actionable plan intelligence without losing the app’s directness.

### Why This Comes Third

- it compounds the value of Phases 1 and 2
- richer analysis is only worth it after trust and activation are strong
- this is where Gymlog starts feeling like a product users keep, not just try

### Scope

- better workout discovery
- richer saved-session fidelity
- more useful history and progress
- Vallu as an operational tool
- tighter long-term profile surfaces

### Deliverables

#### 1. Deeper workout discovery

The Workout tab is already curated but still shallow.

Implementation direction:

- add search
- add stronger filters:
  - time
  - equipment
  - goal
  - experience
- add light comparison for ready programs
- highlight recommendation reason and plan tradeoffs

Likely files:

- [WorkoutsScreen.tsx](/D:/Gymlog/src/screens/WorkoutsScreen.tsx)
- [readyProgramCollections.ts](/D:/Gymlog/src/lib/readyProgramCollections.ts)
- [readyProgramContent.ts](/D:/Gymlog/src/lib/readyProgramContent.ts)
- [programDetails.ts](/D:/Gymlog/src/lib/programDetails.ts)

Acceptance criteria:

- users can narrow plans fast
- ready programs feel explorable, not just scrollable

#### 2. Richer saved session model

Saved sessions should preserve more of what actually happened during logging.

Implementation direction:

- persist notes
- persist swap outcomes or substitution context
- preserve meaningful set-level details needed for later interpretation
- distinguish partial completion from clean completion where useful

Likely files:

- [workoutAppAdapter.ts](/D:/Gymlog/src/features/workout/workoutAppAdapter.ts)
- [models.ts](/D:/Gymlog/src/types/models.ts)
- [database.ts](/D:/Gymlog/src/storage/database.ts)
- [completedWorkoutPersistence.ts](/D:/Gymlog/src/state/completedWorkoutPersistence.ts)

Acceptance criteria:

- History tells a more truthful story
- Progress has richer context for interpretation

#### 3. Better History and Progress surfaces

These screens should reward consistency, not just store records.

Implementation direction:

- add session-level highlights
- add PR or trend markers
- add filters or segmentation in history
- link completion and progress more explicitly
- correct copy around tracked exercises so it matches actual behavior

Likely files:

- [HistoryScreen.tsx](/D:/Gymlog/src/screens/HistoryScreen.tsx)
- [ProgressScreen.tsx](/D:/Gymlog/src/screens/ProgressScreen.tsx)
- [ProgressCard.tsx](/D:/Gymlog/src/components/ProgressCard.tsx)
- [progression.ts](/D:/Gymlog/src/lib/progression.ts)

Acceptance criteria:

- progress feels motivating, not just archival
- history becomes easier to scan and more useful for review

#### 4. Operational Vallu

Vallu should help users act, not only read advice.

Implementation direction:

- add scoped actions like:
  - `Why this plan?`
  - `Adapt to 2 days`
  - `Swap for home gym`
  - `Apply to custom editor`
- improve trust messaging for live vs preview mode
- keep Vallu close to decision moments

Likely files:

- [AICoachScreen.tsx](/D:/Gymlog/src/screens/AICoachScreen.tsx)
- [AICoachCard.tsx](/D:/Gymlog/src/components/AICoachCard.tsx)
- [valluClient.ts](/D:/Gymlog/src/lib/valluClient.ts)
- [valluPreview.ts](/D:/Gymlog/src/lib/valluPreview.ts)
- [App.tsx](/D:/Gymlog/App.tsx)

Acceptance criteria:

- Vallu outputs can move the user into an actual product action
- trust framing is consistent

#### 5. Mature profile and plan utilities

Profile should become the quiet control layer for the user’s long-term setup.

Implementation direction:

- include plan-fit editing entry points
- surface bodyweight goal and relevant long-term preferences where they matter
- keep the screen utility-first and minimal

Likely files:

- [ProfileScreen.tsx](/D:/Gymlog/src/screens/ProfileScreen.tsx)
- [App.tsx](/D:/Gymlog/App.tsx)

### Out Of Scope

- social features
- billing/support expansion
- large community or content features

### Exit Criteria

- workout discovery is meaningfully stronger
- saved sessions retain more truth
- progress and history feel rewarding
- Vallu can trigger action, not only text

## Suggested Execution Order

### Milestone order

1. Phase 1
2. Phase 2
3. Phase 3

### Within Phase 1

1. navigation continuity
2. truthful finish/save flow
3. logger validation and recovery
4. profile/settings cleanup

### Within Phase 2

1. editable setup
2. recommendation simplification
3. Home continue-vs-browse cleanup
4. recommendation explanation

### Within Phase 3

1. saved-session model upgrade
2. history/progress upgrade
3. workout discovery upgrade
4. operational Vallu
5. mature profile utilities

## Product Principle To Keep

Gymlog works best when it feels decisive:

- one clear next action
- visible reasoning
- honest save state
- fast logging

Every future feature should be judged against that standard.
