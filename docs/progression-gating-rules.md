# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

---

# Gainer — Progression Gating Rules (MVP Specification)

**Type:** Implementation spec — values defined here are authoritative and buildable
**Status:** MVP implementation specification. Ready to implement.
**Related:** `coaching-architecture.md`, `post-session-single-insight-mvp.md`, `system-architecture.md`
**Implements:** `src/lib/progressionGating.ts` (not yet created)
**Canonical owner of:** fatigue signal enum (`'normal'/'elevated'/'high'`), ACWR thresholds (1.3/1.5), MVP progression completion rate threshold (80%)

---

## Purpose

This document defines exactly when the system recommends a load increase, holds load, or stays silent — and why. It is an implementation contract, not a philosophy document.

The output of the progression gating function drives one concrete surface: **the suggested load for the next session of a given exercise**. Nothing else. The function does not generate coaching messages, trigger notifications, or modify templates.

---

## Core Model: Double Progression

GAINER uses **double progression** for all weighted exercises with a defined rep range.

```
Phase 1 — Rep accumulation
  User works at a fixed load until they can complete all target sets
  at the TOP of the rep range.

Phase 2 — Load increase
  Once the rep ceiling is reached consistently, load increases.
  Reps reset to the bottom of the range at the new load.
```

**Example:**
```
Template target: 3 sets × 8–12 reps

Session 1 at 60 kg:  10, 9, 8   → below ceiling (12) on all sets → HOLD
Session 2 at 60 kg:  12, 11, 9  → ceiling on set 1, not all sets → HOLD
Session 3 at 60 kg:  12, 12, 11 → ceiling on sets 1–2, not all → HOLD
Session 4 at 60 kg:  12, 12, 12 → ceiling on all sets → PROGRESSION-READY

→ Beginner:     1 progression-ready session → suggest 62.5 kg
→ Intermediate: requires 2 consecutive progression-ready sessions → HOLD at session 4
```

The load increases only when the rep ceiling is reached **on all target working sets**. One set at the ceiling is not sufficient.

---

## 1. Trigger Rules

A progression recommendation fires when ALL of the following are true:

```
T1.  The exercise has set-level data (sets array present and non-empty)
T2.  The template has defined repMin and repMax (both > 0)
T3.  The template has defined targetSets (> 0)
T4.  At least MIN_SESSIONS_REQUIRED sessions exist for this exercise (see §7 for values by level)
T5.  The most recent session was NOT a gap-return session (< 7 days since previous session)
T6.  In the most recent session: no working set had outcome 'failed'
T7.  In the most recent session: no working set had status 'skipped'
T8.  In the most recent session: at least targetSets working sets were completed
T9.  In the most recent session: ALL completed working sets reached repMax reps
T10. The required number of consecutive PROGRESSION-READY sessions is met (by level)
T11. Fatigue gate is clear: fatigueSignal is 'normal' or undefined
T12. Session completion rate in the most recent session ≥ 0.80
     (setsCompleted / targetSetsForSession)
```

If any trigger condition fails, no progression recommendation is made.

**A session is PROGRESSION-READY when T6, T7, T8, and T9 are all true.**

Consecutive PROGRESSION-READY sessions are counted backwards from the most recent session. Any gap in the run (a non-progression-ready session) resets the count to zero.

---

## 2. Silence Rules

The function returns `{ recommendation: 'silent' }` when any of the following are true. Silence rules are evaluated before hold or progress rules.

```
S1.  Fewer than MIN_SESSIONS_REQUIRED sessions exist for this exercise (not enough baseline)
S2.  The exercise has no set-level data (no sets array, or empty — legacy shape only)
S3.  repMin or repMax is not provided or is zero (no target to evaluate against)
S4.  targetSets is not provided or is zero
S5.  The exercise was skipped in the most recent session (log.skipped === true)
S6.  The exercise was swapped in the most recent session (log.status === 'swapped')
S7.  The most recent session is the first session after a gap of ≥ 7 days
     (insufficient recovery/performance context for this return session)
S8.  All sessions for this exercise are older than 90 days
     (stale data — profile may have changed significantly)
S9.  The working weight across the most recent session is 0
     (bodyweight exercise or data error — bodyweight progression not in scope)
```

**Silence means no output.** The function returns a result with `recommendation: 'silent'` and the caller shows nothing to the user. There is no "nothing to show" message.

