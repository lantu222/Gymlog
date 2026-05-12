# GAINER — Shared Terminology Glossary

**Type:** Reference — canonical definitions for all GAINER documentation and implementation
**Status:** Living document. Add terms when introduced; deprecate variants when standardised.
**Related:** All docs/ files. When a term is used in any document, it must match the canonical form defined here.

---

## Purpose

This glossary defines the canonical term for every concept used across GAINER's documentation and codebase. When the same concept has appeared under multiple names, one name is designated canonical and all others are deprecated.

**Rules:**
1. When writing a document, use only canonical terms from this glossary.
2. When introducing a new concept, add it here before using it elsewhere.
3. Deprecated variants are listed so they can be found and corrected — not used.
4. Code identifiers (TypeScript types, function names) may differ from prose terms where language conventions require it; this is noted per entry.

---

## Deprecated Terms Quick Reference

| Deprecated | Canonical replacement |
|---|---|
| Phase 1 / Phase 2 / Phase 3 / Phase 4 (coaching phases) | `observation` / `emerging` / `active` / `trusted` |
| weeks 1–4, months 3–6 (phase boundaries) | session-count boundaries (0–6 / 7–20 / 21–60 / 60+) |
| "top of rep range" | rep ceiling |
| "upper rep range" | rep ceiling |
| "repsMax" (prose) | rep ceiling (prose); `repMax` (code) |
| "session quality" (when meaning completion rate) | completion rate |
| "progression readiness" | progressionReady (session state) |
| "progression-ready session" | progressionReady session |
| "load increase" | load increment |
| "push load" | increase load |
| "hold the load" | hold (progression decision) |
| "fatigue state" (as a general concept) | fatigue signal |
| "overtraining" (in coaching context) | fatigue signal `'high'` |
| "rest recommendation" | deload recommendation |
| "take a rest week" | deload |
| "insight message" | coaching insight |
| "coaching message" | coaching insight |
| "AI message" | coaching insight |
| "AI output" (as a noun for what the user sees) | coaching insight (when visible), signal (when invisible) |
| "AI theater" (as a pattern name) | coaching theater |
| "authority phase" | coaching phase |
| "trust phase" | coaching phase |
| "profile completeness" | (prohibited concept — see entry) |
| "back-to-back insights" | consecutive-session insights |
| "session quality score" (when unqualified) | completion rate or session quality score (see entries) |
| "progressionStatus" | progressionState |
| "coaching cadence" | delivery cadence |

---

## 1. Coaching System Terms

---

### Coaching Phase

**Type:** Enum value (one of four named states) | **Code identifier:** `coachingPhase` field on `AppPreferences`

**Definition:** The stage of the coaching relationship between GAINER's AI system and a specific user, determined by how many completed sessions exist in the user's history. Phase governs how conservative or confident the system's output is.

**The four canonical phases:**

| Phase | Session count | Behaviour |
|---|---|---|
| `observation` | 0–6 | No coaching output except PR detection. Building baseline. |
| `emerging` | 7–20 | Low-stakes insights only (plateau, volume peak, gap return). Conservative confidence threshold. |
| `active` | 21–60 | Full insight portfolio active. Standard confidence threshold. |
| `trusted` | 60+ | Predictive recommendations permitted. Lowest confidence threshold. |

**Canonical terms:** `observation`, `emerging`, `active`, `trusted` — always lowercase, always these exact strings.

**Allowed usage:** In all documents and code that reference coaching authority progression. Phase boundaries are defined by session count, not calendar time.

**Disallowed variants:**
- `Phase 1`, `Phase 2`, `Phase 3`, `Phase 4` — retired naming convention
- Calendar-based boundaries ("weeks 1–4", "months 3–6") — session count is authoritative
- "profiling phase", "pattern recognition phase", "predictive phase" — non-canonical phase names
- "authority phase", "trust phase" — use "coaching phase"

**Related terms:** → earned authority, → confidence threshold, → coaching phase session count

**Canonical source:** `system-architecture.md` §4.4. All other documents reference this source for phase names and boundaries.

---

### Earned Authority

**Type:** Concept (noun phrase)

**Definition:** The incremental right of the AI coaching system to make more specific, predictive, and higher-stakes recommendations as it accumulates accurate, verified observations about a specific user. Authority is not granted on day one — it is earned through correct, restrained output over time.

**Allowed usage:** In philosophy and design reference documents when describing the arc of the coaching relationship. "The system earns authority by being right, not by being present."

**Disallowed variants:**
- "trust" (when meaning authority — trust is a separate concept describing the user's perception, not the system's capability level)
- "unlock" (implies a gate, not an earned progression)

**Related terms:** → coaching phase, → confidence threshold, → trust

---

### Coaching Insight

**Type:** Noun | **Code identifier:** `CoachingInsight` (interface), `PostSessionInsight` (MVP type)

**Definition:** A specific, data-referenced observation or recommendation surfaced to the user by the AI coaching system. A coaching insight must contain at least one reference to the user's specific training history. Generic statements are not coaching insights.

**Allowed usage:** The canonical term for what the AI produces and the user sees. Use "coaching insight" in all prose, "CoachingInsight" in code.

**Disallowed variants:**
- "AI message" — too vague; all user-facing text is technically "from AI"
- "coaching message" — imprecise (message implies communication style; insight implies value)
- "insight message" — redundant
- "AI output" (as a noun for the visible surface) — use "coaching insight" when referring to what the user sees

**Insight types (MVP):** `personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`

**Insight types (future):** `progression_ready`, `deload_recommended`, `adherence_pattern`

**Related terms:** → silence, → confidence threshold, → coaching phase

---

### Silence / Silence Default

**Type:** Noun (outcome), Design principle

**Definition (as outcome):** The state in which the AI coaching system produces no visible output for a given session or trigger point. Silence is expressed as `null` from the insight computation function — not as a "nothing to show" message, not as an empty state with explanatory text.

**Definition (as principle):** The design philosophy that the AI should default to producing no output unless a specific, high-confidence observation is warranted. "Silence is the correct output for most sessions."

