# Source of Truth

This document is authoritative.
If any other document conflicts with this file, this file takes precedence.

---

# Gainer — AI Trust System

**Type:** Design reference — behavioral intent with future implementation targets
**Status:** Design reference. Not an implementation spec.
**Related:** `coaching-intelligence-design.md`, `post-session-single-insight-mvp.md`, `system-architecture.md`, `progression-gating-rules.md`
**Canonical owner of:** trust philosophy, notification/interruption rules, frequency caps (future), per-type confidence targets (future)

---

## 1. Trust Philosophy

Trust in an AI coaching system is not built by being impressive. It is built by being consistently, quietly right — and by knowing when to say nothing.

Most fitness apps fail at trust not because their advice is wrong, but because they spend trust capital recklessly. Every generic motivational push notification, every "You're doing amazing!" after a mediocre session, every unsolicited advice message during a workout — each one costs more than it delivers. The account goes into deficit. Users learn to ignore everything. By the time the system has something genuinely valuable to say, no one is listening.

GAINER's AI trust system is built on the opposite model: radical restraint in exchange for real authority. The AI speaks infrequently, specifically, and correctly. Over time, users learn that when it does speak, it is worth attention.

**The core trade:** the system earns the right to be heard by spending almost nothing.

### Trust is asymmetric

Gaining trust requires many correct, restrained interactions. Losing trust can happen in a single moment. One confidently-wrong recommendation, one interruption at the wrong time, one generic message that ignores the user's actual data — any of these can reset months of earned credibility.

This asymmetry must shape every architectural decision. The system is not optimized for engagement. It is optimized for the long-term relationship between the user and their training data.

### What trust enables

A user who trusts the AI will:
- Act on deload recommendations even when they don't feel tired
- Accept plateau interventions without overriding them immediately
- Follow load increase suggestions on exercises they feel uncertain about
- Stay in the app during low-motivation periods because the AI has earned patience
- Attribute genuine training progress partially to the coaching system

A user who does not trust the AI will:
- Ignore all recommendations
- Dismiss insights before reading them
- Disable notifications and never re-enable them
- Leave the app when progress stalls, because the AI offered nothing useful

---

## 2. How Trust Is Gained

Trust accumulates through five mechanisms, in roughly this order of importance:

### 2.1 Specificity

The single fastest way to earn trust is for the AI to say something that could only apply to this user, in this moment, based on their actual data.

"You've matched 85 kg on squat for four sessions now" is worth more than any amount of generic coaching wisdom. The user knows the AI is watching. They know the advice is for them. Generic advice — even when technically correct — communicates that the system is not actually paying attention.

**The specificity test:** could this exact message have been sent to any other user of the app? If yes, it should not be sent.

### 2.2 Being right

The most powerful trust event is a recommendation that proves correct. The AI suggests a deload. The user takes it reluctantly. The following week, they hit a PR. The AI predicted the outcome better than the user's own instinct. This moment is irreversible — the user will give the system more credit for future recommendations.

This is why confidence thresholds matter. A recommendation made at 60% confidence that turns out wrong destroys weeks of trust. A recommendation withheld at 60% confidence is invisible. The calculus is clear.

### 2.3 Demonstrating memory

The AI should reference the past in ways that prove it has been watching. Not "you've been training consistently" but "your last three leg sessions have all been your longest of the week — your lower body work seems to be expanding."

Demonstrated memory tells the user that the system is accumulating a real picture of them, not just processing each session in isolation. This is the foundation of the compounding personalization model.

### 2.4 Restraint

Counterintuitively, saying nothing is a trust-building act. When the AI stays silent after a routine session, users gradually learn that silence means everything is fine. The absence of a message becomes a signal. This is only possible if the system has established a pattern of speaking rarely.

An AI that speaks every session cannot convey meaning through silence. An AI that speaks once a week can.

### 2.5 Predictable quality

Consistency matters more than any individual insight. Users must develop confidence that when the AI speaks, it will be worth reading. This requires that every message clears the same quality bar. No exceptions for "low stakes" insights. No slipping into generic language because the insight is minor. If it does not clear the bar, do not send it.

---

## 3. How Trust Is Lost

### 3.1 Being wrong on a confident recommendation

This is the most damaging event. A recommendation made with apparent certainty that proves incorrect. The user feels misled. The system's future output is now filtered through suspicion.

