# GAINER — GAINER AI Intelligence Design

**Type:** Design reference — behavioral intent only. Numeric thresholds in this document are design illustrations unless marked otherwise. For authoritative MVP values, see the implementation specs listed below.
**Status:** Design reference. Not an implementation spec.
**Related:** `coaching-architecture.md`, `post-session-single-insight-mvp.md`, `ai-trust-system.md`, `progression-gating-rules.md`, `system-architecture.md`
**Implementation specs that supersede this doc on specific values:**
- Completion rate threshold for progression: `progression-gating-rules.md` (80%, not 90%)
- Fatigue enum and ACWR thresholds: `progression-gating-rules.md` §7
- Coaching phase names and session-count boundaries: `system-architecture.md` §4.4
- MVP confidence threshold: `post-session-single-insight-mvp.md` (0.75 universal)
- Frequency caps: `ai-trust-system.md` §7

---

## 1. Core Coaching Philosophy

### The foundational rule: silence is a feature

Every time the AI speaks, it spends attention capital. Users have a finite tolerance for coaching input. A coach who speaks constantly becomes noise. A coach who speaks rarely and precisely becomes trusted.

GAINER's AI should behave like the best coaches actually behave: they watch, they absorb, they say almost nothing — and when they finally say something, you listen.

**The coach in the corner.** A knowledgeable coach sitting at the edge of the gym. They see every session. They notice when your bench form breaks down under fatigue. They track your sleep patterns through your training quality. They remember what you were doing six months ago. They don't talk between sets. But once every few weeks, they catch you on the way out and say one thing that changes how you train for the next month.

That is the experience GAINER should create.

### What coaching actually is

Coaching is not motivation. It is pattern recognition + timely intervention.

A great coach does not say "you've got this." A great coach says "you've been sleeping less than usual and your working sets have been slower for three weeks — take next week lighter and test your real ceiling the week after."

GAINER's AI delivers three things, in order of value:
1. **Observation** — noticing what the user's data actually shows
2. **Interpretation** — explaining what it means in context
3. **Recommendation** — suggesting one specific action

It does not deliver motivation, encouragement, accountability pressure, or personality.

### Coaching tone

- Calm. Never excited.
- Specific. Never generic.
- Direct. Never hedging.
- Honest. Including when progress is slow.
- Concise. Maximum two sentences per insight.
- Evidence-referenced. "Your last four deadlift sessions" not "lately."

---

## 2. Intelligence Principles

**Observe before concluding.** No coaching output triggered by a single data point. Minimum data thresholds before acting:
- Plateau: 3+ consecutive non-progressing sessions
- Fatigue recommendation: ACWR `'elevated'` or `'high'` sustained — see `progression-gating-rules.md` §7 for the canonical fatigue enum and ACWR threshold values
- Adherence intervention: 2+ missed planned sessions in a 14-day window
- Recovery suggestion: declining density and completion rate across 3+ sessions

**Context before prescription.** A 15% drop in volume load could mean fatigue, a program change, intentional deload, or illness. When context is ambiguous, hold — do not recommend based on the most likely interpretation.

**Confidence gates output.** Every potential recommendation has an internal confidence score. Below the threshold, the system stays silent. A wrong recommendation destroys trust permanently. A withheld recommendation is invisible and has no cost. Default to silence when uncertain.

**One thing at a time.** Never surface more than one insight per session. Never more than three per week. The user can only act on one thing meaningfully anyway.

**Recommendations are perishable.** A plateau insight from three weeks ago is stale. A fatigue insight from last week may be irrelevant after two rest days. Check expiry before surfacing.

**Earn the right to advise.** Early in a user's history, make fewer, more cautious recommendations. As data accumulates and past recommendations prove accurate, the system earns the right to make bolder, more specific claims.

---

## 3. Behavior Systems

### Signal processing hierarchy

```
Priority 1 — Safety signals
  Overtraining risk (ACWR > 1.5 sustained)
  Injury pattern detection (repeated skip on specific exercise)
  Complete session abandonment pattern

Priority 2 — Performance signals
  Plateau (3+ consecutive non-progression)
  Progression readiness (hitting upper rep range consistently)
  Deload trigger (performance declining across multiple exercises)

Priority 3 — Pattern signals
  Training time drift (sessions getting shorter over weeks)
  Volume accumulation trend (weekly load trending up or down)
  Exercise completion rate changes

Priority 4 — Adherence signals
  Missed sessions against plan
  Session timing pattern disruption
  Consistency score trending down

Priority 5 — Positive signals
  Personal records
  Streak milestones
  Goal trajectory on track
```

Higher priority signals suppress lower priority ones. A safety signal does not share a session with a positive reinforcement message.

### The coaching cadence model

**In-session:** No GAINER AI output of any kind. This is architecturally prohibited — see ADR-001. Exercise substitution is a user-initiated data lookup (finding an alternative exercise), not GAINER AI output, and is allowed only when explicitly requested by the user via a substitution button. Unsolicited messages, suggestions, and encouragement are prohibited during active sessions.

