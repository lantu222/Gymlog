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

      // Overview: "Your program is ready" H1 + subtitle, then the 2-card result:
      // a big RECOMMENDED program card (why-line + stat trio + week link) and a
      // smaller ALTERNATIVE card that swaps the selection. No week rows.
      assert.match(reviewBody, />Your program is ready</);
      assert.doesNotMatch(reviewBody, /YOUR PLAN IS READY/);
      assert.match(reviewBody, /`\$\{planReadyPerWeek\} workouts a week`/);
      assert.doesNotMatch(reviewBody, /BUILD · FOCUS · PROGRESS/);
      assert.match(reviewBody, /\[String\(planReadyTotalWorkouts\), 'workouts total'\]/);
      assert.match(reviewBody, /\[planReadySessionLength, 'per session'\]/);
      assert.match(reviewBody, />RECOMMENDED</);
      assert.match(reviewBody, />ALTERNATIVE</);
      assert.match(reviewBody, /setSelectedRecommendationProgramId\(planReadyAlternative\.id\)/);
      assert.match(reviewBody, /setPlanReadyView\('day'\)/);
      assert.doesNotMatch(reviewBody, /planReadyWeekRows\.map/);
      assert.doesNotMatch(reviewBody, /planReadyOverviewWeekBadge/);

      // Day view: read-only preview — day title is the session name (one source
      // of truth), no A-F switcher, no letter badges, numbered exercise list.
      assert.match(dayBody, /`DAY \$\{selectedIndex \+ 1\} OF \$\{dayCount\}`/);
      assert.match(dayBody, /const dayTitle = selectedSession\?\.name/);
      assert.match(dayBody, /`Week 1 of \$\{planReadyWeeks\}`/);
      assert.doesNotMatch(dayBody, /planReadyDayTab/);
      assert.doesNotMatch(dayBody, /setPlanReadyWorkoutPage\(tab\.index\)/);
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

      // Overview is the primary "Save plan & start" surface; the recommended
      // card's "View the week" link opens the read-only day preview whose footer
      // only returns to the plan ("Back to plan"). Footer hides only on the
      // account gate — never leaving the user stuck without a way back.
      assert.match(onboardingSource, /setPlanReadyWorkoutPage\(0\);\s*setPlanReadyView\('day'\)/);
      assert.match(onboardingSource, /if \(planReadyView === 'day'\) \{\s*setPlanReadyView\('overview'\);/);
      assert.match(onboardingSource, /setPlanReadyView\('account'\)/);
      assert.match(onboardingSource, /const footerVisible = !\(stage === 'review' && planReadyView === 'account'\)/);
      assert.doesNotMatch(onboardingSource, /: 'See day 1'/);
      assert.match(onboardingSource, /\? 'Back to plan'\s*: 'Save plan & start'/);

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
      assert.match(canContinueBlock, /stage === 'level'[\s\S]*profileLevelSelected/);
      assert.match(canContinueBlock, /stage === 'days'[\s\S]*profileFrequencySelected/);
      assert.match(canContinueBlock, /stage === 'planning'[\s\S]*focusAreas\.length > 0/);
      assert.match(onboardingSource, /if \(!canContinue \|\| busy\)/);
      assert.match(onboardingSource, /disabled=\{!canContinue \|\| busy\}/);
    },
  },
  {
    name: 'onboarding uses five input steps and builds directly from focus areas',
    run() {
      const footerStart = onboardingSource.indexOf('const footerPrimaryLabel =');
      assert.notEqual(footerStart, -1, 'footerPrimaryLabel should exist');
      const footerBody = onboardingSource.slice(footerStart, onboardingSource.indexOf('<Modal', footerStart));

      assert.match(onboardingSource, /const STAGES: SetupStage\[\] = \['location', 'goal', 'level', 'days', 'planning', 'review'\]/);
      assert.match(onboardingSource, /const ONBOARDING_PROGRESS_STAGES: SetupStage\[\] = \['location', 'goal', 'level', 'days', 'planning'\]/);
      assert.match(onboardingSource, /ONBOARDING_PROGRESS_STAGES\.map/);
      // STEP n OF m labels are computed from the stage array, never hardcoded,
      // so inserting the avoid stage later renumbers everything automatically.
      assert.match(onboardingSource, /function getQuestionnaireStepLabel\(stage: SetupStage\)/);
      assert.doesNotMatch(onboardingSource, /stepLabel: 'STEP \d OF \d'/);
      // Focus areas is the last question; building starts straight from it.
      assert.match(footerBody, /stage === 'planning'[\s\S]*'Build my plan'/);
      assert.match(footerBody, /if \(stage === 'planning'\) \{[\s\S]*setIsBuildingPlan\(true\)/);
    },
  },
  {
    name: 'onboarding step 1 asks what you can train with using equipment chips',
    run() {
      const locationBody = getFunctionBody('renderLocation');

      assert.match(locationBody, /titleLines: \['What can you', 'train with\?'\]/);
      assert.doesNotMatch(locationBody, /Where do you train\?/);
      // Selected setup expands into toggle chips with a live count; the other
      // setups collapse into compact rows under OR CHOOSE ANOTHER.
      assert.match(locationBody, /EQUIPMENT_CHIP_CATALOG\[selectedSetup\.id\]/);
      assert.match(locationBody, /\$\{equipmentItems\.length\} selected/);
      assert.match(locationBody, /OR CHOOSE ANOTHER/);
      assert.match(locationBody, /toggleEquipmentItem\(selectedSetup, item\)/);
      assert.match(locationBody, /compact/);
      assert.match(onboardingSource, /const EQUIPMENT_CHIP_CATALOG/);
      assert.match(onboardingSource, /const EQUIPMENT_DEFAULT_ITEMS/);
      // Three setups only; heavy home gear decides home_gym vs minimal_equipment.
      assert.doesNotMatch(onboardingSource, /id: 'minimal_equipment'/);
      assert.doesNotMatch(onboardingSource, /id: 'running_hybrid'/);
      assert.match(onboardingSource, /setTrainingEnvironment\(hasHeavy \? 'home_gym' : 'minimal_equipment'\)/);
      // Chip labels persist into the setup selection and preferences.
      assert.match(onboardingSource, /const \[equipmentItems, setEquipmentItems\] = useState<string\[\]>\(setupSeed\.equipmentItems \?\? \[\]\)/);
      assert.match(appSource, /setupEquipmentItems: selection\.equipmentItems \?\? \[\]/);
      // No "why it's great" expansion anywhere.
      assert.doesNotMatch(onboardingSource, /WHY IT'S GREAT/);
    },
  },
  {
    name: 'onboarding no longer asks gender or goal weight mid-questionnaire',
    run() {
      // Name/gender/age/height/weight arrive from the About-you screen (01e)
      // via basicsSeed; the old Training profile gender block and the whole
      // bodyweight-goal stage are gone from the stage machine.
      assert.doesNotMatch(onboardingSource, /stage === 'profile'/);
      assert.doesNotMatch(onboardingSource, /stage === 'about'/);
      assert.doesNotMatch(onboardingSource, /function renderProfile\(/);
      assert.doesNotMatch(onboardingSource, /function renderAbout\(/);
      assert.doesNotMatch(onboardingSource, /bodyweightSetupStep/);
      assert.doesNotMatch(onboardingSource, /Program Fit/);
      assert.doesNotMatch(onboardingSource, /GENDER_OPTIONS\.map/);
      assert.doesNotMatch(onboardingSource, /profileGenderSelected/);
      // The seeded values still flow into the selection unchanged.
      assert.match(onboardingSource, /basicsSeed/);
      assert.match(onboardingSource, /gender,\r?\n\s*age,/);
      assert.match(onboardingSource, /currentWeightKg: currentWeightValue === null \? null : convertWeightToKg\(currentWeightValue, unitPreference\)/);
      assert.match(onboardingSource, /targetWeightKg: targetWeightValue === null \? null : convertWeightToKg\(targetWeightValue, unitPreference\)/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{allowScrollBounce\}/);
    },
  },
  {
    name: 'onboarding step 2 uses the light sentence-case primary-goal cards',
    run() {
      const goalBody = getFunctionBody('renderGoal');

      assert.match(goalBody, /stepLabel: getQuestionnaireStepLabel\('goal'\)/);
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
    name: 'onboarding splits training level and days into their own steps',
    run() {
      const levelBody = getFunctionBody('renderLevel');
      const daysBody = getFunctionBody('renderDays');

      assert.match(levelBody, /stepLabel: getQuestionnaireStepLabel\('level'\)/);
      assert.match(levelBody, /titleLines: \['Training level'\]/);
      assert.match(levelBody, /How much training experience do you have\?/);
      assert.match(levelBody, /TRAINING_LEVEL_OPTIONS\.map/);
      assert.match(levelBody, /setLevel\(option\.level\)/);
      assert.match(levelBody, /styles\.trainingExperienceCardActive/);
      assert.match(levelBody, /styles\.trainingProfileRadioActive/);
      assert.doesNotMatch(levelBody, /GENDER_OPTIONS/);
      assert.doesNotMatch(levelBody, /TRAINING_FREQUENCY_OPTIONS/);

      assert.match(daysBody, /stepLabel: getQuestionnaireStepLabel\('days'\)/);
      assert.match(daysBody, /titleLines: \['Training days'\]/);
      assert.match(daysBody, /How many days per week can you train\?/);
      assert.match(daysBody, /TRAINING_FREQUENCY_OPTIONS\.map/);
      assert.match(daysBody, /setDaysPerWeek\(option\.value\)/);
      assert.match(daysBody, /option\.recommendedFor\.includes\(level\)/);
      assert.match(daysBody, /Recommended/);
      assert.doesNotMatch(daysBody, /TRAINING_LEVEL_OPTIONS\.map/);

      assert.match(onboardingSource, /level: 'advanced'/);
      // Frequency is a clickable tier list (2–3 / 3–4 / 4+), not day-count chips.
      assert.match(onboardingSource, /value: 3, title: '2–3 days \/ week'/);
      assert.match(onboardingSource, /value: 4, title: '3–4 days \/ week'/);
      assert.match(onboardingSource, /value: 5, title: '4\+ days \/ week'/);
      assert.match(onboardingSource, /recommendedFor: \['beginner'\]/);
      assert.doesNotMatch(onboardingSource, /\{ value: 6, title: '6\+', body: 'days' \}/);
      assert.match(onboardingSource, /trainingProfileTopPane:\s*\{[\s\S]*height: 150/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderWidth: 2/);
      assert.match(onboardingSource, /trainingExperienceCard:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderColor: ONBOARDING_BORDER_ACTIVE[\s\S]*backgroundColor: ONBOARDING_CARD_ACTIVE/);
      assert.match(onboardingSource, /trainingExperienceTitle:\s*\{[\s\S]*fontSize: 17[\s\S]*lineHeight: 21/);
      assert.match(onboardingSource, /trainingExperienceBody:\s*\{[\s\S]*fontSize: 12[\s\S]*lineHeight: 15/);
    },
  },
  {
    name: 'onboarding step 4 uses anatomy-highlight focus cards',
    run() {
      const planningBody = getFunctionBody('renderPlanning');

      assert.match(planningBody, /stepLabel: getQuestionnaireStepLabel\('planning'\)/);
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
      assert.match(welcomeSource, /Continue with Google/);
      assert.match(welcomeSource, /Continue with Apple/);
      assert.match(welcomeSource, /Sign up with email/);
      assert.match(welcomeSource, /I already have an account/);
      assert.doesNotMatch(welcomeSource, /Start free/);
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
      // Step 1 is a flat selectable list like Step 2: no expanding benefits
      // panel and no per-card dim state (which caused the collapse-dim bug).
      assert.doesNotMatch(locationChoiceBody, /WHY IT'S GREAT FOR YOU/);
      assert.doesNotMatch(locationChoiceBody, /subdued \? 0\.6/);
      const renderLocationBody = getFunctionBody('renderLocation');
      assert.doesNotMatch(renderLocationBody, /benefits:/);
      assert.doesNotMatch(renderLocationBody, /subdued:/);
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
      // Week rows are expandable white cards; cover stats stay readable on the purple cover.
      assert.match(onboardingSource, /planReadyOverviewWeekCard:\s*\{[\s\S]*backgroundColor: ONBOARDING_CARD/);
      assert.match(onboardingSource, /planReadyOverviewStatRow:\s*\{[\s\S]*justifyContent: 'space-between'/);
      assert.match(onboardingSource, /planReadyOverviewStatValue:\s*\{[\s\S]*color: '#FFFFFF'/);
      // Decorative cover orb removed.
      assert.doesNotMatch(onboardingSource, /planReadyOverviewCoverGlow/);
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

      // Subtitle line: "{N}-week plan · goal · location", dot separated.
      assert.match(reviewBody, /\[`\$\{planReadyWeeks\}-week plan`, goalLabel, locationLabel\]/);
      assert.doesNotMatch(reviewBody, /\[goalLabel, locationLabel, levelLabel, `\$\{planReadyPerWeek\} days \/ week`\]/);

      // The recommended/alternative why-lines come from the waterfall decision.
      assert.match(reviewBody, /recommendation\.waterfall/);
      assert.match(reviewBody, /planReadyWhyPrimary/);
      assert.match(reviewBody, /planReadyWhyAlternative/);

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