---

## 3. Confidence Rules

Confidence is a numeric value `[0, 1]` attached to every result. It is an **internal gate**, never shown to the user.

**Progression recommendation threshold: `0.80`**

This threshold is higher than the post-session insight threshold (0.75) because a wrong progression recommendation causes the user to attempt a weight they cannot lift, which erodes trust in a tangible, session-disrupting way.

### Confidence scoring

```
BASE confidence when T1–T12 all pass: 0.90

DEDUCTIONS:
  -0.10  Only T9 passed in the current session (other sets just missed repMax)
         Rationale: borderline hit — pattern not fully established
  -0.05  repMin === repMax (no rep range — all-or-nothing evaluation)
         Rationale: less signal from the range
  -0.10  Exercise matched by name only (no exerciseTemplateId or libraryItemId)
         Rationale: name drift possible — "Bench Press" vs "Flat Bench Press"
  -0.15  Current working weight is the user's all-time best for this exercise
         Rationale: at peak performance, more caution is warranted

DISQUALIFICATION (confidence → 0, result becomes 'silent'):
  - Fewer than MIN_SESSIONS_REQUIRED for the level
  - Fatigue signal is 'high' (not just 'elevated')
  - Any silence rule (S1–S9) is met
```

If the computed confidence after deductions is below `0.80`, the result becomes `{ recommendation: 'hold', holdReason: 'low_confidence' }`. It is never promoted to `'progress'` at low confidence.

---

## 4. Required Inputs / Data

```typescript
// All data provided by caller — this is a pure function

interface ProgressionGatingInput {
  // Exercise-level logs for this specific exercise, sorted newest first.
  // Each log must have the session's performedAt date attached.
  exerciseLogs: ExerciseLogWithSession[];   // from progression.ts

  // Template parameters defining the target performance.
  // These define what "success" looks like for this exercise.
  template: {
    targetSets: number;    // how many working sets are expected
    repMin:     number;    // bottom of the rep range
    repMax:     number;    // top of the rep range — the ceiling to clear
  };

  // Derived user profile (from buildUserFitnessProfile).
  // Used for: level, unitPreference, primaryGoal.
  profile: UserFitnessProfile;

  // Fatigue signal computed separately (e.g. from ACWR or session completion trends).
  // Optional — if absent, treated as 'normal'.
  fatigueSignal?: 'normal' | 'elevated' | 'high';

  // The date of the previous session for this exercise, if known.
  // Used to detect gap-return sessions (S7).
  previousSessionDate?: Date;
}
```

**What the caller must supply — the function does NOT:**
- Retrieve logs from AsyncStorage
- Look up the exercise template
- Compute the fatigue signal
- Access AppPreferences directly
- Know which exercises are "tracked"

**The function receives resolved data and returns a decision. Nothing else.**

---

## 5. Progression Decision Hierarchy

Decisions are evaluated in strict priority order. The first matching condition determines the result.

```
STEP 1 — Silence gate
  Evaluate S1–S9.
  If any silence rule fires → return { recommendation: 'silent', silenceReason }
  ↓

STEP 2 — Fatigue gate
  If fatigueSignal === 'high'
    → return { recommendation: 'hold', holdReason: 'fatigue_high' }
  If fatigueSignal === 'elevated'
    → return { recommendation: 'hold', holdReason: 'fatigue_elevated' }
  ↓

STEP 3 — Session quality gate
  If T6 fails (any set outcome === 'failed')
    → return { recommendation: 'hold', holdReason: 'set_failed' }
  If T7 fails (any working set skipped)
    → return { recommendation: 'hold', holdReason: 'set_skipped' }
  If T8 fails (fewer than targetSets completed)
    → return { recommendation: 'hold', holdReason: 'insufficient_sets' }
  If T12 fails (session completion rate < 0.80)
    → return { recommendation: 'hold', holdReason: 'low_completion_rate' }
  ↓

STEP 4 — Rep ceiling gate
  If T9 fails (not all sets reached repMax)
    → return { recommendation: 'hold', holdReason: 'rep_ceiling_not_reached' }
  ↓

STEP 5 — Consecutive session gate (by level)
  Count consecutive PROGRESSION-READY sessions from most recent.
  If count < REQUIRED_CONSECUTIVE_SESSIONS for this level
    → return { recommendation: 'hold', holdReason: 'awaiting_confirmation' }
  ↓

STEP 6 — Confidence check
  Compute confidence score.
  If confidence < 0.80
    → return { recommendation: 'hold', holdReason: 'low_confidence' }
  ↓

STEP 7 — Progression confirmed
  Compute suggested weight.
  → return {
      recommendation: 'progress',
      suggestedWeightKg: currentWeight + incrementKg,
      confidence,
    }
```