Prevention: never allow confidence scores below threshold to produce output. Higher-stakes recommendation types require higher thresholds.

### 3.2 Generic advice that ignores personal data

"Make sure you're getting enough rest" sent to a user with 10 weeks of logged sessions and a normal ACWR is not helpful advice — it is evidence that the system is not paying attention to them. It feels like a form letter.

Prevention: every message must contain at least one reference to the user's specific data. If no specific reference can be made, the message should not be sent.

### 3.3 Repeated phrasing

Receiving the same sentence twice in different sessions reveals the mechanical nature of the system. Even if the insight is valid, the phrasing repetition breaks the illusion of a system that genuinely understands this user.

Prevention: maintain a rotating message template pool per insight type. Never use the same phrasing within 60 days.

### 3.4 Speaking too frequently

Frequency itself destroys trust, independent of message quality. An insight delivered every session trains users to skim and dismiss. The messages become ambient noise.

Prevention: frequency caps enforced at the architectural level, not as a judgment call.

### 3.5 Any interruption during an active workout

No message, no matter how important, justifies interrupting a workout in progress. The user's attention is on their training. An intrusion at this moment — even a correct one — will be experienced as disruptive and annoying.

Prevention: this must be architecturally impossible, not merely discouraged. The system should have no pathway to surface insights while a workout session is active.

### 3.6 Contradicting itself without explanation

If the system recommended pushing load last week and recommends a deload this week, the user deserves context. Without it, the contradiction reads as inconsistency. With it, it reads as responsiveness to new data.

Prevention: when a recommendation reverses a recent one, include the reason. "Your volume load this week is 20% above last month's average — step back before you step up."

### 3.7 False precision

Stating something with more certainty than the data supports. "You are overtrained" when the signal is elevated but not confirmed. "This is your peak performance window" based on two data points. False precision fails visibly when the user's experience contradicts it.

Prevention: language should reflect actual confidence level. "Looks like" for medium confidence. Specific data references for high confidence. No declarative statements at low confidence.

### 3.8 Shame and pressure mechanics

Guilt-tripping about missed sessions. Countdown timers on streaks. "You're falling behind." These patterns provoke anxiety rather than motivation. They associate the app with negative emotions and accelerate churn.

Prevention: the system never references missed sessions with pressure framing. A return after a gap is acknowledged neutrally, never as a failure.

---

## 4. The Authority Progression Model

The AI does not have the same authority on session one as it does at session sixty. Authority is earned incrementally as data accumulates and recommendations prove accurate. The system should behave differently at each phase.

> **Canonical phase model.** Phase boundaries are defined by **session count**, not calendar time. A user who trains 5×/week reaches the `active` phase in one month; a user who trains 1×/week takes five months. Calendar-based thresholds are wrong for a fitness app where training frequency varies. Phase names and boundaries are owned by `system-architecture.md` §4.4 — this document describes the behavioral implications per phase.
>
> | Phase | Sessions | Confidence threshold |
> |---|---|---|
> | `observation` | 0–6 | No output regardless of signal |
> | `emerging` | 7–20 | 0.80 (future — MVP uses 0.75 universal) |
> | `active` | 21–60 | 0.75 |
> | `trusted` | 60+ | 0.70 (future) |

### `observation` phase (sessions 0–6)

The system has no meaningful baseline. It cannot distinguish this user's patterns from population norms. During this phase:

- No recommendations that require historical comparison
- Only safe, clearly-triggered outputs: PR detection (requires prior session), return-after-gap acknowledgment
- Tone: observational, never prescriptive
- Output frequency: maximum once per phase, likely zero
- Purpose: begin establishing the baseline silently

The user should notice almost nothing from the AI during this phase. That is correct.

### `emerging` phase (sessions 7–20)

Enough data exists to detect simple patterns. The system earns the right to make low-stakes recommendations:

- Plateau detection becomes available (requires 3 sessions minimum)
- Session volume peaks become computable (requires 4+ sessions in window)
- Deload recommendations remain off — insufficient baseline for reliable fatigue modeling
- Tone: observational with light suggestions
- Output frequency: roughly once every 4–6 sessions

Users begin to notice the system is watching. The first "it caught something" moment often happens here.

### `active` phase (sessions 21–60)

Individual patterns are now visible in the data. The system can begin referencing them:

