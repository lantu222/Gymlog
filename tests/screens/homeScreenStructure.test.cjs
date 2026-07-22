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
const emptyWorkoutScreenSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'EmptyWorkoutScreen.tsx'),
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

      // Home v4 session hero (design_handoff_home_v4): no eyebrow or plan-name
      // subline — focus title + plan-wide progress beside it, 2x2 meta grid,
      // and a conditional equipment line derived from the exercise library.
      assert.doesNotMatch(homeScreenSource, /CONTINUE PLAN/);
      assert.doesNotMatch(homeScreenSource, /planEyebrow/);
      assert.doesNotMatch(homeScreenSource, /planSubtitle/);
      assert.doesNotMatch(homeScreenSource, /continuePlanCard/);
      assert.match(homeScreenSource, /nextPlanSession/);
      assert.match(homeScreenSource, /onStartActivePlanSession\(nextPlanSession\.id\)/);
      assert.match(homeScreenSource, /const focusTitle = getSessionFocusTitle\(nextPlanSession\?\.title, activePlan\?\.title\)/);
      // Home simplification round (2026-07-20): hero title bumped to 38.
      assert.match(homeScreenSource, /heroTitle:\s*\{[\s\S]*fontSize: 38/);
      assert.match(homeScreenSource, /\{sessionsDone\} of \{sessionsTotal\} sessions/);
      assert.match(homeScreenSource, /heroProgTrack:\s*\{\s*width: 88,\s*height: 6/);
      assert.match(homeScreenSource, /heroProgFill:\s*\{[\s\S]*backgroundColor: HG3\.purple/);
      assert.match(homeScreenSource, /progressFillAnim\.interpolate\(\{ inputRange: \[0, 100\], outputRange: \['0%', '100%'\] \}\)/);
      // Home simplification round (2026-07-20): the hero shows ONLY the focus
      // title + plan progress — no meta grid, no equipment line.
      assert.doesNotMatch(homeScreenSource, /styles\.metaGrid/);
      assert.doesNotMatch(homeScreenSource, /— needed for today's session/);
      // History section at the bottom: strength + cardio merged, See all link.
      assert.match(homeScreenSource, /historyItems\.map\(/);
      assert.match(homeScreenSource, /See all/);
      assert.match(homeScreenSource, /item\.kind === 'cardio' && item\.cardioIcon \? \(/);
      // Warmup / Workout / Cooldown accordions: workout open by default,
      // animated height + rotating chevron, agenda rows inside.
      // All three section accordions start collapsed (user preference).
      assert.match(homeScreenSource, /warmup: false,\s*workout: false,\s*cooldown: false/);
      assert.match(homeScreenSource, /const warmup = getDefaultWarmup\(focusTitle\)/);
      assert.match(homeScreenSource, /const cooldown = getDefaultCooldown\(focusTitle\)/);
      assert.match(homeScreenSource, /sectionAnims\[key\]\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 420\] \}\)/);
      assert.match(homeScreenSource, /duration: 380/);
      assert.match(homeScreenSource, /secTitle:\s*\{[\s\S]*fontSize: 20/);
      assert.match(homeScreenSource, /planExerciseNumberChip:\s*\{\s*width: 25,\s*height: 25/);
      assert.match(homeScreenSource, /planExerciseScheme:\s*\{[\s\S]*fontFamily: 'JetBrainsMono'/);
      assert.match(homeScreenSource, /exercise\.schemeLabel \?\? exercise\.setsLabel/);
      // Inline Adapt + Start row (no floating bar) and the Adapt sheet with
      // four presentational options + computed trim copy.
      assert.match(homeScreenSource, /adaptButton:\s*\{\s*flex: 1,\s*height: 56,\s*borderRadius: 16,\s*borderWidth: 1\.5,\s*borderColor: HG3\.border/);
      // Start workout is the green action: green border, label, and arrow.
      assert.match(homeScreenSource, /startButton:\s*\{\s*flex: 1\.3,\s*height: 56,\s*borderRadius: 16,\s*borderWidth: 1\.5,\s*borderColor: HG3\.green/);
      assert.match(homeScreenSource, /startButtonText:\s*\{\s*color: HG3\.green/);
      assert.match(homeScreenSource, /Start workout/);
      assert.match(homeScreenSource, /Adapt session/);
      assert.match(homeScreenSource, /Tweak today's session — your plan stays on track\./);
      assert.match(homeScreenSource, /Shorter session/);
      assert.match(homeScreenSource, /Trim to ~\$\{adaptTrim\.trimmedMinutes\} min · drops \$\{adaptTrim\.droppedSets\} sets/);
      assert.match(homeScreenSource, /Change equipment/);
      assert.match(homeScreenSource, /Swap an exercise/);
      assert.match(homeScreenSource, /Feeling low energy/);
      assert.match(homeScreenSource, /adaptCancel/);
      assert.match(homeScreenSource, /onRequestClose=\{\(\) => setAdaptSheetVisible\(false\)\}/);
      // Hero + accordions render only with an active plan.
      assert.match(homeScreenSource, /\{activePlan && nextPlanSession \? \(/);
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

      // Routines section (Templates + Explore shortcut cards) removed from Home —
      // ready templates / programs live in the Programs tab now. Empty workout stays.
      assert.doesNotMatch(homeScreenSource, /routineShortcut/);
      assert.doesNotMatch(homeScreenSource, /onOpenTemplatesHub/);
      assert.doesNotMatch(homeScreenSource, /onBrowseReadyPlans/);
      assert.doesNotMatch(homeScreenSource, /readyTemplateCount/);
      assert.doesNotMatch(homeScreenSource, />Routines</);
      assert.doesNotMatch(homeScreenSource, /My Routines/);
      assert.match(workoutsScreenSource, /const \[showReadyLibrary, setShowReadyLibrary\] = useState\(true\)/);
      assert.match(workoutsScreenSource, /const \[showBrowseWorkouts, setShowBrowseWorkouts\] = useState\(true\)/);
      assert.match(workoutsScreenSource, /const \[readyEquipmentFilter, setReadyEquipmentFilter\] = useState<ReadyEquipmentFilter>\('all'\)/);
      assert.doesNotMatch(appSource, /readyTemplateCount/);
      // Family-sectioned browse: every ready template is bucketed into one family section.
      assert.match(workoutsScreenSource, /const readySectionItems = new Map<string, ReadyDiscoveryItem\[\]>\(\)/);
      assert.match(workoutsScreenSource, /READY_FAMILY_SECTIONS\.find\(\(candidate\) => candidate\.match\(item\)\)/);
      assert.doesNotMatch(workoutsScreenSource, /tpl_gainer_'\)\)/);
      assert.match(workoutsScreenSource, /title="Programs"/);
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
      assert.match(workoutsScreenSource, /READY_FAMILY_SECTIONS/);
      assert.match(workoutsScreenSource, /title: "Women's programs"/);
      assert.match(workoutsScreenSource, /title: 'Muscle group focus'/);
      assert.match(workoutsScreenSource, /title: 'Strength'/);
      assert.match(workoutsScreenSource, /title: 'Muscle'/);
      assert.match(workoutsScreenSource, /title: 'Fat loss'/);
      assert.match(workoutsScreenSource, /title: 'Home & minimal equipment'/);
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
      assert.doesNotMatch(workoutsScreenSource, /Search for programs/);
      assert.doesNotMatch(workoutsScreenSource, /{activeSession \?/);
      assert.doesNotMatch(homeScreenSource, /YOUR PLAN/);
      assert.doesNotMatch(homeScreenSource, /planWeekLabel/);
      assert.doesNotMatch(homeScreenSource, /activePlan\?\.weekLabel/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 'Week 3 of 8'/);
      assert.doesNotMatch(homeScreenSource, /activePlan \? 42/);
      assert.match(appSource, /weekLabel: planProgress\.weekLabel/);
      assert.match(appSource, /progressPercent: planProgress\.progressPercent/);
      // v4 hero data comes from real stores: plan-wide session counts, week
      // position, split focus, and library-derived equipment.
      assert.match(appSource, /sessionsDone: planProgress\.sessionsDone/);
      assert.match(appSource, /sessionsTotal: planProgress\.sessionsTotal/);
      assert.match(appSource, /currentWeek: planProgress\.currentWeek/);
      assert.match(appSource, /planTotalWeeks: planProgress\.totalWeeks/);
      assert.match(appSource, /focusLabel: getSessionBodyFocusLabel\(recommendedReadyTemplate\.splitType\)/);
      assert.match(appSource, /equipmentLabel: buildSessionEquipmentLabel\(/);
      assert.match(appSource, /totalSets: session\.exercises\.reduce/);
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
        homeScreenSource.indexOf('styles.weekCard') < homeScreenSource.indexOf('styles.hero'),
        'week card should render before the session hero',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.hero') < homeScreenSource.indexOf('styles.secs'),
        'session hero should render before the section accordions',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.secs') < homeScreenSource.indexOf('styles.btnRow'),
        'section accordions should render before the Adapt/Start row',
      );
      assert.ok(
        homeScreenSource.indexOf('styles.btnRow') < homeScreenSource.indexOf('styles.emptyWorkoutRow'),
        'Adapt/Start row should render before the empty workout row',
      );
      assert.match(appSource, /activePlan=\{homeActivePlanCard\}/);
      assert.match(appSource, /const homeRecentSessions = useMemo/);
      assert.match(appSource, /\[\.\.\.workoutSessions\][\s\S]*\.sort/);
      assert.match(appSource, /\.slice\(0, 3\)/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*recentSessions=\{homeRecentSessions\}/);
      assert.match(appSource, /<ProgressScreen[\s\S]*recentSessions=\{homeRecentSessions\}/);
      assert.doesNotMatch(appSource, /customTemplates=/);
      assert.match(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'empty' \}\)\}/);
      assert.doesNotMatch(appSource, /onCreateWorkoutFromExercises=\{\(\) => navigate\(\{ tab: 'workout', screen: 'editor' \}\)\}/);
      assert.doesNotMatch(appSource, /onBrowseReadyPlans=/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenProgressOverview=/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenTrackedProgress=/);
      assert.doesNotMatch(appSource, /<HomeScreen[\s\S]*onOpenBodyStats=/);
      assert.match(appSource, /onOpenSessionHistory=\{\(\) => navigate\(\{ tab: 'home', screen: 'history' \}\)\}/);
      assert.match(appSource, /onOpenRecentSession=\{\(sessionId\) => navigate\(\{ tab: 'home', screen: 'session', sessionId \}\)\}/);
      assert.doesNotMatch(appSource, /onOpenAICoach=\{handleOpenAICoach\}/);

      assert.match(routesSource, /screen: 'empty'/);
      // workout/empty renders the dedicated HG freestyle screen; the editor
      // keeps its own branch and no longer has an emptyWorkout presentation.
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'empty'/);
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'editor'/);
      assert.match(appSource, /<EmptyWorkoutScreen/);
      assert.doesNotMatch(appSource, /presentation=/);
      assert.match(appSource, /inlineTip=\{null\}/);
      assert.doesNotMatch(appSource, /Start with the main lift first/);
      assert.doesNotMatch(appSource, /WORKOUT_EDITOR_TIP_ID/);
      assert.doesNotMatch(workoutEditorScreenSource, /emptyWorkout/);
      assert.doesNotMatch(workoutEditorScreenSource, /presentation\?:/);
      // The freestyle screen speaks the HG/AW3 language: empty state, add
      // sheet, shared set table with plate readout and the floating rest bar.
      assert.match(emptyWorkoutScreenSource, /Nothing logged yet/);
      assert.match(emptyWorkoutScreenSource, /freestyle session/);
      assert.match(emptyWorkoutScreenSource, /Recent exercises/);
      assert.match(emptyWorkoutScreenSource, /Popular exercises/);
      assert.match(emptyWorkoutScreenSource, /getPopularExerciseLibraryItems/);
      assert.match(emptyWorkoutScreenSource, /<RestBar/);
      assert.match(emptyWorkoutScreenSource, /<PlatePop/);
      assert.match(emptyWorkoutScreenSource, /buildFreestyleFinish/);
      assert.match(emptyWorkoutScreenSource, /useKeepScreenAwake\(keepScreenAwake, 'empty-workout'\)/);
      assert.match(emptyWorkoutScreenSource, /Finish workout/);
      // Save-truthfulness: the finish handler awaits App's onSave and resets
      // the saving flag on failure instead of showing success early.
      assert.match(emptyWorkoutScreenSource, /await onSave\(draft, summary\);/);
      assert.match(emptyWorkoutScreenSource, /setIsSaving\(false\);/);
      // App-side: template + session persist before the summary route swap.
      assert.match(appSource, /const workoutTemplateId = await upsertWorkoutTemplate\(draft\);[\s\S]*await saveCompletedWorkoutSession\(\{[\s\S]*summaryExitRouteRef\.current = ROOT_ROUTES\.home;[\s\S]*replaceRoute\(\{ tab: 'workout', screen: 'summary' \}\);/);

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

      // Bottom bar EXPERIMENT (dark floating pill): absolutely positioned so it
      // floats low over the content (no backdrop strip), a dark pill, purple-on-dark
      // active tint, a circular highlight that slides between tabs, and a smaller
      // Start button with a purple halo (motion-aware).
      assert.match(bottomTabBarSource, /shell:\s*\{\s*[\s\S]*position: 'absolute'/);
      assert.match(bottomTabBarSource, /pill:\s*\{[\s\S]*backgroundColor: BAR\.pill/);
      assert.match(bottomTabBarSource, /activeTab: RootTabKey \| null/);
      assert.match(bottomTabBarSource, /activeKey === tab\.key/);
      assert.match(appSource, /activeTab=\{route\.tab === 'workout' && route\.screen === 'plans' \? null : route\.tab\}/);
      assert.match(bottomTabBarSource, /const stroke = active \? BAR\.active/);
      assert.match(bottomTabBarSource, /const fill = active \? BAR\.active/);
      assert.match(bottomTabBarSource, /indicator:\s*\{[\s\S]*backgroundColor: BAR\.highlight/);
      assert.match(bottomTabBarSource, /borderRadius: HIGHLIGHT \/ 2/);
      assert.match(bottomTabBarSource, /Animated\.spring\(indicatorX/);
      // Icon-only tabs (labels removed), larger icons, a11y label preserved.
      assert.doesNotMatch(bottomTabBarSource, /sideLabel/);
      assert.match(bottomTabBarSource, /const size = 26/);
      assert.match(bottomTabBarSource, /accessibilityLabel=\{tab\.label\}/);
      // Center "AI" button (design_handoff_ai_button): near-white radial fill + "AI"
      // label + purple halo/glow. Sized down from the 48px spec.
      assert.match(bottomTabBarSource, /const AI_SIZE = 46/);
      assert.match(bottomTabBarSource, />AI<\/Text>/);
      assert.match(bottomTabBarSource, /url\(#aiFill\)/);
      assert.match(bottomTabBarSource, /centerGlow:\s*\{[\s\S]*shadowColor: HG3\.purpleBright/);
      assert.match(bottomTabBarSource, /aiCircle:\s*\{[\s\S]*width: AI_SIZE/);
      assert.match(bottomTabBarSource, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
      assert.match(bottomTabBarSource, /fabPop\.setValue\(1\)/);
      assert.match(bottomTabBarSource, /Easing\.bezier\(0\.3, 1\.3, 0\.5, 1\)/);
      assert.match(bottomTabBarSource, /delay: 500/);
      assert.match(bottomTabBarSource, /delay: 240/);
    },
  },
];
