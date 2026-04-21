# Gymlog Recommendation Engine Design

## Context

Gymlog already has four overlapping product surfaces that influence training choice:

- onboarding and first-run setup
- ready templates / ready plans
- custom template creation
- AI_COACH guidance

Right now those surfaces can recommend or explain training, but they do not yet form one coherent decision system. The next product step is not "more AI." It is a deterministic recommendation engine that can:

- understand what kind of training week fits the user
- recommend a template family and programme style that feel personally relevant
- preserve deterministic product logic instead of relying on free-form LLM generation
- keep AI out of template and programme recommendation itself
- let AI_COACH explain and later adapt within explicit guardrails as a separate premium layer

This design assumes Gymlog keeps supporting all current entry paths:

- start an empty workout
- build your own template
- choose ready templates / ready plans
- accept a recommendation from onboarding
- later use AI_COACH for explanation, comparison, and adaptation

## Problem Framing

The recommendation engine should answer a narrower question than "what exact workout should this person do forever?"

It should answer:

1. What weekly training structure is most likely to fit this user right now?
2. What 6-8 week programme style best matches their goal, schedule, recovery, equipment, and preferences?
3. How can Gymlog explain that recommendation in a way that feels tailored instead of generic?

The engine should not try to solve everything at once. In particular:

- it should not let AI invent arbitrary programmes outside the catalog
- it should not ask so many onboarding questions that users drop before they see value
- it should not blur template and programme into one object

## Assumptions

- Gymlog keeps its current distinction between ready programme content, custom templates, and AI_COACH surfaces.
- Existing onboarding data in `AppPreferences` remains the base input model, with selective expansion rather than a full rewrite.
- MVP recommendation works from a curated catalog of template families and variants, not free-form programme generation.
- Template and programme recommendation are not AI features and must work without AI access.
- AI_COACH can explain and safely adjust recommendations, but does not become the system of record for training logic.
- Recommendation output should be reusable in first run, AI coach, and later "change my plan" flows.

## Existing Product Anchors

This design is intentionally aligned with the current codebase:

- onboarding flow and first-run recommendation logic in `src/screens/OnboardingScreen.tsx` and `src/lib/firstRunSetup.ts`
- AI coach experience in `src/screens/AICoachScreen.tsx`, `src/lib/valluActions.ts`, and `src/lib/aiCoachPlan.ts`
- ready programme grouping and editorial presentation in `src/lib/readyProgramCollections.ts`, `src/lib/readyProgramContent.ts`, and `src/lib/templatePresentation.ts`
- premium direction in `docs/premium-adaptive-coach-plan.md`

## Domain Model

### Definitions

`Workout`
- A single logged training event.
- This is what the user completes in the logger.

`Session`
- A planned day inside a template or programme.
- Example: "Upper Heavy", "Lower Pump", "Full Body B".

`Split`
- The weekly rhythm or structural distribution of sessions.
- Example: 3-day full body, 4-day upper/lower, 4-day glute-biased split.

`Template`
- A reusable training structure that defines:
  - split
  - session archetypes
  - slot pattern
  - expected session count
- A template is stable enough to repeat, clone, and edit.
- A template is not yet a full 6-8 week progression block.

`Programme`
- A time-bounded training block built from a template.
- Includes:
  - progression rules
  - week-by-week structure
  - easier week / pivot / deload logic
  - goal-specific emphasis
- Default target length: 6 or 8 weeks.

`Template Family`
- A higher-level recommendation category used by the engine.
- Example: `mass_hypertrophy`, `powerbuilding`, `glute_priority`, `joint_friendly`.
- One family can contain multiple frequency and equipment variants.

`Recommendation Candidate`
- One concrete recommendation option produced by the engine:
  - template family
  - frequency variant
  - equipment variant
  - emphasis profile
  - programme profile

`AI_COACH`
- The premium conversational layer on top of the engine.
- It explains recommendations and later proposes guarded adjustments.
- It does not replace the recommendation engine.

### Ownership Boundaries

What the user chooses:

- start an empty workout
- create a custom template
- accept the primary recommendation
- choose one of the secondary alternatives
- ask AI_COACH for explanation or a guarded variation if premium is active

What the system recommends:

- the best-fit template family
- the best-fit days-per-week variant
- the best-fit programme profile
- two meaningful alternatives with different tradeoffs

This recommendation step is core product logic, not an AI feature.

What AI_COACH does:

