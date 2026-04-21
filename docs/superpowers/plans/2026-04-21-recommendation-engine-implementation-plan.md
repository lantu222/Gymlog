# Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic recommendation engine for Gymlog that turns onboarding inputs into a ranked `template family + programme profile` recommendation, with clear user-facing explanations and telemetry.

**Architecture:** Add a focused recommendation layer beside the current onboarding and ready-program systems rather than overloading `firstRunSetup.ts` further. The new layer owns family definitions, candidate scoring, confidence, programme-profile generation, and recommendation explanations. Existing onboarding and ready-program surfaces consume that layer directly. `AI_COACH` consumes it separately as a premium explanation/adaptation layer and does not own recommendation decisions.

**Tech Stack:** React Native, TypeScript, existing `src/lib` business-logic modules, existing `tests/lib/*.test.cjs` node-based tests.

---

## File Structure

### New files

- `src/types/recommendation.ts`
  - typed entities for recommendation input, family definitions, candidates, results, and telemetry payloads
- `src/lib/recommendationCatalog.ts`
  - template family catalog and metadata
- `src/lib/recommendationInput.ts`
  - normalization of onboarding data into recommendation input
- `src/lib/recommendationScoring.ts`
  - constraint filtering, weighted scoring, and confidence logic
- `src/lib/recommendationProgramme.ts`
  - programme profile generation and progression metadata
- `src/lib/recommendationExplanation.ts`
  - user-facing explanation tokens and rationale strings for core recommendation surfaces
- `src/lib/recommendationTelemetry.ts`
  - event naming and payload builders
- `tests/lib/recommendationInput.test.cjs`
- `tests/lib/recommendationScoring.test.cjs`
- `tests/lib/recommendationProgramme.test.cjs`
- `tests/lib/recommendationExplanation.test.cjs`

### Existing files to modify

- `src/types/models.ts`
  - add any minimal preference fields needed for MVP recommendation input
- `src/lib/firstRunSetup.ts`
  - stop owning ranking logic directly; delegate to recommendation layer
- `src/screens/OnboardingScreen.tsx`
  - update questions, answer collection, and recommendation display wiring
- `src/lib/aiCoachPlan.ts`
  - align premium coach concepts with family/programme distinction where relevant
- `src/screens/AICoachScreen.tsx`
  - consume recommendation output for premium explanation and adaptation entry points
- `src/lib/valluActions.ts`
  - add allowed AI_COACH recommendation actions and guardrails
- `src/lib/readyProgramCollections.ts`
  - map collections to families or recommendation-friendly categories
- `src/lib/readyProgramContent.ts`
  - enrich content used in recommendation explanation
- `src/lib/templatePresentation.ts`
  - align editorial naming/tags with family language
- `docs/premium-adaptive-coach-plan.md`
  - optional follow-up reference update after implementation stabilizes

### Existing tests likely impacted

- `tests/lib/firstRunSetup.test.cjs`
- `tests/lib/readyProgramCollections.test.cjs`
- `tests/lib/valluActions.test.cjs`

## Implementation Sequence

### Task 1: Freeze the recommendation vocabulary and data boundaries

**Files:**
- Create: `src/types/recommendation.ts`
- Modify: `src/types/models.ts`
- Test: none yet

- [ ] Define `RecommendationInput`, `TemplateFamilyId`, `TemplateFamilyDefinition`, `RecommendationCandidate`, `RecommendationResult`, `ProgrammeProfile`, and `RecommendationConfidence`.
- [ ] Keep `template`, `session`, and `programme` as distinct entities. Do not overload `WorkoutTemplate` for programme metadata.
- [ ] Add only minimal new preference fields to `AppPreferences` if a field cannot be derived from current onboarding state.
- [ ] Keep new types recommendation-specific so they can be reused across onboarding and optional premium AI_COACH flows.

**Verification:**
- TypeScript compile should pass once imports are wired in later tasks.
- No existing model names should be redefined with conflicting meaning.

### Task 2: Build the family catalog

**Files:**
- Create: `src/lib/recommendationCatalog.ts`
- Modify: `src/lib/readyProgramCollections.ts`
- Modify: `src/lib/readyProgramContent.ts`
- Modify: `src/lib/templatePresentation.ts`
- Test: `tests/lib/recommendationScoring.test.cjs`, `tests/lib/readyProgramCollections.test.cjs`

- [ ] Create eight template family definitions:
  - `mass_hypertrophy`
  - `powerbuilding`
  - `strength_base`
  - `full_body_minimal`
  - `glute_priority`
  - `athletic_recomp`
  - `low_equipment`
  - `joint_friendly`
- [ ] For each family, define:
  - user-facing title
  - subtitle
  - supported days-per-week variants
  - equipment compatibility
  - recovery demand
  - experience range
  - style tags
  - contraindication tags
  - linked ready-program IDs where available
- [ ] Reconcile the existing ready-program collections with the new family language instead of maintaining two unrelated editorial systems.
- [ ] Update presentation helpers so recommendation cards and ready templates use the same naming logic.

