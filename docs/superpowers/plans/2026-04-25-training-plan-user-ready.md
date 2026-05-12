# Archived

This document is outdated and should not be used for implementation decisions.
The training plan user-ready work described here is complete or superseded by current specs in `docs/source-of-truth/`.

---

# Training Plan User-Ready Implementation Plan (ARCHIVED)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the recommendation engine to a user-ready level where every onboarding path returns a realistic, consistent, explainable training plan with tested session content and safe fallbacks.

**Architecture:** Keep the current recommendation engine intact and add quality layers around it: plan validation, session guidance, progression readiness, substitution readiness, and scenario regression tests. Do not redesign UI until the generated plan data is trustworthy.

**Tech Stack:** TypeScript, React Native/Expo, CommonJS unit tests under `tests/`, compiled test output in `.test-dist`, existing workout catalog and recommendation modules.

---

## User-Ready Definition

The honest bar is not "mathematically perfect for every possible person." The bar is:

- Every supported onboarding combination produces a plan that matches goal, equipment, days, level, and target-weight direction.
- Every recommended session has warmup, main focus, support work, sets, reps, rest, duration, progression hint, and first action.
- Home/bodyweight users never receive gym-only required exercises.
- Strength plans always include heavy loaded anchors when full gym is available.
- Muscle gain plans have enough weekly volume.
- Fat-loss plans include sustainable resistance work and do not become random mobility-only output.
- Endurance plans include concrete run/cardio work and recovery/mobility.
- Beginner plans stay low-complexity and avoid advanced/high-fatigue structures.
- When a perfect template does not exist, the engine says so internally through confidence/fallback metadata and returns the closest safe plan with optional-day logic.

## File Structure

- `src/lib/workoutContentFit.ts`: keep and expand content validation signals.
- `src/lib/sessionGuidance.ts`: derive user-facing session guidance from template data.
- `src/lib/recommendationScoring.ts`: use validation/fallback confidence without rewriting scoring.
- `src/lib/recommendationPresentation.ts`: prepare clear recommendation output and alternatives.
- `src/features/workout/workoutCatalog.ts`: only small template corrections, no broad rewrite.
- `src/lib/readyProgramContent.ts`: update copy only when plan content changes.
- `tests/lib/workoutContentFit.test.cjs`: guard template quality.
- `tests/lib/sessionGuidance.test.cjs`: guard day-level output quality.
- `tests/lib/firstRunSetup.test.cjs`: guard high-priority onboarding scenarios.
- `tests/lib/recommendationScoring.test.cjs`: guard ranking and penalties.
- `docs/workout-content-matrix.md`: source-of-truth documentation.
- `outputs/onboarding-recommendation/onboarding-recommendation-engine.xlsx`: spreadsheet mirror for review.

---

### Task 1: Define The Acceptance Matrix

**Files:**
- Modify: `docs/workout-content-matrix.md`
- Modify: `tests/lib/firstRunSetup.test.cjs`

- [x] **Step 1: Add the exact "user-ready" matrix to docs**

Add a section with these rows:

```markdown
## User-Ready Acceptance Matrix

| Path | Must recommend | Must explain | Must include |
| --- | --- | --- | --- |
| Full gym + Strength + 2 days | Beginner strength | Low frequency strength base | Heavy squat/press/hinge/pull exposure |
| Full gym + Strength + 3 days | Strength base | Heavy anchors with manageable recovery | 3 required strength days |
| Full gym + Strength + 4 days | Powerbuilding or strength-size | Heavy + support volume | 4 balanced upper/lower days |
| Full gym + Strength + 5 days | 4-day strength fallback | 5th day is optional | Explicit optional accessory/recovery day |
| Full gym + Muscle + gain target | Hypertrophy plan | Volume supports gain target | Enough compounds and accessories |
| Lose weight + lower target | Sustainable resistance plan | Target means fat-loss bias | Moderate full-body strength plus optional conditioning |
| Home + Muscle | Home/bodyweight-safe plan | No gym-only dependency | Bodyweight push/pull/legs/core |
| Outdoor + Endurance | Run + mobility | Run/cardio is primary | Easy run, tempo/stride, reset work |
```