---

## 6. Hold-Load Conditions

A `'hold'` result means: the system has enough data to evaluate, but conditions indicate progression is not appropriate now. Hold is **silent to the user** in MVP — no message is shown.

| `holdReason` | Meaning | User sees |
|---|---|---|
| `fatigue_high` | ACWR or session quality shows high fatigue | Nothing |
| `fatigue_elevated` | Fatigue signal elevated — still training but not the moment to push load | Nothing |
| `set_failed` | One or more sets failed in the most recent session | Nothing |
| `set_skipped` | One or more working sets were skipped | Nothing |
| `insufficient_sets` | Fewer sets completed than template targets | Nothing |
| `low_completion_rate` | Session completion rate < 80% | Nothing |
| `rep_ceiling_not_reached` | Not all working sets reached repMax | Nothing |
| `awaiting_confirmation` | Criteria met in latest session but need N consecutive (intermediate) | Nothing |
| `low_confidence` | Confidence below threshold — data quality or borderline result | Nothing |

**Hold is not a coaching message.** The system observes, decides not to act, and stays silent. The hold reason is for internal logging and debugging only.

The one exception is when the system detects that the user has been in a hold state for 4+ consecutive sessions due to `rep_ceiling_not_reached`. This is a plateau signal and feeds into the post-session insight system (`plateau_detected`). The progression gating function does not handle this — it returns hold. The post-session insight function detects the plateau separately.

---

## 7. Fatigue Gating Rules

Fatigue gating is a **hard block**. If fatigue is elevated or high, the function returns `'hold'` regardless of how well the rep ceiling was met. This cannot be overridden by confidence.

### Fatigue levels in MVP

The full ACWR model is outside the scope of this function. The caller provides a pre-computed fatigue signal. In MVP, three proxy signals determine fatigue level:

```
FATIGUE LEVEL COMPUTATION (caller's responsibility, not this function):

'high'     — ACWR > 1.5 for 3+ consecutive days
             OR session completion rate < 0.65 for 2 consecutive sessions
             OR 3 or more exercises skipped in the most recent session

'elevated' — ACWR between 1.3 and 1.5
             OR session completion rate between 0.65 and 0.80 for 2 consecutive sessions
             OR 1–2 exercises skipped in the most recent session

'normal'   — Everything else
```

**If fatigueSignal is undefined (not provided by caller):** treat as `'normal'`. Never fail silently on missing fatigue data — absence of a fatigue signal is not the same as fatigue.

### Why fatigue gates progression

Recommending a load increase when the user is fatigued produces two failure modes:

1. **The user attempts the new load and fails.** This sets back their confidence and training momentum.
2. **The user succeeds despite fatigue.** The success is not reliable — they may not sustain it when fresh, causing confusion in subsequent sessions.

In both cases, recommending progression during fatigue produces unreliable data and risks eroding trust in the system. Silence during elevated fatigue is the safe, correct, and kind default.

---

## 8. Beginner vs Intermediate Progression Differences

### Required consecutive sessions before progression

| Level | Required consecutive PROGRESSION-READY sessions | Rationale |
|---|---|---|
| `beginner` | **1** | Novice adaptation is fast — hitting the rep ceiling once is sufficient signal |
| `intermediate` | **2** | Adaptation is slower — confirm the ceiling before increasing |
| `advanced` | **2** (same as intermediate in MVP) | ⚠️ Known limitation: advanced trainees often require periodized, non-linear progression. MVP applies the same rule as intermediate. This will produce incorrect recommendations for truly advanced users. Flag and document this limitation explicitly at call sites. |

### Minimum sessions before any evaluation

| Level | `MIN_SESSIONS_REQUIRED` | Rationale |
|---|---|---|
| `beginner` | **3** | Need a baseline for the exercise |
| `intermediate` | **3** | Same baseline requirement |
| `advanced` | **3** | Same baseline requirement |

### Load increment per progression

