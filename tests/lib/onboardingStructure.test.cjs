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
  path.join(__dirname, '..', '..', 'src', 'components', 'VinhaIcon.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'),
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
      const progressionBody = getFunctionBody('renderPlanReadyProgression');

      // Plan-ready is a four-view flow: program pick (08b) -> overview -> day
      // preview -> plan review (automated-progression toggle). No account gate
      // — auth lives on Welcome.
      assert.match(onboardingSource, /const \[planReadyView, setPlanReadyView\] = useState<'pick' \| 'overview' \| 'day' \| 'progression'>\('overview'\)/);
      assert.match(reviewBody, /if \(planReadyView === 'pick'\) \{\s*return renderProgramPick\(\);/);
      assert.match(reviewBody, /if \(planReadyView === 'progression'\) \{\s*return renderPlanReadyProgression\(\);/);
      assert.match(reviewBody, /if \(planReadyView === 'day'\) \{\s*return renderPlanReadyDay\(\);/);

      // The builder lands on the picker first; "Save plan & start" advances it.
      assert.match(onboardingSource, /setPlanReadyView\('pick'\);\s*\r?\n\s*setStageIndex\(getStageIndex\('review'\)\)/);
      assert.match(onboardingSource, /t\(language, 'onb\.cta\.savePlan'\)/);
      assert.match(i18nSource, /'onb\.cta\.savePlan': 'Save plan & start'/);

      // Program pick: one big purple heading, no subline, two equal-template
      // cards (recommended first, selection follows taps), honest focus split.
      const pickBody = getFunctionBody('renderProgramPick');
      assert.match(pickBody, />\{t\(language, 'onb\.planReady\.title'\)\}</);
      assert.doesNotMatch(pickBody, />Pick your program</);
      assert.doesNotMatch(pickBody, /-week plan/);
      assert.match(pickBody, /programPickOptions\.map/);
      assert.match(pickBody, /setSelectedRecommendationProgramId\(option\.id\)/);
      assert.match(onboardingSource, /function ProgramPickCard\(/);
      assert.match(onboardingSource, /t\(language, 'onb\.pick\.whereWeekGoes'\)/);
      // Days-per-week truth: picker stats + focus split come from the composed
      // week (what actually gets saved), never the raw catalog template.
      assert.match(onboardingSource, /composeProgramWeekForSelection\(selection, programId\)/);
      assert.match(onboardingSource, /buildProgramFocusSplit\(week\.sessions\)/);
      assert.doesNotMatch(onboardingSource, /days: template\.daysPerWeek/);

      // Overview: "Your program is ready" H1 + subtitle, then the 2-card result:
      // a big RECOMMENDED program card (why-line + stat trio + week link) and a
      // smaller ALTERNATIVE card that swaps the selection. No week rows.
      assert.match(reviewBody, />\{t\(language, 'onb\.planReady\.title'\)\}</);
      assert.doesNotMatch(reviewBody, /YOUR PLAN IS READY/);
      assert.match(reviewBody, /'onb\.planReady\.perWeekLine', \{ count: planReadyPerWeek \}/);
      assert.doesNotMatch(reviewBody, /BUILD · FOCUS · PROGRESS/);
      assert.match(reviewBody, /\[String\(planReadyTotalWorkouts\), t\(language, 'onb\.planReady\.workoutsTotal'\)\]/);
      assert.match(reviewBody, /\[planReadySessionLength, t\(language, 'onb\.pick\.perSession'\)\]/);
      // Badges are honest about the user's choice: the big card says YOUR PICK
      // when the selection is not the engine's recommendation, and the
      // alternative row flips to RECOMMENDED when that's what it holds.
      assert.match(reviewBody, /planReadyIsRecommended \? 'onb\.pick\.recommended' : 'onb\.pick\.yourPick'/);
      assert.match(
        reviewBody,
        /=== recommendation\.featuredProgramId[\s\S]{0,60}'onb\.pick\.recommended'[\s\S]{0,40}'onb\.pick\.alternative'/,
      );
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

      // Plan review: automated-progression toggle card (default ON = glow +
      // purple checks; OFF dims bullets with strike-through), Settings note,
      // CTA "Start training" completes onboarding. No "Save your plan" copy.
      assert.match(progressionBody, /t\(language, 'onb\.progression\.title'\)/);
      assert.match(progressionBody, /'onb\.progression\.subOn' : 'onb\.progression\.subOff'/);
      assert.match(progressionBody, /'onb\.progression\.bodyOn' : 'onb\.progression\.bodyOff'/);
      assert.match(progressionBody, /accessibilityRole="switch"/);
      assert.match(progressionBody, /setAutomatedProgressionEnabled\(\(current\) => !current\)/);
      assert.match(progressionBody, /PROGRESSION_BULLET_KEYS\.map/);
      assert.match(progressionBody, /styles\.progressionCardOn/);
      assert.match(progressionBody, /styles\.progressionBulletTextOff/);
      assert.match(progressionBody, /t\(language, 'onb\.progression\.note'\)/);
      assert.match(onboardingSource, /const \[automatedProgressionEnabled, setAutomatedProgressionEnabled\] = useState\(/);
      assert.match(onboardingSource, /progressionBulletTextOff:\s*\{[\s\S]*textDecorationLine: 'line-through'/);
      assert.match(onboardingSource, /automatedProgression: automatedProgressionEnabled/);
      assert.match(appSource, /automatedProgressionEnabled: selection\.automatedProgression \?\? true/);
      assert.doesNotMatch(onboardingSource, /Save your plan/);
      assert.doesNotMatch(onboardingSource, /renderPlanReadyAccount/);

      // Overview continues to the progression screen; the day view's footer
      // returns to the plan ("Back to plan"); progression completes onboarding.
      assert.match(onboardingSource, /setPlanReadyWorkoutPage\(0\);\s*setPlanReadyView\('day'\)/);
      assert.match(onboardingSource, /if \(planReadyView === 'day'\) \{\s*setPlanReadyView\('overview'\);/);
      assert.match(onboardingSource, /setPlanReadyView\('progression'\)/);
      assert.match(onboardingSource, /onCompleteToTraining\(selection, activeRecommendedProgramId\)/);
      assert.doesNotMatch(onboardingSource, /: 'See day 1'/);
      assert.match(
        onboardingSource,
        /\? t\(language, 'onb\.cta\.backToPlan'\)\s*: planReadyView === 'progression'\s*\? t\(language, 'onb\.cta\.startTraining'\)\s*: t\(language, 'common\.continue'\)/,
      );
      assert.match(i18nSource, /'onb\.cta\.startTraining': 'Start training'/);

      // App-side save truthfulness: persist the plan and activate it before
      // landing on Home (no auto-started workout in the light flow).
      assert.match(appSource, /function waitForPlanSaveFeedback\(\)[\s\S]*setTimeout\(resolve, 3000\)/);
      // Save path shares the composed week with the onboarding previews
      // (days-per-week truth): what was shown is exactly what is saved.
      assert.match(appSource, /function buildSavedOnboardingPlan\([\s\S]*composeProgramWeekForSelection\(selection, recommendedProgramId\)/);
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
    name: 'onboarding uses six input steps and builds directly from focus areas',
    run() {
      const footerStart = onboardingSource.indexOf('const footerPrimaryLabel =');
      assert.notEqual(footerStart, -1, 'footerPrimaryLabel should exist');
      const footerBody = onboardingSource.slice(footerStart, onboardingSource.indexOf('<Modal', footerStart));

      assert.match(onboardingSource, /const STAGES: SetupStage\[\] = \['location', 'goal', 'level', 'days', 'avoid', 'planning', 'review'\]/);
      assert.match(onboardingSource, /const ONBOARDING_PROGRESS_STAGES: SetupStage\[\] = \['location', 'goal', 'level', 'days', 'avoid', 'planning'\]/);
      assert.match(onboardingSource, /ONBOARDING_PROGRESS_STAGES\.map/);
      // STEP n OF m labels are computed from the stage array, never hardcoded.
      assert.match(onboardingSource, /function getQuestionnaireStepLabel\(stage: SetupStage, language: AppLanguage\)/);
      assert.match(i18nSource, /'onb\.stepLabel': 'STEP \{index\} OF \{count\}'/);
      assert.doesNotMatch(onboardingSource, /stepLabel: 'STEP \d OF \d'/);
      // Focus areas is the last question; building starts straight from it.
      assert.match(footerBody, /stage === 'planning'[\s\S]*t\(language, 'onb\.cta\.buildPlan'\)/);
      assert.match(i18nSource, /'onb\.cta\.buildPlan': 'Build my plan'/);
      assert.match(footerBody, /if \(stage === 'planning'\) \{[\s\S]*setIsBuildingPlan\(true\)/);
    },
  },
  {
    name: 'onboarding avoid step colour-codes caution levels and writes shared flags',
    run() {
      const avoidBody = getFunctionBody('renderAvoid');
      const rowStart = onboardingSource.indexOf('function renderCautionRow(');
      assert.notEqual(rowStart, -1, 'renderCautionRow should exist');
      const rowEnd = onboardingSource.indexOf('\n  function renderAvoid', rowStart);
      assert.notEqual(rowEnd, -1, 'renderCautionRow should be followed by renderAvoid');
      const rowBody = onboardingSource.slice(rowStart, rowEnd);

      assert.match(avoidBody, /stepLabel: getQuestionnaireStepLabel\('avoid', language\)/);
      assert.match(avoidBody, /titleLines: \[t\(language, 'onb\.stage\.avoid\.title1'\), t\(language, 'onb\.stage\.avoid\.title2'\)\]/);
      assert.match(avoidBody, /AVOID_AREA_OPTIONS\.map/);
      assert.match(avoidBody, /t\(language, 'onb\.avoid\.addOther'\)/);
      assert.match(avoidBody, /t\(language, 'onb\.avoid\.nothingToNote'\)/);
      assert.match(avoidBody, /setCautionFlags\(\[\]\)/);

      // Three colour-coded levels tint the tile, border, radio and title.
      assert.match(onboardingSource, /info: \{ ink: '#667085', soft: '#F1F0F4' \}/);
      assert.match(onboardingSource, /careful: \{ ink: '#D97706', soft: '#FEF3C7' \}/);
      assert.match(onboardingSource, /avoid: \{ ink: '#DC2626', soft: '#FEE2E2' \}/);
      assert.match(rowBody, /CAUTION_LEVEL_OPTIONS\.map/);
      assert.match(rowBody, /setCautionLevel\(option\.area, levelOption\.level\)/);
      assert.match(rowBody, /toggleCautionRefinement\(option\.area, refinement\)/);
      assert.match(rowBody, /t\(language, 'onb\.avoid\.refine'\)/);
      // Copy lives in the dictionary; the catalog carries the keys.
      assert.match(onboardingSource, /labelKey: 'onb\.caution\.info\.label'/);
      assert.match(onboardingSource, /labelKey: 'onb\.caution\.careful\.label'/);
      assert.match(onboardingSource, /labelKey: 'onb\.caution\.avoid\.label'/);
      assert.match(i18nSource, /'onb\.caution\.info\.label': 'For info only'/);
      assert.match(i18nSource, /'onb\.caution\.careful\.label': 'Be careful'/);
      assert.match(i18nSource, /'onb\.caution\.avoid\.label': 'Avoid entirely'/);

      // CTA reads Skip until something is flagged; flags persist to prefs.
      assert.match(
        onboardingSource,
        /stage === 'avoid'\s*\r?\n?\s*\? cautionFlags\.length > 0\s*\r?\n?\s*\? t\(language, 'common\.continue'\)\s*\r?\n?\s*: t\(language, 'onb\.cta\.skip'\)/,
      );
      assert.match(onboardingSource, /cautionFlags,/);
      assert.match(appSource, /setupCautionFlags: selection\.cautionFlags \?\? \[\]/);
    },
  },
  {
    name: 'onboarding step 1 asks what you can train with using equipment chips',
    run() {
      const locationBody = getFunctionBody('renderLocation');

      assert.match(locationBody, /titleLines: \[t\(language, 'onb\.stage\.location\.title1'\), t\(language, 'onb\.stage\.location\.title2'\)\]/);
      assert.doesNotMatch(locationBody, /Where do you train\?/);
      // Selected setup expands into toggle chips with a live count; the other
      // setups collapse into compact rows under OR CHOOSE ANOTHER.
      assert.match(locationBody, /EQUIPMENT_CHIP_CATALOG\[selectedSetup\.id\]/);
      assert.match(locationBody, /t\(language, 'onb\.equip\.selectedCount', \{ count: equipmentItems\.length \}\)/);
      assert.match(locationBody, /t\(language, 'onb\.equip\.orChoose'\)/);
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

      assert.match(goalBody, /stepLabel: getQuestionnaireStepLabel\('goal', language\)/);
      assert.match(goalBody, /titleLines: \[t\(language, 'onb\.stage\.goal\.title1'\), t\(language, 'onb\.stage\.goal\.title2'\)\]/);
      assert.match(goalBody, /subtitle: t\(language, 'onb\.stage\.goal\.sub'\)/);
      assert.match(i18nSource, /'onb\.stage\.goal\.sub': "We'll build your training around this\."/);
      assert.match(goalBody, /renderSplitSelectionStage\(\{/);
      assert.match(goalBody, /roomyCards: true/);
      assert.doesNotMatch(goalBody, /compactCards: true/);
      assert.match(goalBody, /optionsContainerStyle: styles\.locationStepTwoOptionsShift/);
      assert.match(goalBody, /topPaneStyleOverride: styles\.locationEquipmentTopPane/);
      assert.match(goalBody, /titleStyleOverride: styles\.locationEquipmentHeadline/);
      assert.match(goalBody, /active: goal === option\.id/);
      assert.doesNotMatch(goalBody, /goals\.includes\(option\.id\)/);
      assert.match(onboardingSource, /titleKey: 'onb\.goal\.strength\.title'/);
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

      assert.match(levelBody, /stepLabel: getQuestionnaireStepLabel\('level', language\)/);
      assert.match(levelBody, /titleLines: \[t\(language, 'onb\.stage\.level\.title1'\)\]/);
      assert.match(levelBody, /subtitle: t\(language, 'onb\.stage\.level\.sub'\)/);
      assert.match(i18nSource, /'onb\.stage\.level\.sub': 'How much training experience do you have\?'/);
      // Slider with three stops, live descriptor lines, and flames that pop
      // and scale with the chosen level around the GAINER wordmark.
      assert.match(levelBody, /LEVEL_SLIDER_OPTIONS\.map/);
      assert.match(levelBody, /setLevel\(option\.level\)/);
      assert.match(levelBody, /levelThumbAnim/);
      assert.match(levelBody, /levelFlamePop/);
      assert.match(levelBody, /<AnimatedFlame/);
      assert.match(levelBody, /selectedLevelOption\.lineKeys\.map/);
      assert.doesNotMatch(levelBody, /GENDER_OPTIONS/);
      assert.doesNotMatch(levelBody, /TRAINING_FREQUENCY_OPTIONS/);
      // SetupLevel and the UI share the same tier names: beginner/advanced/pro.
      assert.match(onboardingSource, /level: 'advanced',\s*\r?\n\s*labelKey: 'onb\.level\.advanced\.label'/);
      assert.match(onboardingSource, /level: 'pro',\s*\r?\n\s*labelKey: 'onb\.level\.pro\.label'/);
      assert.match(i18nSource, /'onb\.level\.advanced\.label': 'Advanced'/);
      assert.match(i18nSource, /'onb\.level\.pro\.label': 'Pro'/);
      assert.match(onboardingSource, /const LEVEL_FLAME_LAYOUTS/);
      assert.match(onboardingSource, /function FlameGlyph\(/);
      // Flames flicker on their own rhythm and burn red, with year-range
      // guidance under the slider segments.
      assert.match(onboardingSource, /function AnimatedFlame\(/);
      assert.match(onboardingSource, /const FLAME_RED = '#EF4444'/);
      assert.match(levelBody, /levelYearsRow/);
      assert.match(i18nSource, /'onb\.level\.beginner\.years': '0–1 years'/);

      assert.match(daysBody, /stepLabel: getQuestionnaireStepLabel\('days', language\)/);
      assert.match(daysBody, /titleLines: \[t\(language, 'onb\.stage\.days\.title1'\)\]/);
      assert.match(daysBody, /subtitle: t\(language, 'onb\.stage\.days\.sub'\)/);
      assert.match(i18nSource, /'onb\.stage\.days\.sub': 'How many days per week can you train\?'/);
      // Number chips 2-6 on top (recommended flagged by level) and a tappable
      // Mon-Sun letter row below that drives the count both ways.
      assert.match(daysBody, /TRAINING_DAY_COUNT_OPTIONS\.map/);
      assert.match(daysBody, /selectTrainingDaysCount\(option\)/);
      assert.match(daysBody, /option === recommendedDays/);
      assert.match(daysBody, /Recommended/);
      assert.match(daysBody, /WEEKDAY_OPTIONS\.map/);
      assert.match(daysBody, /toggleTrainingDay\(day\)/);
      assert.match(daysBody, /t\(language, WEEKDAY_LETTER_KEYS\[day\]\)/);
      assert.match(daysBody, /t\(language, 'onb\.days\.summary', \{ days: selectedDays\.length, rest: restCount \}\)/);
      assert.match(i18nSource, /'onb\.days\.summary': '\{days\} training days · \{rest\} rest'/);
      assert.doesNotMatch(daysBody, /TRAINING_FREQUENCY_OPTIONS/);

      assert.match(onboardingSource, /const TRAINING_DAY_COUNT_OPTIONS: SetupDaysPerWeek\[\] = \[2, 3, 4, 5, 6\]/);
      assert.match(onboardingSource, /level === 'beginner' \? 3 : level === 'pro' \? 5 : 4/);
      // Chips reset to the app-managed default rhythm; hand-picked days switch
      // to self-managed scheduling and clamp to the supported 2-6 range.
      assert.match(onboardingSource, /setAvailableDays\(DEFAULT_RHYTHM_BY_DAYS\[option\]\)/);
      assert.match(onboardingSource, /setScheduleMode\('app_managed'\)/);
      assert.match(onboardingSource, /if \(next\.length < 2 \|\| next\.length > 6\)/);
      assert.match(onboardingSource, /setDaysPerWeek\(next\.length as SetupDaysPerWeek\)/);
      assert.match(onboardingSource, /setScheduleMode\('self_managed'\)/);
      assert.match(onboardingSource, /trainingProfileTopPane:\s*\{[\s\S]*height: 150/);
    },
  },
  {
    name: 'onboarding focus areas is a caution-aware name list',
    run() {
      const planningBody = getFunctionBody('renderPlanning');

      assert.match(planningBody, /stepLabel: getQuestionnaireStepLabel\('planning', language\)/);
      assert.match(planningBody, /titleLines: \[t\(language, 'onb\.stage\.focus\.title1'\), t\(language, 'onb\.stage\.focus\.title2'\)\]/);
      assert.match(planningBody, /FOCUS_AREA_OPTIONS\.filter\(\(option\) => option\.area !== 'mobility'\)/);
      // Name-only selectable rows, tap-to-fill like the goal step; 1-2 picks.
      assert.match(planningBody, /visibleFocusOptions\.map/);
      assert.match(planningBody, /toggleFocusArea\(option\.area\)/);
      assert.match(planningBody, /styles\.focusListRowActive/);
      // Flagged areas keep their caution colour when selected, and picking one
      // swaps the hint for the bodyweight-safety note. No info box.
      assert.match(planningBody, /flaggedFocusSelected/);
      assert.match(planningBody, /joint-friendly, bodyweight-first exercises/);
      assert.match(planningBody, /t\(language, 'onb\.pickAreas'\)/);
      assert.match(i18nSource, /'onb\.pickAreas': 'Pick 1–2 areas\.'/);
      assert.doesNotMatch(planningBody, /Why focus areas\?/);
      assert.match(onboardingSource, /const FOCUS_AREA_OPTIONS = getOnboardingFocusAreaPresentationOptions\(\)/);
      assert.match(onboardingSource, /current\.length >= 2/);

      // Avoid-step flags colour the rows: amber careful / red avoid + triangle.
      assert.match(planningBody, /getFocusAreaCautionLevel\(option\.area, cautionFlags\)/);
      assert.match(planningBody, /CAUTION_LEVEL_COLORS\[caution\]/);
      assert.match(planningBody, /<CautionGlyph/);
      // The area mapping is shared with the exercise filter (P2) so UI colour
      // and actual filtering can never disagree.
      assert.match(onboardingSource, /import \{ buildCautionSummaryLabel, CAUTION_TO_FOCUS_AREAS \} from '..\/lib\/cautionExerciseFilter'/);
      assert.match(onboardingSource, /function getFocusAreaCautionLevel\(/);

      // Anatomy-highlight cards are gone.
      assert.doesNotMatch(onboardingSource, /FocusAreaBodyCard/);
      assert.doesNotMatch(onboardingSource, /FOCUS_AREA_BODY_FRAMING/);
      assert.doesNotMatch(onboardingSource, /react-native-body-highlighter/);
    },
  },
  {
    name: 'launch splash waits on every app start and welcome copy is plan focused',
    run() {
      assert.match(appSource, /const \[minimumSplashElapsed, setMinimumSplashElapsed\] = useState\(false\)/);
      assert.match(appSource, /if \(!minimumSplashElapsed\) \{\s*return;\s*\}/);
      assert.doesNotMatch(appSource, /firstAppOpen/);

      // Light welcome: plan-focused copy now lives in the i18n dictionary and
      // the screen renders every string through t(language, …).
      assert.match(i18nSource, /You go to the gym\./);
      assert.match(i18nSource, /We handle the rest\./);
      assert.match(i18nSource, /Continue with Google/);
      assert.match(i18nSource, /Continue with Apple/);
      assert.match(i18nSource, /Sign up with email/);
      assert.match(i18nSource, /I already have an account/);
      // The old Welcome CTA is gone. Scoped to a welcome.* value on purpose:
      // "Start free" is legitimate prose on the access-choice screen.
      assert.doesNotMatch(i18nSource, /'welcome\.[^']*': '[^']*Start free/);
      assert.match(welcomeSource, /t\(language, 'welcome\.tagline'\)/);
      assert.match(welcomeSource, /t\(language, 'welcome\.continueGoogle'\)/);
      assert.match(welcomeSource, /SUPPORTED_LANGUAGES/);
      // Reads the theme rather than copying a value: a local hex silently
      // drifts the moment the palette moves, which is exactly what happened.
      // The module-level BG constant is gone — a constant cannot follow a
      // theme, so the background is read inside the style factory.
      assert.doesNotMatch(welcomeSource, /const BG = /);
      assert.match(welcomeSource, /backgroundColor: theme\.bg/);
      assert.match(welcomeSource, /const PURPLE = '#7C3AED'/);
      assert.match(welcomeSource, /logoInk/);
      assert.match(welcomeSource, /logoPurple/);
      assert.match(i18nSource, /AI-built plans/);
      assert.match(i18nSource, /Recovery aware/);
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
        onboardingSource.indexOf('function SetupOptionCard'),
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
      assert.match(onboardingSource, /focusAreaTopPane:\s*\{[\s\S]*height: 186/);
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
      assert.match(onboardingSource, /const ONBOARDING_PANEL = HG.bg/);
      assert.match(onboardingSource, /const ONBOARDING_CARD = '#FFFFFF'/);
      assert.match(onboardingSource, /const ONBOARDING_PRIMARY = '#7C3AED'/);
      assert.match(onboardingSource, /const ONBOARDING_TEXT = '#101828'/);
      // The old black plan-ready stage is gone.
      assert.doesNotMatch(onboardingSource, /planReadyStage:\s*\{\s*backgroundColor: '#050505'/);
      assert.doesNotMatch(onboardingSource, /planReadyHeader:/);
      // Cover stats stay readable on the purple cover.
      assert.match(onboardingSource, /planReadyOverviewStatRow:\s*\{[\s\S]*justifyContent: 'space-between'/);
      assert.match(onboardingSource, /planReadyOverviewStatValue:\s*\{[\s\S]*color: '#FFFFFF'/);
      // Decorative cover orb removed.
      assert.doesNotMatch(onboardingSource, /planReadyOverviewCoverGlow/);
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
      // Composed-week day count wins; the raw template count is only a fallback.
      assert.match(reviewBody, /projectedDaysPerWeek[\s\S]*planReadyPayload\.programDaysPerWeek[\s\S]*planReadyPayload\.requestedDaysPerWeek/);
      assert.match(reviewBody, /const planReadyTotalWorkouts = planReadyWeeks \* planReadyPerWeek/);

      // Subtitle line: "{N}-week plan · goal · location", dot separated.
      assert.match(
        reviewBody,
        /'onb\.planReady\.weekPlan', \{ count: planReadyWeeks \}[\s\S]{0,60}goalLabel,\s*locationLabel/,
      );
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
