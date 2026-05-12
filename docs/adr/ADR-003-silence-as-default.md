# ADR-003 — Silence as Default for Coaching Output

**Status:** Accepted
**Date:** 2026-05-12
**Deciders:** Product architecture
**Related:** `source-of-truth/post-session-insight-rules.md`, `source-of-truth/ai-trust-rules.md`, `architecture/system-boundaries.md`

---

## Context

A coaching system that speaks after every session degrades into noise. Users learn to ignore constant output, and when something genuinely important is observed, it fails to land.

The question was whether the coaching system's default output should be a message (with silence as an exception) or silence (with output as an exception).

---

## Decision

**`null` is the correct and expected return value for the majority of coaching evaluations. Silence is the default. Output is the exception.**

The post-session insight function signature encodes this decision:

```typescript
function computePostSessionInsight(
  input: PostSessionInsightInput,
  now: Date
): PostSessionInsight | null  // null is the primary case
```

---

## Rationale

1. **Silence is a signal.** When the AI speaks infrequently, its silence after a routine session becomes meaningful information: "nothing notable happened today." This is only possible if the system has established a pattern of rarely speaking.

2. **Frequency destroys trust faster than silence does.** A user who receives a coaching message after every session learns to dismiss all of them. A user who receives a message after one in six sessions reads it.

3. **Wrong insights are worse than no insight.** Every incorrect or generic coaching output draws down the trust account. A withheld output costs nothing. A wrong output costs trust that is slow to rebuild.

4. **The specificity test enforces silence.** "Could this message apply to any other user?" If yes, it should not be sent. Most sessions for most users do not produce specific-enough signal to pass this test.

---

## Enforced Silence Rules

The function must return `null` whenever any of the following are true. These are hard rules, not guidelines:

1. Fewer than 3 prior completed sessions
2. Session completion rate below 70%
3. An insight was delivered after the immediately preceding session
4. All candidate insight types are below 0.75 confidence threshold
5. The candidate type matches the type delivered last time
6. No tracked exercises with set data in this session

If any silence rule fires, the function returns `null` without evaluating insight types.

---

## Anti-Pattern: Always Show Something

The following patterns are explicitly prohibited:

```typescript
// PROHIBITED: fallback message when no insight fires
if (!insight) {
  return { type: 'encouragement', message: 'Great session today!' };
}

// PROHIBITED: low-confidence generic output
if (confidence < threshold) {
  return { type: 'general', message: 'Keep up the consistency!' };
}

// PROHIBITED: "no news is good news" message
return { type: 'status', message: 'Everything looks on track.' };
```

The correct implementation:

```typescript
if (!insight) {
  return null; // the correct and expected return
}
```

---

## Consequences

- The completion screen must render correctly with no insight panel (null state)
- The empty insight state is not an error state — it is the success state for most sessions
- No "participation ribbon" coaching messages are permitted
- Any future coaching surface must implement the same silence-default contract

---

## Reversibility

The silence-default principle is not reversible — it is foundational to the trust model. Individual silence rules may be adjusted (e.g., reducing the minimum session history requirement from 3 to 2) through a new ADR, but the silence-default architecture is permanent.