**Verification:**
- Add tests that assert every family has at least one valid variant.
- Add tests that linked ready-program IDs exist in the current catalog where applicable.

### Task 3: Normalize onboarding inputs into recommendation input

**Files:**
- Create: `src/lib/recommendationInput.ts`
- Modify: `src/lib/firstRunSetup.ts`
- Modify: `src/types/models.ts`
- Test: `tests/lib/recommendationInput.test.cjs`, `tests/lib/firstRunSetup.test.cjs`

- [ ] Build a normalization function that converts current onboarding selections into `RecommendationInput`.
- [ ] Reuse existing preference fields where possible:
  - `setupGoal`
  - `setupDaysPerWeek`
  - `setupEquipment`
  - `setupFocusAreas`
  - `setupTrainingFeel`
  - `setupWeeklyMinutes`
  - joint-friendly preferences
- [ ] Add only the MVP fields that are currently missing and materially affect ranking:
  - recovery quality
  - preferred training style, if existing fields are not enough
  - explicit limitations / avoid list normalization
- [ ] Preserve compatibility with the current first-run flow so legacy defaults still produce a recommendation.
- [ ] Do not require AI_COACH or any premium-only state to produce a recommendation result.

**Verification:**
- Add tests that show current onboarding defaults produce a valid normalized input.
- Add tests for edge cases:
  - minimal equipment
  - low recovery
  - glute emphasis
  - joint-friendly constraints

### Task 4: Implement constraint filtering, scoring, and confidence

**Files:**
- Create: `src/lib/recommendationScoring.ts`
- Create: `tests/lib/recommendationScoring.test.cjs`
- Modify: `src/lib/firstRunSetup.ts`
- Test: `tests/lib/recommendationScoring.test.cjs`, `tests/lib/firstRunSetup.test.cjs`

- [ ] Generate recommendation candidates from the family catalog and variant metadata.
- [ ] Apply hard filters for:
  - equipment mismatch
  - unrealistic session duration
  - experience mismatch
  - unsupported frequency
  - unsupported movement constraints without safe variant
- [ ] Score surviving candidates using the agreed MVP dimensions:
  - goal alignment
  - schedule/time fit
  - equipment fit
  - recovery fit
  - experience fit
  - style preference fit
  - focus-area match
- [ ] Compute confidence from:
  - input completeness
  - score separation
  - constraint tightness
- [ ] Return one primary recommendation plus two meaningful alternatives.
- [ ] Ensure alternatives represent different tradeoffs rather than trivial duplicates.

**Verification:**
- Add golden tests for archetypal users:
  - 2-day busy beginner
  - 4-day muscle-focused gym user
  - glute-focused 4-day user
  - low-equipment home user
  - joint-sensitive comeback user
- Assert hard failures exclude invalid candidates.
- Assert low-confidence scenarios return clustered top-three output.

### Task 5: Replace direct first-run recommendation logic with the new engine

**Files:**
- Modify: `src/lib/firstRunSetup.ts`
- Modify: `src/screens/OnboardingScreen.tsx`
- Test: `tests/lib/firstRunSetup.test.cjs`

- [ ] Refactor `resolveFirstRunRecommendationWithTailoring` or equivalent first-run helpers to call the new recommendation layer instead of local program-ID heuristics.
- [ ] Preserve backwards-compatible support for existing ready-program IDs until programme-generation output is fully wired.
- [ ] Update recommendation UI state so the first-run flow can render:
  - primary recommendation
  - two alternatives
  - confidence-sensitive explanation copy
- [ ] Keep the "done for me", "guided editable", and "self directed" guidance modes, but make recommendation output consistent across them.
- [ ] Keep recommendation copy non-AI-branded. This is core product logic, not a premium AI experience.

**Verification:**
- Existing first-run tests should still pass after expectations are updated.
- Add tests that a valid first-run selection always produces a recommendation payload with three options when confidence is medium/low.

### Task 6: Add programme profile generation

**Files:**
- Create: `src/lib/recommendationProgramme.ts`
- Create: `tests/lib/recommendationProgramme.test.cjs`
- Modify: `src/lib/aiCoachPlan.ts`
- Modify: `src/lib/programDetails.ts`
- Modify: `src/lib/programInsights.ts`

- [ ] Create programme-profile builders for 6-week and 8-week blocks.
- [ ] Encode progression metadata instead of full free-form workouts:
  - block length
  - weekly phase labels
  - progression style
  - volume progression tendency
  - intensity progression tendency
  - easier-week triggers
  - exercise stability rules
- [ ] Keep `anchor`, `support`, and `accessory` behavior explicit so later adaptation logic can reuse it.
- [ ] Where current programme detail screens need user-facing summaries, expose concise programme explanation strings rather than raw internals.

**Verification:**
- Add tests for each major goal profile:
  - muscle
  - strength
  - fitness
  - glute emphasis
  - recomposition support