- translates recommendation logic into human language
- explains tradeoffs
- proposes safe swaps inside policy boundaries

What AI_COACH does not do:

- invent uncataloged plans for first-run recommendation
- override hard constraints
- silently swap the user into a different family without re-ranking

## Product Principle

The recommendation should feel like:

> "This looks like the kind of training week and programme that fits me."

It should not feel like:

> "The app dropped me into a random generic plan list."

To achieve that, the recommendation needs three layers:

1. deterministic fit logic
2. editorially strong template families with clear identity
3. optional premium AI explanation that makes the fit legible without owning the decision

## Recommendation Architecture

### Recommended Approach

Use a hybrid model:

- curated template family catalog
- deterministic constraint filtering
- weighted scoring and ranking
- confidence layer
- optional AI_COACH explanation and limited premium adaptation

### Alternatives Considered

#### Option A: rules only

Pros:

- predictable
- easy to debug
- easy to test

Cons:

- can feel mechanical
- hard to express nuance in user-facing language

#### Option B: LLM-first plan generation

Pros:

- highly flexible
- sounds intelligent in demos

Cons:

- difficult to verify
- inconsistent quality
- creates product drift
- too risky for onboarding recommendations

#### Option C: hybrid catalog + scorer + AI explanation

Pros:

- deterministic and testable
- scalable editorial system
- can still feel personal
- keeps AI optional and premium without letting it become chaotic

Cons:

- requires up-front content modeling
- recommendation quality depends on catalog quality

Recommendation:

- choose Option C

## Onboarding Input Model

The onboarding model should collect only the information needed to improve fit. It should avoid broad lifestyle surveys that do not change the recommendation. These questions power core recommendation logic, not AI behavior.

### Input Categories

#### Hard constraints

These can disqualify or materially reshape a candidate.

1. `Primary goal`
- Question: "What is your main goal right now?"
- Options: `muscle`, `strength`, `general fitness`, `glute focus`, `body recomposition / fat-loss support`
- Why: defines the candidate pool and programme profile
- Required: yes
- Affects: family eligibility, progression profile, explanation copy

2. `Realistic training frequency`
- Question: "How many days per week do you realistically train?"
- Options: `2`, `3`, `4`, `5`
- Why: the strongest determinant of split viability
- Required: yes
- Affects: candidate filtering, session budget, adherence fit

3. `Typical session length`
- Question: "How much time do you usually have per session?"
- Options: `30`, `45`, `60`, `75+ minutes`
- Why: prevents recommending bloated weekly structures
- Required: yes
- Affects: session-volume budget, family filtering, confidence

4. `Equipment access`
- Question: "Where do you train most often?"
- Options: `full gym`, `basic gym`, `home dumbbells/bands`, `mixed`
- Why: determines equipment-compatible catalog variants
- Required: yes
- Affects: hard filter, swap rules, family ranking

5. `Movement limitations / pain constraints`
- Question: "Any movements or areas we should avoid or protect?"
- Options: structured tags plus optional text, such as `shoulder`, `knee`, `lower back`, `none`
- Why: essential for safety and wrong-fit avoidance
- Required: yes
- Affects: hard fail rules, joint-friendly reranking, allowed swap set

#### Soft preferences

These should shape ranking, not dominate it.

6. `Preferred training style`
- Question: "What style of training feels best to you?"
- Options: `heavy`, `pump`, `balanced`, `fast and efficient`
- Why: improves perceived relevance and adherence
- Required: yes
- Affects: style-fit scoring

7. `Focus area`
- Question: "Anything you want to emphasize more?"
- Options: `glutes`, `upper body`, `legs`, `balanced`
- Why: creates a visible sense of personalization
- Required: optional
- Affects: emphasis score, editorial messaging

8. `Exercise dislikes / avoid list`
- Question: "Any exercises you really do not want in the plan?"
- Input: tag list + free text
- Why: reduces fast rejection and manual swapping
- Required: optional
- Affects: penalty scoring, swap policy

#### Motivation / intent

9. `Progression appetite`
- Question: "Do you want the most sustainable plan, a balanced push, or an aggressive block?"
- Options: `sustainable`, `balanced`, `push hard`
- Why: helps choose progression aggressiveness and fatigue tolerance
- Required: yes
- Affects: programme intensity curve, easier-week sensitivity

10. `Decision style`
- Question: "Do you want one strong recommendation or a few options to compare?"
- Options: `pick one for me`, `show me top options`
- Why: improves presentation and confidence UX
- Required: optional
- Affects: result presentation