- [x] **Step 2: Add missing scenario tests**

Add tests that assert the matrix paths still resolve correctly:

```js
assert.equal(recommendation.featuredProgramId, 'tpl_2_day_beginner_strength_v1');
assert.match(reasons.join(' '), /strength|2-day|beginner/i);
```

- [x] **Step 3: Run focused verification**

Run:

```powershell
npx tsc -p tsconfig.test.json
npm run test:unit
```

Expected: all tests pass.

---

### Task 2: Strengthen Plan Validation

**Files:**
- Modify: `src/lib/workoutContentFit.ts`
- Modify: `tests/lib/workoutContentFit.test.cjs`

- [x] **Step 1: Add missing validation signals**

Extend `WorkoutContentFitSignals` with:

```ts
weeklySetCount: number;
primarySetCount: number;
runExerciseCount: number;
loadedExerciseCount: number;
technicalLiftCount: number;
```

- [x] **Step 2: Add validation tests**

Add tests:

```js
assert.equal(fit.signals.primarySetCount >= 6, true);
assert.equal(fit.signals.weeklySetCount >= 24, true);
assert.equal(fit.signals.technicalLiftCount <= 2, true);
```

Use them to guard:

- strength has heavy anchors and enough primary work
- hypertrophy has enough total volume
- beginner plans do not contain too many technical anchors
- endurance has at least two run/cardio exposures

- [x] **Step 3: Keep fixes small**

If a template fails, adjust only the offending exercise/session. Do not rewrite the catalog.

---

### Task 3: Make Session Guidance Complete

**Files:**
- Modify: `src/lib/sessionGuidance.ts`
- Modify: `tests/lib/sessionGuidance.test.cjs`
- Modify: `src/lib/programDetails.ts`

- [x] **Step 1: Add missing output fields**

If needed, extend `SessionGuidance`:

```ts
export interface SessionGuidance {
  warmup: string;
  mainFocus: string;
  supportFocus: string;
  restGuidance: string;
  estimatedDuration: string;
  progressionHint: string;
  firstAction: string;
  optionalNote: string | null;
}
```

- [x] **Step 2: Test every ready session**

Add a catalog-wide test:

```js
WORKOUT_TEMPLATES_V1.forEach((template) => {
  template.sessions.forEach((session) => {
    const guidance = buildSessionGuidance(template, session);
    assert.ok(guidance.warmup.length > 20);
    assert.ok(guidance.mainFocus.includes('Main focus:'));
    assert.ok(guidance.restGuidance.includes('sec'));
    assert.ok(guidance.estimatedDuration.endsWith('min'));
    assert.ok(guidance.progressionHint.length > 20);
    assert.ok(guidance.firstAction.length > 20);
  });
});
```

- [x] **Step 3: Verify detail model**

Ready program detail must expose guidance; custom programs can keep `guidance: null` until custom guidance is built.

---

### Task 4: Add Fallback Confidence

**Files:**
- Modify: `src/types/recommendation.ts`
- Modify: `src/lib/recommendationScoring.ts`
- Modify: `src/lib/recommendationPresentation.ts`
- Modify: `tests/lib/recommendationScoring.test.cjs`

- [x] **Step 1: Add confidence metadata**

Add:

```ts
recommendationConfidence: number;
fallbackReason: string | null;
```

- [x] **Step 2: Penalize unsafe mismatches**

Rules:

```ts
if (contentFit.issues.length > 0) {
  confidence -= 0.2;
}
if (daysMismatch && hasOptionalDayFallback) {
  fallbackReason = 'Closest structured plan with optional extra day.';
}
```

- [x] **Step 3: Test 5-day fallback**

Assert:

```js
assert.equal(result.featuredProgramId, 'tpl_4_day_powerbuilding_v1');
assert.match(result.fallbackReason, /optional/i);
assert.equal(result.recommendationConfidence < 1, true);
```

---

### Task 5: Build Substitution Readiness

**Files:**
- Modify: `src/features/workout/workoutCatalog.ts`
- Modify: `tests/lib/readyProgramCatalog.test.cjs`