- Assert every programme profile includes easier-week logic and progression metadata.

### Task 7: Build user-facing recommendation explanations

**Files:**
- Create: `src/lib/recommendationExplanation.ts`
- Create: `tests/lib/recommendationExplanation.test.cjs`
- Modify: `src/screens/OnboardingScreen.tsx`
- Modify: `src/lib/templatePresentation.ts`
- Modify: `src/lib/readyProgramContent.ts`

- [ ] Convert scoring output into explanation tokens the UI can render consistently.
- [ ] Ensure explanation covers:
  - why this fits your goal
  - why this fits your schedule
  - what tradeoff was chosen
  - why the alternatives were not primary
- [ ] Keep explanation deterministic and based on scored dimensions, not free-form LLM output.
- [ ] Align family names, subtitles, and tags with explanation language so recommendation cards feel editorially coherent.

**Verification:**
- Add tests that explanation output exists for both high-confidence and low-confidence cases.
- Assert explanation text never references a scoring field that was not actually part of the result.

### Task 8: Define AI_COACH guardrails around recommendation actions

**Files:**
- Modify: `src/screens/AICoachScreen.tsx`
- Modify: `src/lib/valluActions.ts`
- Modify: `src/lib/aiCoachPlan.ts`
- Test: `tests/lib/valluActions.test.cjs`

- [ ] Add explicit recommendation-aware actions such as:
  - explain this recommendation
  - compare these two options
  - shorten this plan
  - make this more joint-friendly
  - rerank because my goal changed
- [ ] Restrict AI_COACH to safe modifications inside policy:
  - no silent family switch
  - no hard-constraint override
  - no uncataloged onboarding recommendation generation
- [ ] Keep AI_COACH out of free template/programme recommendation so premium boundaries stay clear.
- [ ] Expose rerank triggers so AI_COACH can intentionally request a new engine pass instead of improvising.

**Verification:**
- Add tests for action availability by context.
- Add tests that blocked actions are not offered when they would violate hard constraints.

### Task 9: Add telemetry hooks for recommendation quality

**Files:**
- Create: `src/lib/recommendationTelemetry.ts`
- Modify: `src/screens/OnboardingScreen.tsx`
- Modify: `src/screens/AICoachScreen.tsx`
- Modify: `src/lib/homeProgramSelection.ts`
- Modify: `src/state/completedWorkoutPersistence.ts`
- Test: `tests/lib/recommendationInput.test.cjs` or dedicated telemetry tests if needed

- [ ] Define telemetry events for:
  - recommendation_shown
  - recommendation_selected
  - recommendation_rejected
  - recommendation_explanation_opened
  - recommendation_alternative_selected
  - first_workout_started_from_recommendation
  - early_switch_from_recommendation
- [ ] Capture enough context to analyze:
  - selected family
  - confidence level
  - recommendation rank chosen
  - later plan switch or early abandonment
- [ ] Keep the telemetry layer payload-based so analytics implementation can be added without rewriting decision logic.

**Verification:**
- Confirm every major recommendation decision point emits a consistent payload shape.
- Avoid coupling telemetry builders directly to React component state.

### Task 10: Wire recommendation reuse into later "change my plan" flows

**Files:**
- Modify: `src/screens/AICoachScreen.tsx`
- Modify: `src/lib/homeProgramSelection.ts`
- Modify: `src/lib/programDetails.ts`
- Modify: `src/lib/programInsights.ts`
- Test: `tests/lib/programDetails.test.cjs`, `tests/lib/programInsights.test.cjs`

- [ ] Add a rerank entry path from AI_COACH and plan-detail surfaces.
- [ ] Reuse the same recommendation engine for "my plan no longer fits" flows instead of inventing separate logic.
- [ ] Show whether a recommendation switch is driven by:
  - goal change
  - schedule change
  - recovery issue
  - equipment change
  - repeated wrong-fit behavior

**Verification:**
- Add tests for rerank reasons and resulting recommendation payloads.
- Ensure plan-detail and coach surfaces use the same explanation primitives.

## Rollout Notes

### MVP cut line

If implementation needs a narrow first shipping slice, keep:

- recommendation types
- family catalog
- normalized onboarding input
- scoring + confidence
- primary + alternatives UI
- deterministic explanation

Defer if necessary:

- telemetry enrichment beyond selection/start events
- deep AI coach rerank flows
- broad programme detail integration

### Non-goals

Do not do these in the first implementation pass:

- user-specific ML ranking
- free-form LLM programme generation
- AI-branded recommendation UX in onboarding or ready-plan selection
- major persistence schema migration for completed sessions
- large redesign of the template editor

## Verification Checklist

- Recommendation logic is deterministic from the same input.
- Every valid onboarding path produces a recommendation result.
- Hard constraints exclude invalid families.
- Low-confidence scenarios show meaningful alternatives.
- User-facing explanations align with actual scoring output.
- AI_COACH actions respect guardrails.
- Existing ready-program and onboarding flows remain functional.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-recommendation-engine-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
