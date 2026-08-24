const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const appShellSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'AppShell.tsx'), 'utf8');
const onboardingSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

module.exports = [
  {
    name: 'onboarding plan-ready screen keeps safe-area background consistent and hero copy readable',
    run() {
      assert.match(appShellSource, /shellBackgroundColor\?: string/);
      assert.match(appSource, /const onboardingScreenActive = onboardingActive \|\| setupOnboardingActive/);
      // Light shell: warm lavender behind onboarding; dark status-bar glyphs.
      // Onboarding no longer names its own shell colour — the shell defaults to
      // the palette background, which is what onboarding wanted all along.
      assert.match(appShellSource, /shellBackgroundColor \?\? theme\.bg/);
      // Dark icons are the default now, so onboarding and welcome no longer
      // have to ask for them; only the gradient heroes override to 'light'.
      // Status-bar icons follow the theme now; only gradient heroes override.
      assert.match(appShellSource, /statusBarStyleOverride \?\? \(themeName === 'dark' \? 'light' : 'dark'\)/);
      // The two full-bleed review screens join the gradient heroes: art runs
      // to the top edge under a translucent status bar, so the shell must not
      // reserve and paint that strip the way it does for the rest of
      // onboarding. They report a TONE rather than a boolean, because the
      // picker's top half turns white when the second program is chosen and
      // white icons would vanish into it.
      assert.match(appSource, /const \[fullBleedReviewRaw, setFullBleedReview\] = useState<'light' \| 'dark' \| null>\(null\)/);
      // Read through onboardingActive: OnboardingScreen reports this from an
      // effect with no cleanup, so finishing on the paywall left it at 'light'
      // and Home's greeting drew under the status bar on the first screen.
      assert.match(
        appSource,
        /const fullBleedReview =[\s\S]{0,40}onboardingActive \|\|/,
        'the flag must not survive onboarding unmounting',
      );
      assert.match(appSource, /fullBleedReview\s*\?\s*fullBleedReview/);
      assert.match(appSource, /onFullBleedReviewChange=\{setFullBleedReview\}/);
      assert.doesNotMatch(appSource, /#1D1C35/);

      // Plan-ready views animate on one shared card. The shared footer is
      // hidden on the programme picker, which is full-bleed and pins its own
      // CTA; the day view uses it, and that is what walks the days. The Pro
      // paywall used to be the other exception — it left the flow entirely on
      // 2026-08-24.
      assert.match(
        onboardingSource,
        /const footerVisible = !\(stage === 'review' && planReadyView === 'overview'\)/,
      );
      assert.match(onboardingSource, /Animated\.timing\(planReadyCardTranslateX/);
      assert.match(onboardingSource, /planReadyCardOpacity/);

      // CTA labels are sentence case in the light redesign. "See day 1" is gone —
      // the day view is a read-only preview whose footer returns "Back to plan".
      assert.match(onboardingSource, /t\(language, 'onb\.cta\.startTraining'\)/);
      assert.doesNotMatch(onboardingSource, /: 'See day 1'/);
      assert.match(onboardingSource, /\? t\(language, 'onb\.cta\.buildPlan'\)/);
      assert.match(onboardingSource, /t\(language, 'onb\.cta\.saving'\)/);
      assert.match(i18nSource, /'onb\.cta\.startTraining': 'Start training'/);
      assert.match(i18nSource, /'onb\.cta\.buildPlan': 'Build my plan'/);
      assert.match(i18nSource, /'onb\.cta\.saving': 'Saving plan\.\.\.'/);
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
      // Copy lives in i18n.ts; the screen renders the keys.
      assert.match(onboardingSource, /const buildingPlanPhases = useMemo\([\s\S]*'onb\.building\.phase1'[\s\S]*'onb\.building\.phase2'[\s\S]*'onb\.building\.phase3'[\s\S]*'onb\.building\.phase4'/);
      assert.match(onboardingSource, /const buildingPlanStepSubtitles = useMemo/);
      assert.match(i18nSource, /'onb\.building\.phase1': 'Analyzing your inputs'/);
      assert.match(i18nSource, /'onb\.building\.sub2': 'Creating training structure\.\.\.'/);

      // Heading flips to the done copy; animated ellipsis while in progress.
      // The dots hold constant width — appending '.'.repeat(step) changed the
      // line's width every tick and on a narrow phone the title bounced
      // between one and two lines (user 2026-08-23). Unlit dots render
      // transparent instead of being absent.
      assert.match(loaderBody, /buildingPlanComplete \? \([\s\S]{0,40}'onb\.building\.ready'[\s\S]{0,200}'onb\.building\.title'/);
      assert.match(onboardingSource, /buildingPlanEllipsisStep/);
      assert.doesNotMatch(onboardingSource, /'\.'\.repeat\(/);
      assert.match(loaderBody, /buildingPlanEllipsisStep >= 1 \? null : styles\.buildingPlanDotHidden/);
      assert.match(loaderBody, /buildingPlanEllipsisStep >= 2 \? null : styles\.buildingPlanDotHidden/);
      assert.match(onboardingSource, /buildingPlanDotHidden: \{\s*color: 'transparent',/);
      assert.match(onboardingSource, /setBuildingPlanComplete\(true\)/);

      // The pulse is one animated node PER ROW, never one shared between
      // them. A single interpolation is a single native node and
      // PropsAnimatedNode holds exactly one connectedViewTag, so a shared one
      // had to leave one row and join the next inside the same Fabric mount
      // batch — and when the connect landed first it threw "Animated node N
      // is already attached to a view" and killed the app ~85 % through the
      // build (2026-08-24). Two nodes cannot collide.
      assert.match(onboardingSource, /const buildingPlanPulseScales = useRef\(/);
      assert.match(onboardingSource, /const buildingPlanPulseOpacities = useRef\(/);
      assert.match(onboardingSource, /opacity: buildingPlanPulseOpacities\[index\]/);
      assert.match(onboardingSource, /scale: buildingPlanPulseScales\[index\]/);
      assert.doesNotMatch(
        onboardingSource,
        /const buildingPlanPulse(Scale|Opacity) = useRef\(/,
        'one pulse node shared across the step rows is the crash this guards',
      );

      // And the caption fade rides a plain View. On the Text it sat on a
      // subtree whose children relay four times a second (the ellipsis), in
      // the same batch as the phase change that was already racing.
      assert.match(
        onboardingSource,
        /<Animated\.View style=\{\{ opacity: buildingPlanCaptionOpacity \}\}>/,
      );
      assert.doesNotMatch(
        onboardingSource,
        /<Animated\.Text style=\{\[styles\.buildingPlanThinkingText/,
      );

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
