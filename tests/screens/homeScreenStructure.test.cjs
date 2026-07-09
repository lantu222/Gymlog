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
      // Home v3 (GAINER Home v3 mock): palette comes from the shared HG3 token
      // set in lightTheme.ts — no local hex constants for tokenized colors.
      assert.match(homeScreenSource, /import \{ HG3 \} from '\.\.\/lightTheme'/);
      assert.doesNotMatch(homeScreenSource, /const HOME_BACKGROUND =/);
      assert.match(homeScreenSource, /screenBackground:\s*\{[\s\S]*backgroundColor: HG3\.bg/);

      assert.match(homeScreenSource, /Welcome back/);
      assert.match(homeScreenSource, /Let's get after it today\./);
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*paddingTop: 24/);
      assert.match(homeScreenSource, /greetingTitle:\s*\{[\s\S]*fontSize: 26/);
      assert.match(homeScreenSource, /greetingSubtitle:\s*\{[\s\S]*fontSize: 13\.5/);
      assert.match(homeScreenSource, /PRO/);
      assert.match(homeScreenSource, /proBadge:\s*\{[\s\S]*backgroundColor: HG3\.green/);
      assert.match(homeScreenSource, /proBadge:\s*\{\s*paddingVertical: 7,\s*paddingHorizontal: 13/);
      // PRO pill opens the dark Pro bottom sheet.
      assert.match(homeScreenSource, /onPress=\{\(\) => setProSheetVisible\(true\)\}/);
      assert.match(homeScreenSource, /const \[proSheetVisible, setProSheetVisible\] = useState\(false\)/);
      // Week strip lives on a white card and expands into a Monday-first month
      // grid; the chevron rotates 180° and the panel height animates.
      assert.match(homeScreenSource, /topCalendarDays/);
      assert.match(homeScreenSource, /weekCard:\s*\{[\s\S]*borderRadius: 18/);
      assert.match(homeScreenSource, /weekStripItemToday:\s*\{[\s\S]*backgroundColor: HG3\.purpleSoft/);
      assert.match(homeScreenSource, /const \[calendarExpanded, setCalendarExpanded\] = useState\(false\)/);
      assert.match(homeScreenSource, /const monthCalendar = useMemo\(\(\) => getHomeMonthCalendar\(\), \[\]\)/);
      assert.match(homeScreenSource, /monthCalendar\.monthLabel/);
      assert.match(homeScreenSource, /monthDayCellToday/);
      assert.match(homeScreenSource, /monthLegendRow/);
      assert.match(homeScreenSource, /outputRange: \['0deg', '180deg'\]/);
      assert.match(homeScreenSource, /calendarAnim\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 480\] \}\)/);
      // Entrance animations: staggered "rise" + progress fill, all skipped when
      // the user has reduced motion enabled (content must never stay hidden).
      assert.match(homeScreenSource, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
      assert.match(homeScreenSource, /riseValues\.forEach\(\(value\) => value\.setValue\(1\)\)/);
      assert.match(homeScreenSource, /Easing\.bezier\(0\.22, 1, 0\.36, 1\)/);
      assert.match(homeScreenSource, /outputRange: \[16, 0\]/);
      // The weekly status row + streak pill stay removed.
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

      // Continue plan is a boxless agenda (Home v3): purple eyebrow with the
      // day counter, session name as the headline, plan name as the sub, thin
      // animated progress bar, then a numbered exercise list with real
      // sets-by-reps schemes in JetBrains Mono.
      assert.match(homeScreenSource, /CONTINUE PLAN · DAY \$\{nextSessionIndex \+ 1\} OF \$\{planDayCount\}/);
      assert.doesNotMatch(homeScreenSource, /continuePlanCard/);
      assert.match(homeScreenSource, /nextPlanSession/);
      assert.match(homeScreenSource, /onStartActivePlanSession\(nextPlanSession\.id\)/);
      assert.match(homeScreenSource, /const planTitle = nextPlanSession\?\.title/);
      assert.match(homeScreenSource, /const planSubtitle = activePlan\?\.title \?\? 'Workout plan'/);
      assert.match(homeScreenSource, /planTitle:\s*\{[\s\S]*fontSize: 31/);
      assert.match(homeScreenSource, /planEyebrow:\s*\{[\s\S]*color: HG3\.purple/);
      assert.match(homeScreenSource, /weekProgressLabel/);
      assert.match(homeScreenSource, /planProgressTrack:\s*\{[\s\S]*height: 6/);
      assert.match(homeScreenSource, /planProgressFill:\s*\{[\s\S]*backgroundColor: HG3\.purple/);
      assert.match(homeScreenSource, /progressFillAnim\.interpolate\(\{ inputRange: \[0, 100\], outputRange: \['0%', '100%'\] \}\)/);
      assert.match(homeScreenSource, /planExerciseNumberChip:\s*\{\s*width: 25,\s*height: 25/);
      assert.match(homeScreenSource, /planExerciseScheme:\s*\{[\s\S]*fontFamily: 'JetBrainsMono'/);
      assert.match(homeScreenSource, /exercise\.schemeLabel \?\? exercise\.setsLabel/);
      assert.match(homeScreenSource, /agendaExtraCount > 0 \? `\+ \$\{agendaExtraCount\} more · \$\{planDuration\} total` : `\$\{planDuration\} total`/);
      // Ghost start button: white surface, 1.5px purple border, purple label.
      assert.match(homeScreenSource, /Start workout/);
      assert.match(homeScreenSource, /startButton:\s*\{\s*height: 56,\s*borderRadius: 16,\s*borderWidth: 1\.5,\s*borderColor: HG3\.purple/);
      assert.match(homeScreenSource, /startButtonText:\s*\{[\s\S]*fontSize: 16\.5/);
      // Pro sheet: dark gradient bottom sheet with stats, comparison table,
      // pricing toggle, gold CTA, and dismiss.
      assert.match(homeScreenSource, /Train like it's personal\./);
      assert.match(homeScreenSource, /✦ GAINER PRO/);
      assert.match(homeScreenSource, /proSheetGradient/);
      assert.match(homeScreenSource, /stopColor=\{HG3\.proSheetTop\}/);
      assert.match(homeScreenSource, /PRO_STATS/);
      assert.match(homeScreenSource, /PRO_COMPARISON\.map/);
      assert.match(homeScreenSource, /setProPlan\(key\)/);
      assert.match(homeScreenSource, /proPricingCardSelected/);
      assert.match(homeScreenSource, /\{activePricing\.finePrint\}/);
      assert.match(homeScreenSource, /Start 7-day free trial/);
      assert.match(homeScreenSource, /Not now/);
      assert.match(homeScreenSource, /onRequestClose=\{\(\) => setProSheetVisible\(false\)\}/);
      assert.match(homeScreenSource, /Empty workout/);
      assert.match(homeScreenSource, /Log freestyle/);
      assert.match(homeScreenSource, /emptyWorkoutRow/);
      assert.match(homeScreenSource, /emptyWorkoutRow:\s*\{[\s\S]*backgroundColor: HG3\.surface/);
      assert.match(homeScreenSource, /name="plus" color=\{HG3\.purple\} size=\{20\}/);
      assert.doesNotMatch(homeScreenSource, /Jump into an empty workout/);
      assert.doesNotMatch(homeScreenSource, /startWorkoutHero/);
      assert.match(homeScreenSource, /onPress=\{onCreateWorkoutFromExercises\}/);

      assert.match(homeScreenSource, /Routines/);
      assert.match(homeScreenSource, /Templates/);
      assert.doesNotMatch(homeScreenSource, /My Routines/);
      assert.match(homeScreenSource, /Explore/);
      assert.match(homeScreenSource, /routineShortcutCard:\s*\{[\s\S]*minHeight: 92/);
      assert.match(homeScreenSource, /routineShortcutTitle:\s*\{[\s\S]*fontSize: 16/);
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
      assert.doesNotMatch(homeScreenSource, /planWeekLabel/);
      assert.doesNotMatch(homeScreenSource, /activePlan\?\.weekLabel/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 'Week 3 of 8'/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 42/);
      assert.match(appSource, /weekLabel: planProgress\.weekLabel/);
      assert.match(appSource, /progressPercent: planProgress\.progressPercent/);
      assert.match(appSource, /weekProgressLabel: planProgress\.weekProgressLabel/);
      assert.match(appSource, /weekProgressPercent: planProgress\.weekProgressPercent/);
      assert.doesNotMatch(homeScreenSource, /planChartBars/);
      assert.doesNotMatch(homeScreenSource, /View plan/);
      assert.doesNotMatch(homeScreenSource, /VIEW PLAN/);
      assert.doesNotMatch(homeScreenSource, /yourPlanCard/);
      assert.doesNotMatch(homeScreenSource, /yourPlanProgressTrack/);
      assert.doesNotMatch(homeScreenSource, /yourPlanProgressFill/);
      assert.doesNotMatch(homeScreenSource, /yourPlanChartBar/);
      assert.doesNotMatch(homeScreenSource, /viewPlanButton/);
      // v3 is boxless: no full-bleed hero card; interactive rows get the
      // shared pressed-scale feedback.
      assert.doesNotMatch(homeScreenSource, /fullBleedCard/);
      assert.match(homeScreenSource, /pressed:\s*\{\s*transform: \[\{ scale: 0\.95 \}\]/);
      assert.match(homeScreenSource, /style=\{\(\{ pressed \}\) => \[styles\.emptyWorkoutRow, pressed && styles\.pressed\]\}/);
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
        homeScreenSource.indexOf('styles.headerRow') < homeScreenSource.indexOf('styles.weekCard'),
        'header should render before the week card',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.weekCard') < homeScreenSource.indexOf('styles.planEyebrow'),
        'week card should render before the continue-plan agenda',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.planEyebrow') < homeScreenSource.indexOf('styles.startButton'),
        'continue-plan agenda should render before the start button',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.startButton') < homeScreenSource.indexOf('styles.sectionHeaderRow'),
        'start button should render before routines',
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

      // Bottom bar (Home v3): HG3 tokens, 11pt labels, and a floating circular
      // Start button with a glowy purple halo that pops in (reduced-motion aware).
      assert.match(bottomTabBarSource, /shell:\s*\{\s*backgroundColor: HG3\.surface/);
      assert.match(bottomTabBarSource, /activeTab: RootTabKey \| null/);
      assert.match(bottomTabBarSource, /activeTab !== null && activeTab === tab\.key/);
      assert.match(appSource, /activeTab=\{route\.tab === 'workout' && route\.screen === 'plans' \? null : route\.tab\}/);
      assert.match(bottomTabBarSource, /const stroke = active \? HG3\.purple/);
      assert.match(bottomTabBarSource, /const fill = active \? HG3\.purple/);
      assert.match(bottomTabBarSource, /sideLabel:\s*\{[\s\S]*fontSize: 11/);
      assert.match(bottomTabBarSource, /centerButton:\s*\{[\s\S]*shadowColor: HG3\.purpleBright/);
      assert.match(bottomTabBarSource, /shadowOpacity: 0\.45/);
      assert.match(bottomTabBarSource, /centerButtonActive:\s*\{[\s\S]*backgroundColor: HG3\.purple/);
      assert.match(bottomTabBarSource, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
      assert.match(bottomTabBarSource, /fabPop\.setValue\(1\)/);
      assert.match(bottomTabBarSource, /Easing\.bezier\(0\.3, 1\.3, 0\.5, 1\)/);
      assert.match(bottomTabBarSource, /delay: 500/);
      assert.match(bottomTabBarSource, /delay: 240/);
    },
  },
];