**Post-session:** One observation if meaningful. Never multiple insights.

**Weekly (opt-in):** 🔜 Future — not part of MVP. See `mvp-launch-scope.md` §4 for the excluded features list. When built: data-forward summary, one forward-looking insight, training plan adjustment suggestion if warranted.

**Milestone (event-triggered):** 🔜 Future — streak milestones are excluded from MVP (see `mvp-launch-scope.md` §4.7). PR acknowledgment is available via the post-session insight system (`post-session-single-insight-mvp.md`). Goal achievement and plateau break markers are post-launch.

---

## 4. Recommendation Philosophy

### Progression

Recommend load progression only when all three are simultaneously true:
1. User hit the top of their rep range in the last session (all working sets at rep ceiling)
2. Session quality was adequate (completion rate ≥ 80%) — see `progression-gating-rules.md` T12 for the authoritative threshold
3. Fatigue state is `'normal'` — see `progression-gating-rules.md` §7 for the fatigue enum

If any fails, hold load. Do not explain this every time — simply do not recommend the increase.

### Deload

Frame deload as performance strategy, never as rest.
- Trigger: fatigue signal `'elevated'` or `'high'` sustained AND performance declining across 3+ sessions on different muscle groups. See `progression-gating-rules.md` §7 for the canonical fatigue enum and ACWR threshold values (`'elevated'`: ACWR 1.3–1.5; `'high'`: ACWR > 1.5).
- Framing: "Your system has been accumulating load for 7 weeks. A lighter week now will likely result in a meaningful jump in output the following week."
- Never: "You seem tired" or "Make sure to rest"
- Structure: reduce load 40–50%, keep movement patterns, keep frequency

### Plateau intervention hierarchy

Diagnose before intervening. Wrong intervention makes things worse.

1. **Fatigue plateau** (most common, most misdiagnosed): ACWR elevated, performance declining across multiple exercises. → Deload first. Retest. Do not change the exercise.
2. **True strength plateau**: ACWR normal, completion rate fine, same weight/reps for 4+ sessions. → Rep range shift, tempo variation, or patient accumulation. Not all plateaus need intervention.
3. **Motivational plateau**: Completion rate dropping, shorter sessions, no fatigue signal. → Program variation or goal reframe — only with supporting adherence signals.

Never recommend exercise substitution as a plateau fix unless the plateau has persisted through a deload.

### Exercise substitution

When recommending a substitution:
- What movement pattern does this exercise serve?
- What is the user's equipment context?
- What joint sensitivity flags exist?
- What substitution has this user used before (and did they complete it)?

A substitution the user will actually complete outweighs a technically superior one they will skip. The system should learn substitution preferences over time.

---

## 5. Trust and Retention Strategy

### Trust is built through restraint

The single most trust-building behavior is saying nothing when things are fine. Users learn to read the AI's silence as a positive signal: "it would have told me if something was wrong." This gives eventual coaching messages real weight.

Every unnecessary message trains the user to ignore all messages.

For the full trust model — how trust is gained, how it is lost, interruption rules, and frequency caps — see `ai-trust-system.md`. That document is the canonical owner of the trust system.

### Trust destruction events — must be architecturally prevented

1. A recommendation that proves wrong
2. Generic advice that ignores user data ("Make sure to get enough rest" to someone with 8 weeks of consistent data and normal ACWR)
3. Repeated identical phrasing — the system must vary language even when the insight is similar
4. Any message during an active session
5. Conflicting recommendations within a short window without explanation

### The signal-to-noise ratio test

Before any coaching output:
1. Would a competent human coach say this, right now, given all available information?
2. Is this specific to this user's data, or could it apply to anyone?
3. Is this actionable within the next 7 days?
4. Has the user seen a version of this insight recently?
5. Is the system confident enough to be wrong and not lose credibility?

If any answer is no, hold the output.

### Retention through compounding value

The longer a user is in GAINER, the more the system knows about them, and the more accurate the coaching becomes. This creates switching cost without lock-in mechanics.

**The investment curve must be felt by month two.** If users don't notice that the app "knows them better" by 60 days, the compounding value proposition fails. The system must surface at least one observation in the first 8 weeks that clearly derives from personal history — not a generic observation that could apply to anyone.

---

## 6. Smart vs Annoying

### What makes the AI feel genuinely intelligent

- It noticed a pattern before the user consciously registered it
- The recommendation was specific to this user's data, not a general principle
- It correctly predicted that a session would be hard
- It recommended rest when the user expected to be pushed
- It connected two data points from different time periods
- It said nothing for two weeks and then said exactly the right thing
- It told the user they were ready to progress before they felt ready — and it was right

### What makes the AI feel annoying

- It speaks every session
- It uses the same phrases repeatedly
- It celebrates mediocre sessions
- "Great workout! Keep up the amazing work!" — functionally meaningless
- Notifications at bad times
- Flagging something the user deliberately chose to do differently
- Plateau recommendation after one session
- Rest recommendation right after two days off
- Telling the user something they already told the app
- Five insights when one would do
- Advice contradicting last week without explanation

---

