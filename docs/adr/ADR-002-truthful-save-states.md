# ADR-002 — Truthful Save States

**Status:** Accepted
**Date:** 2026-05-12
**Deciders:** Product architecture
**Related:** `architecture/system-boundaries.md`, `mvp-launch-scope.md` §7.1, `product-roadmap-phases.md` Phase 1

# Launch Critical

Failure in this system blocks launch.

---

## Context

The most critical trust failure in a workout tracking app is a lost session. A user who trains, sees "Workout saved," and then finds their session missing in History has experienced a product failure from which they are unlikely to recover.

The app must never imply that a workout was saved before persistence has confirmed success.

---

## Decision

**The workout completion screen (`WorkoutCompletionScreen`) may only be entered after `saveCompletedWorkoutSession()` resolves successfully.**

Additionally:
- Zero-set sessions (where no sets were logged) must never produce a saved state
- A failed persistence operation must produce a visible error state with a retry path
- The save operation must expose three explicit states: `saving`, `saved`, `save failed`

---

## Rationale

1. **User data belongs to the user.** A session represents real physical effort. Losing it without acknowledgment is a product failure, not an edge case.

2. **Optimistic UI is wrong here.** Optimistic UI is appropriate when the operation is low-stakes and almost certain to succeed. AsyncStorage writes can fail on low-memory devices, corrupt storage states, or full disk conditions. The cost of a false success is too high.

3. **Trust is the foundation.** A user who discovers a lost session will question every previous save. One visible failure can undermine months of correctly saved data.

4. **Empty sessions produce no value.** A completion screen for a session where no sets were logged rewards the act of opening and closing the app, not the act of training. This is the wrong incentive.

---

## Required States

### Saving state

Shown immediately after the user confirms session completion. The completion UI is not yet shown. The user sees that the save is in progress.

```
Shown when: user confirms end of session
UI: "Saving..." indicator, no interaction until resolved
Next: → saved state (on success) or save failed state (on failure)
```

### Saved state

Shown only after `saveCompletedWorkoutSession()` resolves with success. This is when `WorkoutCompletionScreen` is entered.

```
Shown when: saveCompletedWorkoutSession() resolves successfully
UI: WorkoutCompletionScreen with completion summary
Invariant: this state MUST NOT appear before persistence resolves
```

### Save failed state

Shown when `saveCompletedWorkoutSession()` rejects or returns an error. The user must be able to retry or explicitly discard.

```
Shown when: saveCompletedWorkoutSession() rejects
UI: Error message with "Try again" and "Discard session" options
Never: silently dismiss, navigate away, or pretend success
```

### Empty session guard

Before triggering the save flow, the session must be validated as non-empty.

```
Condition: zero sets logged (or all sets explicitly skipped without data)
Result: prompt "No sets were logged. Discard this session?" with confirm/cancel
Never: proceed to saving state for an empty session
```

---

## Implementation Constraint

```typescript
// CORRECT
const result = await saveCompletedWorkoutSession(session);
if (result.success) {
  navigateTo('WorkoutCompletionScreen');
} else {
  showSaveFailedState(result.error);
}

// PROHIBITED — optimistic navigation
navigateTo('WorkoutCompletionScreen'); // before save
saveCompletedWorkoutSession(session);  // fire and forget
```

---

## Consequences

- The completion flow requires an async save step before navigation
- A loading/saving state is required in the workout completion UX
- Failed saves must surface a user-actionable error — "try again" is the minimum
- `WorkoutCompletionScreen` should receive the saved session as a prop, confirming the data was actually persisted

---

## Reversibility

This decision is not reversible. The requirement that saves are truthful is a product integrity guarantee. Future versions may improve the UI of the saving state but must not remove the truthfulness guarantee.