Increments are conservative. It is always better to under-increment than to over-increment. A missed lift from too large an increment costs the user a full session, breaks their confidence, and produces a false failure signal.

| Level | Compound increment (kg) | Isolation increment (kg) | Unit: lb equivalent |
|---|---|---|---|
| `beginner` | **2.5 kg** | **1.25 kg** | 5 lb / 2.5 lb |
| `intermediate` | **1.25 kg** | **0.5 kg** | 2.5 lb / 1 lb |
| `advanced` | **1.25 kg** | **0.5 kg** | 2.5 lb / 1 lb |

**MVP simplification:** The function does not distinguish compound from isolation exercises — the exercise template does not carry this classification in the current data model. In MVP, use the **compound increment for all exercises**. Document this as a known limitation.

Future: when `ExerciseTemplate` or `ExerciseLibraryItem` carries a `category` field in scope, use it to select the appropriate increment.

**Increment rounding:**
- In kg: round suggested weight to nearest 0.25 kg
- In lb: round to nearest 0.5 lb
- Never round down below the current weight (this would produce a "hold" result that looks like progression)

### Reps reset on load increase

This function does not manage rep targets — it only outputs a suggested weight. The calling system is responsible for resetting the rep expectation to `repMin` at the new load. The progression gating function has no side effects.

### Behavioral differences summary

```
BEGINNER
  Fast progression (1 session to confirm)
  Larger increments (2.5 kg)
  Tolerates small rep range (repMin/repMax gap of 2–4 reps is common)
  Correct: session after session progress for weeks

INTERMEDIATE  
  Slower progression (2 sessions to confirm)
  Smaller increments (1.25 kg)
  Hit the ceiling twice before committing to new load
  Correct: progresses every 1–2 weeks on compound lifts

ADVANCED (MVP behavior — known limitation)
  Treated identically to intermediate
  May produce stale "hold" results for true advanced trainees who need
  periodized deloads, wave loading, or sub-maximal training blocks
  This limitation must be acknowledged in the UI if advanced is selected
```

---

## 9. Example Progression Recommendations

All examples use kg. lb conversion follows the rounding rules in §8.

---

### Example 1 — Beginner, progression triggered

```
Exercise: Barbell Back Squat
Template: 3 sets × 8–12 reps
Level: beginner
fatigueSignal: 'normal'

Session history (newest first):
  Session 3: 12, 12, 12 reps @ 60 kg → PROGRESSION-READY ✓
  Session 2: 11, 10, 9 reps @ 60 kg → not progression-ready
  Session 1: 10, 9, 8 reps @ 60 kg → not progression-ready

Evaluation:
  S1–S9: all pass (3 sessions, set data present, no skip, no gap)
  T6: no failed sets ✓
  T7: no skipped sets ✓
  T8: 3 sets completed = targetSets ✓
  T9: all sets at repMax (12) ✓
  Consecutive progression-ready sessions: 1
  Required for beginner: 1 ✓
  Confidence: 0.90 (no deductions)

Result:
  recommendation: 'progress'
  suggestedWeightKg: 62.5
  confidence: 0.90

Display:
  "Try 62.5 kg next session."
```

---

### Example 2 — Intermediate, confirmation required

```
Exercise: Bench Press
Template: 4 sets × 6–8 reps
Level: intermediate
fatigueSignal: 'normal'

Session history (newest first):
  Session 4: 8, 8, 8, 8 reps @ 80 kg → PROGRESSION-READY ✓
  Session 3: 8, 7, 7, 6 reps @ 80 kg → not progression-ready
  Session 2: 8, 8, 7, 6 reps @ 80 kg → not progression-ready
  Session 1: 7, 6, 6, 6 reps @ 80 kg → not progression-ready

Evaluation:
  S1–S9: all pass
  T6–T9: all pass for session 4
  Consecutive progression-ready sessions: 1
  Required for intermediate: 2 ✗

Result:
  recommendation: 'hold'
  holdReason: 'awaiting_confirmation'

Display: nothing (hold is silent)
```

---

### Example 3 — Intermediate, 2 consecutive sessions met

