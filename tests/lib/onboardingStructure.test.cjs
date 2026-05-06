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
    name: 'onboarding review step uses the final plan-ready structure',
    run() {
      const reviewBody = getFunctionBody('renderReview');

      assert.match(reviewBody, /YOUR PLAN IS READY/);
      assert.match(reviewBody, /Built around your goals, schedule and recovery\./);
      assert.match(reviewBody, /YOUR WORKOUT PLAN/);
      assert.match(reviewBody, /WHY THIS PLAN\?/);
      assert.match(reviewBody, /PLAN OVERVIEW/);
      assert.doesNotMatch(reviewBody, /YOUR WEEKLY OVERVIEW/);
      assert.doesNotMatch(reviewBody, /WHAT TO EXPECT/);
      assert.match(reviewBody, /planReadyCardShell/);
      assert.match(reviewBody, /planReadyPlanCard/);
      assert.match(reviewBody, /planReadyCardContent/);
      assert.match(reviewBody, /planReadyHeroCard/);
      assert.match(reviewBody, /planReadyHeroImage/);
      assert.match(reviewBody, /PLAN_READY_GYM_BACKDROP_SOURCE/);
      assert.match(reviewBody, /planReadyHeroGradient/);
      assert.match(reviewBody, /planReadyHeroGradientTop/);
      assert.match(reviewBody, /planReadyHeroGradientMiddle/);
      assert.match(reviewBody, /planReadyHeroGradientBottom/);
      assert.match(reviewBody, /planReadyHeroTextScrim/);
      assert.doesNotMatch(reviewBody, /planReadyHeroCharacterImage/);
      assert.doesNotMatch(reviewBody, /planReadyHeroChipRow/);
      assert.match(reviewBody, /planReadyWeekPanel/);
      assert.doesNotMatch(reviewBody, /planReadyWhyMiniCard/);
      assert.doesNotMatch(reviewBody, /planReadyQuickDetail/);
      assert.doesNotMatch(reviewBody, /FIRST ACTION/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\?\.guidance\.firstAction/);
      assert.doesNotMatch(reviewBody, /planReadyInlineExerciseNames/);
      assert.doesNotMatch(reviewBody, /planReadyDetailsButton/);
      assert.doesNotMatch(reviewBody, /planReadyHeroTitleDetailsButton/);
      assert.doesNotMatch(reviewBody, /planReadyHeroTitleDetailsText/);
      assert.match(reviewBody, /planReadyFitSummaryPanel/);
      assert.match(reviewBody, /planReadyFitReasons/);
      assert.match(reviewBody, /planReadyOverviewCard/);
      assert.match(reviewBody, /planReadyWorkoutSingleCard/);
      assert.doesNotMatch(reviewBody, /planReadyBackButton/);
      assert.doesNotMatch(reviewBody, /planReadyDetailsIconButton/);
      assert.doesNotMatch(reviewBody, /planReadyInlineActions/);
      assert.doesNotMatch(reviewBody, /planReadyUsePlanButton/);
      assert.doesNotMatch(reviewBody, /Save plan & start/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeek/);
      assert.doesNotMatch(reviewBody, /See other plans/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansLabel/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeekFoldLine/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeekArrow/);
      assert.doesNotMatch(reviewBody, /planReadyOptionsMenu/);
      assert.doesNotMatch(reviewBody, /Other plans/);
      assert.doesNotMatch(reviewBody, /planReadyOptions\.map/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansRail/);
      assert.doesNotMatch(reviewBody, /SEE OTHER PLANS/);
      assert.match(reviewBody, /<GymlogIcon name="eye"/);
      assert.doesNotMatch(reviewBody, /setSelectedPlanReadySessionId\(planReadyPrimarySessionId\)/);
      assert.doesNotMatch(reviewBody, /onCompleteToStartingWeek\(selection, activeRecommendedProgramId\)/);
      assert.match(onboardingSource, /if \(stage === 'review'\) \{[\s\S]*onCompleteToStartingWeek\(selection, activeRecommendedProgramId\)/);
      assert.match(appSource, /handleOnboardingCompleteToStartingWeek[\s\S]*openStartingWeek\(recommendedProgramId, 'first_run'\)/);
      assert.match(reviewBody, /minHeight: planReadyStageMinHeight/);
      assert.doesNotMatch(reviewBody, /height: planReadyStageMinHeight/);
      assert.doesNotMatch(reviewBody, /CALORIES/);
      assert.doesNotMatch(reviewBody, /65%/);
      assert.doesNotMatch(reviewBody, /bottomNav|BottomTab|bottom bar/i);
      assert.doesNotMatch(reviewBody, /planReadyProgramCard/);
      assert.doesNotMatch(reviewBody, /planReadyWeekCard/);
      assert.doesNotMatch(reviewBody, /planReadyInsightPanel/);
      assert.doesNotMatch(reviewBody, /FIRST WORKOUT/);
      assert.doesNotMatch(onboardingSource, /buildRecommendationReasonLines/);
      assert.doesNotMatch(onboardingSource, /getFallbackReasonCopy/);
      assert.doesNotMatch(onboardingSource, /const recommendationReasonLines = useMemo/);
      assert.doesNotMatch(onboardingSource, /const planReadyTargetReason = useMemo/);
      assert.doesNotMatch(reviewBody, /recommendationReasonLines\[0\]/);
      assert.doesNotMatch(reviewBody, /planReadyTargetReason \?\? recommendationReasonLines\[1\]/);
      assert.doesNotMatch(reviewBody, /planReadyFallbackCopy/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout/);
      assert.doesNotMatch(reviewBody, /const planReadyPrimarySessionId/);
      assert.doesNotMatch(reviewBody, /const planReadyHeroChips: Array<\{ label: string; icon: GymlogIconName \}> = \[/);
      assert.match(onboardingSource, /buildSessionGuidance/);
      assert.match(onboardingSource, /formatPlanReadyExercisePrescription/);
      assert.match(onboardingSource, /formatPlanReadyExerciseRepTarget/);
      assert.match(onboardingSource, /formatPlanReadyExerciseSetLabel/);
      assert.match(onboardingSource, /formatPlanReadyExerciseRepLabel/);
      assert.match(onboardingSource, /hiddenExerciseCount: Math\.max\(0, session\.exercises\.length - 5\)/);
      assert.match(onboardingSource, /exercises: session\.exercises\.slice\(0, 5\)\.map/);
      assert.match(onboardingSource, /compactPrescription: formatPlanReadyExerciseRepTarget\(exercise\)/);
      assert.match(onboardingSource, /setsLabel: formatPlanReadyExerciseSetLabel\(exercise\)/);
      assert.match(onboardingSource, /repsLabel: formatPlanReadyExerciseRepLabel\(exercise\)/);
      assert.match(onboardingSource, /detailExercises: session\.exercises\.map/);
      assert.doesNotMatch(onboardingSource, /const \[planReadyOptionsMenuOpen, setPlanReadyOptionsMenuOpen\] = useState\(false\)/);
      assert.match(onboardingSource, /const \[selectedPlanReadySessionId, setSelectedPlanReadySessionId\] = useState<string \| null>\(null\)/);
      assert.match(onboardingSource, /const selectedPlanReadySession = useMemo/);
      assert.doesNotMatch(onboardingSource, /\.sort\(\(left, right\) => left\.orderIndex - right\.orderIndex\)\s*\n\s*\.slice\(0, 3\)/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.warmup/);
      assert.match(onboardingSource, /MAIN FOCUS/);
      assert.doesNotMatch(reviewBody, /KEY EXERCISES/);
      assert.match(onboardingSource, /ALL EXERCISES/);
      assert.match(onboardingSource, /PROGRESSION/);
      assert.doesNotMatch(onboardingSource, /FIRST ACTION/);
      assert.doesNotMatch(reviewBody, />View details</);
      assert.match(reviewBody, /setSelectedPlanReadySessionId\(planReadyActiveWorkout\.sessionId\)/);
      assert.match(reviewBody, /accessibilityLabel=\{`View \$\{planReadyActiveWorkout\.title\} details`\}/);
      assert.match(reviewBody, /styles\.planReadyWorkoutDetailsButton/);
      assert.match(reviewBody, /styles\.planReadyWorkoutHeaderActions/);
      assert.doesNotMatch(reviewBody, /Hide details/);
      assert.doesNotMatch(reviewBody, /expandedPlanReadySessionId === item\.sessionId/);
      assert.doesNotMatch(reviewBody, /item\.detailExercises\.map/);
      assert.match(onboardingSource, /<Modal\s+visible=\{Boolean\(selectedPlanReadySession\)\}/);
      assert.match(onboardingSource, /selectedPlanReadySession\.detailExercises\.map/);
      assert.match(onboardingSource, /planReadyWorkoutDetailHero/);
      assert.match(onboardingSource, /planReadyWorkoutDetailCloseRail/);
      assert.match(onboardingSource, /planReadyWorkoutDetailCloseButton/);
      assert.match(onboardingSource, /planReadyWorkoutDetailIconSlot/);
      assert.match(onboardingSource, /planReadyWorkoutExerciseIndexBubble/);
      assert.match(onboardingSource, /selectedPlanReadySession\.detailExercises\.map\(\(exercise, index\) =>/);
      assert.match(onboardingSource, /<GymlogIcon name="tempo" color="#B8FF6A"/);
      assert.match(onboardingSource, /<GymlogIcon name="progress" color="#B8FF6A"/);
      assert.match(onboardingSource, /<GymlogIcon name="strength" color="#B8FF6A"/);
      assert.match(onboardingSource, /planReadyDetailSheet:\s*\{[\s\S]*height: '100%'/);
      assert.match(onboardingSource, /planReadyDetailSheet:\s*\{[\s\S]*paddingTop: 14/);
      assert.match(onboardingSource, /planReadyDetailSheet:\s*\{[\s\S]*backgroundColor: '#000000'/);
      assert.match(onboardingSource, /planReadyWorkoutDetailCloseRail:\s*\{[\s\S]*minHeight: 66/);
      assert.match(onboardingSource, /planReadyWorkoutDetailCloseRail:\s*\{[\s\S]*paddingTop: 30/);
      assert.doesNotMatch(onboardingSource, /planReadyWorkoutDetailBackButton/);
      assert.doesNotMatch(onboardingSource, /planReadyWorkoutDetailBackText/);
      assert.doesNotMatch(onboardingSource, /planReadyWorkoutDetailCloseText/);
      assert.ok(
        onboardingSource.indexOf('style={styles.planReadyWorkoutDetailCloseRail}') <
          onboardingSource.indexOf('style={styles.planReadyWorkoutDetailHero}'),
        'workout detail close rail should render above the title hero',
      );
      assert.match(onboardingSource, /planReadyDetailScroll:\s*\{[\s\S]*flex: 1/);
      assert.doesNotMatch(onboardingSource, /<ScrollView\s+style=\{styles\.planReadyDetailScroll\}/);
      assert.match(onboardingSource, /planReadyWorkoutDetailKicker:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(onboardingSource, /planReadyWorkoutDetailBlock:\s*\{[\s\S]*backgroundColor: '#101010'/);
      assert.match(onboardingSource, /planReadyWorkoutExerciseBlock:\s*\{[\s\S]*backgroundColor: '#101010'/);
      assert.match(onboardingSource, /planReadyWorkoutExerciseRow:\s*\{[\s\S]*minHeight: 45/);
      assert.doesNotMatch(onboardingSource, /<View style=\{styles\.sheetHeader\}>[\s\S]*Workout details/);
      assert.match(onboardingSource, /setSelectedPlanReadySessionId\(null\)/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\.guidance\.warmup/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.warmup/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.mainFocus/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.progressionHint/);
      assert.doesNotMatch(onboardingSource, /selectedPlanReadySession\.guidance\.firstAction/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\.exercises\.map/);
      assert.doesNotMatch(reviewBody, /\.slice\(0, 2\)/);
      assert.doesNotMatch(reviewBody, /recommendationOptionIds\s*\n\s*\.filter\(\(programId\) => programId !== activeRecommendedProgramId\)\s*\n\s*\.slice\(0, 2\)/);
      assert.doesNotMatch(reviewBody, /selected: programId === activeRecommendedProgramId/);
      assert.doesNotMatch(reviewBody, /getPlanReadyImageSource/);
      assert.doesNotMatch(reviewBody, /getPlanReadyPreviewImageSource/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_CHARACTER_ASSETS/);
      assert.doesNotMatch(reviewBody, /step7-character-/);
      assert.doesNotMatch(onboardingSource, /step7-preview-male-mass\.png/);
      assert.doesNotMatch(onboardingSource, /step7-preview-female-athletic\.png/);
      assert.doesNotMatch(onboardingSource, /function getPlanReadyImageGender/);
      assert.doesNotMatch(reviewBody, /planReadyRecoverySummary/);
      assert.match(reviewBody, /planReadyWeeklyOverviewRows\.map/);
      assert.doesNotMatch(reviewBody, /planReadyWeeklyOverviewLegend/);
      assert.doesNotMatch(reviewBody, /Training day/);
      assert.doesNotMatch(reviewBody, /Recovery day/);
      assert.doesNotMatch(reviewBody, /planReadyWorkoutDayMeta/);
      assert.doesNotMatch(reviewBody, /planReadyWorkoutDayNumber/);
      assert.doesNotMatch(reviewBody, /planReadyWorkoutDayName/);
      assert.doesNotMatch(reviewBody, /REST \{restDayLabels\.join/);
      assert.doesNotMatch(reviewBody, /planReadyWeekPanelDayPill/);
      assert.doesNotMatch(reviewBody, /stepLabel: 'STEP 7'/);
      assert.doesNotMatch(reviewBody, /renderOnboardingShell/);
      assert.doesNotMatch(reviewBody, /styles\.stageBody/);
      assert.match(onboardingSource, /const standaloneProgressHidden = locationStageActive \|\| stage === 'review'/);
      assert.match(onboardingSource, /return 'tempo'/);
      assert.match(onboardingSource, /return 'restDay'/);
      assert.match(onboardingSource, /paddingBottom: spacing\.xxl \+ spacing\.xl \+ spacing\.lg/);
      assert.match(onboardingSource, /const footerVisible = true/);
      assert.match(onboardingSource, /stage === 'review' && styles\.planReadyFixedFooter/);
      assert.match(onboardingSource, /stage === 'review' \? styles\.planReadyFooterUsePlanButton : styles\.primaryButton/);
      assert.doesNotMatch(onboardingSource, /stage === 'review' \? styles\.secondaryTextLight : styles\.secondaryTextDark/);
      assert.doesNotMatch(onboardingSource, /haystack\.includes\('tempo'\)\) \{\s*return 'chest'/);
      assert.doesNotMatch(onboardingSource, /Easy Run Day/);
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
      assert.match(footerBody, /stage === 'about'[\s\S]*'Build my first program'/);
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
      assert.match(aboutBody, /Target weight/);
      assert.match(aboutBody, /bodyweightGoalMode === 'required'/);
      assert.match(aboutBody, /setTargetBodyweight/);
      assert.match(onboardingSource, /function getBodyweightTargetLimits\(current: number, unit: UnitPreference, goal: SetupGoal\)/);
      assert.match(onboardingSource, /function clampTargetBodyweightForGoal\(/);
      assert.match(onboardingSource, /goal === 'lean_athletic'[\s\S]*max: safeCurrent/);
      assert.match(onboardingSource, /goal === 'muscle'[\s\S]*min: safeCurrent/);
      assert.match(aboutBody, /<BodyweightStepper[\s\S]*label="Current weight"/);
      assert.match(aboutBody, /<BodyweightTargetSlider/);
      assert.match(aboutBody, /const targetLimits = getBodyweightTargetLimits\(bodyweightPickerValue, unitPreference, bodyweightGoal\)/);
      assert.match(aboutBody, /min=\{targetLimits\.min\}/);
      assert.match(aboutBody, /max=\{targetLimits\.max\}/);
      assert.doesNotMatch(aboutBody, /if \(targetWeightValue === null\)[\s\S]*setTargetBodyweight\(getDefaultTargetBodyweight\(bodyweightPickerValue, unitPreference, option\.id\)\)/);
      assert.doesNotMatch(aboutBody, /<BodyweightPicker/);
      assert.match(onboardingSource, /function BodyweightStepper\(/);
      assert.match(onboardingSource, /<TextInput[\s\S]*keyboardType="decimal-pad"/);
      assert.match(onboardingSource, /stage === 'planning'/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{!scrollLockedStage\}/);
    },
  },
  {
    name: 'onboarding step 5 matches the progress tracking reference structure',
    run() {
      const aboutBody = getFunctionBody('renderAbout');

      assert.match(aboutBody, /stepLabel: 'STEP 5 OF 5'/);
      assert.match(aboutBody, /titleLines: \['TRACK YOUR', 'PROGRESS'\]/);
      assert.match(aboutBody, /Set your current weight and optional goal\./);
      assert.match(aboutBody, /<BodyweightGoalOptionCard/);
      assert.match(aboutBody, /<BodyweightTargetSlider/);
      assert.match(aboutBody, /<BodyweightExpectationCard/);
      assert.match(onboardingSource, /const BODYWEIGHT_GOAL_OPTIONS/);
      assert.match(onboardingSource, /function BodyweightGoalOptionCard\(/);
      assert.match(onboardingSource, /function BodyweightTargetSlider\(/);
      assert.match(onboardingSource, /function BodyweightExpectationCard\(/);
      assert.match(onboardingSource, /function BodyweightGoalTrendIcon\(/);
      assert.match(onboardingSource, /import Svg, \{ Path \} from 'react-native-svg'/);
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
      assert.match(onboardingSource, /bodyweightGoalCard:\s*\{[\s\S]*minHeight: 88/);
      assert.match(onboardingSource, /bodyweightGoalCard:\s*\{[\s\S]*paddingVertical: 10/);
      assert.match(onboardingSource, /bodyweightExpectationText/);
      assert.match(onboardingSource, /bodyweightExpectationCard:\s*\{[\s\S]*minHeight: 120/);
      assert.match(onboardingSource, /bodyweightStageContent:\s*\{[\s\S]*translateY: -5/);

      const expectationStart = onboardingSource.indexOf('function BodyweightExpectationCard(');
      const expectationEnd = onboardingSource.indexOf('\nfunction StepDots', expectationStart);
      assert.notEqual(expectationStart, -1, 'BodyweightExpectationCard should exist');
      assert.notEqual(expectationEnd, -1, 'BodyweightExpectationCard should be followed by StepDots');
      const expectationBody = onboardingSource.slice(expectationStart, expectationEnd);
      assert.doesNotMatch(expectationBody, /bodyweightExpectationChart/);
      assert.doesNotMatch(expectationBody, /bodyweightExpectationBulletRow/);
      assert.doesNotMatch(expectationBody, /bodyweightExpectationTargetLabel/);
      assert.doesNotMatch(expectationBody, /content\.bullets/);
    },
  },
  {
    name: 'onboarding step 2 uses the new Step 1-style primary-goal cards',
    run() {
      const goalBody = getFunctionBody('renderGoal');

      assert.match(goalBody, /stepLabel: 'STEP 2 OF 5'/);
      assert.match(goalBody, /titleLines: \['WHAT DO YOU', 'WANT MOST\?'\]/);
      assert.match(goalBody, /We'll build your training around this\./);
      assert.doesNotMatch(goalBody, /compactCards: true/);
      assert.match(goalBody, /roomyCards: true/);
      assert.match(goalBody, /optionsContainerStyle: styles\.locationStepTwoOptionsShift/);
      assert.match(goalBody, /topPaneStyleOverride: styles\.locationEquipmentTopPane/);
      assert.match(goalBody, /titleStyleOverride: styles\.locationEquipmentHeadline/);
      assert.match(goalBody, /active: goal === option\.id/);
      assert.doesNotMatch(goalBody, /goals\.includes\(option\.id\)/);
      assert.match(onboardingSource, /title: 'Get stronger'/);
      assert.match(onboardingSource, /goal: 'lean_athletic'/);
      assert.match(onboardingSource, /goal: 'general_fitness'/);
      assert.doesNotMatch(goalBody, /Running hybrid/);
      assert.match(onboardingSource, /\{ label: 'Lower reps', tone: 'neutral' \}/);
      assert.match(onboardingSource, /\{ label: 'Beginner friendly', tone: 'blue' \}/);
      assert.match(onboardingSource, /getLocationFocusBadgeStyle\(tag\.tone\)/);
      assert.match(onboardingSource, /getLocationFocusBadgeTextStyle\(tag\.tone\)/);
      assert.match(onboardingSource, /locationChoiceTagRow/);
      assert.match(onboardingSource, /locationChoiceCardRoomy:\s*\{[\s\S]*minHeight: 100/);
      assert.match(onboardingSource, /locationStepTwoOptionsShift:\s*\{[\s\S]*translateY: 8/);
      assert.doesNotMatch(goalBody, /WHAT IS YOUR/);
      assert.doesNotMatch(goalBody, /Pick one or more/);
    },
  },
  {
    name: 'onboarding step 3 uses training profile controls',
    run() {
      const profileBody = getFunctionBody('renderProfile');

      assert.match(profileBody, /stepLabel: 'STEP 3 OF 5'/);
      assert.match(profileBody, /titleLines: \['TRAINING', 'PROFILE'\]/);
      assert.match(profileBody, /We'll tailor your plan to your experience and availability\./);
      assert.match(profileBody, /TRAINING_LEVEL_OPTIONS\.map/);
      assert.match(profileBody, /TRAINING_FREQUENCY_OPTIONS\.map/);
      assert.match(profileBody, /setLevel\(option\.level\)/);
      assert.match(profileBody, /setDaysPerWeek\(option\.value\)/);
      assert.match(profileBody, /Plan preview/);
      assert.match(profileBody, /<TrainingSectionIcon icon="strength" \/>/);
      assert.match(profileBody, /\{setupSummary\.workouts\} - \{setupSummary\.duration\} - \{setupSummary\.structure\}/);
      assert.doesNotMatch(profileBody, /Â|Å|â/);
      assert.doesNotMatch(profileBody, /GENDER_OPTIONS/);
      assert.doesNotMatch(profileBody, /AgeSlider/);
      assert.match(onboardingSource, /level: 'advanced'/);
      assert.match(onboardingSource, /\{ value: 6, title: '6\+', body: 'days' \}/);
      assert.match(onboardingSource, /function getTrainingProfileSetupSummary\(level: SetupLevel, daysPerWeek: SetupDaysPerWeek\)/);
      assert.match(onboardingSource, /trainingProfileTopPane:\s*\{[\s\S]*height: 248/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderWidth: 2/);
      assert.match(onboardingSource, /trainingExperienceCard:\s*\{[\s\S]*backgroundColor: '#141414'/);
      assert.match(onboardingSource, /trainingExperienceCardActive:\s*\{[\s\S]*borderColor: '#FFFFFF'[\s\S]*backgroundColor: '#171717'/);
      assert.match(onboardingSource, /trainingExperienceTitle:\s*\{[\s\S]*fontSize: 17[\s\S]*lineHeight: 19/);
      assert.match(onboardingSource, /trainingExperienceBody:\s*\{[\s\S]*fontSize: 9\.5[\s\S]*letterSpacing: -0\.1/);
      assert.match(onboardingSource, /\{ label: 'More recovery', tone: 'green' \}/);
      assert.match(onboardingSource, /\{ label: 'More variety', tone: 'purple' \}/);
      assert.match(onboardingSource, /\{ label: 'Advanced progression', tone: 'green' \}/);
      assert.match(profileBody, /getLocationFocusBadgeStyle\(chip\.tone\)/);
      assert.match(profileBody, /getLocationFocusBadgeTextStyle\(chip\.tone\)/);
    },
  },
  {
    name: 'onboarding step 4 uses focus area placeholder cards',
    run() {
      const planningBody = getFunctionBody('renderPlanning');

      assert.match(planningBody, /stepLabel: 'STEP 4 OF 5'/);
      assert.match(planningBody, /titleLines: \['WHAT DO YOU', 'WANT TO FOCUS ON\?'\]/);
      assert.match(planningBody, /Why focus areas\?/);
      assert.match(planningBody, /FOCUS_AREA_OPTIONS\.filter\(\(option\) => option\.area !== 'mobility'\)/);
      assert.match(planningBody, /visibleFocusOptions\.slice\(0, 3\)/);
      assert.match(planningBody, /visibleFocusOptions\.slice\(6, 9\)/);
      assert.match(planningBody, /focusAreaImageSlot/);
      assert.match(planningBody, /FOCUS_AREA_CARD_ASSETS\[option\.area\]/);
      assert.match(planningBody, /FOCUS_AREA_IMAGE_FRAMES\[option\.area\]/);
      assert.match(planningBody, /resizeMode=\{imageFrameStyle \? 'contain' : 'cover'\}/);
      assert.match(planningBody, /style=\{\[styles\.focusAreaImage, imageFrameStyle\]\}/);
      assert.match(planningBody, /This helps us build a program that prioritizes what matters most to you\./);
      assert.match(planningBody, /Pick 1-2 areas/);
      assert.doesNotMatch(planningBody, /Select up to 2 areas/);
      assert.doesNotMatch(planningBody, /Upper Body/);
      assert.doesNotMatch(planningBody, /Lower Body/);
      assert.doesNotMatch(planningBody, /Performance/);
      assert.doesNotMatch(planningBody, /TRAINING', 'DAYS/);
      assert.doesNotMatch(planningBody, /\[2, 3, 4, 5, 6\]/);
      assert.match(onboardingSource, /const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions\(\)/);
      assert.match(onboardingSource, /focus-chest-anatomy-card\.png/);
      assert.match(onboardingSource, /focus-abs-anatomy-card\.png/);
      assert.match(onboardingSource, /focus-calves-anatomy-card\.png/);
      assert.match(onboardingSource, /focus-mobility-anatomy-card\.png/);
      assert.match(onboardingSource, /const REFINEMENT_FOCUS_AREA_OPTIONS: SetupFocusArea\[\] = FOCUS_AREA_OPTIONS\.map/);
      assert.match(onboardingSource, /current\.length >= 2/);
      assert.match(onboardingSource, /focusAreaTopPane:\s*\{[\s\S]*height: 248/);
      assert.match(onboardingSource, /focusAreaCard:\s*\{[\s\S]*height: 140/);
      assert.match(onboardingSource, /focusAreaGridRow:\s*\{[\s\S]*gap: 6/);
      assert.match(onboardingSource, /focusAreaCardTitle:\s*\{[\s\S]*fontSize: 14[\s\S]*lineHeight: 16/);
      assert.match(onboardingSource, /focusAreaInfoBox:\s*\{[\s\S]*minHeight: 62/);
      assert.match(onboardingSource, /backgroundColor: 'rgba\(198,139,255,0\.20\)'/);
      assert.match(onboardingSource, /focusAreaCardActive:\s*\{[\s\S]*borderColor: '#FFFFFF'/);
    },
  },
  {
    name: 'launch splash waits on every app start and welcome copy is plan focused',
    run() {
      assert.match(appSource, /const \[minimumSplashElapsed, setMinimumSplashElapsed\] = useState\(false\)/);
      assert.doesNotMatch(appSource, /if \(!firstAppOpen && !minimumSplashElapsed\)/);
      assert.match(appSource, /if \(!minimumSplashElapsed\) \{\s*return;\s*\}/);
      assert.doesNotMatch(appSource, /firstAppOpen/);

      assert.match(welcomeSource, /Build your plan\.\\nTrack your progress\./);
      assert.match(welcomeSource, /Rakenna ohjelma\.\\nSeuraa kehitysta\./);
      assert.match(welcomeSource, /useWindowDimensions/);
      assert.match(welcomeSource, /styles\.topOrb/);
      assert.doesNotMatch(welcomeSource, /styles\.orbArcWrap/);
      assert.doesNotMatch(welcomeSource, /strokeDasharray/);
      assert.doesNotMatch(welcomeSource, /react-native-svg/);
      assert.doesNotMatch(welcomeSource, /styles\.orbMark/);
      assert.doesNotMatch(welcomeSource, />G<\/Text>/);
      assert.match(welcomeSource, /<Text style=\{styles\.brandTitle\}>GYMLOG<\/Text>/);
      assert.doesNotMatch(welcomeSource, /Takes less than a minute to set up\./);
    },
  },
  {
    name: 'onboarding selection steps keep vertical layout still and progress aligned',
    run() {
      const locationChoiceBody = onboardingSource.slice(
        onboardingSource.indexOf('function LocationChoiceCard'),
        onboardingSource.indexOf('function PhotoSelectionCard'),
      );

      assert.doesNotMatch(locationChoiceBody, /scale: progress\.interpolate/);
      assert.doesNotMatch(locationChoiceBody, /outputRange: \[1, 1\.02\]/);
      assert.match(onboardingSource, /const fixedTopPaneHeight = Math\.min\(380, Math\.round\(locationStageHeight \* 0\.38\) \+ 40\)/);
      assert.match(onboardingSource, /styles\.locationTopPane,\s*\{ height: fixedTopPaneHeight \},\s*topPaneStyle/);
      assert.doesNotMatch(onboardingSource, /topCopyStyle: styles\.locationTopCopyProfile/);
      assert.match(onboardingSource, /bodyweightTopPane:\s*\{[\s\S]*height: 248/);
      assert.match(onboardingSource, /focusTopPane:\s*\{[\s\S]*height: 246/);
      assert.match(onboardingSource, /stage === 'planning'/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /alwaysBounceVertical=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /overScrollMode=\{scrollLockedStage \? 'never' : 'auto'\}/);
    },
  },
  {
    name: 'plan-ready hero is black from header through program section',
    run() {
      assert.match(onboardingSource, /planReadyStage:\s*\{\s*backgroundColor: '#050505'/);
      assert.match(onboardingSource, /planReadyHeader:\s*\{[\s\S]*backgroundColor: '#000000'/);
      assert.match(onboardingSource, /planReadyTitle:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(onboardingSource, /planReadySubtitle:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.72\)'/);
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
    name: 'plan-ready summary matches the documented ready-plan reference',
    run() {
      const reviewBody = getFunctionBody('renderReview');
      const heroCardStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyHeroCard: {'),
        onboardingSource.indexOf('planReadyHeroImage:', onboardingSource.indexOf('planReadyHeroCard: {')),
      );
      const heroImageStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyHeroImage: {'),
        onboardingSource.indexOf('planReadyHeroImageStyle:', onboardingSource.indexOf('planReadyHeroImage: {')),
      );
      const weekPanelStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyWeekPanel: {'),
        onboardingSource.indexOf('planReadyWeekPanelRow:', onboardingSource.indexOf('planReadyWeekPanel: {')),
      );
      const weekRowStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyWeekPanelRow: {'),
        onboardingSource.indexOf('planReadyWeekPanelDay:', onboardingSource.indexOf('planReadyWeekPanelRow: {')),
      );
      const chipStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyHeroChip: {'),
        onboardingSource.indexOf('planReadyHeroChipText:', onboardingSource.indexOf('planReadyHeroChip: {')),
      );
      const fitSummaryStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyFitSummaryPanel: {'),
        onboardingSource.indexOf('planReadyFitReasons:', onboardingSource.indexOf('planReadyFitSummaryPanel: {')),
      );
      const expectationStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyExpectationPanel: {'),
        onboardingSource.indexOf('planReadyExpectationHeader:', onboardingSource.indexOf('planReadyExpectationPanel: {')),
      );

      assert.match(reviewBody, /const trainingWeekRows = reviewWeekRows\.filter\(\(item\) => item\.training\)/);
      assert.doesNotMatch(reviewBody, /const restDayLabels = reviewWeekRows/);
      assert.match(reviewBody, /const maxPlanReadyWorkoutPage = Math\.max\(0, trainingWeekRows\.length - 1\)/);
      assert.match(reviewBody, /const planReadyWorkoutPageStart = Math\.min\(planReadyWorkoutPage, maxPlanReadyWorkoutPage\)/);
      assert.match(reviewBody, /const planReadyActiveWorkout = trainingWeekRows\[planReadyWorkoutPageStart\] \?\? null/);
      assert.match(reviewBody, /const planReadyWorkoutCarouselVisible = trainingWeekRows\.length > 1/);
      assert.match(reviewBody, /const planReadyWorkoutTabs = trainingWeekRows\.map/);
      assert.match(reviewBody, /const planReadyWeeklyOverviewRows = reviewWeekRows\.map/);
      assert.match(reviewBody, /const screenDimensions = Dimensions\.get\('window'\)/);
      assert.match(reviewBody, /const compactPlanReady = screenDimensions\.width < 520/);
      assert.match(reviewBody, /const planReadyFooterReserve = compactPlanReady \? 56 : 68/);
      assert.match(reviewBody, /screenDimensions\.height - insets\.top - insets\.bottom - planReadyFooterReserve/);
      assert.doesNotMatch(reviewBody, /planReadyPreviewRows\.map/);
      assert.doesNotMatch(reviewBody, /trainingWeekRows\.slice\(planReadyWorkoutPageStart, planReadyWorkoutPageStart \+ 2\)/);
      assert.doesNotMatch(reviewBody, /trainingWeekRows\.map\(\(item, index\) =>/);
      assert.match(reviewBody, /YOUR PLAN IS READY/);
      assert.match(reviewBody, /Minimal Full Body|programTitle/);
      assert.match(reviewBody, /Built around your goals, schedule and recovery\./);
      assert.match(reviewBody, /WHY THIS PLAN\?/);
      assert.match(reviewBody, /PLAN OVERVIEW/);
      assert.match(reviewBody, /YOUR WORKOUT PLAN/);
      assert.match(onboardingSource, /const \[planReadyWorkoutPage, setPlanReadyWorkoutPage\] = useState\(0\)/);
      assert.match(onboardingSource, /useEffect\(\(\) => \{[\s\S]*setPlanReadyWorkoutPage\(0\)[\s\S]*\}, \[activeRecommendedProgramId\]\)/);
      assert.match(reviewBody, /planReadyWorkoutCarouselVisible \? \(/);
      assert.match(reviewBody, /styles\.planReadyWorkoutCarouselBar/);
      assert.match(reviewBody, /styles\.planReadyWorkoutCarouselTabs/);
      assert.match(reviewBody, /planReadyWorkoutTabs\.map/);
      assert.match(reviewBody, /styles\.planReadyWorkoutCarouselTabActive/);
      assert.doesNotMatch(reviewBody, /accessibilityLabel="Previous workouts"/);
      assert.doesNotMatch(reviewBody, /accessibilityLabel="Next workouts"/);
      assert.match(reviewBody, /accessibilityLabel=\{`Show \$\{tab\.label\}`\}/);
      assert.match(reviewBody, /accessibilityState=\{\{ selected: active \}\}/);
      assert.doesNotMatch(reviewBody, /setPlanReadyWorkoutPage\(\(current\) => Math\.max\(0, current - 1\)\)/);
      assert.doesNotMatch(reviewBody, /setPlanReadyWorkoutPage\(\(current\) => Math\.min\(maxPlanReadyWorkoutPage, current \+ 1\)\)/);
      assert.match(reviewBody, /setPlanReadyWorkoutPage\(Math\.min\(tab\.index, maxPlanReadyWorkoutPage\)\)/);
      assert.doesNotMatch(reviewBody, /YOUR WEEKLY OVERVIEW/);
      assert.doesNotMatch(reviewBody, /planReadyRecoverySummary/);
      assert.doesNotMatch(reviewBody, /planReadyWeeklyOverviewLegend/);
      assert.doesNotMatch(reviewBody, /Training day/);
      assert.doesNotMatch(reviewBody, /Recovery day/);
      assert.doesNotMatch(reviewBody, /WHAT TO EXPECT/);
      assert.ok(
        reviewBody.indexOf('styles.planReadyWeeklyOverview') < reviewBody.indexOf('YOUR WORKOUT PLAN') &&
          reviewBody.indexOf('YOUR WORKOUT PLAN') < reviewBody.indexOf('styles.planReadyFitSummaryPanel'),
        'weekly overview, workout cards, and plan reason panel should render in that order',
      );
      assert.match(onboardingSource, /stage === 'review'[\s\S]*'START MY PLAN'/);
      assert.doesNotMatch(reviewBody, /Day \{index \+ 1\}/);
      assert.doesNotMatch(reviewBody, /planReadyWorkoutDayNumber/);
      assert.doesNotMatch(reviewBody, /planReadyWorkoutDayName/);
      assert.match(reviewBody, /planReadyActiveWorkout \? \(/);
      assert.match(reviewBody, /planReadyWorkoutDayCard/);
      assert.match(reviewBody, /planReadyWorkoutSingleCard/);
      assert.match(reviewBody, /planReadyWorkoutTitleBlock/);
      assert.match(reviewBody, /numberOfLines=\{1\}>\{planReadyActiveWorkout\.title\}/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyHeroImageCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyHeroCopyCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyHeroTitleCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyHeroBodyCompact/);
      assert.doesNotMatch(reviewBody, /planReadyHeroChipRow/);
      assert.doesNotMatch(reviewBody, /planReadyHeroChips\.map/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyCardContentCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyFitSummaryPanelCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyOverviewCardCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutDayCardCompact/);
      assert.ok(
        reviewBody.indexOf('compactPlanReady && styles.planReadyWeekPanelRowCompact') <
          reviewBody.indexOf('compactPlanReady && styles.planReadyWorkoutDayCardCompact'),
        'base compact row style should be applied before the taller workout card compact style',
      );
      assert.match(reviewBody, /styles\.planReadyWorkoutDayHeaderCompact/);
      assert.match(reviewBody, /styles\.planReadyWorkoutCardMetaRowCompact/);
      assert.doesNotMatch(reviewBody, /styles\.planReadyWorkoutDayMetaCompact/);
      assert.match(reviewBody, /styles\.planReadyWeekPanelTitleCompact/);
      assert.match(reviewBody, /styles\.planReadyWeekPanelDurationCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutInlineExerciseRowCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutInlineExerciseNameCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutInlineExerciseListCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutInlineExerciseTargetsCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWorkoutMoreExercisesCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewCompact/);
      assert.doesNotMatch(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewHeaderCompact/);
      assert.doesNotMatch(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewTitleCompact/);
      assert.doesNotMatch(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewSummaryCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewDayCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWeeklyOverviewDotCompact/);
      assert.doesNotMatch(reviewBody, /planReadyInlineActions/);
      assert.doesNotMatch(reviewBody, /planReadyUsePlanButton/);
      assert.doesNotMatch(reviewBody, /compactPlanReady && styles\.planReadyOtherPlansLabelCompact/);
      assert.match(reviewBody, /compactPlanReady && styles\.planReadyWeekPanelRowCompact/);
      assert.match(reviewBody, /planReadyWorkoutFocusChip/);
      assert.match(reviewBody, /planReadyActiveWorkout\.exercises\.map/);
      assert.match(reviewBody, /exercise\.setsLabel/);
      assert.match(reviewBody, /exercise\.repsLabel/);
      assert.match(reviewBody, /planReadyActiveWorkout\.hiddenExerciseCount > 0/);
      assert.doesNotMatch(reviewBody, /size=\{compactPlanReady \? 9 : 14\}/);
      assert.match(reviewBody, /planReadyWeeklyOverviewRows\.map/);
      assert.match(reviewBody, /item\.training \? 'Train' : 'Recover'/);
      assert.match(onboardingSource, /buildRecommendationPlanReadyPayload/);
      assert.doesNotMatch(reviewBody, /planReadyPayload\.starterNote/);
      assert.doesNotMatch(onboardingSource, /planReadyStarterNote/);
      assert.doesNotMatch(onboardingSource, /Your 4-week starter plan begins with this first week/);
      assert.match(reviewBody, /planReadyPayload\.weeklySchedule/);
      assert.match(reviewBody, /scheduleDay\.source === 'template'/);
      assert.doesNotMatch(reviewBody, /const sessionIndex = projectedRhythm\.findIndex/);
      assert.match(reviewBody, /planReadyPayload\.whyThisPlan/);
      assert.match(reviewBody, /planReadyPayload\.planOverview/);
      assert.match(reviewBody, /planReadyFitReasons\.map/);
      assert.match(reviewBody, /planReadyOverviewRows\.map/);
      assert.doesNotMatch(reviewBody, /planReadyExpectationItems\.map/);
      assert.doesNotMatch(reviewBody, /Track & adjust/);
      assert.doesNotMatch(reviewBody, /Recovery focused/);
      assert.doesNotMatch(reviewBody, /planReadyWeekPanelRest/);
      assert.doesNotMatch(reviewBody, /restDayLabels\.join\(', '\)/);
      assert.doesNotMatch(reviewBody, /Progressive overload/);
      assert.match(reviewBody, /planReadyOverviewIcons: GymlogIconName\[\] = \['strength', 'tempo', 'progress', 'recovery'\]/);
      assert.doesNotMatch(reviewBody, /key=\{chip\.label\}/);
      assert.doesNotMatch(reviewBody, /<GymlogIcon name=\{chip\.icon\}/);
      assert.match(heroCardStyle, /backgroundColor: 'transparent'/);
      assert.match(heroCardStyle, /overflow: 'hidden'/);
      assert.match(heroCardStyle, /position: 'absolute'/);
      assert.match(heroCardStyle, /height: 190/);
      assert.match(heroCardStyle, /marginHorizontal: 0/);
      assert.match(heroCardStyle, /borderRadius: 0/);
      assert.match(onboardingSource, /planReadyStage:\s*\{[\s\S]*paddingHorizontal: 0/);
      assert.match(onboardingSource, /planReadyPlanCard:\s*\{[\s\S]*borderWidth: 0/);
      assert.match(onboardingSource, /planReadyPlanCard:\s*\{[\s\S]*borderRadius: 0/);
      assert.match(onboardingSource, /planReadyCardShell:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(heroImageStyle, /minHeight: 312/);
      assert.match(onboardingSource, /PLAN_READY_GYM_BACKDROP_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/plan-ready-empty-gym-backdrop-bw\.jpg'\)/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_GYM_BACKDROP_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/plan-ready-gym-backdrop-bw\.jpg'\)/);
      assert.match(onboardingSource, /planReadyHeroImageStyle:\s*\{[\s\S]*opacity: 0\.9/);
      assert.match(onboardingSource, /planReadyHeroImageStyle:\s*\{[\s\S]*transform: \[\{ scaleX: 1\.06 \}, \{ scaleY: 1\.12 \}, \{ translateX: 12 \}\]/);
      assert.match(onboardingSource, /planReadyHeroGradientTop:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.75\)'/);
      assert.match(onboardingSource, /planReadyHeroGradientMiddle:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.45\)'/);
      assert.match(onboardingSource, /planReadyHeroGradientBottom:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.90\)'/);
      assert.doesNotMatch(onboardingSource, /planReadyHeroTopRow:\s*\{/);
      assert.match(onboardingSource, /planReadyHeroTextScrim:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.24\)'/);
      assert.match(onboardingSource, /planReadyHeroCopy:\s*\{[\s\S]*marginTop: 108/);
      assert.doesNotMatch(reviewBody, /planReadyHeroTitleDetailsButton/);
      assert.doesNotMatch(reviewBody, /planReadyHeroTitleDetailsText/);
      assert.match(onboardingSource, /planReadyHeroKicker:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.58\)'/);
      assert.match(onboardingSource, /planReadyHeroKicker:\s*\{[\s\S]*fontSize: 17/);
      assert.match(onboardingSource, /planReadyHeroBody:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.72\)'/);
      assert.match(onboardingSource, /planReadyHeroBody:\s*\{[\s\S]*fontSize: 27/);
      assert.match(onboardingSource, /paddingBottom: \(footerVisible \? spacing\.xxl : spacing\.xl\) \+ insets\.bottom/);
      assert.match(onboardingSource, /planReadyHeroImageCompact:\s*\{[\s\S]*minHeight: 190/);
      assert.match(onboardingSource, /planReadyHeroCopyCompact:\s*\{[\s\S]*marginTop: 26/);
      assert.match(onboardingSource, /planReadyHeroTitleCompact:\s*\{[\s\S]*fontSize: 28/);
      assert.match(onboardingSource, /planReadyHeroTitleCompact:\s*\{[\s\S]*lineHeight: 31/);
      assert.match(onboardingSource, /planReadyHeroBodyCompact:\s*\{[\s\S]*fontSize: 13/);
      assert.match(onboardingSource, /planReadyHeroBodyCompact:\s*\{[\s\S]*lineHeight: 17/);
      assert.match(onboardingSource, /planReadyHeroBodyCompact:\s*\{[\s\S]*maxWidth: '88%'/);
      assert.match(onboardingSource, /planReadyCardContentCompact:\s*\{[\s\S]*gap: 8/);
      assert.match(onboardingSource, /scrollLockedStage =[\s\S]*stage === 'review'/);
      assert.match(onboardingSource, /planReadyCardContentCompact:\s*\{[\s\S]*paddingTop: 144/);
      assert.match(onboardingSource, /planReadyCardContentCompact:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.match(onboardingSource, /planReadyCardContentCompact:\s*\{[\s\S]*paddingBottom: 6/);
      assert.match(weekPanelStyle, /backgroundColor: 'transparent'/);
      assert.match(weekPanelStyle, /borderWidth: 0/);
      assert.match(weekRowStyle, /backgroundColor: 'rgba\(255,255,255,0\.05\)'/);
      assert.match(weekRowStyle, /borderRadius: radii\.sm/);
      assert.match(fitSummaryStyle, /borderRadius: 22/);
      assert.match(fitSummaryStyle, /backgroundColor: 'rgba\(255,255,255,0\.04\)'/);
      assert.match(reviewBody, /size=\{compactPlanReady \? 12 : 18\}/);
      assert.match(reviewBody, /size=\{compactPlanReady \? 13 : 18\}/);
      assert.match(onboardingSource, /planReadyFitSummaryPanelCompact:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyFitSummaryPanelCompact:\s*\{[\s\S]*gap: 10/);
      assert.match(onboardingSource, /planReadyFitSummaryPanelCompact:\s*\{[\s\S]*padding: 14/);
      assert.match(onboardingSource, /planReadyFitSummaryPanelCompact:\s*\{[\s\S]*minHeight: 132/);
      assert.match(onboardingSource, /planReadyFitReasonsCompact:\s*\{[\s\S]*gap: 8/);
      assert.match(onboardingSource, /planReadyFitReasonRowCompact:\s*\{[\s\S]*gap: 7/);
      assert.match(onboardingSource, /planReadyFitReasonTextCompact:\s*\{[\s\S]*fontSize: 11\.5/);
      assert.match(onboardingSource, /planReadyFitSectionTitleCompact:\s*\{[\s\S]*maxWidth: '100%'/);
      assert.match(onboardingSource, /planReadyFitSectionTitleCompact:\s*\{[\s\S]*fontSize: 12/);
      assert.match(onboardingSource, /planReadyOverviewCardCompact:\s*\{[\s\S]*width: '48%'/);
      assert.match(onboardingSource, /planReadyOverviewCardCompact:\s*\{[\s\S]*minWidth: 0/);
      assert.match(onboardingSource, /planReadyOverviewCardCompact:\s*\{[\s\S]*paddingHorizontal: 12/);
      assert.match(onboardingSource, /planReadyOverviewCardCompact:\s*\{[\s\S]*paddingVertical: 12/);
      assert.match(onboardingSource, /planReadyOverviewTitleCompact:\s*\{[\s\S]*fontSize: 12/);
      assert.match(onboardingSource, /planReadyOverviewTextCompact:\s*\{[\s\S]*fontSize: 11\.5/);
      assert.match(onboardingSource, /planReadyWorkoutSingleCard:\s*\{[\s\S]*width: '100%'/);
      assert.match(onboardingSource, /planReadyWorkoutSectionHeader:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyWorkoutCarouselBar:\s*\{[\s\S]*borderRadius: 18/);
      assert.match(onboardingSource, /planReadyWorkoutCarouselBar:\s*\{[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.08\)'/);
      assert.doesNotMatch(onboardingSource, /planReadyWorkoutCarouselButton:\s*\{/);
      assert.match(onboardingSource, /planReadyWorkoutCarouselTabs:\s*\{[\s\S]*flex: 1/);
      assert.match(onboardingSource, /planReadyWorkoutCarouselTabActive:\s*\{[\s\S]*backgroundColor: 'rgba\(198,139,255,0\.82\)'/);
      assert.doesNotMatch(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*flexBasis: 0/);
      assert.match(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*flexGrow: 0/);
      assert.match(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*flexShrink: 0/);
      assert.match(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*minWidth: 0/);
      assert.match(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*paddingHorizontal: 12/);
      assert.match(onboardingSource, /planReadyWorkoutDayCardCompact:\s*\{[\s\S]*minHeight: 286/);
      assert.match(onboardingSource, /planReadyWorkoutDayHeaderCompact:\s*\{[\s\S]*flexDirection: 'column'/);
      assert.match(onboardingSource, /planReadyWorkoutDayHeaderCompact:\s*\{[\s\S]*gap: 9/);
      assert.match(onboardingSource, /planReadyWorkoutCardMetaRowCompact:\s*\{[\s\S]*justifyContent: 'space-between'/);
      assert.match(onboardingSource, /planReadyWeekPanelTitleCompact:\s*\{[\s\S]*fontSize: 23/);
      assert.match(onboardingSource, /planReadyWeekPanelTitleCompact:\s*\{[\s\S]*maxWidth: '68%'/);
      assert.match(onboardingSource, /numberOfLines=\{1\}>\{planReadyActiveWorkout\.title\}/);
      assert.match(onboardingSource, /planReadyWeekPanelDurationCompact:\s*\{[\s\S]*fontSize: 12/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseRowCompact:\s*\{[\s\S]*minHeight: 35/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseListCompact:\s*\{[\s\S]*flexGrow: 0/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseListCompact:\s*\{[\s\S]*justifyContent: 'flex-start'/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseNameCompact:\s*\{[\s\S]*fontSize: 12/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseTargets:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseTargetsCompact:\s*\{[\s\S]*minWidth: 122/);
      assert.match(onboardingSource, /planReadyWorkoutInlineExerciseTargetCompact:\s*\{[\s\S]*fontSize: 12/);
      assert.match(onboardingSource, /planReadyWorkoutMoreExercisesCompact:\s*\{[\s\S]*fontSize: 11/);
      assert.doesNotMatch(onboardingSource, /planReadyOtherPlansPeekCompact:\s*\{/);
      assert.doesNotMatch(onboardingSource, /planReadyOtherPlansLabelCompact:\s*\{/);
      assert.match(onboardingSource, /planReadyWeekPanelRowCompact:\s*\{[\s\S]*minHeight: 0/);
      assert.match(onboardingSource, /planReadyWeekPanelTitleRowCompact:\s*\{[\s\S]*alignItems: 'center'/);
      assert.match(onboardingSource, /planReadyWorkoutTitleBlockCompact:\s*\{[\s\S]*gap: 5/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewCompact:\s*\{[\s\S]*paddingHorizontal: 10/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewCompact:\s*\{[\s\S]*paddingVertical: 10/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewCompact:\s*\{[\s\S]*marginBottom: 8/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewCompact:\s*\{[\s\S]*borderColor: 'rgba\(198,139,255,0\.72\)'/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewCompact:\s*\{[\s\S]*backgroundColor: 'rgba\(198,139,255,0\.12\)'/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewDayCompact:\s*\{[\s\S]*gap: 4/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewDotCompact:\s*\{[\s\S]*width: 18/);
      assert.doesNotMatch(reviewBody, /planReadyExpectationPanel/);
      assert.match(onboardingSource, /planReadyCardContent:\s*\{[\s\S]*flex: 1/);
      assert.match(onboardingSource, /planReadyCardContent:\s*\{[\s\S]*paddingBottom: spacing\.xl/);
      assert.match(onboardingSource, /planReadyFixedFooter:\s*\{[\s\S]*backgroundColor: '#000000'/);
      assert.match(onboardingSource, /planReadyFixedFooter:\s*\{[\s\S]*borderTopWidth: 0/);
      assert.match(onboardingSource, /planReadyFooterUsePlanButton:\s*\{[\s\S]*minHeight: 44/);
      assert.match(onboardingSource, /planReadyFooterUsePlanButton:\s*\{[\s\S]*maxWidth: 360/);
      assert.match(onboardingSource, /planReadyFooterUsePlanButton:\s*\{[\s\S]*backgroundColor: '#B8FF6A'/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewDay:\s*\{[\s\S]*gap: 8/);
      assert.match(onboardingSource, /planReadyHeroChipRow:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyHeroChipRow:\s*\{[\s\S]*flexWrap: 'wrap'/);
      assert.match(onboardingSource, /planReadyHeroChip:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyHeroChipIcon/);
      assert.doesNotMatch(reviewBody, /recommendationConfidenceCopy\.title/);
      assert.doesNotMatch(reviewBody, /planReadyPrimaryReason/);
      assert.match(iconSource, /\| 'eye'/);
      assert.match(iconSource, /case 'eye':/);
    },
  },
];
