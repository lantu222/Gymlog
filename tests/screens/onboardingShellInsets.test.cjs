const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);
const button = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'OnboardingBackButton.tsx'),
  'utf8',
);
const app = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

/**
 * "step teksti menee back napin taakse" (user 2026-09-02, two screenshots).
 *
 * Two offsets disagreed. The back chevron is placed from the safe-area edge
 * (insets.top + 10); the location-stage shell's progress bar and top pane
 * stepped down by fixed amounts from the shell's top — so the bar sat under
 * the status-bar strip and "STEP 2 OF 6" landed on the chevron. And the app
 * shell padded the top edge for onboarding although every onboarding screen
 * pads for the status bar itself, which put each of them one status bar too
 * low. Source guards, because the offsets live in three files and nothing
 * else ties them together.
 */
module.exports = [
  {
    name: 'onboarding shell: the bar and the pane step down from the same edge the chevron does',
    run() {
      // The chevron's own rule, so the guard fails if it moves.
      assert.match(button, /\{ top: insets\.top \+ 10 \}/);

      const shell = screen.slice(
        screen.indexOf('function renderOnboardingShell('),
        screen.indexOf('function renderGoal('),
      );
      assert.ok(shell.length > 0, 'renderOnboardingShell not found');
      assert.match(shell, /styles\.locationProgressBarWrap, \{ top: insets\.top \+ 10 \}/);
      assert.match(shell, /marginTop: insets\.top \+ LOCATION_PANE_TOP_GAP/);

      // And the static styles no longer carry a fixed step-down of their own,
      // which is the exact shape that overlapped.
      const pane = screen.slice(
        screen.indexOf('  locationTopPane: {'),
        screen.indexOf('},', screen.indexOf('  locationTopPane: {')),
      );
      assert.doesNotMatch(pane, /marginTop:/);
      const wrap = screen.slice(
        screen.indexOf('  locationProgressBarWrap: {'),
        screen.indexOf('},', screen.indexOf('  locationProgressBarWrap: {')),
      );
      assert.doesNotMatch(wrap, /\btop:/);

      // With the shell not padding the top, whatever scrolls under the status
      // bar needs the strip: the location stages, and the plan-ready day view
      // (PR review — its exercise list slid across the clock).
      assert.match(
        screen,
        /const statusBarStripActive = locationStageActive \|\| \(stage === 'review' && planReadyView === 'day'\);/,
      );
      assert.match(screen, /\{statusBarStripActive \? <View pointerEvents="none" style=\{\[styles\.locationTopSafeArea/);
    },
  },
  {
    name: 'building your plan: four seconds, and every caption fits inside them',
    run() {
      // Measured 2026-09-02: both Done buttons are under a second; the ten
      // seconds here was the one slow moment. Four, by decision.
      assert.match(screen, /const BUILDING_PLAN_TOTAL_MS = 4000;/);
      // The captions derive from the total. Fixed milliseconds were the
      // shape that shipped, and shortening the total would have hidden the
      // last two captions without a single test going red.
      assert.match(screen, /const BUILDING_PLAN_CAPTION_AT = \[0\.05, 0\.28, 0\.5, 0\.72\] as const;/);
      assert.match(screen, /BUILDING_PLAN_CAPTION_AT\.forEach\(\(fraction, index\) => \{\s*timeouts\.push\(setTimeout\(\(\) => fadeCaption\(index\), Math\.round\(BUILDING_PLAN_TOTAL_MS \* fraction\)\)\);/);
      assert.doesNotMatch(screen, /fadeCaption\(\d\), \d{3,5}\)/);
      // The last caption (0.72 × 4000 = 2880) lands before completion marks
      // every phase done (4000 − 800 = 3200), and completion lands before
      // the fade-out (4000 − 420).
      assert.match(screen, /setBuildingPlanComplete\(true\);\s*\}, BUILDING_PLAN_TOTAL_MS - 800\)/);
      assert.ok(0.72 * 4000 < 4000 - 800 && 4000 - 800 < 4000 - 420);
    },
  },
  {
    name: 'app shell: onboarding screens pad for the status bar themselves, so the shell does not',
    run() {
      const rule = app.slice(
        app.indexOf('safeAreaEdges={'),
        app.indexOf('}', app.indexOf("['top', 'left', 'right', 'bottom']")),
      );
      assert.ok(rule.length > 0, 'safeAreaEdges rule not found');
      // onboardingScreenActive: first run AND the plan editor under Profile,
      // which is the same questionnaire reading the same inset.
      assert.match(rule, /onboardingScreenActive\s*\?[\s\S]{0,1200}\['left', 'right'\]\s*:\s*\['top', 'left', 'right', 'bottom'\]/);
      assert.doesNotMatch(rule, /onboardingActive\s*\?\s*\['top'/);
      assert.doesNotMatch(rule, /onboardingScreenActive\s*\?\s*\['top'/);
      // The guard is only right while the screens do read the inset.
      for (const rel of ['StartPathScreen', 'AboutYouScreen', 'OnboardingReadyCatalogScreen']) {
        const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'screens', `${rel}.tsx`), 'utf8');
        assert.match(src, /paddingTop: insets\.top \+/, `${rel} no longer pads for the status bar itself`);
      }
    },
  },
];
