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
      assert.match(homeScreenSource, /const HOME_BLUE = '#0A84FF'/);

      assert.match(homeScreenSource, /Welcome back!/);
      assert.match(homeScreenSource, /Let's get after it today\./);
      assert.match(homeScreenSource, /PRO/);
      assert.match(homeScreenSource, /proBadge:\s*\{[\s\S]*backgroundColor: HOME_GREEN/);
      assert.match(homeScreenSource, /topCalendarDays/);
      assert.match(homeScreenSource, /homeCalendarStrip/);
      assert.match(homeScreenSource, /homeCalendarItem/);
      assert.match(homeScreenSource, /homeCalendarDayLabel/);
      assert.match(homeScreenSource, /Streak/);
      assert.match(homeScreenSource, /Workouts/);
      assert.match(homeScreenSource, /Total time/);
      assert.match(homeScreenSource, /const totalWorkoutTime = formatWorkoutTotalTime\(streak\.totalDurationMinutes\)/);
      assert.match(homeScreenSource, /<Text style=\{styles\.statValue\}>\{totalWorkoutTime\}<\/Text>/);
      assert.match(dashboardSource, /totalDurationMinutes: number/);
      assert.match(dashboardSource, /getCanonicalCompletedSessions\(database\)\.reduce/);

      assert.match(gymlogIconSource, /\| 'flame'/);
      assert.match(gymlogIconSource, /\| 'dumbbell'/);
      assert.match(gymlogIconSource, /\| 'chevronRight'/);
      assert.match(gymlogIconSource, /case 'flame':/);
      assert.match(gymlogIconSource, /case 'dumbbell':/);
      assert.match(gymlogIconSource, /case 'chevronRight':/);
      assert.match(homeScreenSource, /name="flame" color=\{HOME_GREEN\} size=\{24\}/);
      assert.match(homeScreenSource, /name="progress" color=\{HOME_GREEN\} size=\{23\}/);
      assert.match(homeScreenSource, /name="clock" color=\{HOME_GREEN\} size=\{24\}/);

      assert.match(homeScreenSource, /Start Workout/);
      assert.match(homeScreenSource, /Jump into an empty workout/);
      assert.match(homeScreenSource, /startWorkoutHero/);
      assert.match(homeScreenSource, /startWorkoutHero:\s*\{[\s\S]*backgroundColor: HOME_PURPLE/);
      assert.match(homeScreenSource, /name="dumbbell" color=\{HOME_GREEN\} size=\{26\}/);
      assert.match(homeScreenSource, /name="chevronRight" color=\{HOME_GREEN\} size=\{20\}/);
      assert.match(homeScreenSource, /onPress=\{onCreateWorkoutFromExercises\}/);

      assert.match(homeScreenSource, /Routines/);
      assert.match(homeScreenSource, /Templates/);
      assert.doesNotMatch(homeScreenSource, /My Routines/);
      assert.match(homeScreenSource, /Explore/);
      assert.match(homeScreenSource, /readyTemplateCount > 0 \? `\$\{readyTemplateCount\} templates` : 'Find new Templates'/);
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
      assert.match(workoutsScreenSource, /READY_TEMPLATE_FILTERS/);
      const readyTemplateFilterBlock = workoutsScreenSource.slice(
        workoutsScreenSource.indexOf('const READY_TEMPLATE_FILTERS'),
        workoutsScreenSource.indexOf('const customCardVariants'),
      );
      assert.ok(
        readyTemplateFilterBlock.indexOf("label: 'All templates'") < readyTemplateFilterBlock.indexOf("label: 'Starter picks'"),
        'all templates should be the first visible ready-template filter',
      );
      assert.ok(
        readyTemplateFilterBlock.indexOf("label: 'Starter picks'") < readyTemplateFilterBlock.indexOf("label: 'Strength'"),
        'strength should sit after the two initially visible ready-template filters',
      );
      assert.match(workoutsScreenSource, /snapToInterval=\{195\}/);
      assert.match(workoutsScreenSource, /readyTemplateFilterChip:\s*\{[\s\S]*width: 185/);
      assert.match(workoutsScreenSource, /Popular Programs/);
      assert.match(workoutsScreenSource, /readyTemplateCard/);
      assert.match(workoutsScreenSource, /width: '48%'/);
      assert.match(workoutsScreenSource, /readyTemplateHero/);
      assert.match(appSource, /const readyTemplatesActive = route\.tab === 'workout' && route\.screen === 'plans'/);
      assert.match(appSource, /shellBackgroundColor=\{onboardingScreenActive \? '#1D1C35' : emptyWorkoutActive \|\| readyTemplatesActive \? '#F7F3FF' : undefined\}/);
      assert.doesNotMatch(workoutsScreenSource, /title="Programs"/);
      assert.doesNotMatch(workoutsScreenSource, /Search for programs/);
      assert.doesNotMatch(workoutsScreenSource, /{activeSession \?/);
      assert.match(homeScreenSource, /YOUR PLAN/);
      assert.match(homeScreenSource, /planTitle/);
      assert.match(homeScreenSource, /planWeekLabel/);
      assert.match(homeScreenSource, /planProgressPercent/);
      assert.match(homeScreenSource, /activePlan\?\.weekLabel/);
      assert.match(homeScreenSource, /activePlan\?\.progressPercent/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 'Week 3 of 8'/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 42/);
      assert.match(appSource, /weekLabel: planProgress\.weekLabel/);
      assert.match(appSource, /progressPercent: planProgress\.progressPercent/);
      assert.match(homeScreenSource, /planChartBars/);
      assert.match(homeScreenSource, /View plan/);
      assert.match(homeScreenSource, /VIEW PLAN/);
      assert.match(homeScreenSource, /yourPlanCard:\s*\{[\s\S]*backgroundColor: HOME_SURFACE/);
      assert.match(homeScreenSource, /yourPlanProgressTrack/);
      assert.match(homeScreenSource, /yourPlanProgressFill/);
      assert.match(homeScreenSource, /yourPlanChartBar/);
      assert.match(homeScreenSource, /viewPlanButton/);
      assert.match(homeScreenSource, /fullBleedCard/);
      assert.match(homeScreenSource, /style=\{\[styles\.yourPlanCard, styles\.fullBleedCard\]\}/);
      assert.match(homeScreenSource, /style=\{\[styles\.startWorkoutHero, styles\.fullBleedCard\]\}/);
      assert.match(homeScreenSource, /onOpenActivePlan/);
      assert.doesNotMatch(homeScreenSource, /<Text style=\{styles\.myRoutineLabel\}>My Routine<\/Text>/);
      assert.doesNotMatch(homeScreenSource, /style=\{styles\.myRoutineCard\}/);
      assert.match(homeScreenSource, /Start Workout/);
      assert.match(homeScreenSource, /Quick Access/);
      assert.match(homeScreenSource, /Recent Sessions/);
      assert.match(homeScreenSource, /recentSessions/);
      assert.match(homeScreenSource, /recentSessionsSection/);
      assert.match(homeScreenSource, /recentSessionCard/);
      assert.match(homeScreenSource, /No sessions yet/);
      assert.doesNotMatch(homeScreenSource, /recentSessionEmptyButton/);
      assert.doesNotMatch(homeScreenSource, /recentSessionEmptyButtonText/);
      assert.match(homeScreenSource, /onOpenSessionHistory/);
      assert.match(homeScreenSource, /onOpenRecentSession/);
      assert.match(homeScreenSource, /onOpenProgressOverview/);
      assert.match(homeScreenSource, /onOpenTrackedProgress/);
      assert.match(homeScreenSource, /onOpenBodyStats/);
      assert.match(homeScreenSource, /Progress/);
      assert.match(homeScreenSource, /Body Stats/);
      assert.match(homeScreenSource, /PR Tracker/);
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
        homeScreenSource.indexOf('styles.homeCalendarStrip') < homeScreenSource.indexOf('styles.statsCard'),
        'calendar should render before stats',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.statsCard') < homeScreenSource.indexOf('styles.yourPlanCard'),
        'stats should render before your plan',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.yourPlanCard') < homeScreenSource.indexOf('styles.sectionHeaderRow'),
        'your plan should render before routines',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.routineShortcutRow') < homeScreenSource.indexOf('styles.startWorkoutHero'),
        'start workout hero should render after routine shortcuts',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.startWorkoutHero') < homeScreenSource.indexOf('Quick Access'),
        'start workout hero should render before quick access',
      );
      assert.ok(
        homeScreenSource.indexOf('Quick Access') < homeScreenSource.indexOf('Recent Sessions'),
        'recent sessions should fill the lower home area after quick access',
      );

      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /const homeRecentSessions = useMemo/);
      assert.match(appSource, /\[\.\.\.workoutSessions\][\s\S]*\.sort/);
      assert.match(appSource, /\.slice\(0, 3\)/);
      assert.match(appSource, /recentSessions=\{homeRecentSessions\}/);
      assert.match(appSource, /customTemplates=\{customWorkouts\}/);
      assert.match(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'empty' \}\)\}/);
      assert.doesNotMatch(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'editor' \}\)\}/);
      assert.match(appSource, /onBrowseReadyPlans=\{\(\) => navigate\(WORKOUT_PLAN_ROUTE\)\}/);
      assert.match(appSource, /onOpenProgressOverview=\{\(\) => navigate\(\{ tab: 'progress', screen: 'list', section: 'overview' \}\)\}/);
      assert.match(appSource, /onOpenTrackedProgress=\{\(\) => navigate\(\{ tab: 'progress', screen: 'list', section: 'tracked' \}\)\}/);
      assert.match(appSource, /onOpenBodyStats=\{\(\) => navigate\(\{ tab: 'progress', screen: 'list', section: 'measures' \}\)\}/);
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
