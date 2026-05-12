# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

---

# Post-Session Single Insight — MVP Spec

**Type:** Implementation spec — values defined here are authoritative and buildable
**Status:** Spec only. Not yet implemented.
**Scope:** One optional insight surface after a completed workout. No chatbot. No notifications. No UI redesign.
**Canonical owner of:** universal 0.75 confidence threshold (MVP), no-back-to-back silence rule (MVP)

---

## Core rule

After a session is saved, the system evaluates one question: *is there something worth saying?*

If yes → return one insight. If no → return null. Silence is the correct output for most sessions.

---

## Silence rules

The system returns null whenever any of the following are true. No exceptions.

- Fewer than 3 prior completed sessions (no baseline)
- Session completion rate below 70% (incomplete data)
- An insight was delivered after the immediately preceding session (no back-to-back)
- The highest-confidence candidate is below the 0.75 threshold
- The candidate type matches the type delivered last time (no consecutive repeats)
- No tracked exercises with set data in this session

> **Frequency caps (MVP vs future).** MVP applies the two rules above: no back-to-back sessions with insights, and no consecutive same-type repeats. The full frequency cap system — 3 insights per 7-day window, 14-day same-type cooldown, 21-day deload cooldown — is defined in `ai-trust-system.md` §7 and applies to the future multi-insight coaching system, not to this MVP surface.

---

## Allowed insight types (MVP)

Four types only, evaluated in priority order. When multiple trigger, highest priority wins. Others are discarded.

| Priority | Type | Trigger |
|---|---|---|
| 1 | `personal_record` | New best performance on a tracked exercise |
| 2 | `plateau_detected` | Same top-set weight for 3+ consecutive sessions on the same exercise |
| 3 | `session_volume_peak` | Session total volume exceeds all sessions in the past 6 weeks |
| 4 | `return_after_gap` | First session after a gap of 7+ days |

`progression_ready` is explicitly excluded from MVP — it requires template `repsMax` data. Build in the next iteration.

---

## Data thresholds

Each type has a minimum history requirement. If unmet, the type is disqualified — not approximated.

| Type | Minimum required |
|---|---|
| `personal_record` | ≥ 2 prior sessions with data for this exercise |
| `plateau_detected` | ≥ 3 consecutive sessions, same exercise, same top-set weight |
| `session_volume_peak` | ≥ 4 prior sessions within the last 6 weeks |
| `return_after_gap` | ≥ 1 prior session |

---

## Confidence scoring

Confidence is an internal gate. It is never shown to the user.

**Threshold: 0.75.** Below this, the system stays silent.

```
personal_record
  1.00 — weight × reps volume strictly exceeds all prior sessions for this exercise
  0.85 — same weight, more clean reps than previous best
  0.60 — improvement ambiguous (name mismatch, missing data) → disqualified

plateau_detected
  0.90 — exactly 3 consecutive sessions, same exercise key, same top-set weight
  0.80 — 4+ consecutive sessions (stronger signal)
  0.65 — exercise matched by name only, no library ID → disqualified
  disqualified if any session in the run included a different variant
  disqualified if ACWR is elevated (fatigue plateau, not adaptation plateau)

session_volume_peak
  0.85 — volume exceeds all sessions in 6-week window, 4+ sessions present
  0.70 — exceeds past 4 weeks but fewer than 4 sessions in window → disqualified
  disqualified if fewer than 4 sessions in the window

return_after_gap
  0.95 — gap ≥ 7 days (deterministic)
  always passes threshold when triggered
```

---

## Example messages

Tone: calm, specific, evidence-referenced. No exclamation marks. No superlatives. Maximum two sentences.

**personal_record**
> "Romanian deadlift hit a new high today — 90 kg for 8 reps."
> "New best on bench press: 100 kg for 5. That's 2.5 kg above your previous top set."

**plateau_detected**
> "You've matched 80 kg on squat for three sessions running. Worth trying 82.5 kg next time."
> "Bench press has been at 75 kg for three sessions. Consider moving the weight up slightly."

**session_volume_peak**
> "Highest volume leg session in six weeks."
> "That was your biggest upper body session since early April."

**return_after_gap**
> "First session back in 10 days. Good start."
> "Nine days since your last session. Good to see you back."

**null** — no message rendered.

Messages are deterministic template fills. No LLM generation in MVP.

---

## Pure function contract