```
Exercise: Bench Press
Template: 4 sets × 6–8 reps
Level: intermediate
fatigueSignal: 'normal'

Session history (newest first):
  Session 5: 8, 8, 8, 8 reps @ 80 kg → PROGRESSION-READY ✓
  Session 4: 8, 8, 8, 8 reps @ 80 kg → PROGRESSION-READY ✓
  Session 3: 8, 7, 7, 6 reps @ 80 kg → not progression-ready
  ...

Evaluation:
  Consecutive progression-ready sessions: 2
  Required for intermediate: 2 ✓
  Confidence: 0.90

Result:
  recommendation: 'progress'
  suggestedWeightKg: 81.25
  confidence: 0.90

Display:
  "Try 81.25 kg next session."
```

---

### Example 4 — Hold: failed set

```
Exercise: Overhead Press
Template: 3 sets × 5–8 reps
Level: intermediate
fatigueSignal: 'normal'

Session history (newest first):
  Session 4: sets[0] = {reps: 8, outcome: 'completed'},
             sets[1] = {reps: 8, outcome: 'completed'},
             sets[2] = {reps: 4, outcome: 'failed'}  ← failed

Evaluation:
  T6 fails: set in session 4 has outcome 'failed'

Result:
  recommendation: 'hold'
  holdReason: 'set_failed'

Display: nothing
```

---

### Example 5 — Hold: fatigue elevated

```
Exercise: Deadlift
Template: 3 sets × 4–6 reps
Level: intermediate
fatigueSignal: 'elevated'

Evaluation:
  S1–S9: all pass
  Fatigue gate fires: fatigueSignal === 'elevated'

Result:
  recommendation: 'hold'
  holdReason: 'fatigue_elevated'

Display: nothing (fatigue hold is never communicated via progression suggestion)
Note: the fatigue signal may separately surface as a post-session insight
     if it meets the coaching-intelligence-design thresholds.
```

---

### Example 6 — Hold: rep ceiling partially met

```
Exercise: Incline Dumbbell Press
Template: 3 sets × 10–15 reps
Level: beginner
fatigueSignal: 'normal'

Session (newest):
  Set 1: 15 reps ✓ (at repMax)
  Set 2: 13 reps ✗ (below repMax)
  Set 3: 11 reps ✗ (below repMax)

Evaluation:
  T9 fails: not ALL working sets reached repMax

Result:
  recommendation: 'hold'
  holdReason: 'rep_ceiling_not_reached'

Display: nothing
```

---

### Example 7 — Silence: insufficient data

```
Exercise: Romanian Deadlift
Template: 3 sets × 8–12 reps
Level: beginner

Session history: 2 sessions (below MIN_SESSIONS_REQUIRED = 3)

Evaluation:
  S1 fires: fewer than MIN_SESSIONS_REQUIRED sessions

Result:
  recommendation: 'silent'
  silenceReason: 'insufficient_sessions'

Display: nothing
```

---

### Example 8 — Hold: low confidence due to name drift

```
Exercise identified by name only (no exerciseTemplateId, no libraryItemId)
Name in session 1: "Bench Press"
Name in session 2: "Bench press"  (case difference — same exercise)
Name in session 3: "Flat Bench"   (different name — uncertain identity)

Evaluation:
  Confidence deduction -0.10 for name-only matching
  Cross-session name consistency uncertain — additional -0.10
  Confidence: 0.70

Threshold: 0.80 → below threshold

Result:
  recommendation: 'hold'
  holdReason: 'low_confidence'

Display: nothing
```

---

## 10. Example Hold Recommendations

Hold results are **never shown to the user directly** in MVP. They are internal decisions.

The table below shows what the system observes and what it decides — for implementation and test design clarity.

| Scenario | holdReason | Internal note |
|---|---|---|
| Set failed in last session | `set_failed` | Do not increase load when user is failing reps |
| Set skipped | `set_skipped` | Incomplete session — not representative |
| Session < 80% complete | `low_completion_rate` | Fatigue or motivation issue — not a good signal |
| Not all sets at rep ceiling | `rep_ceiling_not_reached` | Normal state — user is still working up to the ceiling |
| Fatigue elevated | `fatigue_elevated` | Hold until fatigue normalizes |
| Fatigue high | `fatigue_high` | Hard block — no progression under high fatigue |
| 1 of 2 required sessions (intermediate) | `awaiting_confirmation` | Good signal — need one more |
| Name drift, confidence below threshold | `low_confidence` | Data reliability concern |
| First session after 7-day gap | `gap_return` → `'silent'` | Gap-return is silence, not hold |

---

## 11. Pure Function Contract

