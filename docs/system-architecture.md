# GAINER — System Architecture

**Type:** Implementation spec — architecture decisions defined here are authoritative
**Status:** Reference document. Design authority, not implementation spec.
**Related:** `coaching-architecture.md`, `gainer-philosophy.md`, `ai-trust-system.md`, `coaching-intelligence-design.md`
**Canonical owner of:** five-layer coaching architecture, coaching phase names and session-count boundaries (`observation/emerging/active/trusted`)

---

## Purpose

This document defines the high-level system architecture for GAINER: how data flows, where intelligence lives, what each layer owns, and which boundaries must never be crossed. It is the single reference for architectural decisions and the test against which new features are evaluated.

It describes the target architecture. Not every layer is built. Where something is not yet implemented, this document marks it clearly.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Core System Layers](#2-core-system-layers)
3. [Data Flow Philosophy](#3-data-flow-philosophy)
4. [Layer Responsibilities](#4-layer-responsibilities)
   - [Profile Layer](#41-profile-layer)
   - [Memory / Context Layer](#42-memory--context-layer)
   - [Signal Layer](#43-signal-layer)
   - [Intelligence Layer](#44-intelligence-layer)
   - [Delivery Layer](#45-delivery-layer)
5. [GAINER AI Boundaries](#5-gainer-ai-boundaries)
6. [Offline-First and Local-First Philosophy](#6-offline-first-and-local-first-philosophy)
7. [Supabase Role](#7-supabase-role)
8. [Append-Only Logging Philosophy](#8-append-only-logging-philosophy)
9. [Recommendation Pipeline](#9-recommendation-pipeline)
10. [Progression Pipeline](#10-progression-pipeline)
11. [Trust and Confidence Gating](#11-trust-and-confidence-gating)
12. [Data Ownership and Source-of-Truth Rules](#12-data-ownership-and-source-of-truth-rules)
13. [Implementation Boundaries](#13-implementation-boundaries)
14. [Anti-Overengineering Rules](#14-anti-overengineering-rules)
15. [Scalability Principles](#15-scalability-principles)
16. [Future-Safe Architecture Rules](#16-future-safe-architecture-rules)
17. [MVP Architecture Priorities](#17-mvp-architecture-priorities)
18. [Architectural Risks](#18-architectural-risks)
19. [What Must Not Be Built Yet](#19-what-must-not-be-built-yet)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native / Expo)         │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────────────────────────┐   │
│  │  App Shell   │   │            State Layer                │   │
│  │  (App.tsx)   │   │  AppProvider        WorkoutProvider   │   │
│  │              │   │  (AppDatabase)      (Live session)    │   │
│  │  Routing     │   │  AsyncStorage       AsyncStorage      │   │
│  │  Screen mgmt │   │  @gymlog/db/v1      @gymlog/workout/v1│   │
│  └──────────────┘   └──────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Domain Logic (src/lib/)               │   │
│  │  Pure TypeScript functions — no React, no storage        │   │
│  │                                                          │   │
│  │  Profile     Signal     Intelligence     Recommendation  │   │
│  │  Memory      Progression Delivery        Formatting      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Exercise Library (static, generated)        │   │
│  │  src/data/generatedExerciseLibrary.ts                    │   │
│  │  Seeded into AppDatabase on load, stripped on save       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS (GAINER AI live mode only)
                 ┌───────────────▼──────────────┐
                 │     Serverless API Layer      │
                 │   api/ai-coach.ts             │
                 │   (Vercel / similar)          │
                 └───────────────┬───────────────┘
                                 │
                 ┌───────────────▼──────────────┐
                 │          OpenAI API           │
                 │   (GPT-4o or equivalent)      │
                 └──────────────────────────────┘

                 ┌──────────────────────────────┐
                 │    Supabase (future only)     │
                 │   Auth, sync, remote backup   │
                 │   NOT active in MVP           │
                 └──────────────────────────────┘
```

**Key invariants:**
- The app functions fully without any network connection
- OpenAI is never called directly from the mobile app
- Supabase is not part of the current architecture
- All state transitions are deterministic and testable without a running app

---

## 2. Core System Layers

The system is organized into five vertical layers, each with a single responsibility. Lower layers never depend on higher ones. Data flows upward — raw facts become structured knowledge, structured knowledge becomes signals, signals become intelligence, intelligence becomes delivery.

```
┌────────────────────────────────────────────────────────────────┐
│  DELIVERY LAYER                                                │
│  Coaching messages · recommendations · UI signals · silence    │
├────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE LAYER                                            │
│  Progression logic · fatigue assessment · goal tracking        │
│  Insight generation · confidence scoring · coach decisions     │
├────────────────────────────────────────────────────────────────┤
│  SIGNAL LAYER                                                  │
│  Performance signals computed from raw log data                │
│  Volume load · completion rate · plateau detection · PRs       │
├────────────────────────────────────────────────────────────────┤
│  MEMORY / CONTEXT LAYER                                        │
│  Tiered history: session → recent → block → lifetime          │
│  Context assembled for AI calls · coaching state              │
├────────────────────────────────────────────────────────────────┤
│  PROFILE LAYER                                                 │
│  Who the user is: goals · level · equipment · constraints      │
│  UserFitnessProfile derived from AppPreferences                │
└────────────────────────────────────────────────────────────────┘
```

The layer stack applies to the coaching system specifically. The wider app also has:

- **Session layer** — the live workout (`WorkoutProvider`, `workoutState.ts`)
- **Persistence layer** — `AppProvider`, AsyncStorage, `database.ts`
- **Catalog layer** — static ready programs, exercise library
- **Presentation layer** — screens, components, routing

These do not map directly onto the coaching layers but must interact with them through defined interfaces.

---

## 3. Data Flow Philosophy

### Direction

Data flows in one direction through the coaching stack:

```
Raw data (logs, sessions, preferences)
    ↓
Signals (computed facts about performance)
    ↓
Intelligence (interpreted meaning, decisions)
    ↓
Delivery (output to the user, or silence)
```

No layer reaches down past its immediate input. Intelligence does not query logs directly — it consumes signals. Delivery does not interpret data — it renders what intelligence returns.

### Push vs Pull

The system is **pull-based** at the coaching layer. Intelligence is computed on demand (post-session, on load) not streamed continuously. This keeps the architecture simple and deterministic.

In the session layer, the system is **push-based** via React's `useReducer`. All workout mutations dispatch actions; nothing reads and writes directly.

### Immutability of historical data

Session logs and exercise logs are never edited after they are saved. They are the ground truth. All derived values (signals, progression state, coaching insights) are recomputable from the raw log at any time.

If a derived value changes (because the computation logic improved), the logs stay constant and the derived output updates automatically. This is the foundational property that makes the intelligence system trustworthy over time.

---

## 4. Layer Responsibilities

### 4.1 Profile Layer

**What it owns:**
- The current picture of who the user is
- Goals, experience level, equipment context, constraints, preferences
- Derived from `AppPreferences` — no separate storage

**Key type:** `UserFitnessProfile` (`src/types/coaching.ts`)  
**Key function:** `buildUserFitnessProfile(prefs: AppPreferences)` (`src/lib/userFitnessProfile.ts`)

**Rules:**
- Profile is a **derived view** over `AppPreferences`, not a separate store
- `buildUserFitnessProfile()` is a pure function — given the same preferences, it always returns the same profile
- No profile data is persisted separately; `AppPreferences` is the single source of truth
- The profile is rebuilt on each call — no caching required at this layer

**Profile data categories:**

| Category | Fields | Status |
|---|---|---|
| Training identity | `level`, `primaryGoal`, `secondaryGoals` | ✅ implemented |
| Logistics | `daysPerWeek`, `weeklyMinutes`, `equipment`, `trainingEnvironment` | ✅ implemented |
| Preferences | `trainingFeel`, `focusAreas`, `unitPreference` | ✅ implemented |
| Constraints | `shoulderFriendly`, `elbowFriendly`, `kneeFriendly` | ✅ implemented |
| Body context | `currentWeightKg` | ✅ implemented |
| Behavioral (inferred) | Training time patterns, preferred days, session cadence | 🔜 later |

**What the profile layer must NOT do:**
- Store data that should live in the session or log layers
- Infer behavioral patterns (that is the memory layer's job)
- Make coaching decisions (that is the intelligence layer's job)

---

### 4.2 Memory / Context Layer

**What it owns:**
- Structured history at multiple time horizons
- Context assembly for GAINER AI calls
- Stateful coaching knowledge (last insight delivered, coaching phase)

**Tiers of memory:**

```
LIFETIME          All sessions ever — used for long-term trend analysis
    ↑                 (e.g., plateau across 8 weeks, PR history)
BLOCK             Last 4–8 weeks — the training block in progress
    ↑                 (e.g., volume progression, fatigue accumulation)
RECENT            Last 3–5 sessions — immediate performance context
    ↑                 (e.g., did last session feel hard? was it complete?)
SESSION           The session just completed — freshest signal
```

**Implementation state:**
- Raw session data exists in `AppDatabase.workoutSessions` and `AppDatabase.exerciseLogs`
- Memory layer aggregation functions: 🔜 later (to be built in `src/lib/`)
- Context assembler for AI calls: exists in basic form in `aiTrainingContext.ts`

**Context assembly for AI calls:**

When the GAINER AI is invoked, the context assembler selects the most relevant subset of memory for the current situation. It does not dump everything — it curates.

```
contextAssembler(profile, sessionHistory, recentSignals) → CoachingContext
```

The assembled context is the only thing passed to the intelligence layer. Intelligence never accesses raw logs directly.

**Coaching state:**

Some memory is not about training history — it is about the coaching relationship:

| State | Purpose | Storage |
|---|---|---|
| `coachingPhase` | observation / emerging / active / trusted | AppPreferences |
| `lastInsightType` | avoids delivering same insight twice in a row | AppPreferences |
| `lastInsightDeliveredAt` | minimum gap between insights | AppPreferences |
| `sessionsSinceInsight` | controls insight frequency | derivable from logs |

These fields must not grow into a large coaching log. They are lightweight state, not a full event store.

---

### 4.3 Signal Layer

**What it owns:**
- Computed facts derived from raw log data
- Stateless: signals are always recomputable from source data
- The boundary between "what happened" and "what it means"

**Signal categories:**

```
PERFORMANCE SIGNALS (per exercise)
─────────────────────────────────
  progressionStatus     consecutive successes/failures against targets
  plateauDetected       stagnation signal (3+ sessions no progress)
  prCandidate           potential personal record in current session

VOLUME SIGNALS (per session or block)
──────────────────────────────────────
  sessionVolumeTrend    vs recent average
  completionRate        sets completed / sets planned
  sessionQualityScore   composite of completion, effort, substitutions

FATIGUE SIGNALS (cross-session)
────────────────────────────────
  acuteChronicRatio     recent load vs rolling average (ACWR model)
  fatigueSignal         normal / elevated / high
  deloadRecommended     boolean with confidence

ADHERENCE SIGNALS (longitudinal)
─────────────────────────────────
  weeklyAdherence       sessions completed vs planned
  consistencyScore      rolling 4-week adherence percentage
  returnAfterGap        boolean + gap duration

GOAL ALIGNMENT SIGNALS (vs profile)
─────────────────────────────────────
  progressTowardGoal    estimated progress vs stated goal
  programFitScore       how well current program matches profile
```

**Implementation state:**
- `progressionSignal.ts` — ✅ exists (plateau detection, ACWR)
- `historyView.ts` — ✅ exists (session aggregation for progress screen)
- Full signal computation layer: 🔜 later (to be unified under single interface)

**Signal rules:**
- Signals are computed from `(exerciseLogs, workoutSessions, profile)` — no other inputs
- A signal that requires more inputs than this has too much scope
- Signals return confidence values alongside results — low confidence suppresses downstream intelligence
- Signals are never stored; they are computed on demand

---

### 4.4 Intelligence Layer

**What it owns:**
- Interpreting signals and deciding what to do about them
- Generating coaching decisions (act / do not act, what to say, when)
- Progression logic (how to modify load, sets, reps)
- Confidence scoring and threshold gating

**Inputs:** `UserFitnessProfile` + `CoachingContext` (assembled from memory and signals)  
**Outputs:** `CoachingDecision` — a typed value representing what the system will do next, including silence

**Intelligence sources, in order of preference:**

```
1. Deterministic rules        — plateau detection, PR logic, gap detection
                                Fast, testable, inspectable, no hallucination risk

2. Heuristic functions        — progression recommendations, volume targets
                                Derived from well-understood training science

3. Language model (LLM)       — natural language generation only
                                Called only when rules/heuristics determine output is warranted
                                Never called to decide whether to output
```

The LLM is the renderer of a coaching decision, not the maker of it. The decision to say something, what type of thing to say, and the confidence level — these are all rule-based. The LLM only converts a structured coaching decision into natural language.

**The intelligence boundary:**

```
DETERMINISTIC SYSTEM                    LLM BOUNDARY
─────────────────────────────────       ─────────────────────────────────
• Should an insight be delivered?       • What exact words should be used?
• What type of insight?                 • How should it be phrased?
• What specific data is relevant?       • What tone fits this user now?
• What is the confidence level?
• Is the threshold met?
• Is the timing appropriate?
```

**Coaching phases and authority:**

| Phase | Sessions | Behavior |
|---|---|---|
| `observation` | 0–6 | Silent. Building baseline. No coaching output. |
| `emerging` | 7–20 | Single confirmed insights only. High confidence threshold (0.80). |
| `active` | 21–60 | Regular insights when warranted. Standard threshold (0.75). |
| `trusted` | 60+ | Predictive recommendations. Lowered threshold (0.70) for appropriate types. |

---

### 4.5 Delivery Layer

**What it owns:**
- Rendering coaching decisions as UI elements or suppressing them
- Ensuring correct timing, placement, and frequency
- The silence decision — the most frequent output

**Delivery types:**

| Type | When | Placement |
|---|---|---|
| Post-session insight | After a session saves successfully | Post-session screen |
| Inline recommendation | During workout (exercise substitution, load) | Active workout screen |
| Home signal | Between sessions (plan adherence, upcoming session) | Home screen |
| Notification | After a gap, before a planned session | Push notification |
| Silent | Default — most of the time | Not rendered |

**Delivery rules:**
- No coaching output before the session saves. Optimistic delivery that later contradicts the save state destroys trust.
- One insight per session maximum. Two insights per session is twice the noise and half the impact.
- Silence is the default. Output is the exception that must be earned by passing confidence thresholds.
- Every visible coaching output must reference specific user data. Generic output is not delivered.
- Notification permission is never requested during onboarding. It is requested after the first post-session insight is delivered in-app.

---

## 5. GAINER AI Boundaries

### Where AI reasoning should happen

```
✅  Natural language generation (converting structured decision → text)
✅  Context-sensitive phrasing (how to say what has been decided)
✅  Nuanced framing of complex training concepts for a specific user
✅  Generating coaching plan narrative from structured program data
```

### Where AI reasoning must NOT happen

```
❌  Deciding whether to generate an insight (rules do this)
❌  Detecting plateaus, PRs, or fatigue (signal functions do this)
❌  Selecting which exercises to substitute (rule-based + profile)
❌  Computing progression load (deterministic from history)
❌  Determining coaching phase (function of session count)
❌  Answering open-ended fitness questions (GAINER is not a chatbot)
❌  Generating motivational copy disconnected from user data
❌  Any task where a deterministic function produces a reliable result
```

### The LLM call contract

When the intelligence layer determines a coaching output is warranted:

```
Input to LLM:
  • coachingDecision.type          — what kind of insight
  • coachingDecision.data          — the specific training data that triggered it
  • coachingDecision.userProfile   — relevant profile fields only (not full dump)
  • coachingDecision.tone          — calm / encouraging / direct (derived from profile)

Output from LLM:
  • A single, specific, short coaching message (1–3 sentences)
  • No generic advice
  • No content not supported by the input data

Validation:
  • Output must reference at least one specific data point from input
  • Output is rejected and suppressed if it fails this check
  • Failure falls back to silence, never to a generic fallback message
```

### AI in preview mode vs live mode

| Mode | Behavior | When used |
|---|---|---|
| Preview | Local mock responses from `aiCoachPreview.ts` | Default, always works offline |
| Live | Serverless call → OpenAI | When `EXPO_PUBLIC_AI_COACH_API_URL` is configured |

The mobile app never calls OpenAI directly. The serverless layer (`api/ai-coach.ts`) owns the OpenAI interaction. This preserves the API key, allows rate limiting, and keeps AI behavior auditable server-side.

---

## 6. Offline-First and Local-First Philosophy

### The guarantee

GAINER must function completely without a network connection. Logging a session, viewing history, following a program, receiving coaching insights — all of this works offline. Network access is a capability enhancement, never a dependency.

### Local-first storage model

```
Primary storage:    AsyncStorage on device (immediate, synchronous from app perspective)
Sync storage:       Supabase (future — eventual consistency, not required for function)
Cache:              None — device is authoritative, not a cache
```

The device is not a cache for a server. It is the source of truth. The server, when it exists, is a backup and sync mechanism — not the primary data store.

### Why local-first matters for fitness apps

Gyms often have poor connectivity. A workout logging app that requires network connectivity to save a set fails its most important moment. Every data persistence operation must be atomic and device-local.

### Offline behavior by feature

| Feature | Offline behavior |
|---|---|
| Workout logging | Fully functional |
| Session history | Fully functional |
| Program following | Fully functional |
| GAINER AI (preview mode) | Fully functional (local mock) |
| GAINER AI (live mode) | Degrades to silence — no error shown |
| Account sync | Queued until connection restored (future) |
| Premium validation | Cached locally — not re-checked on every launch |

### Network failure contract

When a network-dependent operation fails:
- Never show an error that blocks the workout flow
- Never fail silently in a way that loses user data
- Degrade to the last known good state or to silence
- Queue retry for when connectivity is available (future — sync layer)

---

## 7. Supabase Role

### Current status

**Supabase is not part of the current architecture.** It is a planned future component. Nothing in the current codebase depends on Supabase.

### Intended future role

```
Auth:           User account creation, sign-in (Apple, Google, email)
Sync:           AppDatabase backup and cross-device sync
Analytics:      Aggregate (anonymous) coaching signal telemetry
Remote config:  Feature flags, coaching model parameters (future)
```

### What Supabase will NOT do

```
❌  Store live workout session state (that is WorkoutProvider's job)
❌  Be the primary query layer for coaching signals (computed locally)
❌  Replace AsyncStorage as the primary persistence layer
❌  Gate app functionality (offline must always work)
❌  Store personally identifiable training data without explicit consent
```

### Sync architecture (future design, not implemented)

When Supabase is introduced:
- Device writes to AsyncStorage first, always
- Supabase receives a background sync after the write succeeds
- On conflict (multi-device), the later timestamp wins for preferences; session logs are never overwritten, only appended
- If sync fails, the app continues normally — sync retries in the background

### Authentication state

Auth state is stored locally. A user who signed in previously and loses connectivity can continue using the app without re-authenticating. The premium access tier is cached locally and validated server-side only on explicit refresh.

---

## 8. Append-Only Logging Philosophy

### The principle

Session and exercise logs are never edited, merged, or deleted after they are saved. Every completed session is a permanent record. The system only ever adds new records.

```
workoutSessions:  append only — no edits, no deletes
exerciseLogs:     append only — no edits, no deletes
bodyweightEntries: append only — later entries supersede earlier ones
measurementEntries: append only — later entries supersede earlier ones
```

### Why append-only matters

**Signals remain recomputable.** If the plateau detection algorithm improves, it can be re-run over the same log data and produce better output. The raw data is the ground truth.

**Trust is not retroactively broken.** If a user sees a coaching insight ("you plateaued on bench press") and then that session were editable, the insight would be rendered incoherent. Immutable logs mean insights remain coherent.

**Debugging is possible.** Any unexpected GAINER AI output can be traced back to the exact log data that triggered it. This is only possible if the log is never mutated.

### What "append-only" means in practice

- A user cannot edit the reps on a completed set
- A user cannot delete a completed session
- If data was entered incorrectly, the user logs a corrective entry (future) rather than editing
- In MVP: no correction mechanism exists; logs are accepted as-is

### The exception: preferences and profile

`AppPreferences` is not append-only — it is a current-state record that changes as the user updates their settings. This is correct: preferences represent the current picture, not a history. Historical preference changes are not tracked.

If behavioral drift (the user trains very differently from their stated preferences) needs to be detected, it is detected by comparing behavior to current preferences — not by replaying preference history.

---

## 9. Recommendation Pipeline

The recommendation pipeline produces a program recommendation from the user's profile. It is fully deterministic — no LLM involved.

```
INPUT
──────────────────────────────────────────────────────
  AppPreferences (goal, level, equipment, daysPerWeek, 
  focusAreas, trainingFeel, jointFlags)

STEP 1: Build UserFitnessProfile
  buildUserFitnessProfile(prefs) → UserFitnessProfile

STEP 2: Score all eligible programs
  scorePrograms(profile, catalog) → ScoredProgram[]
  
  Scoring dimensions:
  • Goal alignment          (hard filter — wrong goal = zero score)
  • Level match             (hard filter for advanced; soft for intermediate)
  • Equipment compatibility (hard filter — missing equipment = zero score)
  • Days per week match     (closest match scores highest)
  • Focus area overlap      (bonus scoring for matching focus areas)
  • Joint sensitivity       (penalty if program has incompatible exercises)
  • Training feel alignment (soft scoring vs trainingFeel preference)

STEP 3: Select winner
  selectRecommendation(scoredPrograms) → RecommendedProgram
  
  Rules:
  • Highest score wins
  • On tie: prefer the lower complexity program for beginners
  • On tie: prefer the higher volume program for intermediates+
  • If no program scores above threshold: surface "no recommendation" 
    state with explanation of why (equipment mismatch, goal mismatch)

STEP 4: Generate explanation
  buildExplanation(profile, selected) → RecommendationExplanation
  
  The explanation must reference the user's specific inputs.
  "We chose this because you have full gym access, want to build muscle, 
  and can train 4 days per week" — not generic program description text.

OUTPUT
──────────────────────────────────────────────────────
  RecommendedProgram {
    templateId: string
    score: number
    explanation: RecommendationExplanation
    alternativeIds: string[]    (runner-up recommendations)
  }
```

**Current implementation:** `src/lib/recommendationScoring.ts`, `recommendationProfile.ts`, `recommendationProgramme.ts`

**Pipeline rules:**
- Hard filters are applied before scoring — a program that cannot physically work (wrong equipment, wrong days) is never presented as a scored option
- The explanation is generated deterministically — no LLM
- The pipeline must run synchronously and produce a result in < 50ms on device
- Alternative recommendations are always computed — the user can see why alternatives weren't chosen first

---

## 10. Progression Pipeline

The progression pipeline runs after each completed session and determines whether load, reps, or structure should change for the next session.

```
INPUT
──────────────────────────────────────────────────────
  exerciseLogs for tracked exercises (last N sessions)
  UserFitnessProfile (level, goal, trainingFeel)
  currentTemplate (target sets, rep ranges)

STEP 1: Compute per-exercise performance signal
  computeProgressionSignal(exerciseLogs) → ProgressionSignal
  
  Fields:
  • consecutiveSuccesses   (hit top of rep range on all sets)
  • consecutiveFailures    (missed target on any set)
  • currentTier            (load relative to historical max)
  • plateauDetected        (≥ 3 sessions no progression)
  • prCandidate            (above all previous logged weights)

STEP 2: Apply progression rule
  applyProgressionRule(signal, profile, template) → ProgressionDecision
  
  Rules (in priority order):
  • If plateau detected: suggest load reset or exercise substitution
  • If N consecutive successes: suggest load increase (amount by goal/level)
  • If N consecutive failures: suggest load decrease or rep range adjust
  • If deload recommended (from fatigue signal): suggest deload parameters
  • If no signal: maintain current load (no change recommended)

STEP 3: Express as recommendation
  formatProgressionRecommendation(decision) → string | null
  
  • Only expressed to the user if decision.type !== 'maintain'
  • Format is specific: "Try 72.5 kg next session" not "increase the weight"
  • Null if no recommendation — silence is the output, not "keep going"

OUTPUT
──────────────────────────────────────────────────────
  ProgressionDecision {
    exerciseId:     string
    type:           'increase' | 'decrease' | 'maintain' | 'reset' | 'deload'
    suggestedLoad:  number | null
    confidence:     number        (0–1)
    rationale:      string        (internal — not shown to user directly)
  }
```

**Current implementation:** `src/lib/progressionSignal.ts` (partial), `progressionActivePlan.ts`

**Pipeline rules:**
- Every progression decision has a confidence value — low confidence decisions are not surfaced
- The pipeline never modifies the template directly — it only produces recommendations
- Recommendations are advisory, not automatic — the user chooses whether to apply them
- Progression math (how much to increase) is by level: beginner 2.5–5kg, intermediate 1.25–2.5kg, advanced 0.5–1.25kg per session for compound lifts

---

## 11. Trust and Confidence Gating

Every coaching output must pass a confidence gate before reaching the user. Confidence is not a feeling — it is a numeric value computed from signal quality and data sufficiency.

### Confidence scoring model

```
confidence(signal) = dataQualityScore × signalStrengthScore × profileMatchScore

dataQualityScore:     how many data points support this signal?
                      < 3 sessions:    0.3
                      3–5 sessions:    0.6
                      6–12 sessions:   0.8
                      12+ sessions:    1.0

signalStrengthScore:  how strong is the signal?
                      weak (borderline): 0.5
                      moderate:          0.75
                      strong (clear):    1.0

profileMatchScore:    is this signal type appropriate for this user?
                      beginner seeing plateau (early): 0.6 (normal, not alarming)
                      advanced seeing plateau (8wks):  1.0 (genuine signal)
```

### Delivery thresholds by coaching phase

> **🔜 Future architecture.** The phase-based threshold model below describes the target system once the full coaching phase infrastructure is built. **MVP applies a universal 0.75 threshold for all post-session insight types** — see `post-session-single-insight-mvp.md`. The per-type thresholds in `ai-trust-system.md` §6 are future targets aligned with this model.

| Phase | Future threshold | Rationale |
|---|---|---|
| `observation` (0–6 sessions) | No output regardless | Not enough data |
| `emerging` (7–20) | 0.80 | Earning trust — only say highly certain things |
| `active` (21–60) | 0.75 | Standard operation |
| `trusted` (60+) | 0.70 | More authority, some predictions allowed |

### What gets gated

```
Post-session insight (MVP):   confidence ≥ 0.75 → deliver  [universal threshold]
Post-session insight (future): confidence ≥ phase threshold → deliver
                               confidence < threshold → silence

Progression recommendation:   confidence ≥ 0.80 → show suggestion
                              confidence < 0.80 → silence
                              (see progression-gating-rules.md for full gate logic)

Program recommendation:       always shown (deterministic scoring, not probabilistic)
                              "no recommendation" state shown if no program scores above 60%

Notification (future):        confidence ≥ 0.80 + timing rules → send
                              otherwise → do not send
```

### The silence contract

Silence is the correct output in the majority of cases. A system that says something after every session is a noisy system. The target ratio is approximately one meaningful insight per eight to twelve sessions during the `active` phase.

When the system is silent, it must not explain its silence ("Nothing notable this session!"). Silence means nothing happened worth noting — this does not require acknowledgment.

---

## 12. Data Ownership and Source-of-Truth Rules

### Ownership table

| Data | Owner | Storage | Mutable? |
|---|---|---|---|
| `AppPreferences` | `AppProvider` | `@gymlog/database/v1` | Yes — current state |
| `WorkoutTemplate[]` (custom) | `AppProvider` | `@gymlog/database/v1` | Yes — user created |
| `WorkoutSession[]` | `AppProvider` | `@gymlog/database/v1` | No — append only |
| `ExerciseLog[]` | `AppProvider` | `@gymlog/database/v1` | No — append only |
| `BodyweightEntry[]` | `AppProvider` | `@gymlog/database/v1` | No — append only |
| `ExerciseLibrary` | Static (generated) | Seeded on load, not saved | N/A |
| `WorkoutTemplate[]` (ready) | Static catalog | `workoutCatalog.ts` | No — immutable at runtime |
| Live session state | `WorkoutProvider` | `@gymlog/workout/v1` | Yes — active session |
| `UserFitnessProfile` | Derived | Not stored | N/A — recomputed |
| Signals (plateau, ACWR) | Computed | Not stored | N/A — recomputed |
| Coaching phase | `AppProvider` | `@gymlog/database/v1` (in prefs) | Yes |

### Source-of-truth rules

**One source of truth per data type.** No data is duplicated across stores. If `AppPreferences` owns a field, nothing else owns a copy of it.

**Derived values are never stored.** `UserFitnessProfile` is built from `AppPreferences` on demand. Performance signals are computed from logs on demand. Storing derived values creates synchronization problems — when the source changes, the stored derivative becomes stale.

**Exception: coaching state.** Some lightweight coaching state is stored (last insight type, last insight timestamp, coaching phase) because these need to persist across sessions and cannot be reliably derived from training data alone. These fields live in `AppPreferences` as an explicit exception to the no-derived-storage rule.

**Ready programs are never written to AppDatabase.** If a user wants to modify a ready program, it is duplicated into custom templates first (`readyProgramDuplication.ts`). The ready program catalog remains immutable.

**The exercise library is never persisted.** It is seeded from `generatedExerciseLibrary.ts` on each load. If the library changes, users get the update on next app start without a migration.

---

## 13. Implementation Boundaries

### What `src/lib/` owns

Pure TypeScript functions with no React dependencies, no AsyncStorage calls, no network calls, no side effects. All business logic lives here. All functions are testable without a running app.

```
✅  buildUserFitnessProfile(prefs) → UserFitnessProfile
✅  scorePrograms(profile, catalog) → ScoredProgram[]
✅  computeProgressionSignal(logs) → ProgressionSignal
✅  detectPlateau(logs) → PlateauSignal
✅  assembleCoachingContext(profile, sessions, signals) → CoachingContext
✅  evaluateInsightConfidence(signal, phase) → number
✅  buildPostSessionInsight(context) → CoachingInsight | null
```

These are all architecture-layer pure functions. None call AsyncStorage. None import from React.

### What `src/state/` owns

React context, AsyncStorage operations, and all state mutation that involves persistence. Domain logic calls happen here via lib functions — the state layer owns the orchestration.

```
✅  saveCompletedWorkoutSession() → persists session + logs to AsyncStorage
✅  updatePreferences() → persists preference changes
✅  computeAndSavePostSessionInsight() → calls lib, then persists result to prefs
```

### What screens own

Rendering and user interaction only. Screens do not contain business logic. They call state context functions and lib functions through controlled interfaces.

```
✅  Reading from AppProvider context
✅  Dispatching workout actions through WorkoutProvider
✅  Calling lib functions for display computation (formatting, labels)
❌  Direct AsyncStorage calls
❌  Business logic calculations
❌  Coaching decision-making
```

### The test boundary

All functions in `src/lib/` must have unit tests in `tests/lib/`. The test boundary is the lib layer. State layer, screens, and providers are not unit-tested — they are exercised through integration.

---

## 14. Anti-Overengineering Rules

These rules exist because the most dangerous architectural mistakes in a product at this stage are ones that add abstraction before it is needed.

**Rule 1: No layer that doesn't have a consumer.**
Build each architectural layer when the layer above it needs to consume it. The intelligence layer is not built until the delivery layer needs structured coaching decisions. The memory aggregation layer is not built until the intelligence layer needs cross-session context.

**Rule 2: No interface designed for a use case that doesn't exist yet.**
Type definitions for features not yet built create maintenance burden and false confidence. Define types when you implement the function that uses them.

**Rule 3: No abstraction around a single implementation.**
A wrapper around a single AsyncStorage call is not architecture — it is ceremony. Abstraction is introduced when the second implementation requires it.

**Rule 4: No configuration over behavior.**
A system that works correctly is better than a system that can be configured to work correctly. Default behavior should be correct for 90% of users without configuration.

**Rule 5: No event bus, message queue, or pub-sub.**
The current architecture is synchronous and sequential. Async event systems are introduced only when the use case demonstrably requires it (background sync, push notification scheduling). Not before.

**Rule 6: No generic AI calls where a deterministic function exists.**
If a rule can make the decision correctly, the rule is used. The LLM is reserved for tasks only language models can perform: natural language generation.

**Rule 7: No premature normalization.**
`AppPreferences` is a flat record. It will remain flat until there is a demonstrated need for normalization (e.g., multi-user, user-specific preference history). Normalization for its own sake adds query complexity without benefit.

**Rule 8: No service layer between lib and state.**
`src/lib/` functions are called directly from `src/state/`. A service layer between them would add indirection without adding value in this architecture.

---

## 15. Scalability Principles

These principles apply when the product needs to scale — not before.

### Data volume scalability

Current assumption: a dedicated user logs 3–5 sessions per week, 52 weeks per year, for 5 years. That is approximately 750–1,300 sessions, each with 15–25 exercise log entries. Total: 12,000–32,000 exercise log records for a long-term user.

At this scale, AsyncStorage handles everything. No query optimization, indexing, or pagination is needed for the current data model at the expected volume.

**Threshold for action:** If session count exceeds 2,000 or exercise log count exceeds 50,000, signal computation may show measurable latency and targeted optimization is warranted.

### Signal computation scalability

Currently: all signals are recomputed on demand from the full log history. This is correct for the current data volume.

Future: as history grows, signal computation will need to be amortized. Approach:
- Compute signals post-session and store the result in a lightweight cache (not the raw signal — a timestamped snapshot)
- Invalidate cache on any new session save
- Never store computed signals as permanent record — always recomputable

### Coaching context scalability

As history grows, assembling the full context for an AI call becomes expensive. The solution:
- Context assembly is bounded by time horizon (last 60 days maximum)
- The most recent N sessions are always included regardless of time
- Long-term summary (exercise PRs, overall adherence) is stored as computed metadata, not derived live

### Multi-device scalability (future)

When Supabase sync is introduced:
- Session logs are device-attributed (device ID on each record)
- Preferences use last-write-wins with timestamp
- No merge logic for session data — sessions are always additive
- Conflict resolution is never needed for workout logs because the same session cannot exist on two devices

---

## 16. Future-Safe Architecture Rules

These rules protect the architecture from becoming a barrier to future evolution.

**Rule 1: The coaching layer must not know about UI.**
Coaching decisions are expressed as typed values (`CoachingInsight`, `ProgressionDecision`), not as strings or JSX. The delivery layer converts them to UI. This means the coaching layer can be tested independently and the UI can change without touching coaching logic.

**Rule 2: The profile layer must not know about coaching decisions.**
`UserFitnessProfile` describes who the user is. It does not contain coaching state, insight history, or intelligence outputs. Mixing profile and coaching state makes both harder to evolve.

**Rule 3: AI integration must be behind an interface.**
The intelligence layer calls an AI function that returns a coaching message. Whether that function calls OpenAI, a local model, or returns a mock is invisible to the intelligence layer. This means the AI provider can change without touching the coaching logic.

**Rule 4: Storage keys must be versioned.**
`@gymlog/database/v1` includes the version. When the schema changes in a breaking way, the version increments and a migration is run on load. Never change the schema of an existing key without a version bump.

**Rule 5: The recommendation pipeline must not depend on specific template IDs.**
Recommendations are computed from scoring — not from hardcoded IDs. If the catalog changes (new programs, deprecated programs), the pipeline produces correct results without modification.

**Rule 6: Tests must pass without runtime dependencies.**
All `src/lib/` tests run in Node without a running app, without AsyncStorage, without React, without network. This is the guarantee that the architecture remains testable as it grows.

**Rule 7: The delivery layer owns timing — not the intelligence layer.**
The intelligence layer says "an insight is warranted." The delivery layer decides when to show it (post-session, on next open, as a notification). This separation means delivery timing can be adjusted without changing coaching logic.

---

## 17. MVP Architecture Priorities

The following are architecture priorities for the current phase of the product. These are ordered by importance.

### Priority 1: Stable workout logging

The session layer (`WorkoutProvider`, `workoutState.ts`, `saveCompletedWorkoutSession`) must be completely reliable. A session that fails to save, saves incorrectly, or saves in a state that breaks signal computation is a product-level failure.

**Architecture requirements:**
- Session save is atomic — all or nothing
- Save completion must be confirmed before any post-session UI is shown
- Active session state survives app restart (WorkoutProvider persists to `@gymlog/workout/v1`)
- Exercise log format must be consistent — normalization on load catches legacy shape mismatches

### Priority 2: Clean data model

`AppDatabase` and `AppPreferences` must remain the authoritative data layer. No secondary stores, no duplicate data, no derived values stored alongside source values.

**Architecture requirements:**
- `AppPreferences` remains the single source of truth for user setup and coaching state
- `workoutSessions` and `exerciseLogs` are the immutable ground truth for history
- No duplicate storage of coaching signals or recommendation results (except the minimal state fields: coaching phase, last insight timestamp)

### Priority 3: Testable domain logic

All coaching intelligence, recommendation, and progression logic must live in `src/lib/` and be testable without a running app.

**Architecture requirements:**
- Every new lib function has a corresponding test in `tests/lib/`
- No AsyncStorage, no React imports in lib
- Tests compile from `tsconfig.test.json` and run in Node

### Priority 4: GAINER AI isolation

The GAINER AI must degrade gracefully when the network is unavailable. Preview mode must be indistinguishable in behavior from live mode (same types, same interfaces).

**Architecture requirements:**
- GAINER AI interface is identical in preview and live modes
- Network failure produces silence, not error state
- No coaching logic lives in `api/ai-coach.ts` — the serverless layer is only a relay

---

## 18. Architectural Risks

### Risk 1: AppPreferences bloat

**Current state:** `AppPreferences` is a flat record with 50+ fields. It conflates user setup, coaching state, AI planner state, and UI preferences.

**Risk:** As the coaching system grows, coaching state fields will be added to `AppPreferences`. This creates a single flat object with mixed concerns that becomes hard to reason about.

**Mitigation path:** When coaching state fields exceed approximately 8 fields in `AppPreferences`, extract them into a `CoachingState` sub-object within `AppDatabase`. Migration is version-bumped. Do not do this prematurely.

### Risk 2: Signal computation cost

**Current state:** Signals are computed on demand from full log history. This is fine at current data volumes.

**Risk:** As history grows to years of data, on-demand signal computation may block the UI thread.

**Mitigation path:** Introduce post-session background signal computation with cached results. Signal cache is invalidated on new session save. Implement only when measurable latency is observed.

### Risk 3: LLM reliability for coaching messages

**Current state:** GAINER AI messages are generated by an LLM with a structured prompt.

**Risk:** LLM output can be generic, incorrect, or contain content that contradicts the deterministic signal it is rendering.

**Mitigation path:** Validate LLM output against the structured input before delivery. Reject outputs that do not reference specific data. Reject outputs above a token length limit. Fall back to silence on rejection, never to a fallback message.

### Risk 4: Premature Supabase integration

**Current state:** The app is fully local-first. Supabase is a future dependency.

**Risk:** Adding Supabase before the local experience is solid will introduce sync complexity, auth state management, and remote dependency before the product earns the right to add that complexity.

**Mitigation path:** Supabase is not introduced until: (1) the core workout logging experience is stable, (2) at least one GAINER AI feature is complete, and (3) the user base justifies cross-device sync.

### Risk 5: Coaching frequency calibration

**Current state:** Confidence thresholds and coaching phase definitions are specified in documentation, not yet validated against real training data.

**Risk:** Thresholds that seem correct in design may be too aggressive (noisy coach) or too conservative (invisible coach) in practice.

**Mitigation path:** Instrument insight delivery (type, confidence, phase) in analytics from day one of GAINER AI activation. Adjust thresholds based on observed data — do not guess.

---

## 19. What Must Not Be Built Yet

The following are explicitly deferred. They should not be built, prototyped, or scaffolded until the phase that requires them.

### Do not build yet

| Component | Reason |
|---|---|
| Supabase integration | App must prove local-first experience first |
| Cross-device sync | Requires auth, Supabase, and conflict resolution — not MVP |
| Background signal computation | Not needed at current data volumes |
| Coaching event log | Lightweight coaching state in AppPreferences is sufficient |
| Full memory layer aggregation | Build when intelligence layer needs cross-session context |
| Notification scheduling engine | Build after first in-app coaching insight is complete and validated |
| Social features of any kind | Not in product scope |
| Chatbot / Q&A interface | Explicitly out of scope by product philosophy |
| User-editable session logs | App-level decision: logs are append-only in MVP |
| Body composition tracking | Outside GAINER's scope |
| Nutrition integration | Outside GAINER's scope |
| Wearable integrations | Out of scope until sync layer is stable |
| Multi-user / household mode | Not a use case for this product |
| Admin / coach dashboard | Out of scope |
| A/B testing framework | Premature at current scale |
| Real-time collaboration | Not a use case |
| Custom signal computation plugins | Premature abstraction |
| Generic AI assistant tab | Against product philosophy |

### The test for deferral

A component is deferred if:
1. No current feature requires it to function correctly
2. No current user-facing behavior is blocked without it
3. Its absence cannot be observed by a user using the app normally

If all three are true, do not build it.

---

## Module Responsibilities Summary

```
src/lib/userFitnessProfile.ts    Profile layer: builds UserFitnessProfile from prefs
src/lib/recommendationScoring.ts Profile → recommendation: scores programs
src/lib/recommendationProfile.ts Profiles for recommendation matching
src/lib/recommendationProgramme.ts Program selection and explanation
src/lib/progressionSignal.ts     Signal layer: progression and plateau detection
src/lib/progressionActivePlan.ts Signal → progression recommendation
src/lib/historyView.ts           Memory layer: session aggregation for display
src/lib/aiTrainingContext.ts     Memory layer: context assembly for AI calls
src/lib/aiCoachClient.ts         Intelligence layer: AI call orchestration
src/lib/aiCoachPreview.ts        Intelligence layer: preview mode mock
src/lib/aiCoachActions.ts        Intelligence layer: coaching action types
src/lib/aiCoachPlan.ts           Intelligence layer: plan generation
src/lib/workoutFlow.ts           Session layer: workout flow logic
src/lib/workoutValidation.ts     Session layer: validation rules
src/lib/dashboard.ts             Delivery layer: home screen data assembly
src/lib/homePrimaryAction.ts     Delivery layer: primary action selection
src/lib/format.ts                Delivery layer: formatting utilities
src/lib/displayLabel.ts          Delivery layer: label generation

src/state/AppProvider.tsx        State: persisted app data, AppDatabase
src/features/workout/            State: live session, WorkoutProvider
src/storage/database.ts          State: AsyncStorage load/save, normalization
src/storage/repositories.ts      State: template/plan repository pattern

src/data/generatedExerciseLibrary.ts  Static: exercise library (generated, not persisted)
src/features/workout/workoutCatalog.ts Static: ready program templates (immutable at runtime)
```

---

## Summary

GAINER's architecture is built on five principles:

**Local-first.** The device is the source of truth. Every feature works without a network connection. The server is a future enhancement, not a current dependency.

**Append-only logging.** Session and exercise data are never edited. This is the property that makes coaching intelligence trustworthy over time — signals are always recomputable from the same ground truth.

**Five coaching layers.** Profile → Memory → Signal → Intelligence → Delivery. Each layer has a single responsibility. Lower layers never depend on higher ones. This is the structure that prevents coaching logic from becoming coupled to UI and UI from containing business logic.

**Rules before models.** Deterministic functions make coaching decisions. Language models render those decisions in natural language. This separation keeps the system inspectable, testable, and free of hallucination risk.

**Confidence gating.** Every coaching output passes a numeric confidence threshold. The threshold is a function of data volume and coaching phase. Silence is the default; output is the exception.

The architecture is designed for the long-term relationship between a user and the app. It begins conservatively and earns authority through accurate, specific, infrequent output. It is built to become more capable as data accumulates — not to appear capable before it is.