#### Experience / readiness

11. `Training experience`
- Question: "How experienced are you with structured lifting?"
- Options: `new`, `some routine`, `advanced`
- Why: sets complexity ceiling and overload style
- Required: yes
- Affects: family eligibility, progression pace, exercise stability

#### Recovery / lifestyle

12. `Current recovery quality`
- Question: "How well are you recovering in real life right now?"
- Options: `good`, `mixed`, `poor`
- Why: the same plan can be great or terrible depending on recovery
- Required: yes
- Affects: volume budget, deload sensitivity, recommendation confidence

### Questions to Avoid in MVP

Do not add questions unless they materially change ranking. Avoid these in the MVP recommendation flow:

- detailed body measurements
- long motivation essays
- broad nutrition questionnaires
- aesthetic micro-goals for every body part
- separate questions for every exercise category preference

Those can be useful later, but they will hurt completion if added too early.

## Scoring and Ranking Model

### Candidate Structure

Each candidate should be expressed as:

`template_family x frequency_variant x equipment_variant x emphasis_variant x programme_profile`

### Pipeline

1. Build the candidate pool from the family catalog.
2. Apply hard constraint filtering.
3. Score remaining candidates across weighted dimensions.
4. Sort by total score.
5. Compute confidence and recommendation framing.
6. Return:
   - one `primary recommendation`
   - two `secondary alternatives`

### Weighted Dimensions

| Dimension | Weight | Notes |
|---|---:|---|
| goal alignment | 30 | strongest signal |
| schedule/time fit | 20 | determines real-world usability |
| equipment fit | 15 | near-hard requirement |
| recovery fit | 10 | protects adherence and fatigue |
| experience fit | 10 | avoids over/under-complexity |
| style preference fit | 10 | drives user resonance |
| focus-area match | 5 | creates visible personalization |

### Hard Fail Conditions

A candidate should be excluded if:

- required equipment is unavailable
- expected session time is materially above the user's limit
- required movement pattern violates injury or limitation rules without a safe variant
- the candidate assumes training complexity inappropriate for the user's experience
- the candidate frequency conflicts with the user's stated realistic frequency

### Soft Penalties

Apply score penalties, not hard exclusion, for:

- moderate mismatch in style preference
- moderate mismatch in focus area
- disliked but swappable accessory patterns
- slightly optimistic recovery demand

### Recommendation Confidence

Confidence should be derived from:

- `input completeness`
- `score separation` between top candidates
- `constraint tightness` after filtering

Suggested interpretation:

- `high confidence`
  - required fields complete
  - top score clearly higher than next candidate
  - constraints and preferences point in the same direction

- `medium confidence`
  - recommendation is good, but nearby alternatives are still viable

- `low confidence`
  - top three are very close
  - user inputs are conflicting or incomplete
  - significant limitations narrow options without a clear best fit

### "We are not sure" Case

The engine should explicitly present top three options when:

- top candidates are tightly clustered
- the user gave conflicting goals and limitations
- recovery is low and desired intensity is high
- the user asked to compare options

This is a feature, not a failure. False certainty is worse than honest ambiguity.

## Template Family Catalog

The catalog should be small enough to maintain editorial quality and large enough to cover meaningful user differences.

### Family 1: `mass_hypertrophy`

- User-facing name: `Size Mode`
- Subtitle: `Build muscle with a repeatable weekly rhythm that does not waste effort.`
- Best for:
  - muscle-focused users
  - 3-5 day schedules
  - users with reasonable gym access and recovery
- Not for:
  - severe time limits
  - strict strength-first goals
- Typical split:
  - 4-day upper/lower or 5-day hybrid
- Progression character:
  - volume-first, reps then load
- Distinguishing trait:
  - strongest default hypertrophy family

### Family 2: `powerbuilding`

- User-facing name: `Heavy + Pump`
- Subtitle: `Heavy anchors early, bodybuilding volume after.`
- Best for:
  - users who want stronger lifts and better physique
  - intermediate users
- Not for:
  - most beginners
  - poor recovery phases
- Typical split:
  - 4-day heavy/volume upper-lower
- Progression character:
  - top-set plus backoff, then accessory accumulation
- Distinguishing trait:
  - bridges performance and visual progress

### Family 3: `strength_base`

- User-facing name: `Strong Base`
- Subtitle: `Simple structure, clear progression, less noise.`
- Best for:
  - beginners and intermediates
  - strength-focused users who need repeatability