```typescript
// src/lib/progressionGating.ts

import { ExerciseLogWithSession } from './progression';
import { UserFitnessProfile } from '../types/coaching';

// ─── Input ───────────────────────────────────────────────────────────────────

export interface ProgressionGatingTemplate {
  targetSets: number;
  repMin:     number;
  repMax:     number;
}

export type FatigueSignal = 'normal' | 'elevated' | 'high';

export type HoldReason =
  | 'fatigue_high'
  | 'fatigue_elevated'
  | 'set_failed'
  | 'set_skipped'
  | 'insufficient_sets'
  | 'low_completion_rate'
  | 'rep_ceiling_not_reached'
  | 'awaiting_confirmation'
  | 'low_confidence';

export type SilenceReason =
  | 'insufficient_sessions'
  | 'no_set_data'
  | 'no_rep_range'
  | 'no_target_sets'
  | 'exercise_skipped'
  | 'exercise_swapped'
  | 'gap_return'
  | 'stale_data'
  | 'zero_weight';

// ─── Output ──────────────────────────────────────────────────────────────────

export type ProgressionRecommendation = 'progress' | 'hold' | 'silent';

export interface ProgressionGatingResult {
  recommendation: ProgressionRecommendation;
  // Present only when recommendation === 'progress'
  suggestedWeightKg?: number;
  // Present when recommendation === 'progress'
  confidence?: number;
  // Present when recommendation === 'hold'
  holdReason?: HoldReason;
  // Present when recommendation === 'silent'
  silenceReason?: SilenceReason;
}

// ─── Contract ────────────────────────────────────────────────────────────────

export interface ProgressionGatingInput {
  exerciseLogs:       ExerciseLogWithSession[];   // newest first
  template:           ProgressionGatingTemplate;
  profile:            UserFitnessProfile;
  fatigueSignal?:     FatigueSignal;              // undefined → treated as 'normal'
  previousSessionDate?: Date;                      // for gap detection
}

/**
 * Pure function. No side effects. No storage access.
 * All data provided by the caller.
 * Returns a progression decision for a single exercise.
 */
export function evaluateProgressionGating(
  input: ProgressionGatingInput
): ProgressionGatingResult
```

### Internal structure

```
evaluateProgressionGating(input)
  → checkSilenceConditions(input)        returns SilenceReason | null
  → if silence: return { recommendation: 'silent', silenceReason }

  → checkFatigueGate(fatigueSignal)      returns HoldReason | null
  → if fatigue hold: return { recommendation: 'hold', holdReason }

  → evaluateSessionQuality(latestLog, template)  returns HoldReason | null
  → if quality hold: return { recommendation: 'hold', holdReason }

  → evaluateRepCeiling(latestLog, template)      returns boolean
  → if ceiling not reached: return { recommendation: 'hold', holdReason: 'rep_ceiling_not_reached' }

  → countConsecutiveProgressionReady(logs, template)  returns number
  → requiredConsecutive(profile.level)                returns number
  → if count < required: return { recommendation: 'hold', holdReason: 'awaiting_confirmation' }

  → computeConfidence(input, consecutiveCount)   returns number
  → if confidence < CONFIDENCE_THRESHOLD: return { recommendation: 'hold', holdReason: 'low_confidence' }

  → computeSuggestedWeight(currentWeight, profile)   returns number
  → return { recommendation: 'progress', suggestedWeightKg, confidence }
```

Each internal function is independently testable and has a single responsibility.

### Constraints

- **Pure function.** No AsyncStorage. No React. No network.
- **No side effects.** The function does not write to any store.
- **All data in, decision out.** The caller assembles inputs; the function decides.
- **Deterministic.** Same inputs always produce the same output.
- **`null` is not returned.** The function always returns a typed `ProgressionGatingResult`. Silence is represented by `{ recommendation: 'silent' }`, not by `null`.
- **Logs sorted newest first.** The caller is responsible for sort order. The function does not sort.

---

## 12. Tests Required

All tests in `tests/lib/progressionGating.test.cjs`. Import from `.test-dist/lib/progressionGating`.

### Silence rule tests

