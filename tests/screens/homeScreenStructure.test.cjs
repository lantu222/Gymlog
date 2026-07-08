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
const gymlogIconSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'GymlogIcon.tsx'),
  'utf8',
);
const dashboardSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'lib', 'dashboard.ts'),
  'utf8',
);
const progressScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'ProgressScreen.tsx'),
  'utf8',
);
const workoutEditorScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutEditorScreen.tsx'),
  'utf8',
);
const workoutsScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'WorkoutsScreen.tsx'),
  'utf8',
);
const routesSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'navigation', 'routes.ts'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

module.exports = [
  {
    name: 'home screen uses light routine dashboard with purple workout actions',
    run() {
      assert.match(homeScreenSource, /const HOME_BACKGROUND = '#F7F3FF'/);
      assert.match(homeScreenSource, /const HOME_PURPLE = '#7C3AED'/);
      assert.match(homeScreenSource, /const HOME_PURPLE_DARK = '#5B21B6'/);
      assert.match(homeScreenSource, /const HOME_GREEN = '#16A34A'/);

      assert.match(homeScreenSource, /Welcome back/);
      assert.match(homeScreenSource, /Let's get after it today\./);
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*paddingTop: 24/);
      assert.match(homeScreenSource, /greetingTitle:\s*\{[\s\S]*fontSize: 24/);
      assert.match(homeScreenSource, /greetingSubtitle:\s*\{[\s\S]*fontSize: 14/);
      assert.match(homeScreenSource, /PRO/);
      assert.match(homeScreenSource, /proBadge:\s*\{[\s\S]*backgroundColor: HOME_GREEN/);
      assert.match(homeScreenSource, /topCalendarDays/);
      assert.match(homeScreenSource, /homeCalendarStrip/);
      assert.match(homeScreenSource, /homeCalendarStrip:\s*\{[\s\S]*minHeight: 58/);
      assert.match(homeScreenSource, /homeCalendarItem/);
      assert.match(homeScreenSource, /homeCalendarDayLabel/);
      assert.match(homeScreenSource, /homeCalendarDayLabel:\s*\{[\s\S]*fontSize: 12/);
      // The weekly status row ("N of M sessions this week" + streak pill) was
      // removed: the session count was often untrue and the streak pill was
      // noise (user feedback 2026-07-08).
      assert.doesNotMatch(homeScreenSource, /weeklyStatusRow/);
      assert.doesNotMatch(homeScreenSource, /sessions this week/);
      assert.doesNotMatch(homeScreenSource, /day streak/);
      assert.doesNotMatch(homeScreenSource, /streakPill/);
      assert.doesNotMatch(homeScreenSource, /HomeStreakSummary/);
      assert.match(dashboardSource, /totalDurationMinutes: number/);
      assert.match(dashboardSource, /getCanonicalCompletedSessions\(database\)\.reduce/);

      assert.match(gymlogIconSource, /\| 'dumbbell'/);
      assert.match(gymlogIconSource, /\| 'chevronRight'/);
      assert.match(gymlogIconSource, /case 'dumbbell':/);
      assert.match(gymlogIconSource, /case 'chevronRight':/);

      assert.match(homeScreenSource, /CONTINUE PLAN/);
      assert.match(homeScreenSource, /continuePlanCard/);
      assert.match(homeScreenSource, /nextPlanSession/);
      assert.match(homeScreenSource, /onStartActivePlanSession\(nextPlanSession\.id\)/);
      assert.match(homeScreenSource, /Start workout/);
      assert.match(homeScreenSource, /Empty workout/);
      assert.match(homeScreenSource, /Log freestyle/);
      assert.match(homeScreenSource, /emptyWorkoutRow/);
      assert.match(homeScreenSource, /emptyWorkoutRow:\s*\{[\s\S]*backgroundColor: 'rgba\(255,255,255,0\.58\)'/);
      assert.match(homeScreenSource, /name="plus" color=\{HOME_PURPLE\} size=\{20\}/);
      assert.doesNotMatch(homeScreenSource, /Jump into an empty workout/);
      assert.doesNotMatch(homeScreenSource, /startWorkoutHero/);
      assert.match(homeScreenSource, /onPress=\{onCreateWorkoutFromExercises\}/);

      assert.match(homeScreenSource, /Routines/);
      assert.match(homeScreenSource, /Templates/);
      assert.doesNotMatch(homeScreenSource, /My Routines/);
      assert.match(homeScreenSource, /Explore/);
      assert.match(homeScreenSource, /routineShortcutCard:\s*\{[\s\S]*minHeight: 96/);
      assert.match(homeScreenSource, /routineShortcutTitle:\s*\{[\s\S]*fontSize: 18/);
      assert.match(homeScreenSource, /routineShortcutSubtitle:\s*\{[\s\S]*fontSize: 12/);
      assert.match(homeScreenSource, /readyTemplateCount > 0 \? `\$\{readyTemplateCount\} plans` : 'Find new plans'/);
      assert.doesNotMatch(homeScreenSource, /Find new routines/);
      assert.match(workoutsScreenSource, /const \[showReadyLibrary, setShowReadyLibrary\] = useState\(true\)/);
      assert.match(workoutsScreenSource, /const \[showBrowseWorkouts, setShowBrowseWorkouts\] = useState\(true\)/);
      assert.match(workoutsScreenSource, /const \[readyEquipmentFilter, setReadyEquipmentFilter\] = useState<ReadyEquipmentFilter>\('all'\)/);
      assert.match(appSource, /const readyTemplateCount = workout\.templates\.filter\(\(template\) => template\.id\.startsWith\('tpl_gainer_'\)\)\.length/);
      assert.match(appSource, /readyTemplateCount=\{readyTemplateCount\}/);
      assert.match(workoutsScreenSource, /const gainerProgramItems = filteredReadyItems\.filter/);
      assert.match(workoutsScreenSource, /const allGainerProgramItems = readyDiscoveryItems\.filter/);
      assert.match(workoutsScreenSource, /title="Ready Templates"/);
      assert.match(workoutsScreenSource, /tone="dark"/);
      assert.match(workoutsScreenSource, /Search ready templates/);
      assert.match(workoutsScreenSource, /MagnifyingGlass/);
      assert.match(workoutsScreenSource, /SlidersHorizontal/);
      assert.match(workoutsScreenSource, /showAdvancedReadyFilters/);
      assert.match(workoutsScreenSource, /READY_GOAL_FILTERS/);
      const readyGoalFilterBlock = workoutsScreenSource.slice(
        workoutsScreenSource.indexOf('const READY_GOAL_FILTERS'),
        workoutsScreenSource.indexOf('const READY_TIME_FILTERS'),
      );
      assert.ok(
        readyGoalFilterBlock.indexOf("label: 'All'") < readyGoalFilterBlock.indexOf("label: 'Fat Loss'"),
        'all should be the first visible goal filter',
      );
      assert.ok(
        readyGoalFilterBlock.indexOf("label: 'Fat Loss'") < readyGoalFilterBlock.indexOf("label: 'Strength'"),
        'fat loss should sit before strength in the ready-template goal carousel',
      );
      assert.match(workoutsScreenSource, /Filter templates/);
      assert.match(workoutsScreenSource, /Duration/);
      assert.match(workoutsScreenSource, /Equipment/);
      assert.match(workoutsScreenSource, /Experience/);
      assert.match(workoutsScreenSource, /READY_TIME_FILTERS\.map/);
      assert.match(workoutsScreenSource, /READY_EQUIPMENT_FILTERS\.map/);
      assert.match(workoutsScreenSource, /READY_LEVEL_FILTERS\.map/);
      assert.match(workoutsScreenSource, /snapToInterval=\{116\}/);
      assert.match(workoutsScreenSource, /readyTemplateFilterChip:\s*\{[\s\S]*minWidth: 104/);
      assert.match(workoutsScreenSource, /READY_CATEGORY_SECTIONS/);
      assert.match(workoutsScreenSource, /title: 'Hypertrophy'/);
      assert.match(workoutsScreenSource, /title: 'General Fitness'/);
      assert.match(workoutsScreenSource, /title: 'Strength'/);
      assert.match(workoutsScreenSource, /title: 'Fat Loss'/);
      assert.match(workoutsScreenSource, /itemMatchesReadyCategory/);
      assert.match(workoutsScreenSource, /readyCategorySections/);
      assert.match(workoutsScreenSource, /readyTemplateCategoryList/);
      assert.match(workoutsScreenSource, /readyTemplateCarousel/);
      assert.match(workoutsScreenSource, /readyTemplateScrollHint/);
      assert.match(workoutsScreenSource, /snapToInterval=\{232\}/);
      assert.match(workoutsScreenSource, /readyTemplateCard/);
      assert.match(workoutsScreenSource, /width: 220/);
      assert.match(workoutsScreenSource, /READY_TEMPLATE_CARD_IMAGE/);
      assert.match(workoutsScreenSource, /ready-template-card\.jpg/);
      assert.match(workoutsScreenSource, /ImageBackground/);
      assert.match(workoutsScreenSource, /readyTemplateHero/);
      assert.match(workoutsScreenSource, /readyTemplateHeroBadge/);
      assert.match(workoutsScreenSource, /Lightning/);
      assert.match(workoutsScreenSource, /CalendarBlank/);
      assert.match(workoutsScreenSource, /Clock/);
      assert.match(workoutsScreenSource, /Start Plan/);
      assert.doesNotMatch(workoutsScreenSource, /readyTemplateSummary/);
      assert.doesNotMatch(workoutsScreenSource, /formatTemplateSubtitle/);
      assert.doesNotMatch(workoutsScreenSource, /Next: \{firstExercise\}/);
      assert.match(appSource, /const readyTemplatesActive = route\.tab === 'workout' && route\.screen === 'plans'/);
      assert.match(appSource, /shellBackgroundColor=\{onboardingScreenActive \? '#F7F3FF' : [^}]*emptyWorkoutActive[^}]*readyTemplatesActive[^}]*\? '#F7F3FF' : undefined\}/);
      assert.doesNotMatch(workoutsScreenSource, /title="Programs"/);
      assert.doesNotMatch(workoutsScreenSource, /Search for programs/);
      assert.doesNotMatch(workoutsScreenSource, /{activeSession \?/);
      assert.doesNotMatch(homeScreenSource, /YOUR PLAN/);
      assert.doesNotMatch(homeScreenSource, /planTitle/);
      assert.doesNotMatch(homeScreenSource, /planWeekLabel/);
      assert.doesNotMatch(homeScreenSource, /planProgressPercent/);
      assert.doesNotMatch(homeScreenSource, /activePlan\?\.weekLabel/);
      assert.doesNotMatch(homeScreenSource, /activePlan\?\.progressPercent/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 'Week 3 of 8'/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 42/);
      assert.match(appSource, /weekLabel: planProgress\.weekLabel/);
      assert.match(appSource, /progressPercent: planProgress\.progressPercent/);
      assert.doesNotMatch(homeScreenSource, /planChartBars/);
      assert.doesNotMatch(homeScreenSource, /View plan/);
      assert.doesNotMatch(homeScreenSource, /VIEW PLAN/);
      assert.doesNotMatch(homeScreenSource, /yourPlanCard/);
      assert.doesNotMatch(homeScreenSource, /yourPlanProgressTrack/);
      assert.doesNotMatch(homeScreenSource, /yourPlanProgressFill/);
      assert.doesNotMatch(homeScreenSource, /yourPlanChartBar/);
      assert.doesNotMatch(homeScreenSource, /viewPlanButton/);
      assert.match(homeScreenSource, /fullBleedCard/);
      assert.match(homeScreenSource, /style=\{\[styles\.continuePlanCard, styles\.fullBleedCard\]\}/);
      assert.match(homeScreenSource, /style=\{styles\.emptyWorkoutRow\}/);
      assert.doesNotMatch(homeScreenSource, /onOpenActivePlan/);
      assert.doesNotMatch(homeScreenSource, /<Text style=\{styles\.myRoutineLabel\}>My Routine<\/Text>/);
      assert.doesNotMatch(homeScreenSource, /style=\{styles\.myRoutineCard\}/);
      assert.match(homeScreenSource, /Empty workout/);
      assert.doesNotMatch(homeScreenSource, /Quick Access/);
      assert.doesNotMatch(homeScreenSource, /Recent Sessions/);
      assert.doesNotMatch(homeScreenSource, /recentSessions/);
      assert.doesNotMatch(homeScreenSource, /recentSessionsSection/);
      assert.doesNotMatch(homeScreenSource, /recentSessionCard/);
      assert.doesNotMatch(homeScreenSource, /No sessions yet/);
      assert.doesNotMatch(homeScreenSource, /recentSessionEmptyButton/);
      assert.doesNotMatch(homeScreenSource, /recentSessionEmptyButtonText/);
      assert.doesNotMatch(homeScreenSource, /onOpenSessionHistory/);
      assert.doesNotMatch(homeScreenSource, /onOpenRecentSession/);
      assert.doesNotMatch(homeScreenSource, /onOpenProgressOverview/);
      assert.doesNotMatch(homeScreenSource, /onOpenTrackedProgress/);
      assert.doesNotMatch(homeScreenSource, /onOpenBodyStats/);
      assert.doesNotMatch(homeScreenSource, /Body Stats/);
      assert.doesNotMatch(homeScreenSource, /PR Tracker/);
      assert.doesNotMatch(homeScreenSource, /<Text style=\{styles\.quickAccessText\}>History<\/Text>/);
      assert.doesNotMatch(homeScreenSource, /onOpenAICoach\('Open body stats'\)/);

      assert.doesNotMatch(homeScreenSource, /Weekly overview/);
      assert.doesNotMatch(homeScreenSource, /At a glance/);
      assert.doesNotMatch(homeScreenSource, /Daily tip/);
      assert.doesNotMatch(homeScreenSource, /HOME_RECOVERY_BACKGROUND_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /HOME_TRAINING_BACKGROUND_IMAGE/);
      assert.doesNotMatch(homeScreenSource, /ImageBackground/);

      assert.ok(
        homeScreenSource.indexOf('styles.headerRow') < homeScreenSource.indexOf('styles.homeCalendarStrip'),
        'header should render before calendar',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.homeCalendarStrip') < homeScreenSource.indexOf('styles.continuePlanCard'),
        'calendar should render before continue plan',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.continuePlanCard') < homeScreenSource.indexOf('styles.sectionHeaderRow'),
        'continue plan should render before routines',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.routineShortcutRow') < homeScreenSource.indexOf('styles.emptyWorkoutRow'),
        'empty workout row should render after routine shortcuts',
      );
      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /const homeRecentSessions = useMemo/);
      assert.match(appSource, /\[\.\.\.workoutSessions\][\s\S]*\.sort/);
      assert.match(appSource, /\.slice\(0, 3\)/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*recentSessions=\{homeRecentSessions\}/);
      assert.match(appSource, /<ProgressScreen[\s\S]*recentSessions=\{homeRecentSessions\}/);
      assert.match(appSource, /customTemplates=\{customWorkouts\}/);
      assert.match(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'empty' \}\)\}/);
      assert.doesNotMatch(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'editor' \}\)\}/);
      assert.match(appSource, /onBrowseReadyPlans=\{\(\) => navigate\(WORKOUT_PLAN_ROUTE\)\}/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenProgressOverview=/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenTrackedProgress=/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenBodyStats=/);
      assert.match(appSource, /onOpenSessionHistory=\{\(\) => navigate\(\{ tab: 'home', screen: 'history' \}\)\}/);
      assert.match(appSource, /onOpenRecentSession=\{\(sessionId\) => navigate\(\{ tab: 'home', screen: 'session', sessionId \}\)\}/);
      assert.doesNotMatch(appSource, /onOpenAICoach=\{handleOpenAICoach\}/);

      assert.match(routesSource, /screen: 'empty'/);
      assert.match(appSource, /route\.tab === 'workout' && \(route\.screen === 'editor' \|\| route\.screen === 'empty'\)/);
      assert.match(appSource, /presentation=\{route\.screen === 'empty' \? 'emptyWorkout' : 'editor'\}/);
      assert.match(appSource, /route\.screen === 'empty'/);
      assert.match(appSource, /inlineTip=\{null\}/);
      assert.doesNotMatch(appSource, /Start with the main lift first/);
      assert.doesNotMatch(appSource, /WORKOUT_EDITOR_TIP_ID/);
      assert.match(workoutEditorScreenSource, /presentation\?: 'editor' \| 'emptyWorkout'/);
      assert.match(workoutEditorScreenSource, /Empty Workout/);
      assert.match(workoutEditorScreenSource, /No exercises added yet/);
      assert.match(workoutEditorScreenSource, /Recent Exercises/);
      assert.match(workoutEditorScreenSource, /Popular Exercises/);
      assert.match(workoutEditorScreenSource, /getPopularExerciseLibraryItems/);
      assert.match(workoutEditorScreenSource, /emptyWorkoutHasRecentExercises/);
      assert.match(workoutEditorScreenSource, /Finish Workout/);
      assert.match(workoutEditorScreenSource, /emptyWorkoutBottomBar/);
      assert.match(workoutEditorScreenSource, /getExerciseListIcon/);

      assert.match(routesSource, /section\?: 'overview' \| 'tracked' \| 'measures'/);
      assert.match(progressScreenSource, /initialSection\?: ProgressSection/);
      assert.match(progressScreenSource, /recentSessions\?: HomeRecentSessionItem\[\]/);
      assert.match(progressScreenSource, /onOpenSessionHistory\?: \(\) => void/);
      assert.match(progressScreenSource, /onOpenRecentSession\?: \(sessionId: string\) => void/);
      assert.match(progressScreenSource, /<Text style=\{styles\.referenceCardTitle\}>History<\/Text>/);
      assert.match(progressScreenSource, /recentSessions\.slice\(0, 3\)\.map/);
      assert.match(progressScreenSource, /progressHistoryCard/);
      assert.match(progressScreenSource, /onOpenRecentSession\?\.\(session\.id\)/);
      assert.match(progressScreenSource, /useState<ProgressSection>\(initialSection \?\? 'overview'\)/);
      assert.match(progressScreenSource, /useEffect\(\(\) => \{[\s\S]*setProgressSection\(initialSection\);[\s\S]*\}, \[initialSection\]\)/);
      assert.match(appSource, /initialSection=\{route\.screen === 'list' \? route\.section : undefined\}/);

      assert.match(bottomTabBarSource, /backgroundColor: '#FFFFFF'/);
      assert.match(bottomTabBarSource, /activeTab: RootTabKey \| null/);
      assert.match(bottomTabBarSource, /activeTab !== null && activeTab === tab\.key/);
      assert.match(appSource, /activeTab=\{route\.tab === 'workout' && route\.screen === 'plans' \? null : route\.tab\}/);
      assert.match(bottomTabBarSource, /const stroke = active \? '#7C3AED'/);
      assert.match(bottomTabBarSource, /const fill = active \? '#7C3AED'/);
      assert.match(bottomTabBarSource, /centerButtonActive:\s*\{[\s\S]*backgroundColor: '#7C3AED'/);
    },
  },
];
