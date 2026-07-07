const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboardingSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'OnboardingScreen.tsx'),
  'utf8',
);
const welcomeSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'WelcomeScreen.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'App.tsx'),
  'utf8',
);
const iconSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'GymlogIcon.tsx'),
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
    name: 'onboarding review step uses the light plan-ready flow',
    run() {
      const reviewBody = getFunctionBody('renderReview');
      const dayBody = getFunctionBody('renderPlanReadyDay');
      const accountBody = getFunctionBody('renderPlanReadyAccount');

      // Plan-ready is a three-view flow: overview -> day preview -> account gate.
      assert.match(onboardingSource, /const \[planReadyView, setPlanReadyView\] = useState<'overview' \| 'day' \| 'account'>\('overview'\)/);
      assert.match(reviewBody, /if \(planReadyView === 'account'\) \{\s*return renderPlanReadyAccount\(\);/);
      assert.match(reviewBody, /if \(planReadyView === 'day'\) \{\s*return renderPlanReadyDay\(\);/);

      // Overview: kicker, dynamic block title, meta line, gradient cover with stats.
      assert.match(reviewBody, /YOUR PLAN IS READY/);
      assert.match(reviewBody, /\$\{planReadyWeeks\}-Week Progress Plan/);
      assert.match(reviewBody, /BUILD · FOCUS · PROGRESS/);
      assert.match(reviewBody, /\[String\(planReadyTotalWorkouts\), 'Workouts'\]/);
      assert.match(reviewBody, /\[String\(planReadyWeeks\), 'Weeks'\]/);
      assert.match(reviewBody, /\[String\(planReadyPerWeek\), 'Per week'\]/);
      assert.match(reviewBody, /planReadyPayload\.fourWeekProgression\.map/);
      assert.match(reviewBody, /planReadyWeekRows\.map/);
      assert.match(reviewBody, /`Week \$\{row\.week\}`/);
      assert.match(reviewBody, /`\$\{planReadyPerWeek\} workouts`/);

      // Day view: day kicker/focus title, week badge, A/B/C tabs, numbered list.
      assert.match(dayBody, /`DAY \$\{selectedIndex \+ 1\} OF \$\{dayCount\}`/);
      assert.match(dayBody, /`\$\{dayFocus\} Focus`/);
      assert.match(dayBody, /`Week 1 of \$\{planReadyWeeks\}`/);
      assert.match(dayBody, /String\.fromCharCode\(65 \+ index\)/);
      assert.match(dayBody, /setPlanReadyWorkoutPage\(tab\.index\)/);
      assert.match(dayBody, /\? 'EXERCISE' : 'EXERCISES'/);
      assert.match(dayBody, /String\(index \+ 1\)\.padStart\(2, '0'\)/);
      assert.match(dayBody, /exercise\.setsLabel/);
      assert.match(dayBody, /exercise\.repsLabel/);

      // Account gate: save copy + three providers, all completing onboarding.
      assert.match(accountBody, /Save your plan/);
      assert.match(accountBody, /Continue with Google/);
      assert.match(accountBody, /Continue with Apple/);
      assert.match(accountBody, /Use email instead/);
      assert.match(accountBody, /onCompleteToTraining\(selection, activeRecommendedProgramId\)/);

      // Footer drives the flow and hides on the account gate.
      assert.match(onboardingSource, /if \(planReadyView === 'overview'\) \{[\s\S]*setPlanReadyView\('day'\)/);
      assert.match(onboardingSource, /setPlanReadyView\('account'\)/);
      assert.match(onboardingSource, /const footerVisible = !\(stage === 'review' && planReadyView === 'account'\)/);
      assert.match(onboardingSource, /\? 'Save plan & start'\s*: 'See day 1'/);

      // App-side save truthfulness: persist the plan and activate it before
      // landing on Home (no auto-started workout in the light flow).
      assert.match(appSource, /function waitForPlanSaveFeedback\(\)[\s\S]*setTimeout\(resolve, 3000\)/);
      assert.match(appSource, /function buildSavedOnboardingPlan\([\s\S]*buildRecommendationPlanReadyPayload\(selection, recommendedProgramId\)[\s\S]*upsertWorkoutTemplate\(savedPlan\.draft\)/);
      assert.match(appSource, /handleOnboardingCompleteToTraining[\s\S]*waitForPlanSaveFeedback\(\)[\s\S]*persistSetupSelection\(selection, recommendedProgramId\)[\s\S]*upsertWorkoutTemplate\(savedPlan\.draft\)[\s\S]*upsertWorkoutPlan\(activePlan\)[\s\S]*updatePreferences\(\{ activePlanId: activePlan\.id \}\)[\s\S]*resetToRoute\(ROOT_ROUTES\.home\)/);

      // The removed dark plan-ready must stay gone.
      assert.doesNotMatch(onboardingSource, /PLAN_READY_GYM_BACKDROP_SOURCE/);
      assert.doesNotMatch(onboardingSource, /planReadyHeroGradient/);
      assert.doesNotMatch(onboardingSource, /planReadyFitSummaryPanel/);
      assert.doesNotMatch(onboardingSource, /planReadyDetailSheet/);
      assert.doesNotMatch(onboardingSource, /planReadyProgramOverviewVisible/);
      assert.doesNotMatch(onboardingSource, /VIEW FULL PROGRAM/);
      assert.doesNotMatch(onboardingSource, /'SAVE PLAN & START'/);
      assert.doesNotMatch(reviewBody, /WHY THIS PLAN\?/);
      assert.doesNotMatch(reviewBody, /PLAN OVERVIEW/);
      assert.doesNotMatch(reviewBody, /YOUR WORKOUT PLAN/);
    },
  },
  {
    name: 'onboarding footer requires one focus area and guards invalid and busy transitions',
    run() {
      const canContinueStart = onboardingSource.indexOf('const canContinue =');
      const locationStageActiveStart = onboardingSource.indexOf('const locationStageActive =');
      assert.notEqual(canContinueStart, -1, 'canContinue should exist');
      assert.notEqual(locationStageActiveStart, -1, 'locationStageActive should exist');

      const canContinueBlock = onboardingSource.slice(canContinueStart, locationStageActiveStart);
      assert.match(canContinueBlock, /stage === 'profile'[\s\S]*profileLevelSelected && profileFrequencySelected && profileGenderSelected/);
      assert.match(canContinueBlock, /stage === 'planning'[\s\S]*focusAreas\.length > 0/);
      assert.match(onboardingSource, /if \(!canContinue \|\| busy\)/);
      assert.match(onboardingSource, /disabled=\{!canContinue \|\| busy\}/);
    },
  },
  {
    name: 'onboarding uses five input steps and builds directly from step 5',
    run() {
      const aboutBody = getFunctionBody('renderAbout');
      const footerStart = onboardingSource.indexOf('const footerPrimaryLabel =');
      assert.notEqual(footerStart, -1, 'footerPrimaryLabel should exist');
      const footerBody = onboardingSource.slice(footerStart, onboardingSource.indexOf('<Modal', footerStart));

      assert.match(onboardingSource, /const STAGES: SetupStage\[\] = \['location', 'goal', 'profile', 'planning', 'about', 'review'\]/);
      assert.match(onboardingSource, /const ONBOARDING_PROGRESS_STAGES: SetupStage\[\] = \['location', 'goal', 'profile', 'planning', 'about'\]/);
      assert.match(onboardingSource, /ONBOARDING_PROGRESS_STAGES\.map/);
      assert.doesNotMatch(onboardingSource, /const STAGES: SetupStage\[\] = \[[^\]]*'focus'/);
      assert.doesNotMatch(onboardingSource, /function renderFocus\(/);
      assert.match(aboutBody, /stepLabel: 'STEP 5 OF 5'/);
      assert.match(footerBody, /stage === 'about'[\s\S]*'Build my plan'/);
      assert.match(footerBody, /if \(stage === 'about'\) \{[\s\S]*setIsBuildingPlan\(true\)/);
      assert.doesNotMatch(footerBody, /stage === 'focus'/);
      assert.doesNotMatch(onboardingSource, /stage === 'focus'/);
      assert.doesNotMatch(onboardingSource, /renderFocus\(\)/);
    },
  },
  {
    name: 'onboarding bodyweight step adapts target weight by selected goal',
    run() {
      assert.match(onboardingSource, /function getBodyweightGoalMode\(goals: SetupGoal\[\]\)/);
      assert.match(onboardingSource, /goals\.includes\('lean_athletic'\)/);
      assert.match(onboardingSource, /return 'required'/);
      assert.match(onboardingSource, /goals\.includes\('muscle'\)/);
      assert.match(onboardingSource, /return 'optional'/);

      const aboutBody = getFunctionBody('renderAbout');
      assert.match(aboutBody, /const bodyweightGoalMode = getBodyweightGoalMode\(\[bodyweightGoal\]\)/);

      // Goal-aware clamping still bounds the target weight.
      assert.match(onboardingSource, /function getBodyweightTargetLimits\(current: number, unit: UnitPreference, goal: SetupGoal\)/);
      assert.match(onboardingSource, /function clampTargetBodyweightForGoal\(/);
      assert.match(onboardingSource, /goal === 'lean_athletic'[\s\S]*max: safeCurrent/);
      assert.match(onboardingSource, /goal === 'muscle'[\s\S]*min: safeCurrent/);
      assert.match(aboutBody, /clampTargetBodyweightForGoal\(/);
      assert.match(aboutBody, /setTargetBodyweight/);

      // Steppers replace the old target slider; the hint copy adapts by goal mode.
      assert.match(aboutBody, /label=\{`Current Weight \(\$\{unitPreference\.toUpperCase\(\)\}\)`\}/);
      assert.match(aboutBody, /label=\{`Goal Weight \(\$\{unitPreference\.toUpperCase\(\)\}\)`\}/);
      assert.match(aboutBody, /bodyweightGoalMode === 'required'/);
      assert.match(aboutBody, /'Set a target weight to stay on track\.'/);
      assert.match(aboutBody, /'Only if you have a target in mind\.'/);
      assert.doesNotMatch(aboutBody, /<BodyweightTargetSlider/);
      assert.match(onboardingSource, /function BodyweightStepper\(/);
      assert.match(onboardingSource, /<TextInput[\s\S]*keyboardType="decimal-pad"/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{allowScrollBounce\}/);
    },
  },
  {
    name: 'onboarding step 5 expected outcome uses compact timeline structure',
    run() {
      const aboutBody = getFunctionBody('renderAbout');

      assert.match(aboutBody, /stepLabel: 'STEP 5 OF 5'/);
      assert.match(aboutBody, /: \['Expected', 'outcome'\]/);
      assert.match(aboutBody, /<BodyweightGoalOptionCard/);
      assert.match(aboutBody, /<BodyweightStepper/);
      assert.match(aboutBody, /<BodyweightSummaryRow/);
      assert.match(aboutBody, /<BodyweightTimelineCard current=\{bodyweightPickerValue\} target=\{targetBodyweight\} unit=\{unitPreference\}/);
      assert.doesNotMatch(aboutBody, /<BodyweightExpectationCard/);
      assert.match(onboardingSource, /const BODYWEIGHT_GOAL_OPTIONS/);
      assert.match(onboardingSource, /function BodyweightGoalOptionCard\(/);
      assert.match(onboardingSource, /function BodyweightStepper\(/);
      assert.match(onboardingSource, /function BodyweightSummaryRow\(/);
      assert.match(onboardingSource, /function BodyweightTimelineCard\(/);
      assert.doesNotMatch(onboardingSource, /function BodyweightExpectationCard\(/);
      assert.match(onboardingSource, /function BodyweightGoalTrendIcon\(/);
      assert.match(onboardingSource, /import Svg, \{ Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop \} from 'react-native-svg'/);
      assert.match(onboardingSource, /strokeLinecap="round"/);
      assert.match(onboardingSource, /strokeLinejoin="round"/);
      assert.match(onboardingSource, /'M12 15 V4'/);
      assert.match(onboardingSource, /'M12 3 V14'/);
      assert.match(onboardingSource, /icon: 'up'/);
      assert.match(onboardingSource, /accentColor: '#8BDEAE'/);
      assert.match(onboardingSource, /icon: 'flat'/);
      assert.match(onboardingSource, /accentColor: '#8FCAFF'/);
      assert.match(onboardingSource, /icon: 'down'/);
      assert.match(onboardingSource, /accentColor: '#D9A9FF'/);
      assert.match(onboardingSource, /bodyweightSliderRow/);
      assert.match(onboardingSource, /bodyweightSliderCard:\s*\{[\s\S]*minHeight: 50/);
      assert.match(onboardingSource, /bodyweightSliderTrackWrap:\s*\{[\s\S]*flex: 1/);
      assert.match(onboardingSource, /bodyweightGoalGrid/);
      assert.match(onboardingSource, /bodyweightGoalCard:\s*\{[\s\S]*minHeight: 86/);
      assert.match(onboardingSource, /bodyweightGoalCard:\s*\{[\s\S]*paddingVertical: 10/);
      assert.match(onboardingSource, /bodyweightSummaryRow:\s*\{[\s\S]*minHeight: 58/);
      assert.match(onboardingSource, /bodyweightTimelineCard:\s*\{[\s\S]*minHeight: 236/);
      assert.match(onboardingSource, /Expected timeline/);
      assert.match(onboardingSource, /Based on a sustainable weekly rate\. You can adjust this later\./);
      assert.match(onboardingSource, /Today\{"\\n"\}\{formatBodyweightDisplay\(current, unit\)\}/);
      assert.match(onboardingSource, /Target\{"\\n"\}\{formatBodyweightDisplay\(target, unit\)\}/);
      assert.match(onboardingSource, /bodyweightStageContent:\s*\{[\s\S]*translateY: -12/);

      const timelineStart = onboardingSource.indexOf('function BodyweightTimelineCard(');
      const timelineEnd = onboardingSource.indexOf('\nfunction StepDots', timelineStart);
      assert.notEqual(timelineStart, -1, 'BodyweightTimelineCard should exist');
      assert.notEqual(timelineEnd, -1, 'BodyweightTimelineCard should be followed by StepDots');
      const timelineBody = onboardingSource.slice(timelineStart, timelineEnd);
      assert.match(timelineBody, /const curve = `M18 \$\{startY\} C100 \$\{startY\}, 196 \$\{endY\}, 302 \$\{endY\}`/);
      assert.match(timelineBody, /stroke=\{ONBOARDING_PRIMARY\}/);
      assert.doesNotMatch(timelineBody, /bodyweightTimelineIcon/);
      assert.doesNotMatch(timelineBody, /bodyweightExpectation/);
    },
  },
  {
    name: 'onboarding step 2 uses the light sentence-case primary-goal cards',
    run() {
      const goalBody = getFunctionBody('renderGoal');

      assert.match(goalBody, /stepLabel: 'STEP 2 OF 5'/);
      assert.match(goalBody, /titleLines: \['What do you', 'want most\?'\]/);
      assert.match(goalBody, /We'll build your training around this\./);
      assert.match(goalBody, /renderSplitSelectionStage\(\{/);
      assert.match(goalBody, /roomyCards: true/);
      assert.doesNotMatch(goalBody, /compactCards: true/);
      assert.match(goalBody, /optionsContainerStyle: styles\.locationStepTwoOptionsShift/);
      assert.match(goalBody, /topPaneStyleOverride: styles\.locationEquipmentTopPane/);
      assert.match(goalBody, /titleStyleOverride: styles\.locationEquipmentHeadline/);
      assert.match(goalBody, /active: goal === option\.id/);
      assert.doesNotMatch(goalBody, /goals\.includes\(option\.id\)/);
      assert.match(onboardingSource, /title: 'Get stronger'/);
      assert.match(onboardingSource, /goal: 'lean_athletic'/);
      assert.match(onboardingSource, /goal: 'general_fitness'/);
      assert.match(onboardingSource, /getLocationFocusBadgeStyle\(tag\.tone\)/);
      assert.match(onboardingSource, /getLocationFocusBadgeTextStyle\(tag\.tone\)/);
      // Sentence case replaced the old shouty two-line headline.
      assert.doesNotMatch(goalBody, /WHAT DO YOU/);
      assert.doesNotMatch(goalBody, /WANT MOST\?/);
      assert.doesNotMatch(goalBody, /Pick one or more/);
    },
  },
  {
    name: 'onboarding step 3 uses training profile controls',
    run() {
      const profileBody = getFunctionBody('renderProfile');

      assert.match(profileBody, /stepLabel: 'STEP 3 OF 5'/);
      assert.match(profileBody, /titleLines: \['Training profile'\]/);
      assert.match(profileBody, /We'll tailor your plan to your experience and availability\./);
      assert.match(profileBody, /TRAINING_LEVEL_OPTIONS\.map/);
      assert.match(profileBody, /TRAINING_FREQUENCY_OPTIONS\.map/);
      assert.match(profileBody, /GENDER_OPTIONS\.map/);
      assert.match(profileBody, /setLevel\(option\.level\)/);
      assert.match(profileBody, /setDaysPerWeek\(option\.value\)/);
      assert.match(profileBody, /setGender\(option\.gender\)/);
      assert.match(profileBody, /Program Fit/);
      assert.match(profileBody, /Your plan preview/);
      assert.match(profileBody, /trainingPlanMetricsRow/);
      assert.match(profileBody, /setupSummary\.duration\.replace\(' sessions', ''\)/);
      assert.doesNotMatch(profileBody, /Â|Å|â/);
      assert.doesNotMatch(profileBody, /AgeSlider/);
      assert.match(onboardingSource, /level: 'advanced'/);
      assert.match(onboardingSource, /\{ value: 6, title: '6\+', body: 'days' \}/);
      assert.match(onboardingSource, /function getTrainingProfileSetupSummary\(level: SetupLevel, daysPerWeek: SetupDaysPerWeek\)/);
      assert.match(onboardingSource, /trainingProfileTopPane:\s*\{[\s\S]*height: 206/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderWidth: 2/);
      assert.match(onboardingSource, /trainingExperienceCard:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderColor: ONBOARDING_BORDER_ACTIVE[\s\S]*backgroundColor: ONBOARDING_CARD_ACTIVE/);
      // Light redesign: experience card title 17/21 (design onb-screens2 = 15.5/800,
      // within the handoff's 1-2px tolerance), body 12/15. Weight stays 800/600.
      assert.match(onboardingSource, /trainingExperienceTitle:\s*\{[\s\S]*fontSize: 17[\s\S]*lineHeight: 21/);
      assert.match(onboardingSource, /trainingExperienceBody:\s*\{[\s\S]*fontSize: 12[\s\S]*lineHeight: 15/);
      assert.match(onboardingSource, /trainingGenderTileActive:\s*\{[\s\S]*borderColor: ONBOARDING_BORDER_ACTIVE/);
      assert.match(onboardingSource, /trainingGenderTitle:\s*\{[\s\S]*fontSize: 14/);
    },
  },
  {
    name: 'onboarding step 4 uses anatomy-highlight focus cards',
    run() {
      const planningBody = getFunctionBody('renderPlanning');

      assert.match(planningBody, /stepLabel: 'STEP 4 OF 5'/);
      assert.match(planningBody, /titleLines: \['What do you', 'want to focus on\?'\]/);
      assert.match(planningBody, /FOCUS_AREA_OPTIONS\.filter\(\(option\) => option\.area !== 'mobility'\)/);
      assert.match(planningBody, /visibleFocusOptions\.slice\(0, 3\)/);
      assert.match(planningBody, /visibleFocusOptions\.slice\(6, 9\)/);
      assert.match(planningBody, /<FocusAreaBodyCard/);
      assert.match(planningBody, /Why focus areas\?/);
      assert.match(planningBody, /This helps us build a program that prioritizes what matters most to you\./);
      assert.match(planningBody, /Pick 1-2 areas/);

      // Anatomy-highlight cards replace the old photo cards entirely.
      assert.match(onboardingSource, /function FocusAreaBodyCard\(/);
      assert.match(onboardingSource, /FOCUS_AREA_BODY_FRAMING\[option\.area\]/);
      assert.match(onboardingSource, /accessibilityState=\{\{ selected: active \}\}/);
      assert.doesNotMatch(onboardingSource, /FOCUS_AREA_CARD_ASSETS/);
      assert.doesNotMatch(planningBody, /focusAreaImageSlot/);
      assert.match(onboardingSource, /const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions\(\)/);
      assert.match(onboardingSource, /current\.length >= 2/);
      assert.doesNotMatch(planningBody, /Upper Body/);
      assert.doesNotMatch(planningBody, /Lower Body/);
      assert.doesNotMatch(planningBody, /Performance/);
    },
  },
  {
    name: 'launch splash waits on every app start and welcome copy is plan focused',
    run() {
      assert.match(appSource, /const \[minimumSplashElapsed, setMinimumSplashElapsed\] = useState\(false\)/);
      assert.match(appSource, /if \(!minimumSplashElapsed\) \{\s*return;\s*\}/);
      assert.doesNotMatch(appSource, /firstAppOpen/);

      // Light welcome: English plan-focused copy on the HG palette.
      assert.match(welcomeSource, /You go to the gym\./);
      assert.match(welcomeSource, /We handle the rest\./);
      assert.match(welcomeSource, /Start free/);
      assert.match(welcomeSource, /I already have an account/);
      assert.match(welcomeSource, /const BG = '#F7F3FF'/);
      assert.match(welcomeSource, /const PURPLE = '#7C3AED'/);
      assert.match(welcomeSource, /logoInk/);
      assert.match(welcomeSource, /logoPurple/);
      assert.match(welcomeSource, /AI-built plans/);
      assert.match(welcomeSource, /Recovery aware/);
      assert.doesNotMatch(welcomeSource, /Sinä menet salille/);
      assert.doesNotMatch(welcomeSource, /Aloita ilmaiseksi/);
      assert.doesNotMatch(welcomeSource, /GYMLOG/);
      assert.doesNotMatch(welcomeSource, /#0f0f0f/);
    },
  },
  {
    name: 'onboarding selection steps keep vertical layout still and progress aligned',
    run() {
      const locationChoiceBody = onboardingSource.slice(
        onboardingSource.indexOf('function LocationChoiceCard'),
        onboardingSource.indexOf('function PhotoSelectionCard'),
      );

      // Selection highlight is a subtle scale (max 1.5%), never a layout jump.
      assert.match(locationChoiceBody, /outputRange: \[1, 1\.015\]/);
      assert.doesNotMatch(locationChoiceBody, /outputRange: \[1, 1\.1/);
      assert.match(onboardingSource, /const fixedTopPaneHeight = Math\.min\(380, Math\.round\(locationStageHeight \* 0\.34\) \+ 34\)/);
      assert.match(onboardingSource, /styles\.locationTopPane, \{ height: fixedTopPaneHeight \}, topPaneStyle/);
      assert.match(onboardingSource, /<View pointerEvents="none" style=\{styles\.locationProgressBarWrap\}>[\s\S]*<StepDots index=\{stageIndex\} \/>/);
      assert.match(onboardingSource, /bodyweightTopPane:\s*\{[\s\S]*height: 214/);
      assert.match(onboardingSource, /focusAreaTopPane:\s*\{[\s\S]*height: 206/);
      assert.match(onboardingSource, /stage === 'planning'/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{allowScrollBounce\}/);
      assert.match(onboardingSource, /alwaysBounceVertical=\{allowScrollBounce\}/);
      assert.match(onboardingSource, /overScrollMode=\{allowScrollBounce \? 'auto' : 'never'\}/);
      // Steps 1-2 (location/goal) scroll so expanded benefits / wrapped chips stay reachable.
      assert.doesNotMatch(onboardingSource, /const scrollLockedStage =\s*stage === 'location'/);
      assert.doesNotMatch(onboardingSource, /const scrollLockedStage =\s*stage === 'location' \|\|\s*stage === 'goal'/);
      assert.match(onboardingSource, /const allowScrollBounce = !scrollLockedStage && stage !== 'location' && stage !== 'goal'/);
      // Step 2 goal chips wrap instead of truncating.
      assert.match(onboardingSource, /locationChoiceTagRow:\s*\{[\s\S]*flexWrap: 'wrap'/);
    },
  },
  {
    name: 'plan-ready screens share the light onboarding palette',
    run() {
      assert.match(onboardingSource, /const ONBOARDING_PANEL = '#F7F3FF'/);
      assert.match(onboardingSource, /const ONBOARDING_CARD = '#FFFFFF'/);
      assert.match(onboardingSource, /const ONBOARDING_PRIMARY = '#7C3AED'/);
      assert.match(onboardingSource, /const ONBOARDING_TEXT = '#101828'/);
      // The old black plan-ready stage is gone.
      assert.doesNotMatch(onboardingSource, /planReadyStage:\s*\{\s*backgroundColor: '#050505'/);
      assert.doesNotMatch(onboardingSource, /planReadyHeader:/);
      // Week rows are white cards; cover stats stay readable on the purple cover.
      assert.match(onboardingSource, /planReadyOverviewWeekRow:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /planReadyOverviewStatValue:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(onboardingSource, /planReadyOverviewKicker:\s*\{[\s\S]*color: ONBOARDING_PRIMARY/);
    },
  },
  {
    name: 'plan-ready alternatives are hidden from the ready hero',
    run() {
      const reviewBody = getFunctionBody('renderReview');

      assert.doesNotMatch(reviewBody, /const nextPlanOption = planReadyOptions\[0\] \?\? null/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeek/);
      assert.doesNotMatch(reviewBody, /See other plans/);
      assert.doesNotMatch(reviewBody, /setPlanReadyOptionsMenuOpen/);
      assert.doesNotMatch(reviewBody, /planReadyOptionsMenuOpen \? \(/);
      assert.doesNotMatch(reviewBody, /planReadyOptionsMenuItem/);
      assert.doesNotMatch(reviewBody, /planReadyOptionsMenuFooter/);
      assert.doesNotMatch(reviewBody, /setSelectedRecommendationProgramId\(option\.id\)/);
      assert.doesNotMatch(onboardingSource, /planReadyOtherPlansPeek:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyOtherPlansLabel:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyOptionsMenu:\s*\{/);
      assert.match(reviewBody, /Animated\.View/);
      assert.match(reviewBody, /planReadyCardTranslateX/);
      assert.match(reviewBody, /planReadyCardOpacity/);
      assert.match(onboardingSource, /Animated\.timing\(planReadyCardTranslateX/);
      assert.doesNotMatch(reviewBody, /SEE OTHER PLANS/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansRail/);
      assert.doesNotMatch(reviewBody, /PROGRAM OPTIONS PREVIEW/);
      assert.doesNotMatch(reviewBody, /ALTERNATIVE PLAN/);
    },
  },
  {
    name: 'plan-ready summary derives its numbers from the recommendation payload',
    run() {
      const reviewBody = getFunctionBody('renderReview');
      const dayBody = getFunctionBody('renderPlanReadyDay');

      // Weeks / per-week / total workouts come from the payload with safe fallbacks.
      assert.match(reviewBody, /const planReadyWeeks = planReadyPayload\.blockLengthWeeks > 0 \? planReadyPayload\.blockLengthWeeks : 4/);
      assert.match(reviewBody, /planReadyPayload\.programDaysPerWeek[\s\S]*projectedDaysPerWeek[\s\S]*planReadyPayload\.requestedDaysPerWeek/);
      assert.match(reviewBody, /const planReadyTotalWorkouts = planReadyWeeks \* planReadyPerWeek/);

      // Meta line: goal / location / level / cadence, dot separated.
      assert.match(reviewBody, /\[goalLabel, locationLabel, levelLabel, `\$\{planReadyPerWeek\} days \/ week`\]/);

      // Week rows strip the "Week N:" prefix from progression labels.
      assert.match(reviewBody, /phase\.label\.replace/);
      assert.match(reviewBody, /planReadyPayload\.fourWeekProgression\.map/);

      // Day view derives its focus and muscle groups from real session content.
      assert.match(dayBody, /const focusOf = \(name: string, index: number\)/);
      assert.match(dayBody, /normalized\.includes\('full'\)/);
      assert.match(dayBody, /const groupOf = \(name: string\)/);
      assert.match(dayBody, /projectedSessions/);
      assert.match(dayBody, /selectedSession\?\.guidance\?\.estimatedDuration/);
      assert.match(onboardingSource, /const \[planReadyWorkoutPage, setPlanReadyWorkoutPage\] = useState\(0\)/);
      assert.match(onboardingSource, /buildRecommendationPlanReadyPayload/);
      assert.match(iconSource, /\| 'eye'/);
    },
  },
];