```
S1. Returns 'silent' / 'insufficient_sessions' when exerciseLogs.length < 3 (beginner)
S2. Returns 'silent' / 'no_set_data' when latest log has no sets and empty repsPerSet
S3. Returns 'silent' / 'no_rep_range' when template.repMin === 0
S4. Returns 'silent' / 'no_rep_range' when template.repMax === 0
S5. Returns 'silent' / 'no_target_sets' when template.targetSets === 0
S6. Returns 'silent' / 'exercise_skipped' when latest log.skipped === true
S7. Returns 'silent' / 'exercise_swapped' when latest log.status === 'swapped'
S8. Returns 'silent' / 'gap_return' when previousSessionDate is 7 days ago
S9. Returns 'silent' / 'gap_return' when previousSessionDate is 10 days ago
    Returns 'hold' (not silent) when previousSessionDate is 6 days ago
S10. Returns 'silent' / 'stale_data' when all logs are older than 90 days
S11. Returns 'silent' / 'zero_weight' when working weight in latest session is 0
```

### Fatigue gate tests

```
F1. Returns 'hold' / 'fatigue_high' when fatigueSignal === 'high'
F2. Returns 'hold' / 'fatigue_elevated' when fatigueSignal === 'elevated'
F3. Does NOT return fatigue hold when fatigueSignal === 'normal'
F4. Does NOT return fatigue hold when fatigueSignal is undefined
F5. Fatigue gate fires before session quality gate (ordering test)
```

### Session quality gate tests

```
Q1. Returns 'hold' / 'set_failed' when any working set has outcome === 'failed'
Q2. Returns 'hold' / 'set_skipped' when any working set has status === 'skipped'
Q3. Returns 'hold' / 'insufficient_sets' when completed working sets < targetSets
Q4. Returns 'hold' / 'low_completion_rate' when setsCompleted/targetSets < 0.80
Q5. Does NOT return quality hold when all working sets are completed and outcome === 'completed'
Q6. Warmup sets (kind === 'warmup') are excluded from working set evaluation
Q7. Drop sets (kind === 'drop') are excluded from working set evaluation
```

### Rep ceiling tests

```
R1. Returns 'hold' / 'rep_ceiling_not_reached' when set 1 at repMax, sets 2–3 below repMax
R2. Returns 'hold' / 'rep_ceiling_not_reached' when all sets are at repMin (below repMax)
R3. Returns 'hold' / 'rep_ceiling_not_reached' when all sets are one rep below repMax
R4. Does NOT return 'rep_ceiling_not_reached' when all working sets exactly equal repMax
R5. Does NOT return 'rep_ceiling_not_reached' when all working sets exceed repMax
    (user exceeded the target — still progression-ready)
```

### Consecutive session tests (by level)

```
C1. Beginner: returns 'progress' after 1 progression-ready session
C2. Intermediate: returns 'hold' / 'awaiting_confirmation' after exactly 1 progression-ready session
C3. Intermediate: returns 'progress' after 2 consecutive progression-ready sessions
C4. Intermediate: returns 'hold' after 1 progression-ready session preceded by a non-progression-ready session
    (non-consecutive: session 4 is progression-ready, session 3 is not, session 5 is)
    → count resets to 1, not 2
C5. Advanced: treated as intermediate (2 consecutive required)
C6. Consecutive count correctly resets when a session breaks the run
```

### Load increment tests

```
I1. Beginner: suggested weight = currentWeight + 2.5 (kg)
I2. Intermediate: suggested weight = currentWeight + 1.25 (kg)
I3. Result rounds to nearest 0.25 kg (e.g. 60 + 1.25 = 61.25 ✓ not 61.3)
I4. Unit preference 'lb': increment is 5 lb for beginner, 2.5 lb for intermediate
I5. Unit preference 'lb': result rounds to nearest 0.5 lb
I6. Suggested weight is always greater than current weight (never equal or less)
```

### Confidence tests

```
CF1. Returns confidence ≥ 0.80 when all trigger conditions cleanly pass
CF2. Returns 'hold' when confidence is computed as < 0.80 (low_confidence)
CF3. Confidence decreases by 0.10 when exercise matched by name only (no IDs)
CF4. Confidence decreases by 0.15 when current weight equals all-time best
CF5. Confidence is never > 1.0
CF6. Confidence is never < 0.0
```

### Integration / composition tests

