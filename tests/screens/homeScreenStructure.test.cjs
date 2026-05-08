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
      assert.match(homeScreenSource, /HOME_WORKOUT_COPY_OPTIONS/);
      assert.match(homeScreenSource, /getHomeWorkoutCopy/);
      assert.match(homeScreenSource, /formatHomePlanTitle/);
      assert.match(homeScreenSource, /step7-preview-male-mass\.png/);
      assert.match(homeScreenSource, /TODAY'S WORKOUT/);
      assert.match(homeScreenSource, /Good morning, Name! 👋/);
      assert.match(homeScreenSource, /Consistency today, results tomorrow\./);
      assert.match(homeScreenSource, /name="bell"/);
      assert.match(homeScreenSource, /name="profile"/);
      assert.match(homeScreenSource, /notificationDot/);
      assert.match(homeScreenSource, /planSummaryRow/);
      assert.match(homeScreenSource, /YOUR PLAN/);
      assert.match(homeScreenSource, /activePlan\.title/);
      assert.match(homeScreenSource, /homePlanTitle/);
      assert.match(homeScreenSource, /Plan details/);
      assert.match(homeScreenSource, /name="file"/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.title/);
      assert.match(homeScreenSource, /activePlan\.nextSession\.duration/);
      assert.match(homeScreenSource, /todayWorkoutScrim/);
      assert.match(homeScreenSource, /todayWorkoutGreenGlow/);
      assert.match(homeScreenSource, /todayWorkoutMenuButton/);
      assert.match(homeScreenSource, /Start workout/);
      assert.match(homeScreenSource, /View workout/);
      assert.match(homeScreenSource, /onStartActivePlan/);
      assert.match(homeScreenSource, /quickActionSection/);
      assert.match(homeScreenSource, /Quick actions/);
      assert.match(homeScreenSource, /Explore workout plans/);
      assert.match(homeScreenSource, /Build your own split/);
      assert.match(homeScreenSource, /bottomSafeFade/);
      assert.match(homeScreenSource, /bottomSafeFadeSoft/);
      assert.match(homeScreenSource, /WEEKLY_OVERVIEW_DAYS/);
      assert.match(homeScreenSource, /WEEKLY_OVERVIEW_CARD_HEIGHT/);
      assert.match(homeScreenSource, /PROGRESS_SUMMARY_CARD_HEIGHT = Math\.round\(WEEKLY_OVERVIEW_CARD_HEIGHT \* 0\.9\)/);
      assert.match(homeScreenSource, /TRAINING_DAY_PATTERNS/);
      assert.match(homeScreenSource, /getWeeklyTrainingIndexes/);
      assert.match(homeScreenSource, /recoveryDaysBuiltIn/);
      assert.match(homeScreenSource, /Training day/);
      assert.match(homeScreenSource, /Recovery day/);
      assert.match(homeScreenSource, /Your progress/);
      assert.match(homeScreenSource, /View progress/);
      assert.match(homeScreenSource, /progressSummaryCard/);
      assert.match(homeScreenSource, /progressStatGrid/);
      assert.match(homeScreenSource, /progressStatTopRow/);
      assert.match(homeScreenSource, /progressStatEmojiIcon/);
      assert.match(homeScreenSource, /\\uD83D\\uDD25/);
      assert.match(homeScreenSource, /\\uD83C\\uDFC6/);
      assert.match(homeScreenSource, /Workouts completed/);
      assert.match(homeScreenSource, /Current streak/);
      assert.match(homeScreenSource, /Total workouts/);
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
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*backgroundColor: '#000000'/);
      assert.match(homeScreenSource, /greetingTitle:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(homeScreenSource, /headerActionButton:\s*\{[\s\S]*borderRadius: 999/);
      assert.match(homeScreenSource, /startWorkoutButton:\s*\{[\s\S]*backgroundColor: '#B8FF6A'/);
      assert.match(homeScreenSource, /startWorkoutArrowTriangle/);
      assert.match(homeScreenSource, /weeklyOverviewCard:\s*\{[\s\S]*backgroundColor: '#151515'/);
      assert.match(homeScreenSource, /progressSummaryCard:\s*\{[\s\S]*backgroundColor: '#151515'/);
      assert.match(homeScreenSource, /dailyTipCard:\s*\{[\s\S]*borderColor: 'rgba\(198,139,255,0\.46\)'/);
      assert.match(homeScreenSource, /viewWorkoutButton:\s*\{[\s\S]*backgroundColor: '#151515'/);
      assert.match(homeScreenSource, /quickActionSection:\s*\{[\s\S]*backgroundColor: '#151515'/);

      assert.ok(
        homeScreenSource.indexOf("TODAY'S WORKOUT") < homeScreenSource.indexOf('Weekly overview'),
        'today workout hero should render before weekly overview',
      );
      assert.ok(
        homeScreenSource.indexOf('Weekly overview') < homeScreenSource.indexOf('Quick actions'),
        'quick actions should stay below weekly overview',
      );
      assert.ok(
        homeScreenSource.indexOf('Weekly overview') < homeScreenSource.indexOf('Your progress'),
        'progress summary should render below weekly overview',
      );
      assert.ok(
        homeScreenSource.indexOf('Your progress') < homeScreenSource.indexOf('Quick actions'),
        'progress summary should stay above quick actions',
      );
      assert.ok(
        homeScreenSource.indexOf('Your progress') < homeScreenSource.indexOf('Daily tip'),
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
