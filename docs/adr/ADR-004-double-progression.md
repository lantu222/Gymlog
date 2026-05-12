# ADR-004 — Double Progression as the Training Model

**Status:** Accepted
**Date:** 2026-05-12
**Deciders:** Product architecture
**Related:** `source-of-truth/progression-system.md`, `source-of-truth/glossary.md`

---

## Context

GAINER needs a consistent, understandable, and correctly-implementable model for deciding when to increase training load. Multiple models exist in the fitness domain: linear progression, percentage-based periodization, RPE-based autoregulation, double progression, and others.

The chosen model must be:
- Deterministic (computable without user input beyond logged sets)
- Appropriate for the full range of GAINER's user base (beginner to intermediate)
- Explainable in terms the user can understand and verify
- Robust enough to handle irregular training frequency

---

## Decision

**All weighted exercises with a defined rep range use the double progression model.**

```
Phase 1 — Rep accumulation
  User works at a fixed load until they can complete all target sets
  at the TOP of the rep range (the rep ceiling).

Phase 2 — Load increase
  Once the rep ceiling is reached consistently across consecutive sessions,
  load increases by a fixed increment.
  Reps reset to the bottom of the range at the new load.
```

---

## Model Parameters

| Parameter | Beginner | Intermediate | Notes |
|---|---|---|---|
| Consecutive sessions at rep ceiling required | 1 | 2 | Beginners progress faster; intermediates need confirmation |
| Load increment | 2.5 kg | 1.25 kg | Smaller increments for slower progression rates |
| Rep ceiling definition | All target working sets at `repMax` | Same | Not one set — all working sets |
| Minimum sessions required before gating activates | 2 | 3 | Not enough history → silent |

These values are owned by `progression-gating-rules.md` and may be updated there without a new ADR.

---

## Rationale

1. **Deterministic.** The progression decision can be computed entirely from logged set data and template definition. No user input required, no LLM required, no coach judgment required.

2. **Beginner-appropriate.** Linear progression (add weight every session) fails too quickly. Percentage-based periodization is too complex for beginners. Double progression gives beginners room to accumulate reps before increasing load — preventing failure and building confidence.

3. **Intermediate-appropriate.** The two-consecutive-session requirement for intermediates prevents false progression signals from outlier sessions.

4. **Explainable.** "Hit 12 reps on all three sets, so we're suggesting 2.5 kg more next time" is something any user can verify and understand.

5. **Robust to irregular frequency.** The model is session-count-based, not calendar-based. A user who trains once per week and a user who trains five times per week progress at appropriate rates without explicit frequency tracking.

---

## What This Model Does Not Cover

| Situation | Behavior |
|---|---|
| Bodyweight-only exercises | Double progression with rep ceiling and variation difficulty escalation — no load increment |
| Running/cardio exercises | Distance or time accumulation model — not double progression |
| Exercises without a defined rep range | No gating — silent |
| Sessions where the user failed sets | No progression that session (T6 trigger rule) |
| Sessions immediately after a 7+ day gap | No progression that session (T5 trigger rule) |
| High fatigue state | Hard block (high) or hold (elevated) regardless of rep ceiling status |

---

## Consequences

- All template exercises must have `repMin`, `repMax`, and `targetSets` defined for the gating system to activate
- Exercises without a defined rep range are excluded from progression gating — they are not errors
- The "rep ceiling" concept is the canonical internal terminology (see `glossary.md`)
- `progressionReady` (boolean, session state) is the internal flag for an exercise that has reached the ceiling and is eligible for progression consideration

---

## Reversibility

The double progression model may be replaced or augmented for specific user tiers (e.g., advanced users) through a new ADR. The beginner/intermediate parameters may be adjusted in `progression-gating-rules.md` without a new ADR.