**Allowed usage:**
- "The system returns silence" — correct (do not say "the system returns nothing")
- "Silence is the default" — correct
- "The AI stayed silent" — correct

**Disallowed variants:**
- "no message" (correct but imprecise — prefer "silence" as the canonical term for this state)
- "empty state" (describes a UI pattern, not the coaching outcome)
- Representing silence as a message to the user ("Nothing to report today!") — prohibited

**Related terms:** → silence rule, → coaching insight, → confidence threshold

---

### Silence Rule

**Type:** Noun | **Code context:** Conditions evaluated at the start of `computePostSessionInsight()` that cause early return of `null`

**Definition:** Any condition that causes the coaching system to produce silence regardless of signal strength. Silence rules are evaluated first, before confidence scoring, before insight type evaluation. If any silence rule fires, the result is `null`.

**Canonical silence rules (MVP):**
- Fewer than 3 prior completed sessions
- Session completion rate below 70%
- Insight delivered after the immediately preceding session (consecutive-session gate)
- All candidates below 0.75 confidence threshold
- Candidate type matches type delivered last session (consecutive-type gate)
- No tracked exercises with set data in this session

**Allowed usage:** "Silence rule S3 fires when the exercise was skipped." — correct

**Disallowed variants:**
- "disqualification rule" — use "silence rule" for early-exit conditions
- "gating rule" — ambiguous (confidence gates are different from silence rules)

**Related terms:** → silence, → confidence threshold, → consecutive-session gate

---

### Consecutive-Session Gate

**Type:** Noun | Silence rule

**Definition:** The silence rule that prevents a coaching insight from being delivered in two consecutive completed sessions. If an insight was delivered after session N, session N+1 always produces silence regardless of signal quality.

**Canonical term:** consecutive-session gate

**Disallowed variants:**
- "back-to-back insights" — deprecated shorthand; use "consecutive-session insights" when describing what the gate prevents
- "no back-to-back rule" — use "consecutive-session gate"

**Related terms:** → silence rule, → delivery cadence

---

### Delivery Cadence

**Type:** Noun

**Definition:** The rhythm at which coaching insights are surfaced to a specific user, governed by silence rules, frequency caps, and the coaching phase. Target delivery cadence in the `active` phase is approximately one insight per 8–12 completed sessions.

**Canonical term:** delivery cadence

**Disallowed variants:**
- "coaching cadence" — deprecated; the cadence applies to delivery, not to coaching as a whole
- "insight frequency" — acceptable but less precise

**Related terms:** → coaching phase, → silence rule, → frequency cap

---

### Frequency Cap

**Type:** Noun

**Definition:** An architectural limit on how many coaching insights can be delivered within a time window or per insight type. Frequency caps are enforced structurally — they cannot be overridden by a high-confidence signal.

**MVP caps (from `post-session-single-insight-mvp.md`):**
- Maximum 1 insight per completed session
- No consecutive same-type insights

**Future caps (from `ai-trust-system.md` §7, not yet active):**
- Maximum 3 insights per 7-day rolling window
- Same insight type: 14-day minimum cooldown
- Deload type: 21-day minimum cooldown

**Related terms:** → silence rule, → delivery cadence, → consecutive-session gate

---

### Coaching Theater

**Type:** Noun (anti-pattern)

**Definition:** The practice of producing AI output that appears intelligent but contains no information not already visible to the user from their own data. Generic session summaries, motivational text dressed as analysis, and name-insertion personalisation are all coaching theater. Coaching theater erodes trust and trains users to ignore all AI output.

**Canonical term:** coaching theater

**Disallowed variants:**
- "AI theater" — deprecated; use "coaching theater"
- "generic AI" (as a description of the pattern) — too vague

**Related terms:** → specificity test, → coaching insight

---

### Specificity Test

**Type:** Noun (quality gate)

**Definition:** The test applied to every candidate coaching insight before delivery: "Could this exact message have been sent to any other user of the app, using different data, and produced an identical message?" If yes, the insight fails the specificity test and must not be delivered.

**Allowed usage:** "The message failed the specificity test — it contained no reference to the user's actual training data."

**Related terms:** → coaching theater, → coaching insight

---

### Hold (Progression Decision)

**Type:** Noun, Verb (in context of progression gating)

**Definition:** A progression decision outcome where the system has enough data to evaluate the exercise but conditions indicate a load increase is not appropriate at this time. Hold is always silent to the user — no message is shown explaining the hold.

**Canonical term:** `hold` (as a `ProgressionRecommendation` enum value)

**Allowed usage:**
- "The system returned hold due to a failed set." — correct (internal/developer context)
- Never: display the word "hold" to the user

**Disallowed variants:**
- "hold the load" — use "hold" as a noun: "returned a hold decision"
- "maintain load" — ambiguous (implies a deliberate choice; hold implies a gate)

**Related terms:** → progression decision, → silence (when there is insufficient data, the result is `'silent'`, not `'hold'`)

---

### Coaching Action

**Type:** Noun | **Code identifier:** `CoachingAction` (future type, not yet implemented)

**Definition:** A structured, typed value representing a specific intervention the AI coaching system has decided is warranted. Coaching actions are the output of the intelligence layer and the input to the delivery layer. In MVP, coaching actions are implicit in the insight types; the formal `CoachingAction` type system is future work.

**MVP insight types that will become formal coaching actions:**
`personal_record`, `plateau_detected`, `session_volume_peak`, `return_after_gap`, `progression_ready` (future), `deload_recommended` (future)

**Related terms:** → coaching insight, → intelligence layer

---

### Deload Recommendation

**Type:** Noun | **Code identifier:** `deload_recommended` (future insight type)

**Definition:** A coaching insight that recommends the user reduce training load for a period (typically one week) to allow recovery and enable a subsequent performance gain. Always framed as a performance strategy, never as rest or recovery language.

**Canonical framing:** "Your volume load has been above your 4-week average for 11 days. A lighter week now typically leads to a stronger one after." Not: "You seem tired. Make sure to rest."

**Canonical term:** deload recommendation

**Disallowed variants:**
- "rest recommendation" — do not use; deloads reduce load, they do not prescribe rest
- "rest week" — deprecated; use "deload" or "lighter week"
- "recovery recommendation" — too vague
- "take time off" — prohibited framing

