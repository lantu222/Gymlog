# GAINER — GAINER AI Architecture

**Type:** Design reference — phased implementation roadmap only. Layer definitions live in `system-architecture.md`.
**Status:** Reference document. MVP types only. No implementation beyond `UserFitnessProfile`.

---

## Purpose

This document defines the long-term architecture for GAINER's GAINER AI system.
It exists to prevent ad-hoc decisions from blocking future capability.

**Do not implement ahead of need.**
The app must remain stable and shippable at every phase.

---

## System layers

The five-layer coaching architecture (`PROFILE → MEMORY → SIGNAL → INTELLIGENCE → DELIVERY`) is defined and owned by `system-architecture.md` §2 and §4. Refer to that document for layer responsibilities, data flow, and ownership rules.

This document covers only the **phased implementation roadmap** — what to build and in what order.

---

## Implementation phases

### ✅ MVP — ready to build now

**`UserFitnessProfile`**
A typed, derived view over existing `AppPreferences` data.
No new data collection. No UI changes. No new storage key.
See `src/types/coaching.ts` for the type definition.

Used by: `aiCoachClient`, `aiCoachPreview`, future `contextAssembler`.

---

### 🔜 Later — build when the feature requires it

**`ProgressionState`** (per exercise)
- Consecutive successes/failures, current tier, deload flag
- Requires: post-session computation hook
- Unlocks: smarter load recommendations in GAINER AI

**`SessionPerformanceSignal`** (per session)
- Volume load, completion rate, session quality score
- Requires: post-session computation, cached result
- Unlocks: block memory, fatigue model, coaching actions

**`AdherenceRecord`** (weekly)
- Planned vs completed, consistency score
- Requires: planned session tracking (not yet in model)
- Unlocks: retention signals, habit engine

**`CoachingAction` type system**
- Typed action union: `progression_ready`, `deload_needed`, `plateau_intervention`, etc.
- Requires: signal layer to be meaningful
- Unlocks: structured GAINER AI context, ranked recommendations

**`buildCoachingContext()`**
- Assembles memory tiers into a structured object for the GAINER AI
- Requires: at least `UserFitnessProfile` + `SessionPerformanceSignal`
- Unlocks: live GAINER AI with real user data

---

### 🚫 Do not build yet

**Memory tiers** (`RecentMemory`, `BlockMemory`, `LifetimeMemory`)
- Requires sufficient data volume to be useful
- Build after 3+ months of real user sessions exist

**`MuscleGroupFatigueState`**
- Per-muscle ACWR is more accurate than session-level
- Requires reliable volume-load tracking per muscle group
- Current ACWR implementation is sufficient for now

**`GoalMilestone` tracking**
- Requires goal-setting UI that does not yet exist
- Do not build the data model until the product flow is defined

**Supabase sync layer**
- Offline queue, conflict resolution, RLS policies
- Build only when multi-device or cloud backup becomes a user need

**ML plateau prediction**
- Requires 6+ months of data across 100+ users
- Heuristic plateau detection (already built) is sufficient for now

**Push notification coaching**
- Requires notification permission flow and backend scheduler
- Not a current priority

---

## Data relationships (reference)

```
AppPreferences ──derives──▶ UserFitnessProfile
                                    │
                          used by GAINER AI context

WorkoutSession ──computes──▶ SessionPerformanceSignal   [later]
ExerciseLog    ──computes──▶ ExercisePerformanceSignal  [later]
                                    │
                          ProgressionState (per exercise)  [later]
                          MuscleGroupFatigueState          [do not build yet]

AdherenceRecord (per week)  [later]
GoalMilestone   (per goal)  [do not build yet]

All of the above ──assembles──▶ CoachingContext  [later]
                                      │
                             LLM prompt / GAINER AI response
```

---

## Key constraints

- **Signal computation is never synchronous in render.** Compute post-session, cache result.
- **AI context has a size budget.** Target ≤ 2,000 tokens when serialized. Compress aggressively.
- **Cold start must degrade gracefully.** No history = no signals = no actions. Never show fabricated data.
- **All coaching types live in `src/types/coaching.ts`.** No type sprawl across modules.
- **Raw logs are append-only.** Signals are derived, never stored as edits to the log.
- **Supabase schema mirrors these entities 1:1** when sync is built. Design with flat, normalized, UUID-keyed records.
