const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboardingSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);

function getFunctionBody(name) {
  const start = onboardingSource.indexOf(`function ${name}()`);
  assert.notEqual(start, -1, `${name} should exist`);

  const nextFunction = onboardingSource.indexOf('\n  function ', start + 1);
  assert.notEqual(nextFunction, -1, `${name} should be followed by another function`);

  return onboardingSource.slice(start, nextFunction);
}

module.exports = [
  {
    name: 'onboarding review step uses the final plan-ready structure',
    run() {
      const reviewBody = getFunctionBody('renderReview');

      assert.match(reviewBody, /YOUR PLAN/);
      assert.match(reviewBody, /IS READY/);
      assert.match(reviewBody, /planReadyProgramCard/);
      assert.match(reviewBody, /\.slice\(0, 2\)/);
      assert.match(reviewBody, /recommendationOptionIds\s*\n\s*\.slice\(0, 2\)/);
      assert.match(reviewBody, /selected: programId === activeRecommendedProgramId/);
      assert.match(reviewBody, /getPlanReadyImageSource/);
      assert.match(reviewBody, /getPlanReadyPreviewImageSource/);
      assert.match(onboardingSource, /step7-character-male-01\.png/);
      assert.match(onboardingSource, /step7-character-female-01\.png/);
      assert.match(onboardingSource, /step7-preview-male-mass\.png/);
      assert.match(onboardingSource, /step7-preview-female-athletic\.png/);
      assert.match(onboardingSource, /function getPlanReadyImageGender/);
      assert.match(reviewBody, /REST DAY/);
      assert.doesNotMatch(reviewBody, /stepLabel: 'STEP 7'/);
      assert.doesNotMatch(reviewBody, /renderOnboardingShell/);
      assert.doesNotMatch(reviewBody, /styles\.stageBody/);
      assert.match(onboardingSource, /const standaloneProgressHidden = locationStageActive \|\| stage === 'review'/);
      assert.match(onboardingSource, /return 'tempo'/);
      assert.match(onboardingSource, /return 'restDay'/);
      assert.match(onboardingSource, /paddingBottom: spacing\.xxl \+ spacing\.xl/);
      assert.doesNotMatch(onboardingSource, /haystack\.includes\('tempo'\)\) \{\s*return 'chest'/);
      assert.doesNotMatch(onboardingSource, /Easy Run Day/);
    },
  },
  {
    name: 'onboarding footer guards invalid and busy transitions',
    run() {
      const canContinueStart = onboardingSource.indexOf('const canContinue =');
      const locationStageActiveStart = onboardingSource.indexOf('const locationStageActive =');
      assert.notEqual(canContinueStart, -1, 'canContinue should exist');
      assert.notEqual(locationStageActiveStart, -1, 'locationStageActive should exist');

      const canContinueBlock = onboardingSource.slice(canContinueStart, locationStageActiveStart);
      assert.match(canContinueBlock, /stage === 'focus'/);
      assert.match(canContinueBlock, /focusAreas\.length > 0/);
      assert.match(onboardingSource, /if \(!canContinue \|\| busy\)/);
      assert.match(onboardingSource, /disabled=\{!canContinue \|\| busy\}/);
    },
  },
];