**Deload parameters:** reduce load 40–50%, maintain movement patterns, maintain frequency.

**Related terms:** → fatigue signal, → ACWR, → coaching insight

---

## 2. Progression Terms

---

### Double Progression

**Type:** Noun (training model)

**Definition:** The progression model used for all weighted exercises with a defined rep range in GAINER. It has two phases: (1) rep accumulation — the user works at a fixed load, increasing reps within the target range across sessions; (2) load increment — once the rep ceiling is reached consistently, load increases and reps reset to the bottom of the range.

**Example:** Target 3×8–12 reps. User trains at 60 kg until all three sets reach 12 reps. Then load increases to 62.5 kg and reps reset toward 8.

**Canonical term:** double progression

**Allowed usage:** "GAINER uses double progression for all weighted exercises with defined rep ranges."

**Disallowed variants:**
- "linear progression" — too generic; double progression is a specific model
- "rep-then-weight" — informal, not canonical

**Related terms:** → rep ceiling, → load increment, → progressionReady (session state)

---

### Rep Ceiling

**Type:** Noun | **Code identifier:** `repMax` (on `ExerciseTemplate`)

**Definition:** The upper bound of a set's target rep range. In the double progression model, reaching the rep ceiling on all target working sets in a session is the trigger condition for a potential load increment. "Clearing the rep ceiling" means every working set completed at or above `repMax` reps.

**Canonical term:** rep ceiling (in all prose documents)

**Code canonical term:** `repMax` (in TypeScript, matching the existing field on `ExerciseTemplate`)

**Allowed usage:**
- "All working sets must reach the rep ceiling before a load increment is suggested." — correct
- "The user cleared the rep ceiling on two of three sets." — correct
- In code: `template.repMax` — correct