- Deload recommendations available (with conservative fatigue threshold — see `progression-gating-rules.md` §7 for values)
- Training day patterns can be surfaced ("your Wednesday sessions trend 15% below your Monday sessions")
- Adherence patterns visible enough to reference
- Tone: specific, evidence-forward, more confident
- Output frequency: roughly once every 8–12 sessions when warranted

This is the phase where the compounding value becomes felt. Users begin to sense the system "knows them."

### `trusted` phase (sessions 60+)

The system has a genuine longitudinal picture of this user. It can make predictions, not just observations:

- Predictive deload timing ("based on your accumulation pattern, this is historically when performance starts dipping")
- Seasonal pattern awareness
- Individual plateau type recognition ("this looks like the same pattern as your bench plateau in March — deload resolved it then")
- Tone: peer-level, showing reasoning, not just conclusions
- Output frequency: quality-gated, not session-count-gated

At this phase, users treat the AI's output the way they would treat advice from a coach who has been watching them train for years. This is the goal.

---

## 5. Notification and Interruption Philosophy

### Default state: no notifications

Notifications are opt-in, not opt-out. The default state is silence. Users who want proactive outreach enable it explicitly. Users who do not are never contacted outside the app.

This is both a trust decision and a product decision. Notifications that go unread or are dismissed train users to dismiss them. Notifications that are never sent cannot damage trust.

### Notification tier system

Not all notifications are equal. When notifications are enabled, only tier-1 events justify them.

**Tier 1 — Allowed as notification:**
- Genuine personal record (high confidence, clearly new best)
- Significant streak milestone (user has explicitly expressed consistency as a goal)

**Tier 2 — Post-session surface only, never push notification:**
- Plateau detection
- Session volume peak
- Return after gap
- Any fatigue/deload recommendation

**Tier 3 — Never a notification, never proactively surfaced:**
- Routine encouragement
- Session completion acknowledgment
- Generic progress commentary

### Interruption rules

The following are absolute rules, not guidelines:

1. **No output during an active workout session.** Ever. No exceptions.
2. **No output that requires the user to stop what they are doing.** Post-session insight is surfaced on the completion screen — the user is already stopped.
3. **No output triggered by the user simply opening the app.** The user opened the app to train, not to receive coaching.
4. **No re-engagement notifications.** "We miss you" or "it's been a while" mechanics are explicitly prohibited. They signal that the system's goal is engagement metrics, not the user's training.
5. **No countdown or urgency framing.** "Your streak ends in 2 hours" is anxiety, not coaching.

### Notification timing

When a notification is warranted (tier-1 only, user has opted in):
- Deliver within 30 minutes of session completion — the user is still in the context
- Never deliver during the user's established training window (they may be mid-session)
- Never deliver late at night or early morning
- If the moment is missed, surface on next app open instead — do not catch up with a delayed push

---

## 6. Confidence Threshold System

Confidence is the internal gate between a potential insight and a delivered one. It is never shown to the user. It exists entirely to protect trust.

### Threshold by recommendation type

> **MVP vs future.** MVP post-session insights apply a **universal 0.75 threshold** for all types — see `post-session-single-insight-mvp.md`. The per-type thresholds below are **future targets** for when each insight type has its own mature confidence model. `progression_ready` is excluded from MVP entirely — see `post-session-single-insight-mvp.md` "What not to build yet."

| Insight type | Future threshold | Rationale |
|---|---|---|
| `personal_record` | 0.75 | Low cost if wrong — user can verify immediately |
| `return_after_gap` | 0.90 | Deterministic date math — threshold is for edge cases |
| `session_volume_peak` | 0.80 | Requires sufficient window; thin baseline inflates false positives |
| `plateau_detected` | 0.85 | Wrong plateau call is actively unhelpful and erodes trust |
| `deload_recommended` | 0.90 | Wrong deload advice interrupts productive training |
| `progression_ready` | 0.80 🔜 future | Excluded from MVP. When built: see `progression-gating-rules.md` for gate logic |

### What lowers confidence

- Exercise matched by name only, no library ID (name drift is common)
- Session completion rate below 80% (incomplete data distorts signals)
- Fewer than the minimum required prior sessions for this insight type
- Ambiguous data (e.g., weight recorded inconsistently across sessions)
- ACWR elevated when evaluating performance-based insights (fatigue confounds)
- The same exercise appears under multiple names in the log history