```typescript
// src/lib/postSessionInsight.ts

export type InsightType =
  | 'personal_record'
  | 'plateau_detected'
  | 'session_volume_peak'
  | 'return_after_gap';

export interface PostSessionInsight {
  type: InsightType;
  message: string;
  confidence: number;
  exerciseKey?: string;   // personal_record and plateau_detected only
}

export interface PostSessionInsightInput {
  completedSession: Pick<WorkoutSession, 'id' | 'performedAt' | 'totalVolumeKg'>;
  sessionExerciseLogs: ExerciseLog[];
  allPriorSessions: Pick<WorkoutSession, 'id' | 'performedAt' | 'totalVolumeKg'>[];
  allPriorExerciseLogs: ExerciseLog[];
  lastInsightSessionId: string | null;
  lastInsightType: InsightType | null;
  unitPreference: UnitPreference;
}

export function computePostSessionInsight(
  input: PostSessionInsightInput,
  now: Date
): PostSessionInsight | null
```

**Constraints:**
- Pure function. No side effects. No storage access. No database calls.
- All data passed in by the caller.
- Returns `null` explicitly for silence — not as an error state.
- Caller is responsible for resolving input data from existing stores.

**Internal structure:**
```
computePostSessionInsight
  → checkSilenceConditions()         returns null early if any rule fires
  → evaluatePersonalRecord()         returns candidate | null
  → evaluatePlateauDetected()        returns candidate | null
  → evaluateSessionVolumePeak()      returns candidate | null
  → evaluateReturnAfterGap()         returns candidate | null
  → selectHighestPriorityCandidate() priority order + threshold gate
  → PostSessionInsight | null
```

Each `evaluate*` is an independent pure function. They do not call each other.

---

## Storage requirement

Two new fields on `AppPreferences` only:

```typescript
lastInsightSessionId: string | null;   // session after which insight was last delivered
lastInsightType: InsightType | null;   // type of that insight (for repeat-type gate)
```

No new database schema. No new storage key. These are small, non-critical preference fields.

---

## Required tests

**Silence rules**
- Returns null with fewer than 3 prior sessions
- Returns null when session has no tracked set data
- Returns null when session completion rate is below 70%
- Returns null when insight was delivered after the immediately preceding session
- Returns null when all candidates are below the confidence threshold

**personal_record**
- Detects new top-set weight on a tracked exercise
- Detects same weight with more reps as a record
- Does not trigger when current session equals (not exceeds) previous best
- Does not trigger with fewer than 2 prior sessions for this exercise
- Formats weight correctly for kg and lb

**plateau_detected**
- Triggers after exactly 3 consecutive sessions at the same top-set weight
- Does not trigger after only 2 consecutive matching sessions
- Does not trigger when exercise name drifted (low confidence → disqualified)
- Does not trigger when ACWR is elevated

**session_volume_peak**
- Triggers when volume exceeds all sessions in the 6-week window
- Does not trigger with fewer than 4 sessions in the window
- Does not trigger when a prior session had higher volume

**return_after_gap**
- Triggers when gap is exactly 7 days
- Triggers when gap exceeds 7 days
- Does not trigger when gap is 6 days or fewer

**Priority resolution**
- Returns `personal_record` when both personal_record and plateau_detected fire
- Returns `plateau_detected` when only plateau_detected and session_volume_peak fire

**Message format**
- personal_record message contains the exercise name and weight value
- plateau_detected message contains the session count
- return_after_gap message contains the day count
- No message contains an exclamation mark
- No message exceeds two sentences

---

## What not to build yet

| Feature | Reason |
|---|---|
| `progression_ready` insight type | Requires template `repsMax`; validate data flow first. When built: applies 0.80 threshold (see `ai-trust-system.md` §6) and follows progression logic in `progression-gating-rules.md` |
| LLM-generated messages | Template messages are deterministic and sufficient |
| Insight history or log | No UI surface; premature persistence |
| Push notifications | Different delivery system; out of scope |
| Weekly summary insights | Different cadence and aggregation |
| Fatigue-based insights | ACWR is a gate only, not a primary signal in MVP |
| User feedback on insights | No feedback loop needed until usage volume exists |
| Multiple insights per session | Violates core constraint |
| In-session insights | Architecturally prohibited |
| `lastInsightSessionId` in a new table | Two AppPreferences fields are sufficient |
