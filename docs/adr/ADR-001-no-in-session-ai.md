# ADR-001 — No AI Output During Active Workout Sessions

**Status:** Accepted
**Date:** 2026-05-12
**Deciders:** Product architecture
**Related:** `architecture/system-boundaries.md`, `ai-trust-system.md` §3.5, `post-session-single-insight-mvp.md`

# Launch Critical

Failure in this system blocks launch.

---

## Context

During active workout sessions, the user's attention is on training. Any GAINER AI output — whether an insight, a suggestion, a substitution prompt, or an encouragement message — competes with that attention and constitutes an interruption.

Multiple documents in the codebase have proposed or implied in-session AI behavior:
- `premium-adaptive-coach-plan.md` proposed "set-to-set guidance during logging" (archived)
- `coaching-intelligence-design.md` §3 stated "exercise substitution suggestions allowed" in-session

The question of whether any in-session AI output is acceptable needed a formal decision.

---

## Decision

**All GAINER AI output is architecturally prohibited during active workout sessions. No exceptions.**

This applies to:
- Post-session insights
- Substitution suggestions
- Progression recommendations
- Motivational messages
- Rest timer coaching
- Any output that requires evaluating the user's training data in real time

"AI output" means any output from the coaching intelligence layer — whether deterministic or LLM-generated.

---

## Rationale

1. **Trust loss is irreversible.** A single interruption during a training set — even a correct recommendation — is experienced as disruptive. This trust loss cannot be recovered by subsequent correct behavior.

2. **The user opened the app to train, not to receive coaching.** Unsolicited interruptions during training signal that the app's goal is engagement, not the user's performance.

3. **Architectural enforcement is the only reliable enforcement.** "Rarely interrupt" is not enforceable. "Architecturally impossible" is.

4. **Post-session is always available.** Any observation worth surfacing after a set is still worth surfacing after the session. The information does not expire in the 30 minutes between the set and session completion.

5. **Substitution suggestions are a user-initiated action.** If a user requests a substitution (by tapping a substitution button), that is user-initiated and not in-session GAINER AI. This decision prohibits *unsolicited* AI output only. User-initiated exercise substitution lookup is allowed.

---

## Implementation Constraint

`computePostSessionInsight()` and the GAINER AI client (`aiCoachClient.ts`) must only be called after the session save resolves. The `WorkoutProvider` active session state is the gate.

**Permitted call sequence:**
```
saveCompletedWorkoutSession() resolves successfully
  → computePostSessionInsight(input)  ← only here
```

**Prohibited call sequence:**
```
WorkoutProvider has active session
  → computePostSessionInsight(input)  ← PROHIBITED
```

---

## Consequences

- `premium-adaptive-coach-plan.md` is archived because its core value proposition (in-session coaching) violates this decision
- `coaching-intelligence-design.md` §3 must remove the statement that exercise substitution suggestions are allowed in-session
- Any future premium feature proposal must not include in-session AI output as a differentiator
- Exercise substitution UI may allow users to look up alternatives, but the lookup is data retrieval, not coaching intelligence

---

## Reversibility

This decision is reversible in a future version if:
1. A new ADR is created that explicitly supersedes ADR-001
2. The new ADR documents the specific mechanism by which interruption is controlled
3. User research demonstrates clear demand for in-session coaching with acceptable interruption framing
4. The feature is behind a user-controlled opt-in preference
