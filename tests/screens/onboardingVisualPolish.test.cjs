const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const appShellSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'AppShell.tsx'), 'utf8');
const onboardingSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);

module.exports = [
  {
    name: 'onboarding plan-ready screen keeps safe-area background consistent and hero copy readable',
    run() {
      assert.match(appShellSource, /shellBackgroundColor\?: string/);
      assert.match(appSource, /const onboardingScreenActive = onboardingActive \|\| setupOnboardingActive/);
      // Light shell: warm lavender behind onboarding; dark status-bar glyphs.
      assert.match(appSource, /shellBackgroundColor=\{onboardingScreenActive \? '#F7F3FF' :/);
      assert.match(appSource, /statusBarStyleOverride=\{[^}]*onboardingScreenActive \? 'dark' : welcomeActive \? 'dark' : undefined\}/);
      assert.doesNotMatch(appSource, /#1D1C35/);

      // Plan-ready views animate on one shared card; footer hides on the account
      // gate AND the overview (which enters the plan via expandable day rows).
      assert.match(onboardingSource, /const footerVisible = !\(stage === 'review' && \(planReadyView === 'account' \|\| planReadyView === 'overview'\)\)/);
      assert.match(onboardingSource, /Animated\.timing\(planReadyCardTranslateX/);
      assert.match(onboardingSource, /planReadyCardOpacity/);

      // CTA labels are sentence case in the light redesign. "See day 1" is gone —
      // the overview enters the plan by tapping a day, not a footer button.
      assert.match(onboardingSource, /\? 'Save plan & start'/);
      assert.doesNotMatch(onboardingSource, /: 'See day 1'/);
      assert.match(onboardingSource, /\? 'Build my plan'/);
      assert.match(onboardingSource, /'Saving plan\.\.\.'/);
      assert.doesNotMatch(onboardingSource, /'SAVE PLAN & START'/);
      assert.doesNotMatch(onboardingSource, /'BUILD MY PLAN'/);

      // The dark plan-ready surfaces stay gone.
      assert.doesNotMatch(onboardingSource, /planReadyProgramOverviewVisible/);
      assert.doesNotMatch(onboardingSource, /planReadyNextSessionHeroImage/);
      assert.doesNotMatch(onboardingSource, /VIEW FULL PROGRAM/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_UPPER_WORKOUT_SOURCE/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_PROGRAM_OVERVIEW_HERO_SOURCE/);
    },
  },
  {
    name: 'plan-building loading screen shows a calm progress list with no orb or mascot',
    run() {
      // Phase 2 redesign: the building-your-plan loader is a calm step list with
      // a slim progress bar - no orb/mascot/hype (handoff README, Phase 2
      // "Building-your-plan loader" + designs onb-screens3 "Building your plan").
      const loaderStart = onboardingSource.indexOf('function renderBuildingPlan()');
      assert.notEqual(loaderStart, -1, 'renderBuildingPlan should exist');
      const loaderEnd = onboardingSource.indexOf('return renderBuildingPlan();', loaderStart);
      const loaderBody = onboardingSource.slice(loaderStart, loaderEnd === -1 ? undefined : loaderEnd);

      // Four calm phase labels with rotating active subtitles.
      assert.match(onboardingSource, /const buildingPlanPhases = useMemo\([\s\S]*'Analyzing your inputs'[\s\S]*'Building your split'[\s\S]*'Matching exercises'[\s\S]*'Finalizing your plan'/);
      assert.match(onboardingSource, /const buildingPlanStepSubtitles = useMemo/);
      assert.match(onboardingSource, /Creating training structure\.\.\./);

      // Heading flips to the done copy; animated ellipsis while in progress.
      assert.match(loaderBody, /buildingPlanComplete \? 'Your plan is ready' : `Building your plan\$\{buildingPlanAnimatedEllipsis\}`/);
      assert.match(onboardingSource, /buildingPlanEllipsisStep/);
      assert.match(onboardingSource, /'\.'\.repeat\(buildingPlanEllipsisStep \+ 1\)/);
      assert.match(onboardingSource, /setBuildingPlanComplete\(true\)/);

      // Slim determinate progress bar + percent readout (calm, not a hype ring).
      assert.match(loaderBody, /styles\.buildingPlanProgressTrack/);
      assert.match(loaderBody, /styles\.buildingPlanProgressFill, \{ width: `\$\{buildingPlanPercent\}%` \}/);
      assert.match(loaderBody, /<Text style=\{styles\.buildingPlanPercentText\}>\{`\$\{buildingPlanPercent\}%`\}<\/Text>/);

      // Vertical step list with an active-row highlight and a done check.
      assert.match(loaderBody, /styles\.buildingPlanStepList/);
      assert.match(loaderBody, /buildingPlanPhases\.map\(\(label, index\) =>/);
      assert.match(loaderBody, /active && styles\.buildingPlanStepRowActive/);
      assert.match(loaderBody, /completed && styles\.buildingPlanStepIconDone/);
      assert.match(loaderBody, /styles\.buildingPlanStepActiveDot/);

      // No orb, mascot, progress ring, or "did you know" hype in the loader.
      assert.doesNotMatch(loaderBody, /GainerCoachOrb/);
      assert.doesNotMatch(onboardingSource, /buildingPlanOrbGlow/);
      assert.doesNotMatch(onboardingSource, /buildingPlanOrbFloat/);
      assert.doesNotMatch(onboardingSource, /buildingPlanPercentBadge/);
      assert.doesNotMatch(onboardingSource, /const ringSize = 282/);
      assert.doesNotMatch(onboardingSource, /const progressRadius = 118/);
      assert.doesNotMatch(onboardingSource, /DID YOU KNOW\?/);
      assert.doesNotMatch(onboardingSource, /Plans that adapt to you get better results/);
    },
  },
];
