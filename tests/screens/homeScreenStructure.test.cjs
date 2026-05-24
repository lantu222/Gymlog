const assert = require('assert');
const fs = require('fs');
const path = require('path');

const homeScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'HomeScreen.tsx'),
  'utf8',
);
const bottomTabBarSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'BottomTabBar.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

module.exports = [
  {
    name: 'training tab prioritizes the active plan before quick starts',
    run() {
      assert.match(homeScreenSource, /interface HomePlanCard/);
      assert.match(homeScreenSource, /activePlan\?: HomePlanCard \| null/);
      assert.match(homeScreenSource, /onOpenActivePlan\?: \(\) => void/);
      assert.match(homeScreenSource, /const hasActivePlan = Boolean\(activePlan\)/);
      assert.match(homeScreenSource, /ImageBackground/);
      assert.match(homeScreenSource, /HOME_WORKOUT_HERO_IMAGE/);
      assert.match(homeScreenSource, /step7-preview-male-mass\.png/);
      assert.match(homeScreenSource, /profileName\?: string \| null/);
      assert.match(homeScreenSource, /Welcome back, \{greetingName\}\./);
      assert.match(homeScreenSource, /Let's crush today\./);
      assert.match(homeScreenSource, /name="bell"/);
      assert.match(homeScreenSource, /name="profile"/);
      assert.match(homeScreenSource, /notificationDot/);
      assert.match(homeScreenSource, /activePlan\.title/);
      assert.match(homeScreenSource, /miniCalendarRow/);
      assert.match(homeScreenSource, /calendarVisible/);
      assert.match(homeScreenSource, /Open training calendar/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.title/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.duration/);
      assert.match(homeScreenSource, /todayWorkoutScrim/);
      assert.match(homeScreenSource, /todayWorkoutGreenGlow/);
      assert.match(homeScreenSource, /START YOUR/);
      assert.match(homeScreenSource, /WORKOUT HERE/);
      assert.match(homeScreenSource, /startWorkoutFloatingButton/);
      assert.match(homeScreenSource, /onStartActivePlan/);
      assert.match(homeScreenSource, /workoutPlanCard/);
      assert.match(homeScreenSource, /Today's workout/);
      assert.match(homeScreenSource, /Plan preview/);
      assert.match(homeScreenSource, /View plan/);
      assert.match(homeScreenSource, /buildFallbackPreviewSessions/);
      assert.match(homeScreenSource, /quickActionSection/);
      assert.match(homeScreenSource, /Quick actions/);
      assert.match(homeScreenSource, /Explore workout plans/);
      assert.match(homeScreenSource, /Build your own split/);
      assert.match(homeScreenSource, /bottomSafeFade/);
      assert.match(homeScreenSource, /bottomSafeFadeSoft/);
      assert.match(homeScreenSource, /WEEKLY_OVERVIEW_DAYS/);
      assert.match(homeScreenSource, /WEEKLY_OVERVIEW_CARD_HEIGHT/);
      assert.match(homeScreenSource, /PROGRESS_SUMMARY_CARD_HEIGHT = 178/);
      assert.match(homeScreenSource, /TRAINING_DAY_PATTERNS/);
      assert.match(homeScreenSource, /getWeeklyTrainingIndexes/);
      assert.doesNotMatch(homeScreenSource, /recoveryDaysBuiltIn/);
      assert.match(homeScreenSource, /At a glance/);
      assert.match(homeScreenSource, /View all/);
      assert.match(homeScreenSource, /progressSummaryCard/);
      assert.match(homeScreenSource, /progressStatGrid/);
      assert.match(homeScreenSource, /progressStatTopRow/);
      assert.match(homeScreenSource, /progressStatEmojiIcon/);
      assert.match(homeScreenSource, /\\uD83D\\uDC4D/);
      assert.match(homeScreenSource, /\\uD83D\\uDD25/);
      assert.match(homeScreenSource, /\\uD83C\\uDFC6/);
      assert.match(homeScreenSource, /Workouts completed/);
      assert.match(homeScreenSource, /Current streak/);
      assert.match(homeScreenSource, /Total workouts/);
      assert.doesNotMatch(homeScreenSource, /progressStatMeta/);
      assert.match(homeScreenSource, /DAILY_TIP_IMAGE/);
      assert.match(homeScreenSource, /endurance-cardio-goal-card\.png/);
      assert.match(homeScreenSource, /Daily tip/);
      assert.match(homeScreenSource, /Focus on quality over quantity\. Good reps, better results\./);
      assert.match(homeScreenSource, /dailyTipCard/);
      assert.match(homeScreenSource, /dailyTipImageScrim/);
      assert.match(homeScreenSource, /dailyTipPurpleWashStrong/);
      assert.match(homeScreenSource, /dailyTipIcon/);
      assert.match(homeScreenSource, /quickStartIconPlay/);
      assert.match(homeScreenSource, /quickStartPlayTriangle/);
      assert.match(homeScreenSource, /quickStartIconPlus/);
      assert.match(homeScreenSource, /quickStartFileIcon/);
      assert.match(homeScreenSource, /Start with what the week needs next\./);
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*backgroundColor: colors\.background/);
      assert.match(homeScreenSource, /greetingTitle:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(homeScreenSource, /headerActionButton:\s*\{[\s\S]*borderRadius: 999/);
      assert.match(homeScreenSource, /startWorkoutFloatingButton:\s*\{[\s\S]*backgroundColor: '#B8FF6A'/);
      assert.match(homeScreenSource, /startWorkoutFloatingTriangle/);
      assert.match(homeScreenSource, /progressSummaryCard:\s*\{[\s\S]*backgroundColor: HOME_CARD_BACKGROUND/);
      assert.match(homeScreenSource, /dailyTipCard:\s*\{[\s\S]*borderColor: 'rgba\(198,139,255,0\.46\)'/);
      assert.match(homeScreenSource, /quickActionSection:\s*\{[\s\S]*backgroundColor: HOME_CARD_BACKGROUND/);

      assert.ok(
        homeScreenSource.indexOf('WORKOUT HERE') < homeScreenSource.indexOf("Today's workout"),
        'hero start CTA should render before the workout plan card',
      );
      assert.ok(
        homeScreenSource.indexOf("Today's workout") < homeScreenSource.indexOf('Plan preview'),
        'today workout summary should lead the combined plan card',
      );
      assert.ok(
        homeScreenSource.indexOf('At a glance') < homeScreenSource.indexOf('Daily tip'),
        'daily tip should render below progress summary',
      );
      assert.ok(
        homeScreenSource.indexOf('Daily tip') < homeScreenSource.indexOf('Quick actions'),
        'daily tip should stay above quick actions',
      );
      assert.ok(
        homeScreenSource.indexOf('Quick actions') < homeScreenSource.indexOf('bottomSafeFade'),
        'bottom fade should finish the home screen below quick actions',
      );
      assert.ok(
        homeScreenSource.indexOf('Templates') < homeScreenSource.indexOf('Quick actions') ||
          !homeScreenSource.includes('Templates'),
        'quick actions should be the last section when templates exist',
      );

      assert.match(appSource, /const homeActivePlanCard = useMemo/);
      assert.match(appSource, /setsLabel: `\$\{exercise\.sets\} sets`/);
      assert.match(appSource, /hiddenExerciseCount: Math\.max\(nextSession\.exercises\.length - 5, 0\)/);
      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /onStartActivePlan=\{\(\) =>/);
      assert.match(appSource, /handleStartReadyProgram\(homeActivePlanCard\.programId\)/);
      assert.match(appSource, /onOpenActivePlan=\{\(\) =>/);
      assert.match(appSource, /handleOpenReadyProgramDetail\(homeActivePlanCard\.programId\)/);

      assert.match(bottomTabBarSource, /key: 'home', label: 'Home'/);
      assert.doesNotMatch(bottomTabBarSource, /key: 'home', label: 'Training'/);
    },
  },
];
