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

      assert.match(reviewBody, /YOUR WORKOUT PLAN/);
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
      assert.match(reviewBody, /planReadyHeroChipRow/);
      assert.match(reviewBody, /planReadyWeekPanel/);
      assert.doesNotMatch(reviewBody, /planReadyWhyMiniCard/);
      assert.doesNotMatch(reviewBody, /planReadyQuickDetail/);
      assert.doesNotMatch(reviewBody, /FIRST ACTION/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\?\.guidance\.firstAction/);
      assert.doesNotMatch(reviewBody, /planReadyInlineExerciseNames/);
      assert.doesNotMatch(reviewBody, /planReadyDetailsButton/);
      assert.match(reviewBody, /planReadyHeroTitleRow/);
      assert.match(reviewBody, /planReadyHeroTitleDetailsButton/);
      assert.match(reviewBody, /planReadyHeroTitleDetailsText/);
      assert.match(reviewBody, /planReadyInlineActions/);
      assert.match(reviewBody, /planReadyBackButton/);
      assert.doesNotMatch(reviewBody, /planReadyDetailsIconButton/);
      assert.match(reviewBody, /planReadyUsePlanButton/);
      assert.match(reviewBody, /Start plan/);
      assert.doesNotMatch(reviewBody, /Save plan & start/);
      assert.match(reviewBody, /planReadyOtherPlansPeek/);
      assert.match(reviewBody, /See other plans/);
      assert.match(reviewBody, /planReadyOtherPlansLabel/);
      assert.match(reviewBody, /planReadyOtherPlansPeekFoldLine/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeekArrow/);
      assert.match(reviewBody, /planReadyOptionsMenu/);
      assert.match(reviewBody, /Other plans/);
      assert.match(reviewBody, /planReadyOptions\.map/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansRail/);
      assert.doesNotMatch(reviewBody, /SEE OTHER PLANS/);
      assert.match(reviewBody, /<GymlogIcon name="eye"/);
      assert.match(reviewBody, /setSelectedPlanReadySessionId\(planReadyPrimarySessionId\)/);
      assert.match(reviewBody, /onCompleteToStartingWeek\(selection, activeRecommendedProgramId\)/);
      assert.match(appSource, /handleOnboardingCompleteToStartingWeek[\s\S]*openStartingWeek\(recommendedProgramId, 'first_run'\)/);
      assert.match(reviewBody, /minHeight: planReadyStageMinHeight/);
      assert.doesNotMatch(reviewBody, /height: planReadyStageMinHeight/);
      assert.doesNotMatch(reviewBody, /CALORIES/);
      assert.doesNotMatch(reviewBody, /65%/);
      assert.doesNotMatch(reviewBody, /bottomNav|BottomTab|bottom bar/i);
      assert.doesNotMatch(reviewBody, /planReadyProgramCard/);
      assert.doesNotMatch(reviewBody, /planReadyWeekCard/);
      assert.doesNotMatch(reviewBody, /planReadyInsightPanel/);
      assert.doesNotMatch(reviewBody, /WEEKLY OVERVIEW/);
      assert.doesNotMatch(reviewBody, /WHY THIS PLAN/);
      assert.doesNotMatch(reviewBody, /FIRST WORKOUT/);
      assert.doesNotMatch(onboardingSource, /buildRecommendationReasonLines/);
      assert.doesNotMatch(onboardingSource, /getFallbackReasonCopy/);
      assert.doesNotMatch(onboardingSource, /const recommendationReasonLines = useMemo/);
      assert.doesNotMatch(onboardingSource, /const planReadyTargetReason = useMemo/);
      assert.doesNotMatch(reviewBody, /recommendationReasonLines\[0\]/);
      assert.doesNotMatch(reviewBody, /planReadyTargetReason \?\? recommendationReasonLines\[1\]/);
      assert.doesNotMatch(reviewBody, /planReadyFallbackCopy/);
      assert.match(reviewBody, /planReadyFirstWorkout/);
      assert.match(reviewBody, /const planReadyPrimarySessionId = trainingWeekRows\[0\]\?\.sessionId \?\? planReadyFirstWorkout\?\.id \?\? null/);
      assert.match(reviewBody, /const planReadyHeroChips: Array<\{ label: string; icon: GymlogIconName \}> = \[/);
      assert.match(onboardingSource, /buildSessionGuidance/);
      assert.match(onboardingSource, /formatPlanReadyExercisePrescription/);
      assert.match(onboardingSource, /formatPlanReadyExerciseRepTarget/);
      assert.match(onboardingSource, /exercises: session\.exercises\.slice\(0, 4\)\.map/);
      assert.match(onboardingSource, /compactPrescription: formatPlanReadyExerciseRepTarget\(exercise\)/);
      assert.match(onboardingSource, /detailExercises: session\.exercises\.map/);
      assert.match(onboardingSource, /const \[planReadyOptionsMenuOpen, setPlanReadyOptionsMenuOpen\] = useState\(false\)/);
      assert.match(onboardingSource, /const \[selectedPlanReadySessionId, setSelectedPlanReadySessionId\] = useState<string \| null>\(null\)/);
      assert.match(onboardingSource, /const selectedPlanReadySession = useMemo/);
      assert.doesNotMatch(onboardingSource, /\.sort\(\(left, right\) => left\.orderIndex - right\.orderIndex\)\s*\n\s*\.slice\(0, 3\)/);
      assert.match(onboardingSource, /WARMUP/);
      assert.match(onboardingSource, /MAIN FOCUS/);
      assert.doesNotMatch(reviewBody, /KEY EXERCISES/);
      assert.match(onboardingSource, /ALL EXERCISES/);
      assert.match(onboardingSource, /PROGRESSION/);
      assert.match(onboardingSource, /FIRST ACTION/);
      assert.doesNotMatch(reviewBody, />View details</);
      assert.match(reviewBody, /setSelectedPlanReadySessionId\(item\.sessionId\)/);
      assert.doesNotMatch(reviewBody, /Hide details/);
      assert.doesNotMatch(reviewBody, /expandedPlanReadySessionId === item\.sessionId/);
      assert.doesNotMatch(reviewBody, /item\.detailExercises\.map/);
      assert.match(onboardingSource, /<Modal\s+visible=\{Boolean\(selectedPlanReadySession\)\}/);
      assert.match(onboardingSource, /selectedPlanReadySession\.detailExercises\.map/);
      assert.match(onboardingSource, /setSelectedPlanReadySessionId\(null\)/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\.guidance\.warmup/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.warmup/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.mainFocus/);
      assert.match(onboardingSource, /selectedPlanReadySession\.guidance\.progressionHint/);
      assert.doesNotMatch(reviewBody, /planReadyFirstWorkout\.exercises\.map/);
      assert.match(reviewBody, /\.slice\(0, 2\)/);
      assert.match(reviewBody, /recommendationOptionIds\s*\n\s*\.filter\(\(programId\) => programId !== activeRecommendedProgramId\)\s*\n\s*\.slice\(0, 2\)/);
      assert.doesNotMatch(reviewBody, /selected: programId === activeRecommendedProgramId/);
      assert.doesNotMatch(reviewBody, /getPlanReadyImageSource/);
      assert.match(reviewBody, /getPlanReadyPreviewImageSource/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_CHARACTER_ASSETS/);
      assert.doesNotMatch(reviewBody, /step7-character-/);
      assert.match(onboardingSource, /step7-preview-male-mass\.png/);
      assert.match(onboardingSource, /step7-preview-female-athletic\.png/);
      assert.match(onboardingSource, /function getPlanReadyImageGender/);
      assert.match(reviewBody, /planReadyRecoverySummary/);
      assert.match(reviewBody, /planReadyWeeklyOverviewRows\.map/);
      assert.match(reviewBody, /planReadyWorkoutDayMeta/);
      assert.match(reviewBody, /planReadyWorkoutDayNumber/);
      assert.match(reviewBody, /planReadyWorkoutDayName/);
      assert.doesNotMatch(reviewBody, /REST \{restDayLabels\.join/);
      assert.doesNotMatch(reviewBody, /planReadyWeekPanelDayPill/);
      assert.doesNotMatch(reviewBody, /stepLabel: 'STEP 7'/);
      assert.doesNotMatch(reviewBody, /renderOnboardingShell/);
      assert.doesNotMatch(reviewBody, /styles\.stageBody/);
      assert.match(onboardingSource, /const standaloneProgressHidden = locationStageActive \|\| stage === 'review'/);
      assert.match(onboardingSource, /return 'tempo'/);
      assert.match(onboardingSource, /return 'restDay'/);
      assert.match(onboardingSource, /paddingBottom: spacing\.xxl \+ spacing\.xl \+ spacing\.lg/);
      assert.match(onboardingSource, /const footerVisible = stage !== 'review'/);
      assert.doesNotMatch(onboardingSource, /stage === 'review' && styles\.footerDarkStage/);
      assert.doesNotMatch(onboardingSource, /stage === 'review' && styles\.reviewPrimaryButton/);
      assert.doesNotMatch(onboardingSource, /stage === 'review' \? styles\.secondaryTextLight : styles\.secondaryTextDark/);
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
  {
    name: 'onboarding bodyweight step adapts target weight by selected goal',
    run() {
      assert.match(onboardingSource, /function getBodyweightGoalMode\(goals: SetupGoal\[\]\)/);
      assert.match(onboardingSource, /goals\.includes\('general'\)/);
      assert.match(onboardingSource, /return 'required'/);
      assert.match(onboardingSource, /goals\.includes\('muscle'\)/);
      assert.match(onboardingSource, /return 'optional'/);

      const aboutBody = getFunctionBody('renderAbout');
      assert.match(aboutBody, /const bodyweightGoalMode = getBodyweightGoalMode\(goals\)/);
      assert.match(aboutBody, /Target weight/);
      assert.match(aboutBody, /bodyweightGoalMode === 'required'/);
      assert.match(aboutBody, /bodyweightGoalMode === 'optional'/);
      assert.match(aboutBody, /setTargetBodyweight/);
      assert.match(aboutBody, /<BodyweightStepper[\s\S]*label="Current weight"/);
      assert.match(aboutBody, /<BodyweightStepper[\s\S]*label=\{`Target weight/);
      assert.doesNotMatch(aboutBody, /<BodyweightPicker/);
      assert.match(onboardingSource, /function BodyweightStepper\(/);
      assert.match(onboardingSource, /<TextInput[\s\S]*keyboardType="decimal-pad"/);
      assert.match(onboardingSource, /stage === 'planning'/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{!scrollLockedStage\}/);
    },
  },
  {
    name: 'onboarding step 2 uses the new Step 1-style primary-goal cards',
    run() {
      const goalBody = getFunctionBody('renderGoal');

      assert.match(goalBody, /stepLabel: 'STEP 2 OF 6'/);
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

      assert.match(planningBody, /stepLabel: 'STEP 4 OF 6'/);
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
      assert.match(planningBody, /Max 2 selections/);
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

      assert.match(welcomeSource, /Build your plan\. Track your progress\./);
      assert.match(welcomeSource, /Rakenna ohjelma\. Seuraa kehitystä\./);
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
      assert.match(onboardingSource, /bodyweightTopPane:\s*\{\s*\}/);
      assert.match(onboardingSource, /focusTopPane:\s*\{[\s\S]*height: 246/);
      assert.match(onboardingSource, /stage === 'planning'/);
      assert.match(onboardingSource, /scrollEnabled=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /bounces=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /alwaysBounceVertical=\{!scrollLockedStage\}/);
      assert.match(onboardingSource, /overScrollMode=\{scrollLockedStage \? 'never' : 'auto'\}/);
    },
  },
  {
    name: 'focus step uses a lightweight body map instead of heavy image cards',
    run() {
      const focusBody = getFunctionBody('renderFocus');

      assert.match(onboardingSource, /type FocusBodyView = 'front' \| 'back'/);
      assert.match(onboardingSource, /const FOCUS_BODY_MENU_ORDER: SetupFocusArea\[\]/);
      assert.match(onboardingSource, /const FOCUS_BODY_PERSON_ASSETS: Record<FocusBodyView, ImageSourcePropType>/);
      assert.match(onboardingSource, /const \[focusBodyView, setFocusBodyView\] = useState<FocusBodyView>\('front'\)/);
      assert.match(focusBody, /focusBodySelectionStage/);
      assert.match(focusBody, /focusBodyViewToggle/);
      assert.match(focusBody, /Front/);
      assert.match(focusBody, /Back/);
      assert.match(focusBody, /FOCUS_BODY_MENU_ORDER\.map/);
      assert.match(focusBody, /focusBodyOptionPill/);
      assert.match(focusBody, /focusBodyFigure/);
      assert.match(focusBody, /<Image\s+source=\{FOCUS_BODY_PERSON_ASSETS\[focusBodyView\]\}/);
      assert.match(focusBody, /focusBodyPersonImage/);
      assert.match(focusBody, /focusAreas\.includes\('conditioning'\)/);
      assert.match(focusBody, /styles\.focusBodyConditioningGlow/);
      assert.doesNotMatch(focusBody, /setupOptionGrid/);
      assert.doesNotMatch(focusBody, /SetupOptionCard/);
      assert.doesNotMatch(focusBody, /FOCUS_AREA_CARD_ASSETS/);
      assert.match(onboardingSource, /focusBottomPane:\s*\{[\s\S]*paddingTop: 4/);
      assert.match(onboardingSource, /focusStageShell:\s*\{[\s\S]*minHeight: 0/);
      assert.match(onboardingSource, /focusTopPane:\s*\{[\s\S]*height: 246/);
      assert.match(onboardingSource, /focusBodySelectionStage:\s*\{[\s\S]*minHeight: 360/);
      assert.match(onboardingSource, /focusBodyFigure:\s*\{[\s\S]*height: 244/);
      assert.match(onboardingSource, /focusBodyOptionPill:\s*\{[\s\S]*minHeight: 31/);
      assert.match(onboardingSource, /focusBodyHead:\s*\{[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.14\)'/);
      assert.match(onboardingSource, /focusBodyTorso:\s*\{[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.11\)'/);
      assert.match(onboardingSource, /focusBodyPartActive:\s*\{[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.68\)'/);
      assert.doesNotMatch(onboardingSource, /focusBodyPartActive:\s*\{[\s\S]*backgroundColor: '#E8E8E8'/);
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
    name: 'plan-ready alternatives use a top-right peek',
    run() {
      const reviewBody = getFunctionBody('renderReview');
      const peekStyle = onboardingSource.slice(
        onboardingSource.indexOf('planReadyOtherPlansPeek: {'),
        onboardingSource.indexOf('planReadyOtherPlansPeekDisabled:', onboardingSource.indexOf('planReadyOtherPlansPeek: {')),
      );

      assert.match(reviewBody, /const nextPlanOption = planReadyOptions\[0\] \?\? null/);
      assert.match(reviewBody, /planReadyOtherPlansPeek/);
      assert.match(reviewBody, /planReadyOtherPlansPeekFoldLine/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansPeekArrow/);
      assert.match(reviewBody, /setPlanReadyOptionsMenuOpen\(\(current\) => !current\)/);
      assert.match(reviewBody, /planReadyOptionsMenuOpen \? \(/);
      assert.match(reviewBody, /planReadyOptionsMenuItem/);
      assert.match(reviewBody, /planReadyOptionsMenuFooter/);
      assert.doesNotMatch(reviewBody, /planReadyHeroInfoButton/);
      assert.doesNotMatch(reviewBody, /setSelectedRecommendationProgramId\(nextPlanOption\.id\)/);
      assert.match(reviewBody, /setSelectedRecommendationProgramId\(option\.id\)/);
      assert.match(reviewBody, /Animated\.View/);
      assert.match(reviewBody, /planReadyCardTranslateX/);
      assert.match(reviewBody, /planReadyCardOpacity/);
      assert.match(onboardingSource, /Animated\.timing\(planReadyCardTranslateX/);
      assert.doesNotMatch(reviewBody, /SEE OTHER PLANS/);
      assert.doesNotMatch(reviewBody, /planReadyOtherPlansRail/);
      assert.doesNotMatch(reviewBody, /PROGRAM OPTIONS PREVIEW/);
      assert.doesNotMatch(reviewBody, /ALTERNATIVE PLAN/);
      assert.match(peekStyle, /position: 'absolute'/);
      assert.match(peekStyle, /width: 126/);
      assert.match(peekStyle, /height: 46/);
      assert.match(peekStyle, /backgroundColor: '#FFFFFF'/);
      assert.match(peekStyle, /right: 0/);
      assert.match(onboardingSource, /planReadyOtherPlansLabel:\s*\{[\s\S]*color: '#06080B'/);
      assert.match(onboardingSource, /planReadyOtherPlansPeekFoldLine:\s*\{[\s\S]*transform: \[\{ rotate: '-45deg' \}\]/);
    },
  },
  {
    name: 'plan-ready summary is one visual workout plan card',
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

      assert.match(reviewBody, /const trainingWeekRows = reviewWeekRows\.filter\(\(item\) => item\.training\)/);
      assert.match(reviewBody, /const restDayLabels = reviewWeekRows\s*\n\s*\.filter\(\(item\) => !item\.training\)\s*\n\s*\.map\(\(item\) => item\.day\)/);
      assert.match(reviewBody, /const planReadyPreviewRows = trainingWeekRows\.slice\(0, 2\)/);
      assert.match(reviewBody, /const planReadyWeeklyOverviewRows = reviewWeekRows\.map/);
      assert.match(reviewBody, /planReadyPreviewRows\.map/);
      assert.doesNotMatch(reviewBody, /trainingWeekRows\.map\(\(item, index\) =>/);
      assert.match(reviewBody, /YOUR WORKOUT PLAN/);
      assert.match(reviewBody, /Your weekly overview/);
      assert.match(reviewBody, /Day \{index \+ 1\}/);
      assert.match(reviewBody, /\{item\.day\}/);
      assert.match(reviewBody, /planReadyWorkoutDayCard/);
      assert.match(reviewBody, /item\.exercises\.map/);
      assert.match(reviewBody, /exercise\.compactPrescription/);
      assert.match(reviewBody, /planReadyWeeklyOverviewRows\.map/);
      assert.match(reviewBody, /item\.training \? 'Train' : 'Recover'/);
      assert.doesNotMatch(reviewBody, /planReadyWeekPanelRest/);
      assert.doesNotMatch(reviewBody, /restDayLabels\.join\(', '\)/);
      assert.match(reviewBody, /Best fit for you/);
      assert.match(reviewBody, /Progressive overload/);
      assert.match(reviewBody, /icon: 'tempo'/);
      assert.match(reviewBody, /icon: 'progress'/);
      assert.match(reviewBody, /icon: 'check'/);
      assert.match(reviewBody, /key=\{chip\.label\}/);
      assert.match(reviewBody, /<GymlogIcon name=\{chip\.icon\}/);
      assert.match(heroCardStyle, /backgroundColor: '#0B0B0B'/);
      assert.match(heroCardStyle, /overflow: 'hidden'/);
      assert.match(heroCardStyle, /marginHorizontal: 0/);
      assert.match(heroCardStyle, /borderRadius: 0/);
      assert.match(onboardingSource, /planReadyStage:\s*\{[\s\S]*paddingHorizontal: 0/);
      assert.match(onboardingSource, /planReadyPlanCard:\s*\{[\s\S]*borderWidth: 0/);
      assert.match(onboardingSource, /planReadyPlanCard:\s*\{[\s\S]*borderRadius: 0/);
      assert.match(onboardingSource, /planReadyCardShell:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(heroImageStyle, /minHeight: 312/);
      assert.match(onboardingSource, /PLAN_READY_GYM_BACKDROP_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/plan-ready-empty-gym-backdrop-bw\.jpg'\)/);
      assert.doesNotMatch(onboardingSource, /PLAN_READY_GYM_BACKDROP_SOURCE = require\('\.\.\/\.\.\/assets\/fitness\/selected\/plan-ready-gym-backdrop-bw\.jpg'\)/);
      assert.match(onboardingSource, /planReadyHeroImageStyle:\s*\{[\s\S]*opacity: 0\.84/);
      assert.match(onboardingSource, /planReadyHeroImageStyle:\s*\{[\s\S]*transform: \[\{ scaleX: 1\.12 \}, \{ scaleY: 1\.26 \}, \{ translateX: 24 \}\]/);
      assert.match(onboardingSource, /planReadyHeroGradientTop:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.75\)'/);
      assert.match(onboardingSource, /planReadyHeroGradientMiddle:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.45\)'/);
      assert.match(onboardingSource, /planReadyHeroGradientBottom:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.90\)'/);
      assert.match(onboardingSource, /planReadyHeroTopRow:\s*\{[\s\S]*justifyContent: 'flex-end'/);
      assert.match(onboardingSource, /planReadyHeroTextScrim:\s*\{[\s\S]*backgroundColor: 'rgba\(0,0,0,0\.24\)'/);
      assert.match(onboardingSource, /planReadyHeroCopy:\s*\{[\s\S]*marginTop: 90/);
      assert.match(onboardingSource, /planReadyHeroTitleRow:\s*\{[\s\S]*justifyContent: 'space-between'/);
      assert.match(onboardingSource, /planReadyHeroTitleDetailsButton:\s*\{[\s\S]*backgroundColor: '#FFFFFF'/);
      assert.match(onboardingSource, /planReadyHeroTitleDetailsText:\s*\{[\s\S]*color: '#06080B'/);
      assert.match(onboardingSource, /planReadyHeroKicker:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.58\)'/);
      assert.match(onboardingSource, /planReadyHeroKicker:\s*\{[\s\S]*fontSize: 10/);
      assert.match(onboardingSource, /planReadyHeroBody:\s*\{[\s\S]*color: 'rgba\(255,255,255,0\.72\)'/);
      assert.match(weekPanelStyle, /backgroundColor: 'transparent'/);
      assert.match(weekPanelStyle, /borderWidth: 0/);
      assert.match(weekRowStyle, /backgroundColor: 'rgba\(255,255,255,0\.05\)'/);
      assert.match(weekRowStyle, /borderRadius: radii\.sm/);
      assert.match(chipStyle, /backgroundColor: '#222222'/);
      assert.match(onboardingSource, /planReadyCardContent:\s*\{[\s\S]*flex: 1/);
      assert.match(onboardingSource, /planReadyCardContent:\s*\{[\s\S]*paddingBottom: spacing\.sm/);
      assert.match(onboardingSource, /planReadyInlineActions:\s*\{[\s\S]*marginTop: 'auto'/);
      assert.match(onboardingSource, /planReadyInlineActions:\s*\{[\s\S]*paddingBottom: spacing\.lg/);
      assert.match(onboardingSource, /planReadyWeeklyOverviewDay:\s*\{[\s\S]*gap: 8/);
      assert.match(onboardingSource, /planReadyHeroChipRow:\s*\{[\s\S]*flexDirection: 'column'/);
      assert.match(onboardingSource, /planReadyHeroChip:\s*\{[\s\S]*flexDirection: 'row'/);
      assert.match(onboardingSource, /planReadyHeroChipIcon/);
      assert.doesNotMatch(reviewBody, /recommendationConfidenceCopy\.title/);
      assert.doesNotMatch(reviewBody, /planReadyPrimaryReason/);
      assert.match(iconSource, /\| 'eye'/);
      assert.match(iconSource, /case 'eye':/);
    },
  },
];
