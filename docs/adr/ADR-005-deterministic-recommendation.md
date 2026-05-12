# ADR-005 — Deterministic Recommendation Engine

**Status:** Accepted
**Date:** 2026-05-12
**Deciders:** Product architecture
**Related:** `source-of-truth/onboarding-contract.md`, `source-of-truth/recommendation-engine.md`, `architecture/system-boundaries.md`

---

## Context

GAINER's onboarding flow must produce a programme recommendation. Two approaches were available:

1. **LLM-generated recommendations:** The user's onboarding answers are sent to an AI model, which selects or generates an appropriate programme.

2. **Deterministic scoring engine:** A weighted scoring function evaluates all catalog programmes against the user's onboarding answers and selects the best fit.

The question was which approach better serves the MVP goals of reliability, explainability, offline-first operation, and trust.

---

## Decision

**Programme selection and construction must not require LLM generation. The recommendation engine is deterministic.**

The recommendation engine:
- Scores catalog programmes against a `UserFitnessProfile` using weighted dimensions
- Applies hard constraints as elimination filters before scoring
- Returns the highest-scoring programme as the primary recommendation
- Produces explanation copy from the onboarding answers and scoring result — no LLM required

The GAINER AI may explain or discuss a recommendation after it has been made. The GAINER AI does not make or change the recommendation itself.

---

## Rationale

1. **Offline-first.** The recommendation must work without any network connection. LLM calls require a live backend. A deterministic scoring function requires only the catalog data already bundled with the app.

2. **Testability.** A scoring function produces the same output for the same inputs, always. It can be unit-tested exhaustively. An LLM produces variable output and cannot be regression-tested for correctness.

3. **Explainability.** "This programme was selected because it matches your full gym, 3-day schedule, and strength goal" is generated deterministically from the scoring result. LLM explanations are generated probabilistically and may not accurately reflect why a programme was selected.

4. **Trust at first impression.** If the recommendation is wrong (wrong equipment, wrong frequency), the user's first impression is broken. Deterministic scoring with hard constraints guarantees that hard constraints are never violated — no gym-only programme for a home gym user.

5. **AI is a better coach than a better selector.** The GAINER AI's value is in observing patterns over time and making specific, evidence-based coaching observations. Using LLM calls to select a programme from a catalog wastes AI capacity on a problem that deterministic scoring solves better.

---

## Boundaries This Decision Establishes

**The GAINER AI must not:**
- Override a deterministic recommendation during onboarding
- Generate a programme that does not exist in the catalog
- Invent exercise selections, rep schemes, or weekly structures
- Be called as part of the recommendation flow itself

**The recommendation engine must not:**
- Call the GAINER AI for any part of selection or explanation
- Return a programme that requires equipment the user does not have (hard constraint)
- Invent a programme for a frequency/goal combination the catalog does not support (honest fallback required instead)

---

## Catalog Completeness Obligation

This decision creates an obligation: when a user's onboarding answers produce no good catalog match, the engine must return an honest fallback with explanation — not an invented programme.

Catalog gaps are content work, not AI work. If a 5-day strength programme does not exist in the catalog, the engine returns the closest coherent match (4-day strength with optional accessory day) and explains this honestly.

---

## Consequences

- All programmes must exist as static catalog entries in `workoutCatalog.ts`
- The scoring dimensions and weights in `onboarding-impact-matrix.md` are the only inputs to selection
- Explanation copy is generated from typed programme metadata and onboarding answers — no LLM
- GAINER AI in onboarding is limited to after the recommendation is shown (e.g., "Ask GAINER AI about this plan")

---

## Reversibility

The deterministic engine may be augmented in future versions with:
- Personalization based on historical behavioral data (adjusting scoring weights based on what the user actually responds to)
- AI-assisted programme generation as a premium feature for custom programme creation

These augmentations would require a new ADR. The core onboarding recommendation flow remains deterministic.