### What raises confidence

- Exercise matched by stable library ID across all sessions
- Clean, complete set data across all relevant sessions
- Large sample size (plateau across 5 sessions > plateau across 3 sessions)
- Consistent pattern with no exceptions in the lookback window
- Supporting signals from other insight types (e.g., both volume and performance declining)

### Confidence is not displayed

The user never sees a confidence score, a probability, or hedging language like "we think" or "it seems like maybe." If confidence is high enough to surface the insight, the message is delivered without qualification. If it is not, the message is not delivered. There is no middle state.

---

## 7. Recommendation Restraint Rules

### Hard frequency caps

> **MVP vs future.** The caps below describe the full future system. **MVP (post-session single insight) applies two simpler rules only**: (1) no back-to-back sessions with insights, (2) no consecutive same insight type. See `post-session-single-insight-mvp.md` silence rules. The full cap system below applies when the multi-surface coaching system is built.

These are enforced architecturally, not by judgment:

- Maximum 1 insight per completed session
- Maximum 3 insights per 7-day rolling window 🔜 future
- Same insight type: minimum 14-day cooldown between instances 🔜 future
- After a deload recommendation: minimum 21-day cooldown before another deload recommendation 🔜 future
- After a wrong or overridden recommendation: extended silence window (28 days minimum before same type) 🔜 future

### Perishability

Every potential insight has an expiry. An insight computed but not delivered (due to frequency cap or lower priority) is discarded, not queued.

Queueing creates debt. A plateau insight from two weeks ago may be irrelevant by the time it surfaces. The system evaluates fresh at each trigger point, never delivers stale observations.

### One winner only

When multiple insight types fire simultaneously, exactly one is selected by priority. The others are discarded. They do not appear next session. They do not appear next week. The system re-evaluates at the next trigger point from scratch.

This means some valid insights are never delivered. That is correct. The alternative — queuing and draining over time — turns every session into an administrative catch-up and destroys the "spoke because it mattered" trust model.

---

## 8. Anti-Annoyance Systems

### The generic AI fitness spam problem

Most AI fitness apps feel the same because they all make the same mistake: they prioritize output over accuracy. They fill every session with something. The content is templated, the tone is uniformly enthusiastic, and the advice could apply to any user of any fitness level doing any workout.

GAINER avoids this through a structural rule: **if removing the user's name and replacing their data with a different user's data would produce an identical message, the message should not be sent.**

Every insight must be earned by the user's specific history. There are no generic messages in the system.

### Phrase rotation

The system maintains multiple phrasing variants per insight type. No variant is used within 60 days of its last use for a given user. This prevents the mechanical feel of receiving the same sentence twice.

Variants should differ in structure, not just synonyms. "You've matched 80 kg on squat for three sessions now" and "Squat has been stuck at 80 kg across your last three sessions" are structurally different enough to avoid feeling repeated.

### No engagement mechanics

The following patterns are explicitly prohibited:

- Streak count-down pressure ("your streak ends tonight")
- Loss aversion framing ("don't lose your progress")
- Re-engagement messages after inactivity
- Celebrating session completion with language that implies the alternative was failure
- Comparative language ("better than 80% of users")
- Gamification points, badges for non-meaningful actions, or artificial milestones

These mechanics drive short-term engagement metrics at the cost of long-term trust. They signal that the system's goal is retention, not the user's training.

### The "surprised by silence" test

Periodically, a well-trained user should open the app after a session, see no insight, and think "nothing worth flagging today — that's fine." That thought is the anti-annoyance system working. The silence has become legible. The user trusts the quiet.

If a user would be surprised by the absence of a message, the system has been over-messaging. If a user has been trained to expect nothing, occasional insights land harder.

---

## 9. Good vs Bad AI Behavior

### Personal record detection

**Good:**
> "Romanian deadlift hit a new high — 90 kg for 8 reps."

Why: specific, evidence-based, no exclamation, exactly what happened, nothing added.

**Bad:**
> "Amazing work today! You absolutely crushed it on Romanian deadlift! Keep pushing those limits! 💪"

Why: no specific data, generic enthusiasm, emoji, language that could apply to any user on any day.

---

### Plateau detection

**Good:**
> "You've matched 80 kg on bench press for three sessions now. Worth trying 82.5 kg next time."