```
IT1. Full beginner path: 3 sessions, all progression-ready, returns 'progress' with correct weight
IT2. Full intermediate path: 4 sessions, last 2 progression-ready, returns 'progress'
IT3. Fatigue gate overrides otherwise-valid progression criteria
IT4. Set failure in most recent session overrides consecutive streak from prior sessions
IT5. Silence gate fires before fatigue gate (ordering test)
IT6. Returns deterministic result: same input always produces same output
IT7. Works with legacy log shape (no sets array, only weight + repsPerSet)
IT8. Legacy shape: synthesizes sets from repsPerSet and treats all as working sets
```

---

## 13. What NOT to Build Yet

| Feature | Reason deferred |
|---|---|
| Periodized progression (wave loading, undulating) | Requires program-level planning, not per-session evaluation |
| Advanced-specific non-linear models | Advanced users need periodization blocks — MVP applies intermediate rules with known limitation |
| Bodyweight progression (more reps, harder variation) | Different progression model — cannot compute load increment for bodyweight |
| RPE-based progression | Requires effort data at set level to be reliable and consistently logged |
| Deload recommendation in this function | Deload is a fatigue output — the fatigue signal is computed separately and passed in |
| Progression rollback (last increase was wrong, reduce) | Requires tracking which increases were system-recommended vs user-chosen |
| Multi-exercise fatigue model | ACWR is per-session, not per-exercise — cross-exercise fatigue is a future signal |
| User confirmation of progression acceptance | Requires a UI surface that does not yet exist |
| Storing progression history separately | `exerciseLogs` is the source of truth — recompute, do not store derived progression state |
| Notifying the user about upcoming progression opportunity | Push notification system not yet built |
| Distinguishing compound vs isolation for increments | Requires `ExerciseLibraryItem.category` at the exercise template level — not yet connected |
| Progression for AMRAP sets (repMax undefined) | AMRAP has no ceiling — different evaluation model required |
| Rep range auto-adjustment (increase reps if weight is unavailable) | Too complex for MVP; microloading assumption is simpler |
| Automatic template modification on progression | This function recommends only — it never writes |

---

## Display Contract

This specification defines the decision function. The display layer is not specified here. However, the following constraints apply to whatever surface renders the result:

```
'progress' result:
  MAY be shown as a pre-loaded weight suggestion in the next session
  MAY be shown as a post-session hint ("Ready for more — try 82.5 kg next time")
  MUST be shown after session save (never before, never during a live set)
  MUST NOT be shown if the session save fails
  MUST be specific: "Try 82.5 kg" not "Increase the weight"
  MUST NOT use exclamation marks or superlatives

'hold' result:
  MUST NOT be shown to the user in MVP
  The hold reason is for internal logging only

'silent' result:
  MUST NOT be shown to the user
  An empty state is preferred over a "nothing to show" message
```

---

## Interaction with Other Systems

```
progressionGating ← receives fatigueSignal from (future) fatigueComputer
progressionGating → outputs progress decision → used by session pre-load suggestion
progressionGating → hold due to plateau-candidate → detected by postSessionInsight
progressionGating → always silent output → no interaction with delivery layer

The progression gating function does NOT:
  - Call or interact with postSessionInsight
  - Call or interact with aiCoachClient
  - Read from AppDatabase directly
  - Write to AppPreferences
  - Know about the AI trust system or confidence phase
```

The coaching phase (`observation`, `emerging`, `active`, `trusted`) applies to the **post-session insight system**, not to progression gating. Progression gating is purely data-driven. A beginner on session 2 gets the same silence for `insufficient_sessions` as anyone else — coaching phase is irrelevant here.

---

## Summary

The progression gating function makes one decision: `'progress'`, `'hold'`, or `'silent'`.

It makes this decision by working through a strict priority hierarchy:

1. **Silence first.** Not enough data → silent, no matter what else is true.
2. **Fatigue second.** Elevated fatigue → hold, regardless of rep performance.
3. **Session quality third.** Failed sets, skipped sets, or incomplete session → hold.
4. **Rep ceiling fourth.** Not all sets at repMax → hold. This is the most common state.
5. **Consecutive confirmation fifth.** Beginner needs 1 session; intermediate needs 2.
6. **Confidence sixth.** If data quality is borderline, hold rather than risk a wrong recommendation.
7. **Progress.** All gates cleared → compute suggested weight and return.

The function is silent in the vast majority of evaluations. Most sessions, the user is still working toward the rep ceiling. This is expected and correct. The progression recommendation is rare because progression itself is rare — that is training.