## 7. Beginner / Intermediate / Advanced Differences

### Beginner

The single highest-value outcome is becoming someone who trains consistently. Not optimization — habit formation.

- Prioritize consistency signals over performance signals
- Positive reinforcement on attendance, not just performance
- Deload logic mostly irrelevant — volume too low to accumulate meaningful fatigue
- Plateau detection uses a longer lookback window — linear progression continues longer than the user expects
- Simpler language, shorter explanations
- No complex periodization concepts
- Goal: build the training identity

Avoid: overloading with signals they cannot act on, fatigue warnings based on insufficient data, expectations that are too aggressive.

### Intermediate

Habit is established. First real plateaus are appearing. This is where coaching intelligence delivers differentiated value.

- Begin tracking progression state per exercise
- Deload recommendations become relevant
- Plateau intervention logic activates (conservative)
- Volume and frequency optimization starts to matter
- Adherence patterns become meaningful predictors of outcome
- Program-level suggestions become appropriate

### Advanced

The advanced athlete will immediately detect if the AI says something that doesn't match their experience.

- Observational, not instructional — surface data, let the athlete interpret
- High confidence threshold before any recommendation
- Show reasoning: not "you should deload" but "your volume load has declined 18% over 3 weeks — this pattern preceded your last two deloads and you PR'd afterwards both times"
- Respect autonomy — frame as options, not prescriptions
- Periodization awareness — understand where in a training block the athlete is
- Do not explain basic concepts
- The AI's value is pattern detection and trend analysis, not coaching fundamentals

---

## 8. Long-term Personalization Model

### Phases

> **Canonical phase model.** Phase names, session-count boundaries, and confidence thresholds are defined in `system-architecture.md` §4.4 and `ai-trust-system.md` §4. The canonical phases are `observation` (0–6 sessions), `emerging` (7–20), `active` (21–60), and `trusted` (60+). The behavioral descriptions below map to those phases.

**`observation` phase (0–6 sessions)**
Establishing baselines. The system collects data without acting on it. Recommendations rely on stated profile only (`UserFitnessProfile`). Keep all outputs conservative — no historical comparison is yet possible.

**`emerging` phase (7–20 sessions)**
Enough data to detect simple individual patterns:
- Which training days produce best performance
- How quickly this user recovers between sessions
- Which exercises plateau first
- Volume ceiling before performance degrades

**`active` phase (21–60 sessions)**
System begins to reference individual patterns:
- When a deload is likely needed based on this user's accumulation rate
- Which plateau type this user tends to experience
- What intervention has worked previously for this user

**`trusted` phase (60+ sessions)**
Full longitudinal picture. System can anticipate rather than observe:
- Seasonal training patterns
- Life disruption signatures (gap timing correlations)
- Long-term strength curves
- What program types produce the best response for this individual

### What the system should learn

| Signal | What it reveals |
|---|---|
| Training time of day | User's optimal performance window |
| Session-to-session performance variance | Recovery speed and volume tolerance |
| Exercise skip patterns | Actual preferences vs stated preferences |
| RPE reported vs performance actual | RPE calibration accuracy |
| Plateau frequency per exercise category | Individual adaptation rate by movement |
| Adherence gap patterns | Life disruption signatures |
| Post-deload performance delta | Individual response to deload |

---

## 9. Invisible vs Visible AI

Most AI should be invisible — it makes things work better without announcement:
- Better default progression suggestions
- Smarter exercise substitutions
- More appropriate volume recommendations
- Timing of deload suggestions

Visible AI moments should be rare and meaningful:
- "You've been plateauing on deadlift for 5 weeks — here's why and what to try"
- "Your strongest training day is Thursday — your Friday sessions are significantly weaker"
- "You've now surpassed your previous best 3-month training streak"

**The ratio should be heavily weighted toward invisible.** Approximately 10:1.

### AI magic moment opportunities

These are the moments that make a user think "this app actually gets me":
- First time the AI catches a plateau before the user noticed
- First correct prediction of a hard session
- First deload recommendation that leads to visible progress after
- Surfacing a connection the user didn't see ("you train consistently better with 2 days between sessions")
- Correctly flagging a muscle imbalance risk
- Noticing a habit formation pattern ("you've established Tuesday/Thursday as your training anchor days")

---

## 10. Positive Reinforcement Philosophy

**Reinforce:**
- Consistency (showing up), not perfection
- Effort quality, not just load moved
- Process behaviors (completing warmups, logging honestly)
- Recovery decisions (taking deload when suggested)
- Long-term trends, not single sessions

**Do not:**
- Celebrate every session equally — dilutes meaning
- Over-celebrate easy workouts
- Create anxiety when a session is missed
- Use identical phrasing for genuine achievements and routine completions

---

## Core summary

GAINER's GAINER AI intelligence has one job: be right less often, but be undeniably right when it speaks.

The system earns trust through restraint, builds retention through compounding personalization, and delivers value through precise observation — not volume of output.

Every design decision should be evaluated against a single question: does this make the AI feel more like a coach who has watched you train for years, or more like a fitness app trying to justify its existence?
