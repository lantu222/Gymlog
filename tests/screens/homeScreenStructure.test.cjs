const assert = require('assert');
const fs = require('fs');
const path = require('path');

const homeScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'HomeScreen.tsx'),
  'utf8',
);
const homeCalendarSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'lib', 'homeCalendar.ts'),
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
      assert.match(homeScreenSource, /onStartActivePlanSession\?: \(sessionId: string\) => void/);
      assert.match(homeScreenSource, /const hasActivePlan = Boolean\(activePlan\)/);
      assert.match(homeScreenSource, /ImageBackground/);
      assert.match(homeScreenSource, /HOME_TRAINING_BACKGROUND_IMAGE/);
      assert.match(homeScreenSource, /HOME_RECOVERY_BACKGROUND_IMAGE/);
      assert.match(homeScreenSource, /home-training-background\.png/);
      assert.match(homeScreenSource, /home-recovery-background\.png/);
      assert.match(homeScreenSource, /<ImageBackground[\s\S]*source=\{homeModeBackground\}[\s\S]*style=\{styles\.screenBackground\}/);
      assert.match(homeScreenSource, /screenBackgroundWash/);
      assert.match(homeScreenSource, /profileName\?: string \| null/);
      assert.match(homeScreenSource, /Welcome back, \{greetingName\}\./);
      assert.match(homeScreenSource, /Let's crush today\./);
      assert.match(homeScreenSource, /name="bell"/);
      assert.match(homeScreenSource, /name="profile"/);
      assert.match(homeScreenSource, /notificationDot/);
      assert.match(homeScreenSource, /activePlan\?\.goalLabel\.toUpperCase\(\)/);
      assert.match(homeScreenSource, /miniCalendarRow/);
      assert.match(homeScreenSource, /ScrollView/);
      assert.match(homeScreenSource, /horizontal/);
      assert.match(homeScreenSource, /useWindowDimensions/);
      assert.match(homeScreenSource, /const miniCalendarDayWidth = \(screenWidth - spacing\.lg \* 2\) \/ 7/);
      assert.match(homeScreenSource, /getHomeCarouselCalendarDays\(undefined, \{ daysBefore: 7, daysAfter: 13 \}\)/);
      assert.match(homeScreenSource, /contentOffset=\{\{ x: miniCalendarPageWidth, y: 0 \}\}/);
      assert.match(homeScreenSource, /snapToInterval=\{miniCalendarPageWidth\}/);
      assert.match(homeScreenSource, /disableIntervalMomentum/);
      assert.match(homeScreenSource, /miniCalendarDateBubbleEmpty/);
      assert.match(homeScreenSource, /futureTrainingDay && styles\.miniCalendarDateBubbleFutureTraining/);
      assert.match(homeScreenSource, /miniCalendarDateBubbleFutureTraining:\s*\{[\s\S]*backgroundColor: '#B8FF6A'/);
      assert.match(homeScreenSource, /miniCalendarDateBubbleActive:\s*\{[\s\S]*backgroundColor: '#7C3AED'/);
      assert.doesNotMatch(homeScreenSource, /item\.isTrainingDay && styles\.miniCalendarDateBubbleTraining/);
      assert.match(homeScreenSource, /miniCalendarDayLabel:\s*\{[\s\S]*textAlign: 'center'/);
      assert.match(homeScreenSource, /Show \$\{item\.label\}/);
      assert.match(homeScreenSource, /const \[selectedDayStart, setSelectedDayStart\] = useState<number \| null>\(null\)/);
      assert.match(homeScreenSource, /event\.stopPropagation\(\)/);
      assert.match(homeScreenSource, /setSelectedDayStart\(item\.dayStart\)/);
      assert.match(homeScreenSource, /getHomeDayView\(selectedCalendarDay, trainingDayIndexes, activePlanSessions\)/);
      assert.doesNotMatch(homeScreenSource, /RecoveryStatusOrb/);
      assert.doesNotMatch(homeScreenSource, /resolveCoachOrbMood/);
      assert.doesNotMatch(homeScreenSource, /buildCoachOrbCarouselPages/);
      assert.doesNotMatch(homeScreenSource, /coachOrbCarouselPages/);
      assert.doesNotMatch(homeScreenSource, /coachOrbCarouselScrollX/);
      assert.match(homeScreenSource, /hasActiveWorkout\?: boolean/);
      assert.match(homeScreenSource, /goalLabel: string/);
      assert.doesNotMatch(homeScreenSource, /HOME_RECOVERY_HERO_IMAGES/);
      assert.doesNotMatch(homeScreenSource, /recovery-main\.png/);
      assert.doesNotMatch(homeScreenSource, /recovery-1\.png/);
      assert.doesNotMatch(homeScreenSource, /recovery-2\.png/);
      assert.doesNotMatch(homeScreenSource, /recoveryCarouselPage/);
      assert.doesNotMatch(homeScreenSource, /recoveryCarouselHeight/);
      assert.doesNotMatch(homeScreenSource, /recoveryCarouselPages/);
      assert.match(homeScreenSource, /const homeModeTitle = isRecoveryDay \? 'RECOVERY' : activePlan\?\.goalLabel\.toUpperCase\(\) \?\? 'TRAINING'/);
      assert.match(homeScreenSource, /const homeModeBackground = isRecoveryDay \? HOME_RECOVERY_BACKGROUND_IMAGE : HOME_TRAINING_BACKGROUND_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /HOME_RECOVERY_ORB_BACKGROUND_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /HOME_TRAINING_ORB_BACKGROUND_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /Recovery_image\.png/);
      assert.doesNotMatch(homeScreenSource, /Trainingday_image\.png/);
      assert.doesNotMatch(homeScreenSource, /Focusmode_image\.png/);
      assert.doesNotMatch(homeScreenSource, /Proud_image\.png/);
      assert.doesNotMatch(homeScreenSource, /Concerned_image\.png/);
      assert.doesNotMatch(homeScreenSource, /recoveryAmbientDepthOne/);
      assert.doesNotMatch(homeScreenSource, /recoveryGymSilhouetteLayer/);
      assert.doesNotMatch(homeScreenSource, /recoveryDataParticleLayer/);
      assert.doesNotMatch(homeScreenSource, /recoveryParticleLineOne/);
      assert.doesNotMatch(homeScreenSource, /recoveryCoachBubble/);
      assert.doesNotMatch(homeScreenSource, /recoveryCoachBubbleTail/);
      assert.doesNotMatch(homeScreenSource, /recoveryCoachBubblePage/);
      assert.doesNotMatch(homeScreenSource, /recoveryCarouselDots/);
      assert.doesNotMatch(homeScreenSource, /coachInsightCard/);
      assert.doesNotMatch(homeScreenSource, /Recovery status/);
      assert.doesNotMatch(homeScreenSource, /Your last workout highlights/);
      assert.doesNotMatch(homeScreenSource, /recoveryOrbPercent/);
      assert.match(homeScreenSource, /const isRecoveryDay = selectedDayView\.kind === 'recovery'/);
      assert.doesNotMatch(homeScreenSource, /calendarVisible/);
      assert.doesNotMatch(homeScreenSource, /Training calendar/);
      assert.doesNotMatch(homeScreenSource, /calendarSheet/);
      assert.match(homeScreenSource, /activePlan\?\.nextSession\.exercises/);
      assert.match(homeScreenSource, /homeModeHero/);
      assert.match(homeScreenSource, /homeModeFocusCard/);
      assert.match(homeScreenSource, /homeModeMetricsCard/);
      assert.match(homeScreenSource, /homeModeListCard/);
      assert.match(homeScreenSource, /homeModeStartButton/);
      assert.doesNotMatch(homeScreenSource, /todayWorkoutGreenGlow/);
      assert.doesNotMatch(homeScreenSource, /HOME_FUTURE_WORKOUT_HERO_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /showTodayStartHero/);
      assert.doesNotMatch(homeScreenSource, /showFutureWorkoutHero/);
      assert.doesNotMatch(homeScreenSource, /showCoachOrbHero/);
      assert.match(homeScreenSource, /selectedDayView\.kind === 'recovery'/);
      assert.match(homeScreenSource, /RECOVERY/);
      assert.match(homeScreenSource, /REST\. REPAIR\. COME BACK STRONGER\./);
      assert.match(homeScreenSource, /FOCUS\. LIFT\. GET STRONGER\./);
      assert.match(homeScreenSource, /Start Workout/);
      assert.doesNotMatch(homeScreenSource, /FlatList/);
      assert.doesNotMatch(homeScreenSource, /Track Recovery/);
      assert.doesNotMatch(homeScreenSource, /recoveryHeroImage/);
      assert.match(homeCalendarSource, /day\.isToday \? 'NO EXCUSES' : 'TRAINING'/);
      assert.match(homeCalendarSource, /day\.isToday \? 'JUST RESULTS' : 'TODAY'/);
      assert.doesNotMatch(homeCalendarSource, /START YOUR/);
      assert.doesNotMatch(homeCalendarSource, /WORKOUT HERE/);
      assert.doesNotMatch(homeScreenSource, /startWorkoutFloatingButton/);
      assert.doesNotMatch(homeScreenSource, /onStartActivePlan\?:/);
      assert.match(homeScreenSource, /Today's plan/);
      assert.match(homeScreenSource, /Recovery tips/);
      assert.doesNotMatch(homeScreenSource, /Plan preview/);
      assert.doesNotMatch(homeScreenSource, /recoveryHeroCopy/);
      assert.doesNotMatch(homeScreenSource, /recoveryHeroKicker/);
      assert.doesNotMatch(homeScreenSource, /recoveryHeroTitle/);
      assert.doesNotMatch(homeScreenSource, /todayMissionKicker/);
      assert.doesNotMatch(homeScreenSource, /todayMissionTitle/);
      assert.doesNotMatch(homeScreenSource, /todayMissionMeta/);
      assert.doesNotMatch(homeScreenSource, /todayMissionDetailsButton/);
      assert.doesNotMatch(homeScreenSource, /View plan/);
      assert.doesNotMatch(homeScreenSource, /buildFallbackPreviewSessions/);
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
      assert.match(homeScreenSource, /screenBackground:\s*\{[\s\S]*backgroundColor: colors\.background/);
      assert.match(homeScreenSource, /scrollView:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*backgroundColor: 'transparent'/);
      assert.doesNotMatch(homeScreenSource, /homeModeHeroImage/);
      assert.match(homeScreenSource, /greetingTitle:\s*\{[\s\S]*color: '#FFFFFF'/);
      assert.match(homeScreenSource, /headerActionButton:\s*\{[\s\S]*borderRadius: 999/);
      assert.doesNotMatch(homeScreenSource, /startWorkoutFloatingButton/);
      assert.doesNotMatch(homeScreenSource, /startWorkoutFloatingTriangle/);
      assert.match(homeScreenSource, /progressSummaryCard:\s*\{[\s\S]*backgroundColor: HOME_CARD_BACKGROUND/);
      assert.match(homeScreenSource, /dailyTipCard:\s*\{[\s\S]*borderColor: 'rgba\(198,139,255,0\.46\)'/);
      assert.match(homeScreenSource, /quickActionSection:\s*\{[\s\S]*backgroundColor: HOME_CARD_BACKGROUND/);

      assert.ok(
        homeScreenSource.indexOf('homeModeHero') < homeScreenSource.indexOf("Today's focus"),
        'mode hero should render before the focus card',
      );
      assert.ok(
        homeScreenSource.indexOf("Today's focus") < homeScreenSource.indexOf('homeModeMetricsCard'),
        'focus card should render before the metrics card',
      );
      assert.ok(
        homeScreenSource.indexOf('homeModeMetricsCard') < homeScreenSource.indexOf('Recovery tips'),
        'metrics should render before the mode list card',
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
      assert.match(appSource, /hiddenExerciseCount: Math\.max\(session\.exercises\.length - 5, 0\)/);
      assert.match(appSource, /goalLabel: formatGoalLabel\(preferences\.aiPlannerGoal \|\| preferences\.setupGoal \|\| 'general'\)/);
      assert.match(appSource, /goalLabel: formatGoalLabel\(recommendedReadyTemplate\.goalType\)/);
      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /hasActiveWorkout=\{Boolean\(workout\.activeSession\)\}/);
      assert.doesNotMatch(appSource, /onStartActivePlan=\{/);
      assert.match(appSource, /onStartActivePlanSession=\{\(sessionId\) =>/);
      assert.match(appSource, /handleStartCustomProgramSession\(homeActivePlanCard\.programId, sessionId\)/);
      assert.match(appSource, /handleStartReadyProgramSession\(homeActivePlanCard\.programId, sessionId\)/);
      assert.match(appSource, /sessions: homeSessions/);
      assert.match(appSource, /const workoutLogNavigationAllowedAtRef = useRef<number \| null>\(null\)/);
      assert.match(appSource, /function navigateToWorkoutLog\(workoutTemplateId: string\)/);
      assert.match(appSource, /workoutLogNavigationAllowedAtRef\.current = Date\.now\(\)/);
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'log'/);
      assert.match(appSource, /!allowedAt \|\| Date\.now\(\) - allowedAt > 2000/);
      assert.match(appSource, /replaceRoute\(ROOT_ROUTES\.home\)/);
      assert.equal((appSource.match(/navigate\(\{ tab: 'workout', screen: 'log'/g) ?? []).length, 1);
      assert.match(appSource, /onOpenActivePlan=\{\(\) =>/);
      assert.match(appSource, /handleOpenReadyProgramDetail\(homeActivePlanCard\.programId\)/);

      assert.match(bottomTabBarSource, /key: 'home', label: 'Home'/);
      assert.doesNotMatch(bottomTabBarSource, /key: 'home', label: 'Training'/);
    },
  },
];