Why: specific count, specific weight, specific action, calm tone.

**Bad:**
> "It looks like you might be hitting a plateau! Don't give up — sometimes our bodies need time to adapt. Try mixing things up!"

Why: hedged language ("might be"), false comfort, vague advice ("mixing things up"), no reference to actual data.

---

### Deload recommendation

**Good:**
> "Your volume load has been above your 4-week average for 11 days. A lighter week now typically leads to a stronger one after."

Why: specific duration, evidence-referenced, framed as performance strategy, not rest prescription.

**Bad:**
> "You've been working really hard lately. Don't forget to rest — recovery is just as important as training!"

Why: no data reference, condescending, generic, could apply to any user at any time.

---

### Return after gap

**Good:**
> "First session back in 9 days. Good start."

Why: specific gap, neutral acknowledgment, no pressure, no drama.

**Bad:**
> "Welcome back! We missed you! Life gets busy but you made it — that's what counts! Let's get back on track together!"

Why: emotional manipulation, false familiarity, guilt-adjacent framing ("we missed you"), implies the absence was a failure.

---

### Silence after a routine session

**Good:**
*[nothing]*

Why: the session was fine, nothing notable happened, saying something would be noise.

**Bad:**
> "Great job completing today's session! Consistency is the key to results. See you next time!"

Why: adds nothing, rewards nothing, trains users to ignore all messages, uses language identical to what would appear after a breakthrough session.

---

### Being wrong

**Good (after a wrong deload recommendation):**
*[system flags that this recommendation type requires extended cooldown — no follow-up message, no explanation]*

Why: acknowledging a wrong recommendation in-app draws attention to the error. The better recovery is silence and a longer cooldown before the same type appears again.

**Bad:**
> "Looks like you didn't need that rest after all! Keep up the great work!"

Why: draws attention to the error, attempts to spin it positively, condescending.

---

## 10. MVP Trust Rules

For the initial post-session insight implementation, these rules apply without exception:

1. **One insight per session, maximum.** The function returns one result or null.
2. **Null is a valid and frequent return value.** Most sessions should produce null.
3. **Minimum 3 prior sessions before any insight is eligible.** No exceptions.
4. **Minimum confidence 0.75 across all types.** Lower types produce null.
5. **No back-to-back sessions with insights.** If an insight was delivered after session N, session N+1 produces null regardless of triggers.
6. **No consecutive repeats of the same insight type.** plateau_detected cannot follow plateau_detected.
7. **No insight during an active session.** Architecturally enforced.
8. **Every message must contain a specific data reference.** No generic text.
9. **No exclamation marks. No superlatives.** Reviewed before shipping any message template.
10. **No push notifications in MVP.** Post-session surface only. Notifications are a future opt-in feature.

---

## 11. What Must Be Architecturally Prevented

These are not guidelines. They are failure modes that must be impossible, not just unlikely.

| Behavior | Prevention mechanism |
|---|---|
| Any coaching output during an active workout session | Insight computation gated on session completion event — never called while session is active |
| Multiple insights in a single session | Function returns a single value type — no list, no array |
| Insight delivery without minimum session history | Silence condition checked first, before any evaluation |
| Generic messages without data reference | Template review process — every template string must contain at least one data placeholder |
| Re-engagement notifications ("we miss you") | Notification system has no trigger type for inactivity — architecturally absent |
| Streak pressure or loss-aversion language | Prohibited in all message templates — reviewed at template authoring time |
| Queued insights from previous sessions | No queue data structure — evaluation is stateless per trigger |
| Same phrasing twice within 60 days | Phrase rotation pool with recency tracking per user |
| Confidence score below threshold producing output | Threshold check is the final gate before return — cannot be bypassed |
| Insight types contradicting each other in the same window | Priority system selects one and discards others — they cannot both exist |

---

## Summary

The trust system is not a feature. It is the operating constraint that all AI coaching output exists within.

Every message the AI delivers is a withdrawal from a trust account that is built slowly and depleted quickly. The system's job is to keep that account in surplus — by making far fewer withdrawals than the account can support, and by making every withdrawal count.

A user who has received twelve insights from GAINER over six months, each of which was specific, accurate, and actionable, trusts the system more than a user who has received 180 generic motivational messages. The first user acts on recommendations. The second user has the notifications disabled.

GAINER's AI earns authority by spending almost nothing.