- Not for:
  - users mainly seeking body-part specialization
- Typical split:
  - 3-day full-body or upper/lower hybrid
- Progression character:
  - load-first with lower exercise churn
- Distinguishing trait:
  - best default strength entry point

### Family 4: `full_body_minimal`

- User-facing name: `Full Body Express`
- Subtitle: `When the plan needs to fit your life first.`
- Best for:
  - 2-3 day users
  - comeback phases
  - busy schedules
- Not for:
  - maximum specialization goals
- Typical split:
  - 2-day A/B or 3-day full body
- Progression character:
  - minimum effective dose, adherence-first
- Distinguishing trait:
  - highest low-friction fit

### Family 5: `glute_priority`

- User-facing name: `Glute Builder`
- Subtitle: `Prioritize glutes without turning the week into chaos.`
- Best for:
  - glute-focused users
  - lower-body emphasis seekers
- Not for:
  - pure upper-body goals
- Typical split:
  - 3-day lower-biased or 4-day glute/upper
- Progression character:
  - extra lower exposures and targeted set budget
- Distinguishing trait:
  - clearest aesthetic lower-body emphasis

### Family 6: `athletic_recomp`

- User-facing name: `Lean + Capable`
- Subtitle: `Train for better shape, better engine, and better consistency.`
- Best for:
  - general fitness
  - recomposition support
  - users who want athletic feel over maximal specialization
- Not for:
  - dedicated powerlifting expectations
- Typical split:
  - 3-4 day balanced structure
- Progression character:
  - moderate volume with conditioning-aware fatigue control
- Distinguishing trait:
  - strongest hybrid fitness identity

### Family 7: `low_equipment`

- User-facing name: `Home Iron`
- Subtitle: `A real training rhythm even with limited equipment.`
- Best for:
  - home and minimal-equipment users
- Not for:
  - maximal strength goals that require heavy loading
- Typical split:
  - 3-4 day compact split
- Progression character:
  - unilateral work, tempo, density, rep progression
- Distinguishing trait:
  - equipment-first family

### Family 8: `joint_friendly`

- User-facing name: `Joint-Smart Build`
- Subtitle: `Progress with guardrails when tolerance matters.`
- Best for:
  - restart phases
  - users with joint sensitivity or pain history
- Not for:
  - users who want very aggressive loading
- Typical split:
  - 2-4 days with controlled stress distribution
- Progression character:
  - slower overload, higher swap stability, easier-week sensitivity
- Distinguishing trait:
  - the safest "keep moving forward" recommendation

## Programme Generation Rules

The recommendation engine should recommend a family first and generate a programme second.

### Programme Input

The programme builder should consume:

- selected template family
- days-per-week variant
- equipment variant
- goal profile
- experience level
- recovery profile
- session time budget
- emphasis profile

### Progression Variables

Each programme should define:

- weekly set budget
- rep target ranges
- effort target or RIR band
- load progression rule
- density target / rest guidance
- exercise stability level:
  - `anchor`
  - `support`
  - `accessory`

### Exercise Stability Rules

`anchor` lifts
- should stay stable across the block unless:
  - pain emerges
  - equipment becomes unavailable
  - there is a repeated stall trigger

`support` lifts
- can rotate at block midpoint or on fit issues

`accessory` lifts
- can rotate more freely for tolerance, variety, or equipment reasons

### Volume Progression

`muscle`
- increase effective set count first
- use rep progression before load whenever possible

`strength`
- keep overall volume more controlled
- drive earlier progress through load and top-set quality

`general fitness`
- keep volume moderate and recovery predictable

`glute focus`
- add lower-body emphasis without inflating every session

`recomposition / fat-loss support`
- prioritize adherence and fatigue management over theoretical maximum volume

### Intensity Progression

`beginner`
- progress with rep targets and small load increases

`intermediate`
- allow double progression and top-set / backoff structures where appropriate

`advanced`
- out of scope for deep personalization in MVP; use conservative family variants

### Easier Week / Pivot / Deload Logic

Base rule:

- 6-week block
  - 2 weeks build-in
  - 2 weeks overload
  - 1 easier week
  - 1 consolidation week

- 8-week block
  - 2 weeks base
  - 2 weeks build
  - 1 pivot week
  - 2 weeks intensify
  - 1 consolidation or resensitization week

Triggered easier week conditions:

- repeated hard/maxed effort trends
- >30% missed session rate over two weeks
- repeated pain or swap events
- low readiness trend

## AI_COACH Interaction Rules

AI_COACH should be useful because it makes the engine understandable and adaptive, not because it ignores the engine.

### During Onboarding

AI_COACH may:

- ask one clarifying question at a time
- help turn free text into structured preferences
- explain what a question means

AI_COACH may not:

- generate a custom plan instead of letting the engine rank candidates
- bypass required questions

### After Recommendation

AI_COACH should:

- explain why the primary recommendation fits
- explain why the top alternatives were not the default
- highlight the tradeoff being made

Example explanation dimensions:

- goal fit
- schedule fit
- equipment fit
- recovery realism
- style match

### Allowed Modifications

AI_COACH may:

- switch to a shorter-session version in the same family
- recommend safe exercise swaps in the same slot class
- tune emphasis inside the chosen family

AI_COACH may not:

- silently change families
- violate injury or equipment constraints
- turn a deterministic recommendation into free-form planning

### Family / Programme Switch Triggers

AI_COACH can recommend re-ranking or switching when:

- the user repeatedly skips the same session type
- many manual swaps target the same pattern
- adherence drops for multiple weeks
- the user's goal changes
- readiness and recovery materially change

## Feedback Loop

The engine should improve from product data, not only from model prompting.

### Immediate Success Signals

- which recommendation slot the user chose
- whether they start the first workout within 24-72 hours
- whether they complete week 1
- whether they ask for explanation before accepting
- whether they reject the primary recommendation

### Medium-Term Retention Signals

- 2-week adherence
- 4-week completion rate
- continuation into week 5+
- reuse of the same family for the next block

### Wrong-Fit Signals

- early abandonment
- repeated skipping of the same session archetype
- repeated movement substitutions
- AI_COACH conversations tagged with:
  - too long
  - too hard
  - boring
  - hurts
- quick switching from primary to alternative family

## Data Model Direction

MVP does not require a large schema rewrite, but it does require cleaner recommendation entities.

Recommended additions:

- `RecommendationInput`
  - normalized onboarding + coach clarification inputs
- `TemplateFamilyDefinition`
  - catalog metadata, variants, contraindications, and scoring tags
- `RecommendationCandidate`
  - family + variant + profile bundle
- `RecommendationResult`
  - primary recommendation
  - secondary alternatives
  - confidence
  - explanation tokens
- `ProgrammeProfile`
  - 6/8 week progression metadata
- `RecommendationTelemetryEvent`
  - selection and fit outcomes

Prefer these as dedicated recommendation-layer types rather than overloading `WorkoutTemplate`, `WorkoutPlan`, or `AICoachPlanSchema`.

## MVP Scope

MVP should include:

- 8 curated template families
- 2-5 day family variants
- deterministic scoring and ranking
- top-3 recommendation output
- AI explanation layer
- basic telemetry for selection, adherence, and wrong-fit detection
- programme generation rules by family and goal profile

MVP should exclude:

- unconstrained AI-generated plans
- per-user machine learning models
- automated weekly programme rewrites with no guardrails
- excessively deep onboarding branches

## Later Version

Later versions can add:

- behavior-informed re-ranking
- richer telemetry loops
- confidence-aware follow-up questioning
- stronger premium adaptation hooks
- more sophisticated programme pivots from actual logging behavior

## Risks and Tradeoffs

### Risk: too many family options

If the family catalog becomes bloated, recommendations will feel cosmetic rather than structurally different.

Decision:

- keep the initial family catalog small and distinct

### Risk: template and programme remain conflated

If the product keeps using one overloaded mental model, both UI and persistence will become harder to reason about.

Decision:

- preserve explicit template vs programme distinction in UX and internal types

### Risk: AI feels smart but undermines trust

If AI_COACH can improvise too freely, users will get inconsistent recommendations and developers will lose debuggability.

Decision:

- keep AI_COACH as interpreter and guarded adapter, not recommendation engine of record

## MVP-First Recommendation

Build the first version around:

- a small family catalog
- deterministic scoring
- top-3 recommendations with confidence
- editorially strong naming and explanation
- AI_COACH guardrails

This will make Gymlog feel personalized without becoming unpredictable. The user should come away feeling that Gymlog understood:

- how often they can actually train
- what kind of weekly rhythm fits them
- what tradeoff the app chose on purpose

That is the product win to optimize first.