- [x] **Step 1: Audit substitution groups**

Each required exercise should have a substitution group with at least one realistic alternative:

```js
assert.ok(group.allowedExerciseNames.length >= 2, group.id);
```

Exception groups can be explicit:

```js
const SINGLE_OPTION_ALLOWED = new Set(['running_blocks']);
```

- [x] **Step 2: Add equipment-safe substitution tests**

For bodyweight groups:

```js
assert.equal(group.allowedExerciseNames.some((name) => fullGymOnly.has(name)), false);
```

- [x] **Step 3: Fix only missing groups**

Add targeted alternatives such as:

- Push-Up Wide -> Incline Push-Up -> Decline Push-Up
- Inverted Row -> Pull-Up
- Bodyweight Squat -> Walking Lunge -> Reverse Lunge

---

### Task 6: Final User-Ready Regression Suite

**Files:**
- Modify: `tests/lib/firstRunSetup.test.cjs`
- Modify: `tests/lib/workoutContentFit.test.cjs`
- Modify: `tests/lib/sessionGuidance.test.cjs`
- Modify: `tests/lib/recommendationScoring.test.cjs`

- [x] **Step 1: Add final smoke scenario helper**

```js
function assertUserReadyRecommendation(selection) {
  const recommendation = resolveFirstRunRecommendation(selection);
  const definition = getRecommendationProgramDefinition(recommendation.featuredProgramId);
  const fit = evaluateWorkoutContentFit(recommendation.featuredProgramId, recommendation.input.profile);

  assert.ok(definition);
  assert.deepEqual(fit.issues, []);
  assert.ok(recommendation.explanation.length > 20);
  assert.ok(recommendation.weeklyStructureSummary.length > 20);
}
```

- [x] **Step 2: Cover high-risk combinations**

Test:

- strength 2/3/4/5 days
- muscle 3/4/5 days
- fat loss with lower target
- gain target with muscle goal
- home bodyweight muscle
- outdoor endurance 3/4/5 days
- beginner + 5 days should not become too complex

- [x] **Step 3: Run full verification**

Run:

```powershell
npx tsc -p tsconfig.test.json
npm run test:unit
npm run typecheck
git diff --check
```

Expected:

- TypeScript test build passes.
- Unit tests pass.
- Typecheck passes.
- Diff check has no whitespace errors. Windows LF/CRLF warnings are acceptable.

---

### Task 7: Update Review Artifacts

**Files:**
- Modify: `docs/workout-content-matrix.md`
- Modify: `outputs/onboarding-recommendation/onboarding-recommendation-engine.xlsx`

- [x] **Step 1: Update docs**

Document:

- acceptance matrix
- content-fit rules
- session guidance fields
- known template gaps
- current fallback behavior

- [x] **Step 2: Update spreadsheet**

Workbook tabs should include:

- Summary
- Scenario Matrix
- Program Catalog
- Content Fit Checks
- Session Quality
- Catalog Gaps
- Final User-Ready Checklist

- [x] **Step 3: Verify workbook**

Open or inspect the workbook and confirm the final checklist reflects the current code.

---

## Recommended Execution Order

1. Task 1: Acceptance Matrix
2. Task 2: Validation
3. Task 3: Session Guidance
4. Task 4: Confidence/Fallback
5. Task 5: Substitutions
6. Task 6: Final Regression Suite
7. Task 7: Docs/Spreadsheet

## Stop Conditions

Do not start new UI screens until:

- all high-risk scenarios pass,
- every ready template has clean content-fit checks for intended use,
- every ready session has guidance,
- fallback outputs are explicit,
- substitutions are equipment-safe,
- spreadsheet and docs match the implementation.

## Practical Release Standard

After this plan, it is fair to say:

"The app generates a good, realistic starter training plan for every supported onboarding path, explains why it was chosen, gives the user a clear first week and first session, and blocks the main classes of bad recommendations with tests."

It is not fair to say:

"This is a perfect coach for every edge case."

That higher bar requires user feedback, real training history, injury constraints, and adaptive progression after several logged sessions.