**Disallowed variants:**
- "top of rep range" — deprecated; use "rep ceiling"
- "upper rep range" — deprecated; use "rep ceiling"
- "repsMax" (in prose) — use "rep ceiling" in prose, `repMax` in code
- "maximum reps" — ambiguous (could mean the user's physical max, not the target ceiling)

**Related terms:** → double progression, → load increment, → progressionReady (session state)

---

### Rep Floor

**Type:** Noun | **Code identifier:** `repMin` (on `ExerciseTemplate`)

**Definition:** The lower bound of a set's target rep range. After a load increment, the user is expected to train toward the rep floor at the new load before building toward the rep ceiling again.

**Canonical term:** rep floor (in all prose documents)

**Code canonical term:** `repMin`

**Disallowed variants:**
- "minimum reps" — ambiguous
- "bottom of rep range" — acceptable but non-canonical; prefer "rep floor"

**Related terms:** → rep ceiling, → double progression

---

### progressionReady (Session State)

**Type:** Boolean property of a completed session, evaluated per exercise

**Definition:** A session is `progressionReady` for a given exercise when all of the following are true: (1) all target working sets were completed, (2) all completed working sets reached the rep ceiling, (3) no working set had outcome `'failed'` or status `'skipped'`, (4) session completion rate ≥ 80%.

**Canonical term:** `progressionReady` (session state) — lowerCamelCase in code and technical prose

**Allowed usage:**
- "Session 4 was progressionReady for bench press." — correct (technical prose)
- "Two consecutive progressionReady sessions triggered the load increment." — correct

**Disallowed variants:**
- "progression-ready session" — hyphenated form not canonical
- "progression readiness" — use "progressionReady" as a property, not "readiness" as a concept
- "ready to progress" — informal; use "progressionReady" in technical contexts

**Related terms:** → rep ceiling, → double progression, → load increment, → `progression_ready` (insight type — different concept)

---

### `progression_ready` (Insight Type)

**Type:** Enum value (future coaching insight type) | **Code identifier:** `'progression_ready'`

**Definition:** A post-session coaching insight type that communicates to the user that a specific exercise is ready for a load increment. Distinct from the session-level `progressionReady` state (which is an internal computation) — this is the user-visible delivery of that finding.

**Status:** 🔜 **Future — excluded from MVP.** See `post-session-single-insight-mvp.md`. When built: applies 0.80 confidence threshold (see `ai-trust-system.md` §6) and follows gate logic in `progression-gating-rules.md`.

**Canonical term:** `progression_ready` — snake_case, matching the naming convention of other insight type values

**Disallowed variants:**
- "progression insight" — too vague
- `progressionReady` (as an insight type) — camelCase form reserved for the session state

**Note on separation:** `progressionReady` (session state, internal) and `progression_ready` (insight type, user-visible) are distinct concepts. The session state is an input to the intelligence layer; the insight type is an output from the delivery layer.

**Related terms:** → progressionReady (session state), → coaching insight, → load increment

---

### Load Increment

**Type:** Noun | **Code identifier:** `suggestedWeightKg` field on `ProgressionGatingResult`

**Definition:** The specific amount by which load increases when a progressionReady threshold is met. Load increments are conservative by design — undershooting is preferred over overshooting.

**Canonical values (MVP):**
- `beginner` level: +2.5 kg / +5 lb
- `intermediate` and `advanced` levels: +1.25 kg / +2.5 lb

**Rounding:** nearest 0.25 kg; nearest 0.5 lb

**Canonical term:** load increment

**Allowed usage:** "The system suggests a load increment of 2.5 kg." — correct

**Disallowed variants:**
- "weight increase" — too informal; use "load increment"
- "load increase" — acceptable but prefer "load increment" for precision
- "add weight" — informal command form; not canonical in documentation

**Related terms:** → double progression, → progressionReady (session state), → progression decision

---

### Progression Decision

**Type:** Noun | **Code identifier:** `ProgressionGatingResult`

**Definition:** The output of `evaluateProgressionGating()`. One of three values: `'progress'` (load increment recommended), `'hold'` (enough data but conditions not met), or `'silent'` (insufficient data to evaluate).

**Canonical values:** `'progress'` | `'hold'` | `'silent'`

**Canonical term:** progression decision

**Related terms:** → hold, → silence, → load increment, → progression gating

---

### Progression Gating

**Type:** Noun (process)

**Definition:** The rule-based evaluation process that determines whether to recommend a load increment, hold load, or stay silent for a given exercise. Defined fully in `progression-gating-rules.md`.

**Canonical term:** progression gating

**Related terms:** → progression decision, → hold, → silence rule

---

### Plateau

**Type:** Noun | **Code identifier:** `PlateauResult` (in `progressionAnalyzer.ts`)

**Definition:** A state in which the top-set weight for a given exercise has not increased across 3 or more consecutive sessions. A plateau is detected by the signal layer and may surface as a `plateau_detected` coaching insight.

**Plateau types (for diagnostic purposes):**
- **Fatigue plateau** — ACWR elevated; performance declining across multiple exercises. Deload first; do not change the exercise.
- **True strength plateau** — ACWR normal, completion rate adequate, same weight/reps for 4+ sessions. Rep range shift, tempo variation, or patient accumulation.
- **Motivational plateau** — completion rate declining, shorter sessions, no fatigue signal. Program variation or goal reframe.

**Canonical term:** plateau

**Disallowed variants:**
- "stagnation" — acceptable informally but non-canonical
- "stuck" — informal
- "hitting a wall" — informal metaphor, not for technical docs

**Related terms:** → `plateau_detected`, → fatigue signal, → deload recommendation

---

## 3. Fatigue and Recovery Terms

---

### Fatigue Signal

**Type:** Enum | **Code identifier:** `FatigueSignal = 'normal' | 'elevated' | 'high'`

**Definition:** A three-level classification of the user's estimated fatigue state, computed from ACWR and session quality proxy signals. The fatigue signal is an input to the progression gating function and the coaching intelligence layer.

**Canonical enum values:**

| Value | ACWR range | Session proxy |
|---|---|---|
| `'normal'` | Below 1.3 | Completion rate ≥ 80% across recent sessions |
| `'elevated'` | 1.3 – 1.5 | Completion rate 65–80% for 2 consecutive sessions, or 1–2 exercises skipped |
| `'high'` | Above 1.5 | Completion rate < 65% for 2 consecutive sessions, or 3+ exercises skipped |

**Canonical term:** fatigue signal (prose), `FatigueSignal` (code), `fatigueSignal` (field name)

**Allowed usage:** "The fatigue signal is `'elevated'`, so the progression gate returns hold." — correct

**Disallowed variants:**
- "fatigue state" — deprecated; use "fatigue signal"
- "overtraining" (as a coaching-layer term) — deprecated; use "fatigue signal `'high'`" for implementation precision. "Overtraining" is a clinical term outside GAINER's scope.
- "fatigue level" — acceptable but non-canonical; use "fatigue signal"

**Related terms:** → ACWR, → hold (progression decision), → deload recommendation

---

### ACWR (Acute:Chronic Workload Ratio)

**Type:** Noun (metric) | **Abbreviation:** ACWR

**Definition:** The ratio of recent training load (acute: typically last 7 days) to longer-term average training load (chronic: typically last 28 days). ACWR is the primary input to the fatigue signal computation. Values above 1.3 indicate elevated fatigue risk; values above 1.5 indicate high fatigue risk.

**Canonical term:** ACWR (all caps, no periods). Full form: "Acute:Chronic Workload Ratio" — spell out on first use in any document.

**Threshold ownership:** `progression-gating-rules.md` §7 owns all ACWR threshold values. Do not define ACWR thresholds in other documents — reference this document instead.

**Disallowed variants:**
- "acute:chronic ratio" — missing the abbreviation; use ACWR after first definition
- "workload ratio" — ambiguous

**Related terms:** → fatigue signal, → deload recommendation

---

### Deload

**Type:** Noun, Verb

**Definition:** A period of reduced training load — typically one week — intended to allow recovery and precede a performance gain. In GAINER, deload is always framed as a performance strategy, not as rest. Deload parameters: reduce load 40–50%, maintain movement patterns, maintain frequency.

**Canonical term:** deload

**Allowed usage:** "The system recommends a deload." "The user is in a deload week." — correct

**Disallowed variants:**
- "rest week" — does not distinguish deload (reduced load, training continues) from complete rest
- "recovery week" — acceptable informally but non-canonical
- "easy week" — too informal

**Related terms:** → deload recommendation, → fatigue signal, → ACWR

---

## 4. Session and Performance Terms

---

### Completion Rate

**Type:** Noun (metric) | **Code identifier:** `completionRate` (lowerCamelCase)

**Definition:** The ratio of working sets completed to working sets planned in a given session. Computed as: `setsCompleted / targetSetsForSession`. A session with 3 of 4 planned working sets completed has a completion rate of 0.75 (75%).

**Canonical term:** completion rate (prose), `completionRate` (code)

**Threshold usage:**
- Below 70%: silence rule in post-session insight computation
- Below 80%: hold condition in progression gating (T12)

**Disallowed variants:**
- "session completion" — too vague
- "sets completed" (as a rate) — this is the count, not the ratio; use "completion rate" for the ratio

**Important distinction from session quality score:** completion rate is one component of a future composite `sessionQualityScore`. They are not synonymous. Do not use "session quality" when "completion rate" is what is meant.

**Related terms:** → session quality score, → working set, → silence rule, → hold (progression decision)

---

### Session Quality Score

**Type:** Noun (future metric) | **Code identifier:** `sessionQualityScore` (future, not yet implemented)

**Definition:** A future composite score representing the overall quality of a training session, incorporating completion rate, effort ratings, substitution count, and other signals. Not yet implemented — only completion rate is used in MVP.

**Status:** 🔜 Future. In MVP, use "completion rate" for the specific metric. Do not use "session quality score" when completion rate is meant.

**Canonical term:** session quality score (prose), `sessionQualityScore` (code)

**Disallowed variants:**
- Using "session quality score" interchangeably with "completion rate" — they are different. Completion rate is one input to the future composite score.
- "session quality" unqualified — always specify "completion rate" or "session quality score" depending on which is meant

**Related terms:** → completion rate

---

### Working Set

**Type:** Noun | **Code identifier:** `kind: 'working'` on `ExerciseLogSet`

**Definition:** A set performed at the user's working load, as opposed to a warmup set or drop set. Working sets are the sets used in all progression calculations, plateau detection, and completion rate computation. In code, a working set has `kind === 'working'`.

**Canonical term:** working set

**Disallowed variants:**
- "main set" — non-canonical
- "training set" — non-canonical

**Related terms:** → warmup set, → drop set, → completion rate, → progressionReady (session state)

---

### Warmup Set

**Type:** Noun | **Code identifier:** `kind: 'warmup'` on `ExerciseLogSet`

**Definition:** A set performed below working load to prepare for the working sets. Warmup sets are excluded from all progression calculations and completion rate computation.

**Canonical term:** warmup set

---

### Drop Set

**Type:** Noun | **Code identifier:** `kind: 'drop'` on `ExerciseLogSet`

**Definition:** A set performed at a reduced load immediately after a working set, without rest. Drop sets are excluded from standard progression calculations.

**Canonical term:** drop set

---

### Set Outcome

**Type:** Enum | **Code identifier:** `ExerciseSetOutcome = 'completed' | 'failed' | 'skipped'`

**Definition:** The result of an individual set. `'completed'` means the set was performed to the user's satisfaction. `'failed'` means the user attempted the set but could not complete the target reps. `'skipped'` means the set was not attempted.

**Note on progression gating:** Any set with `outcome === 'failed'` in the most recent session causes a hold decision, regardless of other conditions (trigger rule T6).

**Canonical term:** set outcome

**Related terms:** → working set, → hold (progression decision)

---

### Top-Set Weight

**Type:** Noun (metric)

**Definition:** The highest weight lifted in any working set during a given session for a specific exercise. Used in plateau detection: three consecutive sessions at the same top-set weight constitute a plateau signal.

**Canonical term:** top-set weight

**Allowed usage:** "The top-set weight for squat has been 80 kg for three consecutive sessions." — correct

**Disallowed variants:**
- "working weight" — ambiguous (could mean any weight used in the session)
- "peak weight" — non-canonical

**Related terms:** → plateau, → working set

---

### Volume Load

**Type:** Noun (metric)

**Definition:** The total mechanical work performed in a session or block, computed as the sum of (weight × reps) across all completed working sets. Used in session volume peak detection and ACWR computation.

**Canonical term:** volume load

**Allowed usage:** "Session volume load exceeded the 6-week average." — correct

**Disallowed variants:**
- "total volume" — acceptable but less precise; volume load implies the weight-reps product specifically
- "training volume" — too broad (could include exercise count, set count, etc.)

**Related terms:** → ACWR, → `session_volume_peak`

---

### Personal Record (PR)

**Type:** Noun | **Code identifier:** `'personal_record'` (insight type)

**Definition:** A new best performance by the user on a specific exercise, detected by comparing the current session's top-set volume (weight × reps) against all prior sessions for that exercise. PRs are detected with at least 2 prior sessions of data for the exercise.

**Canonical term:** personal record; abbreviation: PR

**Insight type code value:** `'personal_record'` (snake_case, matching other insight type values)

**Disallowed variants:**
- "new best" — acceptable in user-facing copy but not in technical documentation
- "PB" (personal best) — non-canonical; use PR

**Related terms:** → coaching insight, → `personal_record` (insight type), → top-set weight

---

### Return After Gap

**Type:** Noun (insight trigger) | **Code identifier:** `'return_after_gap'` (insight type)

**Definition:** A session that occurs 7 or more days after the user's previous completed session. The return-after-gap insight type acknowledges the user's return neutrally, without pressure framing.

**Gap threshold:** ≥ 7 calendar days since previous session.

**Canonical framing:** "First session back in 9 days. Good start." Not: "Welcome back! We missed you!"

**Canonical term:** return after gap (prose), `'return_after_gap'` (code)

**Disallowed variants:**
- "comeback session" — informal
- "re-engagement" — has manipulative connotations; not used in coaching context

**Related terms:** → coaching insight, → gap-return silence rule

---

## 5. Onboarding and Profile Terms

---

### UserFitnessProfile

**Type:** Interface | **Code identifier:** `UserFitnessProfile` (in `src/types/coaching.ts`)

**Definition:** A derived, typed view over `AppPreferences` that represents who the user is in coaching-relevant terms. Built by `buildUserFitnessProfile(prefs: AppPreferences)`. Contains: level, primary/secondary goals, equipment, daysPerWeek, weeklyMinutes, focusAreas, trainingFeel, joint sensitivity flags, bodyweight context, unit preference.

**Key property:** `UserFitnessProfile` is derived — it is never stored separately. `AppPreferences` is the source of truth; the profile is recomputed on demand.

**Canonical term:** `UserFitnessProfile` (PascalCase, always this exact identifier in code and technical prose)

**Related terms:** → `AppPreferences`, → progressive profiling

---

### AppPreferences

**Type:** Interface | **Code identifier:** `AppPreferences` (in `src/types/models.ts`)

**Definition:** The flat record stored in `AppDatabase` that contains all user-editable preferences, setup choices, and lightweight coaching state. The single source of truth for the user's current profile and settings. `UserFitnessProfile` is derived from it.

**Canonical term:** `AppPreferences`

**Related terms:** → `UserFitnessProfile`, → `AppDatabase`

---

### Progressive Profiling

**Type:** Noun (design pattern)

**Definition:** The practice of collecting additional user information at the moment it becomes relevant to the product's recommendations, rather than upfront during onboarding. GAINER collects only what it can immediately use, then adds context over time as features require it.

**Onboarding data (collected day 1):** goal, level, equipment, days per week, (optionally) focus areas.

**Deferred data (collected contextually):** joint sensitivity (first time user substitutes an exercise), preferred training days (inferred from patterns), coaching style preference (inferred from response to early insights).

**Canonical term:** progressive profiling

**Disallowed variants:**
- "delayed data collection" — misses the contextual trigger concept
- "incremental onboarding" — non-canonical

**Related terms:** → `UserFitnessProfile`, → `AppPreferences`

---

### Training Feel Preference

**Type:** Enum | **Code identifier:** `TrainingFeelPreference = 'easy' | 'steady' | 'challenging' | 'intense'`

**Definition:** The user's stated preference for how hard their sessions should feel. One of four values. Used in program recommendation scoring and, in future, in coaching tone calibration.

**Canonical term:** training feel preference (prose), `TrainingFeelPreference` (code), `trainingFeel` (field)

**Disallowed variants:**
- "intensity preference" — confuses intensity (load-based) with feel (RPE-based)
- "effort preference" — non-canonical

---

### Joint Sensitivity Flag

**Type:** Noun | **Code identifiers:** `setupShoulderFriendlySwaps`, `setupElbowFriendlySwaps`, `setupKneeFriendlySwaps` on `AppPreferences`; mapped to `shoulderFriendly`, `elbowFriendly`, `kneeFriendly` booleans on `UserFitnessProfile`

**Definition:** A flag indicating that the user prefers exercise substitutions that avoid loading a specific joint. Set during onboarding (optionally) or when the user first substitutes an exercise. Used in exercise substitution filtering.

**Canonical term:** joint sensitivity flag (prose)

**Disallowed variants:**
- "injury flag" — implies a diagnosed injury; joint sensitivity is a preference, not a clinical designation
- "joint preference" — too vague

---

### Profile Completeness

**Type:** Concept — PROHIBITED

**Definition:** A "profile completeness" percentage or indicator suggesting the user's profile is incomplete until they have answered every possible question. This concept is explicitly prohibited in GAINER.

**Why prohibited:** Implies the user has not done enough. Pressures users to provide data the product cannot yet use. Contradicts the progressive profiling philosophy.

**Canonical alternative:** Progressive profiling — data is collected when relevant, not to reach a completeness score.

---

## 6. Adherence and Retention Terms

---

### Adherence

**Type:** Noun (metric concept)

**Definition:** The ratio of sessions completed to sessions planned over a given period. A user who planned 3 sessions per week and completed 3 has 100% adherence; a user who completed 2 has 67% adherence.

**Canonical term:** adherence

**Disallowed variants:**
- "compliance" — clinical term with negative connotations
- "consistency" — related but distinct (consistency describes pattern regularity; adherence describes plan completion rate)

**Related terms:** → consistency score, → `AdherenceRecord` (future)

---

### Consistency Score

**Type:** Noun (metric) | **Code identifier:** `consistencyScore` (future)

**Definition:** A rolling measure of training regularity over a lookback window, independent of whether sessions matched a specific plan. A user who trains 3 times per week, every week, is consistent even if they have no formal plan.

**Canonical term:** consistency score

**Distinction from adherence:** Adherence measures plan-vs-actual. Consistency measures pattern regularity regardless of plan.

**Related terms:** → adherence

---

### Training Gap

**Type:** Noun

**Definition:** A period of 7 or more calendar days between two completed sessions. A training gap triggers the `'return_after_gap'` coaching insight type on the first session following the gap.

**Canonical term:** training gap

**Related terms:** → return after gap, → `'return_after_gap'`

---

### Intrinsic Motivation

**Type:** Noun (retention concept)

**Definition:** Motivation to train that comes from the training itself — strength progress, physical competence, consistency pride, the habit of training. Intrinsic motivation compounds over time and survives motivation troughs that would end extrinsically-motivated behaviour.

**Canonical term:** intrinsic motivation

**Contrasted with:** extrinsic motivation (points, badges, streaks, social comparison) — which is finite and diminishes as novelty fades.

**Related terms:** → extrinsic motivation, → identity-based retention

---

### Extrinsic Motivation

**Type:** Noun (retention concept)

**Definition:** Motivation to train generated by external rewards — points, badges, streaks, leaderboards, social comparison, app-manufactured urgency. Acceptable in limited, honest forms (streak counts reflecting genuine consistency). Prohibited when manufactured to create false achievement signals.

**Canonical term:** extrinsic motivation

**Related terms:** → intrinsic motivation, → gamification (prohibited concept)

---

### Identity-Based Retention

**Type:** Noun (retention concept)

**Definition:** The most durable form of retention: a user who thinks of themselves as "someone who trains" rather than "someone trying to get fit." Identity-based retention survives life disruption because training is part of who the user is, not a goal they are pursuing.

**Canonical term:** identity-based retention

**Related terms:** → intrinsic motivation, → healthy retention

---

### Healthy Retention

**Type:** Noun (design principle)

**Definition:** Retention that keeps users in the product by delivering genuine, compounding value. The user stays because the product is useful and improves over time — not because leaving has been engineered to feel costly. Healthy retention is the only acceptable retention model in GAINER.

**Contrasted with:** manipulative retention — using loss aversion, guilt, social pressure, or streak mechanics to keep users from leaving.

**Canonical term:** healthy retention

**Related terms:** → manipulative retention, → identity-based retention

---

### Manipulative Retention

**Type:** Noun (anti-pattern)

**Definition:** Retention mechanics that exploit psychological vulnerabilities to prevent users from leaving — loss aversion, guilt, fear of missing out, streak pressure, false urgency, re-engagement guilt ("we miss you"). Explicitly prohibited in GAINER.

**Canonical term:** manipulative retention

**Disallowed patterns:** streak countdowns, "don't lose your progress" language, re-engagement notifications, competitive comparison, artificial urgency on pricing.

**Related terms:** → healthy retention, → gamification

---

## 7. Architecture Terms

---

### Five-Layer Coaching Architecture

**Type:** Noun (system design)

**Definition:** The layered architecture of GAINER's AI coaching system. Five layers, each with a single responsibility, where lower layers never depend on higher ones.

**Canonical layer names (bottom to top):**

| Layer | Responsibility |
|---|---|
| `PROFILE` | Who the user is: goals, constraints, preferences |
| `MEMORY` | Tiered history: session → recent → block → lifetime |
| `SIGNAL` | Performance signals computed from raw log data |
| `INTELLIGENCE` | Progression logic, fatigue assessment, coaching decisions |
| `DELIVERY` | Coaching insights, recommendations, UI signals, silence |

**Canonical source:** `system-architecture.md` §2 and §4. `coaching-architecture.md` references this; it does not define it.

---

### Profile Layer

**Type:** Architecture layer

**Definition:** The bottom layer of the coaching stack. Owns `UserFitnessProfile` and the derivation logic from `AppPreferences`. Answers: "Who is this user?"

**Canonical term:** Profile layer

---

### Memory Layer

**Type:** Architecture layer

**Definition:** The second layer. Owns tiered history and context assembly for AI calls. Does not compute signals — provides structured access to raw history for the signal layer.

**Canonical term:** memory layer (also: context layer, acceptable synonym)

---

### Signal Layer

**Type:** Architecture layer

**Definition:** The third layer. Computes derived facts from raw log data — plateaus, PRs, volume trends, fatigue indicators. Signals are always recomputable from source data; they are never stored permanently.

**Canonical term:** signal layer

---

### Intelligence Layer

**Type:** Architecture layer

**Definition:** The fourth layer. Interprets signals and makes coaching decisions. Uses rules and heuristics first; LLM only for natural language generation. The intelligence layer decides whether to speak and what to say — the LLM renders the language.

**Canonical term:** intelligence layer

---

### Delivery Layer

**Type:** Architecture layer

**Definition:** The top layer. Converts coaching decisions into user-visible output or silence. Owns timing, placement, and frequency of all coaching surfaces.

**Canonical term:** delivery layer

---

### Local-First

**Type:** Design principle (adjective)

**Definition:** The architectural commitment that the device is the primary data store and source of truth. The server, when it exists, is a backup and sync mechanism — not the authoritative store. The app functions fully without a network connection.

**Canonical term:** local-first

**Disallowed variants:**
- "offline-capable" — implies the device is a cache for the server; local-first inverts this
- "offline-first" — acceptable synonym; but local-first is preferred as it describes the data ownership model, not just the connectivity model

---

### Offline-First

**Type:** Design principle (adjective)

**Definition:** The operational guarantee that every core feature (workout logging, session history, program following, coaching insights) works without a network connection. Accepted synonym for local-first in contexts emphasising the user experience of connectivity failure.

**Canonical term:** offline-first (acceptable alongside local-first)

---

### Append-Only Logging

**Type:** Design principle (noun phrase)

**Definition:** The rule that `WorkoutSession` and `ExerciseLog` records are never edited or deleted after being saved. All historical data is immutable. Derived signals (plateaus, PRs, progression state) are always recomputable from the immutable log.

**Canonical term:** append-only logging

**Disallowed variants:**
- "immutable logs" — correct concept but non-canonical phrase
- "read-only history" — misleading (new records are written; existing ones are immutable)

---

### Derived Value

**Type:** Noun (architecture concept)

**Definition:** A value computed from source data on demand, rather than stored independently. `UserFitnessProfile` is a derived value (computed from `AppPreferences`). Performance signals are derived values (computed from `exerciseLogs`). Derived values are never stored as the primary record alongside their source — doing so creates synchronisation problems.

**Canonical term:** derived value

**Related terms:** → source of truth, → pure function

---

### Source of Truth

**Type:** Noun (architecture concept)

**Definition:** The single authoritative location for a given data type. When the source of truth and a copy of that data differ, the source of truth is correct. Each data type in GAINER has exactly one source of truth.

**Source-of-truth table:**

| Data | Source of truth |
|---|---|
| User preferences and coaching state | `AppPreferences` in `AppDatabase` |
| Session history | `workoutSessions` in `AppDatabase` |
| Exercise history | `exerciseLogs` in `AppDatabase` |
| Exercise library | `generatedExerciseLibrary.ts` (static, re-seeded on load) |
| Ready programs | `workoutCatalog.ts` (static, immutable at runtime) |
| Live workout state | `WorkoutProvider` (`@gymlog/workout/v1`) |
| `UserFitnessProfile` | Derived from `AppPreferences` — not stored |
| Performance signals | Derived from `exerciseLogs` — not stored |

**Canonical term:** source of truth

---

### Pure Function

**Type:** Noun (architecture constraint)

**Definition:** A function in `src/lib/` that has no side effects, no storage access, no network calls, and no React dependencies. Given the same inputs, always returns the same output. All domain logic in GAINER must be implemented as pure functions. Testable in Node without a running app.

**Canonical term:** pure function

**Related terms:** → `src/lib/` (the pure function layer)

---

## 8. Confidence and Trust Terms

---

### Confidence Score

**Type:** Noun (metric) | **Code identifier:** `confidence: number` field on result types

**Definition:** A numeric value between 0 and 1 representing the system's certainty that a potential coaching insight is accurate and appropriate to deliver. Computed per candidate insight from data quality, signal strength, and profile context. Never shown to the user.

**Canonical term:** confidence score

**Disallowed variants:**
- "confidence level" — acceptable but prefer "confidence score" for precision
- "certainty score" — non-canonical
- "probability" — GAINER's confidence scoring is not a probabilistic model; prefer "confidence score"

**Related terms:** → confidence threshold, → confidence gate

---

### Confidence Threshold

**Type:** Noun (gate value)

**Definition:** The minimum confidence score required for a coaching insight to be delivered. Insights with confidence below the threshold produce silence.

**MVP threshold:** Universal 0.75 for all post-session insight types — owned by `post-session-single-insight-mvp.md`.

**Future per-type thresholds (not yet active):** defined in `ai-trust-system.md` §6.

**Future phase-based thresholds (not yet active):** defined in `system-architecture.md` §11.

**Canonical term:** confidence threshold

**Disallowed variants:**
- "minimum confidence" — acceptable but prefer "confidence threshold"
- "confidence gate" — this describes the mechanism; "confidence threshold" names the value

**Related terms:** → confidence score, → confidence gate, → silence rule

---

### Confidence Gate

**Type:** Noun (mechanism)

**Definition:** The architectural check that compares a candidate insight's confidence score against the confidence threshold. If confidence < threshold, the gate blocks delivery and produces silence. The confidence gate is evaluated after silence rules and before delivery.

**Canonical term:** confidence gate

**Related terms:** → confidence score, → confidence threshold, → silence rule

---

### Trust

**Type:** Noun (user experience concept)

**Definition:** The user's belief that the AI coaching system is watching their data, is right when it speaks, and is on their side. Trust is built through specificity, restraint, accuracy, and demonstrated memory. It is lost through generic advice, wrong recommendations, and over-messaging. Trust is a user experience outcome, not a system property.

**Distinguished from earned authority:** Earned authority is the system's capability level (a function of data volume). Trust is the user's perception. A system can have earned authority without the user trusting it (if early outputs were wrong). A user can trust a system before it has full authority (if early outputs were right despite limited data).

**Canonical term:** trust

**Related terms:** → earned authority, → specificity test, → coaching theater

---

## 9. UX Terms

---

### Workout-Flow-First

**Type:** Design principle (adjective)

**Definition:** The UX principle that the workout logging screen is the most important surface in the app, and every other screen exists in service of it. Design decisions are evaluated against: "does this help the user train, or does it help the app look impressive?"

**Canonical term:** workout-flow-first

**Related terms:** → single-focus rule

---

### Single-Focus Rule

**Type:** Design principle (noun phrase)

**Definition:** At any point in the application, there should be one primary thing the user is expected to do. The interface communicates that one thing clearly. Everything else is either hidden, de-emphasised, or absent.

**Canonical term:** single-focus rule

**Related terms:** → workout-flow-first, → information density

---

### Information Density

**Type:** Noun (UX concept)

**Definition:** The amount of information displayed on a screen, calibrated to what the user needs to accomplish the current task. Correct information density varies by context: minimum during a workout session, more on the progress screen, one primary recommendation on the home screen.

**Canonical term:** information density

---

### Gamification

**Type:** Noun (anti-pattern in GAINER context)

**Definition:** The use of game mechanics — points, badges, leaderboards, achievement sequences — in a non-game context to drive engagement. In GAINER, gamification that manufactures false achievement signals is explicitly prohibited. Gamification that acknowledges genuine achievements (PRs, meaningful milestones, genuine consistency records) is acceptable in limited form.

**Canonical term:** gamification

**Canonical prohibition list:** See `gainer-philosophy.md` Anti-Bloat Principles — this is the authoritative source.

**Acceptable forms:** streak counts (genuine consistency, displayed neutrally), PR notation, meaningful milestone acknowledgment.

**Prohibited forms:** XP/points/coins, achievement badges for routine actions, leaderboards, confetti for non-achievements, level-up sequences, countdown urgency.

---

### Post-Session Completion Screen

**Type:** Noun (UI surface)

**Definition:** The screen shown to the user after a workout session is saved successfully. The only surface in MVP where coaching insights are rendered. A coaching insight appears here if one has cleared the confidence threshold; otherwise the screen reflects completion without coaching content.

**Canonical term:** post-session completion screen

**Disallowed variants:**
- "summary screen" — non-canonical
- "results screen" — non-canonical

**Related terms:** → coaching insight, → silence, → delivery layer

---

### In-Session

**Type:** Adjective (timing constraint)

**Definition:** The period during which a workout session is active — from the user's first set until `saveCompletedWorkoutSession` resolves. No coaching insights are surfaced in-session. This is an absolute rule, not a guideline.

**Canonical term:** in-session (hyphenated, used as an adjective)

**Rule:** No coaching output in-session. Ever. The insight computation function is not called while a session is active.

**Related terms:** → post-session completion screen, → delivery layer

---

### Calm vs Noisy UX

**Type:** Design spectrum (noun phrase)

**Definition:** The design quality axis that measures how many competing calls to action, indicators, animations, and notifications a screen contains. GAINER targets the calm end: one primary action, clear hierarchy, motion only when functional. Noisy UX has multiple competing elements, ambient animations, and unread indicators that do not require action.

**Canonical terms:** calm UX / noisy UX

---

## 10. Deprecated Terms Index

All terms listed here are deprecated. Use the canonical replacement.

| Deprecated term | Canonical replacement | Notes |
|---|---|---|
| Phase 1, Phase 2, Phase 3, Phase 4 (coaching) | `observation`, `emerging`, `active`, `trusted` | Always use session-count canonical names |
| weeks 1–4, months 3–6 (phase boundaries) | 0–6 sessions, 7–20 sessions, 21–60 sessions, 60+ sessions | Session count is authoritative |
| authority phase | coaching phase | |
| trust phase | coaching phase | |
| top of rep range | rep ceiling | |
| upper rep range | rep ceiling | |
| repsMax (prose) | rep ceiling (prose); `repMax` (code) | |
| session quality (as a synonym for completion rate) | completion rate | Distinguish from future session quality score |
| progression readiness | progressionReady (session state) | |
| progression-ready session | progressionReady session | No hyphen in canonical form |
| load increase | load increment | |
| push load | increase load | |
| hold the load | hold | Use as noun: "returned a hold decision" |
| fatigue state | fatigue signal | |
| overtraining (coaching context) | fatigue signal `'high'` | |
| rest recommendation | deload recommendation | |
| rest week | deload | |
| take time off | deload | |
| AI message | coaching insight | |
| coaching message | coaching insight | |
| insight message | coaching insight | |
| AI theater | coaching theater | |
| coaching cadence | delivery cadence | |
| back-to-back insights | consecutive-session insights | Gate is "consecutive-session gate" |
| no back-to-back rule | consecutive-session gate | |
| offline-capable | local-first or offline-first | |
| progressionStatus | progressionState | |
| profile completeness | (prohibited) | Do not use this concept at all |
| total volume (precise use) | volume load | When meaning weight × reps sum |
| working weight (imprecise) | top-set weight or working set load | Specify which is meant |
| PB (personal best) | PR (personal record) | |
| compliance (training) | adherence | |
| new best (technical docs) | personal record / PR | Acceptable in user-facing copy only |
| summary screen | post-session completion screen | |
| results screen | post-session completion screen | |
| fatigue level | fatigue signal | |
| minimum confidence | confidence threshold | |
| certainty score | confidence score | |
| intensity preference | training feel preference | |
| injury flag | joint sensitivity flag | |
| stagnation (technical) | plateau | |
| AI output (user-visible noun) | coaching insight | |
