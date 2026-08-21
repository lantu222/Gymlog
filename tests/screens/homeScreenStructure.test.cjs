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
const vinhaIconSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'VinhaIcon.tsx'),
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
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');

module.exports = [
  {
    name: 'home screen uses light routine dashboard with purple workout actions',
    run() {
      // Home v3 (GAINER Home v3 mock): palette comes from the shared HG token
      // set in lightTheme.ts — no local hex constants for tokenized colors.
      // Home reads the active theme now. PW's sheet gradients stay outside it,
      // being a designed dark surface rather than a light-theme variant.
      assert.match(homeScreenSource, /import \{ PW \} from '\.\.\/lightTheme'/);
      assert.match(homeScreenSource, /useThemedStyles\(makeStyles\)/);
      assert.doesNotMatch(homeScreenSource, /const HOME_BACKGROUND =/);
      assert.match(homeScreenSource, /screenBackground:\s*\{[\s\S]*backgroundColor: theme.bg/);

      // The greeting is chosen by homeGreeting from what the log says, then
      // rendered through i18n — never a hardcoded "welcome back".
      assert.match(homeScreenSource, /t\(language, greeting\.titleKey, greeting\.titleVars\)/);
      // Home shows ONE line now (design 1C). The subtitle key stays part of
      // selectHomeGreeting's contract; the surface simply stopped using it.
      assert.doesNotMatch(homeScreenSource, /t\(language, greeting\.subtitleKey\)/);
      assert.match(homeScreenSource, /selectHomeGreeting\(\{/);
      // A state greeting earned from the log outranks the clock.
      assert.match(homeScreenSource, /if \(!isRotatingGreeting\(greeting\.titleKey\)\)/);
      assert.match(homeScreenSource, /selectTimeGreetingKey\(\)/);
      // Never "Hyvää aamua, " with nothing after it.
      assert.match(homeScreenSource, /firstName\s*\?\s*t\(language, 'home\.greet\.time\.named'/);
      assert.doesNotMatch(homeScreenSource, /t\(language, 'home\.greeting\.title'\)/);
      assert.match(i18nSource, /'home\.greet\.first\.title': 'Welcome to Vinha'/);
      assert.match(i18nSource, /'home\.greet\.back1\.title': 'Tervetuloa takaisin'/);
      assert.match(homeScreenSource, /content:\s*\{[\s\S]*paddingTop: 24/);
      assert.match(homeScreenSource, /greetingLine:\s*\{[\s\S]*fontSize: 13\.5/);
      // The PRO pill is back, and it reads the entitlement. It was removed for
      // advertising a subscription to people who already paid; that reason
      // applied to the gold offer, not to a status badge. Gold goes to the Pro
      // page, grey goes to the membership the reader already has — a
      // subscriber must never be sent to a page selling them what they own.
      assert.match(homeScreenSource, /proUnlocked \? onOpenSubscription\?\.\(\) : onOpenPremium\?\.\(\)/);
      assert.match(homeScreenSource, /proUnlocked \? styles\.proPillActive : styles\.proPillOffer/);
      assert.match(homeScreenSource, /proPillOffer:\s*\{[\s\S]{0,80}backgroundColor: theme\.gold/);
      assert.match(homeScreenSource, /proPillActive:\s*\{[\s\S]{0,120}backgroundColor: theme\.surfaceSoft/);
      // The label is one word; what it means is in the accessibility label.
      assert.match(homeScreenSource, /proUnlocked \? 'home\.proPill\.manage' : 'home\.proPill\.get'/);
      // The full lockup: the app is called Vinha Fitness, and Home is where
      // the reader looks to see whose app this is.
      assert.match(homeScreenSource, /<VinhaWordmark size=\{30\} fitness \/>/);
      assert.match(homeScreenSource, /speedRule:\s*\{[\s\S]*skewX: '-18deg'/);
      // The date is stated once, on the greeting row — today's cell in the
      // week strip is told apart by its highlight, not by different content.
      assert.match(homeScreenSource, /const dayLabel = day\.weekdayLabel;/);
      assert.match(homeScreenSource, /const \[plateauSheetVisible, setPlateauSheetVisible\] = useState\(false\)/);
      // Week strip lives on a white card and expands into a Monday-first month
      // grid; the chevron rotates 180° and the panel height animates.
      assert.match(homeScreenSource, /topCalendarDays/);
      assert.match(homeScreenSource, /weekCard:\s*\{[\s\S]*borderRadius: 18/);
      assert.match(homeScreenSource, /weekStripItemToday:\s*\{[\s\S]*backgroundColor: theme.purpleSoft/);
      assert.match(homeScreenSource, /const \[calendarExpanded, setCalendarExpanded\] = useState\(false\)/);
      // The month grid pages, so the offset is part of what it memoises on.
      assert.match(
        homeScreenSource,
        /getHomeMonthCalendar\(new Date\(\), language, monthOffset\),\s*\r?\n?\s*\[language, monthOffset\]/,
      );
      assert.match(homeScreenSource, /setMonthOffset\(\(current\) => current - 1\)/);
      assert.match(homeScreenSource, /setMonthOffset\(\(current\) => current \+ 1\)/);
      assert.match(homeScreenSource, /monthCalendar\.monthLabel/);
      assert.match(homeScreenSource, /monthDayCellToday/);
      assert.match(homeScreenSource, /monthLegendRow/);
      assert.match(homeScreenSource, /outputRange: \['0deg', '180deg'\]/);
      assert.match(homeScreenSource, /calendarAnim\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 480\] \}\)/);
      // Entrance animations: staggered "rise" + progress fill, all skipped when
      // the user has reduced motion enabled (content must never stay hidden).
      assert.match(homeScreenSource, /queryReduceMotion\(\)/);
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

      assert.match(vinhaIconSource, /\| 'dumbbell'/);
      assert.match(vinhaIconSource, /\| 'chevronRight'/);
      assert.match(vinhaIconSource, /case 'dumbbell':/);
      assert.match(vinhaIconSource, /case 'chevronRight':/);

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
      assert.match(homeScreenSource, /t\(language, 'home\.hero\.sessionsProgress', \{ done: sessionsDone, total: sessionsTotal \}\)/);
      assert.match(i18nSource, /'home\.hero\.sessionsProgress': '\{done\} of \{total\} sessions'/);
      assert.match(homeScreenSource, /heroProgTrack:\s*\{\s*width: 88,\s*height: 6/);
      assert.match(homeScreenSource, /heroProgFill:\s*\{[\s\S]*backgroundColor: theme.purple/);
      assert.match(homeScreenSource, /progressFillAnim\.interpolate\(\{ inputRange: \[0, 100\], outputRange: \['0%', '100%'\] \}\)/);
      // Home simplification round (2026-07-20): the hero shows ONLY the focus
      // title + plan progress — no meta grid, no equipment line.
      assert.doesNotMatch(homeScreenSource, /styles\.metaGrid/);
      assert.doesNotMatch(homeScreenSource, /— needed for today's session/);
      // History section at the bottom: strength + cardio merged, See all link.
      assert.match(homeScreenSource, /historyItems\.map\(/);
      assert.match(homeScreenSource, /t\(language, 'home\.history\.seeAll'\)/);
      assert.match(i18nSource, /'home\.history\.seeAll': 'See all'/);
      assert.match(homeScreenSource, /item\.kind === 'cardio' && item\.cardioIcon \? \(/);
      // Warmup / Workout / Cooldown accordions: workout open by default,
      // animated height + rotating chevron, agenda rows inside.
      // All three section accordions start collapsed (user preference).
      assert.match(homeScreenSource, /warmup: false,\s*workout: false,\s*cooldown: false/);
      // The blocks are chosen by classified focus, never by the session title:
      // the title is display text, and feeding it here is what made every
      // Finnish session share one generic warmup.
      assert.match(homeScreenSource, /const focusKind = nextPlanSession\?\.focusKind \?\? 'general'/);
      assert.match(homeScreenSource, /const warmup = getDefaultWarmup\(focusKind, language, availableEquipment\)/);
      assert.match(homeScreenSource, /const cooldown = getDefaultCooldown\(focusKind, language, availableEquipment\)/);
      assert.doesNotMatch(homeScreenSource, /getDefault(Warmup|Cooldown)\(focusTitle/);
      // Accordion interpolations live in a useRef built once per mount — an
      // inline sectionAnims[key].interpolate() per render leaks native nodes
      // (Fabric disconnectAnimatedNodes crash).
      assert.match(homeScreenSource, /const sectionStyles = useRef\(\{/);
      assert.match(homeScreenSource, /maxHeight: sectionAnims\.workout\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 420\] \}\)/);
      assert.match(homeScreenSource, /style=\{\[styles\.secBody, sectionStyles\[key\]\.body\]\}/);
      assert.match(homeScreenSource, /duration: 380/);
      assert.match(homeScreenSource, /secTitle:\s*\{[\s\S]*fontSize: 20/);
      assert.match(homeScreenSource, /planExerciseNumberChip:\s*\{\s*width: 25,\s*height: 25/);
      assert.match(homeScreenSource, /planExerciseScheme:\s*\{[\s\S]*fontFamily: 'JetBrainsMono'/);
      assert.match(homeScreenSource, /exercise\.schemeLabel \?\? exercise\.setsLabel/);
      // Inline Adapt + Start row (no floating bar) and the Adapt sheet, which
      // is now one real action rather than four rows that closed it.
      assert.match(homeScreenSource, /adaptButton:\s*\{\s*flex: 1,\s*height: 56,\s*borderRadius: 16,\s*borderWidth: 1\.5,\s*borderColor: theme.border/);
      // Start workout is the green action: green border, label, and arrow.
      // A3: the shape is drawn, and the green stays — this is the one button
      // on the screen that is not purple, which is the point of it.
      assert.match(homeScreenSource, /startButton:\s*\{\s*height: 56/);
      assert.match(homeScreenSource, /stroke=\{theme\.accent\}/);
      // The start CTA reads `accent`, not `green`: green also means "done"
      // (completed sets, finished cardio), and the dark theme moves the action
      // accent to orange without moving those.
      assert.match(homeScreenSource, /startButtonText:\s*\{\s*color: theme.accent/);
      // The hero button says "Start workout" only when there is a session to
      // start. With no programme it used to promise one anyway and open an empty
      // workout — the same thing the row below it already offers — so the label
      // and the action now both switch to finding a programme. And with a
      // workout already in progress it says so: the tap resumed it all along,
      // but the label read "Aloita treeni" over a session left mid-warm-up.
      assert.match(homeScreenSource, /hasActiveSession\s*\?\s*'home\.resumeWorkout'\s*:\s*'home\.startWorkout'/);
      assert.match(homeScreenSource, /:\s*'home\.findProgram'/);
      assert.match(homeScreenSource, /const heroStartsSession = Boolean\(nextPlanSession\)/);
      assert.match(i18nSource, /'home\.resumeWorkout': 'Resume workout'/);
      assert.match(i18nSource, /'home\.resumeWorkout': 'Jatka treeniä'/);
      assert.match(appSource, /hasActiveSession=\{workout\.activeSession !== null && workout\.activeSession\.status !== 'completed'\}/);
      assert.match(homeScreenSource, /if \(!nextPlanSession && onFindProgram\)/);
      assert.match(i18nSource, /'home\.startWorkout': 'Start workout'/);
      assert.match(i18nSource, /'home\.findProgram': 'Find a program'/);
      assert.match(appSource, /onFindProgram=\{\(\) => navigateToTab\('workout'\)\}/);
      assert.match(i18nSource, /'home\.adaptSheet\.shorter\.title': 'Shorter session'/);
      // Minutes again, but only because there is now one formula. The sheet
      // and the player used to disagree about the same session (~35 vs ~50)
      // and the promise was the one the user read first, so the copy retreated
      // to sets. Both numbers now come from previewSessionTrim, which runs the
      // real trim plan through estimateSessionMinutes.
      assert.match(homeScreenSource, /t\(language, 'home\.adaptSheet\.shorter\.explain', \{[\s\S]*after: adaptTrim\.minutes,/);
      assert.match(homeScreenSource, /const adaptTrim = nextPlanSession\?\.trim \?\? null;/);
      // Home sees only the first five exercises, so it must not compute the
      // preview itself — App.tsx does it where the whole session is in hand.
      assert.doesNotMatch(homeScreenSource, /previewSessionTrim|getAdaptTrimEstimate/);
      assert.match(appSource, /trim: previewSessionTrim\(durationInputs, routineSeconds\)/);

      // The three options that used to sit beside it are gone, and must not
      // come back here: a taken rack and a body with nothing in it are both
      // discovered in the gym, and the player answers both. Only the trim is
      // knowable before you leave the house.
      assert.doesNotMatch(i18nSource, /'home\.adaptSheet\.(equipment|swap|energy)\./);
      assert.doesNotMatch(homeScreenSource, /adaptSheet\.(equipment|swap|energy)/);

      // And the trim actually starts a session instead of closing a sheet.
      assert.match(homeScreenSource, /onStartTrimmedSession\?\.\(nextPlanSession\.id\)/);
      assert.match(homeScreenSource, /adaptCancel/);
      assert.match(homeScreenSource, /onRequestClose=\{\(\) => setAdaptSheetVisible\(false\)\}/);
      // Hero + accordions render only with an active plan.
      assert.match(homeScreenSource, /\{activePlan && nextPlanSession \? \(/);
      // The Home pro sheet is gone (GAINER Paywall Moments): the PRO pill
      // opens the one full Pro page, and Home's paywall moment is the plateau
      // card whose blurred conclusion is the real text from proInsights.
      assert.doesNotMatch(homeScreenSource, /proSheetVisible|PRO_STATS|PRO_COMPARISON/);
      // The PRO pill is gone from the header, so this is now the only place
      // Home reaches the Pro page: the plateau moment's sheet. The prop and
      // the route stay — twelve other surfaces use them.
      assert.match(homeScreenSource, /onSeePro=\{\(\) => \{[\s\S]{0,120}onOpenPremium\?\.\(\);/);
      assert.match(homeScreenSource, /pro\.plateau\.eyebrow/);
      assert.match(homeScreenSource, /<ProLockedCard/);
      assert.match(homeScreenSource, /<ProMomentSheet/);
      assert.match(homeScreenSource, /t\(language, 'home\.emptyWorkout\.title'\)/);
      assert.match(homeScreenSource, /t\(language, 'home\.emptyWorkout\.meta'\)/);
      assert.match(i18nSource, /'home\.emptyWorkout\.title': 'Empty workout'/);
      assert.match(i18nSource, /'home\.emptyWorkout\.meta': 'Log freestyle'/);
      assert.match(homeScreenSource, /emptyWorkoutRow/);
      assert.match(homeScreenSource, /emptyWorkoutRow:\s*\{[\s\S]*backgroundColor: theme.surface/);
      assert.match(homeScreenSource, /name="plus" color=\{theme.highlight\} size=\{20\}/);
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
      assert.match(workoutsScreenSource, /title=\{t\(language, 'tabs\.programs'\)\}/);
      // This used to assert `tone="dark"` on the header, because ScreenHeader
      // defaulted to near-white legacy text that vanished on a light screen.
      // The prop is gone and the header always reads from the shared palette,
      // so the guard now protects that instead — reintroducing a tone prop
      // would bring the trap back.
      const screenHeaderSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'components', 'ScreenHeader.tsx'),
        'utf8',
      );
      assert.doesNotMatch(screenHeaderSource, /tone\?:/);
      assert.doesNotMatch(screenHeaderSource, /from '\.\.\/theme'[\s\S]*colors/);
      // First component on the theme hook. Reading from the active theme is a
      // stronger version of the old guard — it cannot be a local hex, and it
      // cannot be a palette constant frozen at module load either.
      assert.match(screenHeaderSource, /useThemedStyles\(makeStyles\)/);
      assert.match(screenHeaderSource, /const makeStyles = \(theme: Theme\)/);
      assert.match(screenHeaderSource, /color: theme\.ink/);
      assert.match(workoutsScreenSource, /t\(language, 'ready\.searchPlaceholder'\)/);
      assert.match(workoutsScreenSource, /MagnifyingGlass/);
      assert.match(workoutsScreenSource, /SlidersHorizontal/);
      assert.match(workoutsScreenSource, /showAdvancedReadyFilters/);
      assert.match(workoutsScreenSource, /READY_GOAL_FILTERS/);
      const readyGoalFilterBlock = workoutsScreenSource.slice(
        workoutsScreenSource.indexOf('const READY_GOAL_FILTERS'),
        workoutsScreenSource.indexOf('const READY_TIME_FILTERS'),
      );
      assert.ok(
        readyGoalFilterBlock.indexOf("labelKey: 'facet.all'") <
          readyGoalFilterBlock.indexOf("labelKey: 'ready.goal.fatLoss'"),
        'all should be the first visible goal filter',
      );
      assert.ok(
        readyGoalFilterBlock.indexOf("labelKey: 'ready.goal.fatLoss'") <
          readyGoalFilterBlock.indexOf("labelKey: 'ready.goal.strength'"),
        'fat loss should sit before strength in the ready-template goal carousel',
      );
      assert.match(workoutsScreenSource, /t\(language, 'ready\.filterTemplates'\)/);
      assert.match(workoutsScreenSource, /t\(language, 'progress\.metric\.duration'\)/);
      assert.match(workoutsScreenSource, /t\(language, 'myData\.equipment'\)/);
      assert.match(workoutsScreenSource, /t\(language, 'myData\.experience'\)/);
      assert.match(i18nSource, /'ready\.filterTemplates': 'Filter templates'/);
      assert.match(workoutsScreenSource, /READY_TIME_FILTERS\.map/);
      assert.match(workoutsScreenSource, /READY_EQUIPMENT_FILTERS\.map/);
      assert.match(workoutsScreenSource, /READY_LEVEL_FILTERS\.map/);
      assert.match(workoutsScreenSource, /snapToInterval=\{116\}/);
      assert.match(workoutsScreenSource, /readyTemplateFilterChip:\s*\{[\s\S]*minWidth: 104/);
      assert.match(workoutsScreenSource, /READY_FAMILY_SECTIONS/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.section\.women'/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.section\.focus'/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.goal\.strength'/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.section\.muscle'/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.goal\.fatLoss'/);
      assert.match(workoutsScreenSource, /titleKey: 'ready\.section\.home'/);
      assert.match(i18nSource, /'ready\.section\.women': "Women's programs"/);
      assert.match(i18nSource, /'ready\.section\.home': 'Home & minimal equipment'/);
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
      assert.match(workoutsScreenSource, /ready\.startPlan/);
      assert.match(i18nSource, /'ready\.startPlan': 'Start Plan'/);
      assert.doesNotMatch(workoutsScreenSource, /readyTemplateSummary/);
      assert.doesNotMatch(workoutsScreenSource, /formatTemplateSubtitle/);
      assert.doesNotMatch(workoutsScreenSource, /Next: \{firstExercise\}/);
      assert.match(appSource, /const readyTemplatesActive = route\.tab === 'workout' && route\.screen === 'plans'/);
      // The safe area must match the content it frames. App.tsx used to
      // enumerate every light screen to achieve that, and any screen left off
      // the list fell through to the legacy dark theme — which is how Home got
      // a navy status bar. The shell now defaults to light and only the
      // gradient-hero screens opt out, so the guard lives on the default.
      const appShellSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'components', 'AppShell.tsx'),
        'utf8',
      );
      assert.match(appShellSource, /shellBackgroundColor \?\? theme\.bg/);
      // Status-bar icons follow the theme now; only gradient heroes override.
      assert.match(appShellSource, /statusBarStyleOverride \?\? \(themeName === 'dark' \? 'light' : 'dark'\)/);
      assert.match(appSource, /shellBackgroundColor=\{aiSetupActive \? theme\.surface : undefined\}/);
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
      // The hero's focus label used to come from the recommendation fallback,
      // which impersonated an active plan whenever the reader had none: it
      // hid a removed programme, an entry-less plan, and it started sessions
      // against a programme nobody had adopted. The plan branch is the only
      // source now, and a reader with no plan gets Home's no-plan state.
      assert.doesNotMatch(appSource, /recommendedReadyTemplate\.splitType/);
      assert.match(appSource, /focusLabel: getSessionBodyFocusLabel\(/);
      assert.match(appSource, /resolveNextPlanEntryIndex\(sortedEntries, completedPlanSessions\)/);
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
      // v3 kept the plan off Home entirely. That reversed once the active
      // program moved here from the Programs tab: the block above is today,
      // and this is the block today belongs to. Programs is for FINDING a
      // program; Home is for running one, and only one screen owns it.
      assert.match(homeScreenSource, /onPress=\{onOpenActivePlan\}/);
      assert.match(homeScreenSource, /t\(language, 'programs\.activeProgram'\)/);
      assert.match(homeScreenSource, /activePlan\.sessions\.map/);
      // Two actions and nothing else: see the plan, edit the days.
      assert.match(homeScreenSource, /t\(language, 'programs\.viewPlan'\)/);
      assert.match(homeScreenSource, /onPress=\{onSetTrainingDays\}/);
      // The weekday rule is shared, not copied. Two screens with their own
      // opinion about the same week is the bug that rule exists to prevent.
      assert.match(homeScreenSource, /from '\.\.\/lib\/planWeekdays'/);
      assert.doesNotMatch(homeScreenSource, /const TRAINING_DAY_SPREAD/);
      assert.doesNotMatch(homeScreenSource, /<Text style=\{styles\.myRoutineLabel\}>My Routine<\/Text>/);
      assert.doesNotMatch(homeScreenSource, /style=\{styles\.myRoutineCard\}/);
      assert.match(homeScreenSource, /home\.emptyWorkout\.title/);
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
      // The inline tip is gone entirely. It used to be passed as null from both
      // call sites, which meant a dark-themed card that could never render —
      // this guard pinned the null; now it pins the absence.
      assert.doesNotMatch(appSource, /inlineTip/);
      assert.doesNotMatch(workoutEditorScreenSource, /inlineTip/);
      assert.doesNotMatch(appSource, /Start with the main lift first/);
      assert.doesNotMatch(appSource, /WORKOUT_EDITOR_TIP_ID/);
      assert.doesNotMatch(workoutEditorScreenSource, /emptyWorkout/);
      assert.doesNotMatch(workoutEditorScreenSource, /presentation\?:/);
      // The freestyle screen speaks the HG/AW3 language: empty state, add
      // sheet, shared set table with plate readout and the floating rest bar.
      assert.match(emptyWorkoutScreenSource, /emptyWorkout\.empty\.title/);
      assert.match(emptyWorkoutScreenSource, /emptyWorkout\.stat\.tag/);
      assert.match(emptyWorkoutScreenSource, /emptyWorkout\.recent/);
      assert.match(emptyWorkoutScreenSource, /emptyWorkout\.popular/);
      assert.match(i18nSource, /'emptyWorkout\.empty\.title': 'Nothing logged yet'/);
      assert.match(i18nSource, /'emptyWorkout\.stat\.tag': 'freestyle session'/);
      assert.match(emptyWorkoutScreenSource, /getPopularExerciseLibraryItems/);
      assert.match(emptyWorkoutScreenSource, /<RestBar/);
      assert.match(emptyWorkoutScreenSource, /<PlatePop/);
      assert.match(emptyWorkoutScreenSource, /buildFreestyleFinish/);
      assert.match(emptyWorkoutScreenSource, /useKeepScreenAwake\(keepScreenAwake, 'empty-workout'\)/);
      assert.match(emptyWorkoutScreenSource, /emptyWorkout\.finishWorkout/);
      assert.match(i18nSource, /'emptyWorkout\.finishWorkout': 'Finish workout'/);
      // Save-truthfulness: the finish handler awaits App's onSave and resets
      // the saving flag on failure instead of showing success early.
      assert.match(emptyWorkoutScreenSource, /await onSave\(draft, summary\);/);
      assert.match(emptyWorkoutScreenSource, /setIsSaving\(false\);/);
      // App-side: template + session persist before the summary route swap.
      assert.match(appSource, /const workoutTemplateId = await upsertWorkoutTemplate\(draft\);[\s\S]*await saveCompletedWorkoutSession\(\{[\s\S]*summaryExitRouteRef\.current = ROOT_ROUTES\.home;[\s\S]*replaceRoute\(\{ tab: 'workout', screen: 'summary' \}\);/);

      assert.match(routesSource, /section\?: 'overview' \| 'records' \| 'tracked' \| 'measures'/);
      assert.match(progressScreenSource, /initialSection\?: ProgressSection/);
      assert.match(progressScreenSource, /recentSessions\?: HomeRecentSessionItem\[\]/);
      assert.match(progressScreenSource, /onOpenSessionHistory\?: \(\) => void/);
      assert.match(progressScreenSource, /onOpenRecentSession\?: \(sessionId: string\) => void/);
      assert.match(
        progressScreenSource,
        /<Text style=\{styles\.referenceCardTitle\}>\{t\(language, 'progress\.history'\)\}<\/Text>/,
      );
      assert.match(progressScreenSource, /recentSessions\.slice\(0, 3\)\.map/);
      assert.match(progressScreenSource, /progressHistoryCard/);
      assert.match(progressScreenSource, /onOpenRecentSession\?\.\(session\.id\)/);
      assert.match(progressScreenSource, /useState<ProgressSection>\(initialSection \?\? 'overview'\)/);
      assert.match(progressScreenSource, /useEffect\(\(\) => \{[\s\S]*setProgressSection\(initialSection\);[\s\S]*\}, \[initialSection\]\)/);
      assert.match(appSource, /initialSection=\{route\.screen === 'list' \? route\.section : undefined\}/);

      // Bottom bar EXPERIMENT (dark floating pill): absolutely positioned so it
      // floats low over the content (no backdrop strip), a dark pill, a circular
      // highlight that slides between tabs, and a smaller Start button with a
      // purple halo (motion-aware).
      //
      // The pill stays a designed dark surface in both themes, but the active
      // tint follows the theme (2026-08-01) — violet in light, orange in dark,
      // alongside every other interactive element.
      assert.match(bottomTabBarSource, /shell:\s*\{\s*[\s\S]*position: 'absolute'/);
      // The fill moved onto CutSurface when the bar took the A3 shape
      // (2026-08-11): left in the style it would paint a rectangle behind the
      // cut path. Same default, asserted where it now lives.
      assert.match(bottomTabBarSource, /const pillBackground = themeName === 'dark' \? theme\.surfaceSoft : BAR\.pill/);
      assert.match(bottomTabBarSource, /<CutSurface size="lg" fill=\{pillBackground\}/);
      assert.match(bottomTabBarSource, /activeTab: RootTabKey \| null/);
      assert.match(bottomTabBarSource, /activeKey === tab\.key/);
      assert.match(appSource, /activeTab=\{route\.tab === 'workout' && route\.screen === 'plans' \? null : route\.tab\}/);
      assert.match(bottomTabBarSource, /const stroke = active \? theme\.highlight/);
      assert.match(bottomTabBarSource, /const fill = active \? theme\.highlight/);
      assert.match(bottomTabBarSource, /indicator:\s*\{[\s\S]*backgroundColor: theme\.highlightSoft/);
      assert.match(bottomTabBarSource, /borderRadius: HIGHLIGHT \/ 2/);
      assert.match(bottomTabBarSource, /Animated\.spring\(indicatorX/);
      // Icon-only tabs (labels removed), larger icons, a11y label preserved.
      assert.doesNotMatch(bottomTabBarSource, /sideLabel/);
      assert.match(bottomTabBarSource, /const size = 26/);
      assert.match(bottomTabBarSource, /accessibilityLabel=\{label\}/);
      // Center "AI" button (design_handoff_ai_button): near-white radial fill + "AI"
      // label + purple halo/glow. Sized down from the 48px spec.
      assert.match(bottomTabBarSource, /const AI_SIZE = 46/);
      assert.match(bottomTabBarSource, />AI<\/Text>/);
      assert.match(bottomTabBarSource, /url\(#aiFill\)/);
      assert.match(bottomTabBarSource, /centerGlow:\s*\{[\s\S]*shadowColor: theme\.purpleBright/);
      assert.match(bottomTabBarSource, /aiCircle:\s*\{[\s\S]*width: AI_SIZE/);
      assert.match(bottomTabBarSource, /queryReduceMotion\(\)/);
      assert.match(bottomTabBarSource, /fabPop\.setValue\(1\)/);
      assert.match(bottomTabBarSource, /Easing\.bezier\(0\.3, 1\.3, 0\.5, 1\)/);
      assert.match(bottomTabBarSource, /delay: 500/);
      assert.match(bottomTabBarSource, /delay: 240/);
    },
  },
  {
    /**
     * TÄNÄÄN is a claim about the calendar.
     *
     * The row computed `const isToday = activePlan.nextSession?.id ===
     * session.id` — a variable named for the calendar and meaning "is next".
     * No clock came near it, so the badge followed the rotation and was right
     * only by coincidence.
     */
    name: 'the TODAY badge reads the calendar and the outline reads the plan',
    run() {
      assert.match(homeScreenSource, /const todayWeekdayCode = weekdayCodeForDate\(new Date\(\)\)/);
      assert.match(homeScreenSource, /const isToday = weekday !== null && weekday === todayWeekdayCode/);
      assert.match(homeScreenSource, /const isNext = activePlan\.nextSession\?\.id === session\.id/);
      // The outline is the plan's mark, the pill is the calendar's.
      assert.match(homeScreenSource, /stroke=\{isNext \? theme\.purpleBright : undefined\}/);
      assert.doesNotMatch(homeScreenSource, /const isToday = activePlan\.nextSession/);
    },
  },
  {
    /**
     * "Today is legs, not upper."
     *
     * The rotation decides what comes next in the programme and cannot know
     * what happened to the reader's day. Before this, the only way to train
     * something else was to leave Home for the programme screen and start a
     * session from the list there.
     */
    name: "today's workout can be changed from the title, for one day only",
    run() {
      // The title is the switch: a reader looking at the wrong workout reaches
      // for its name first.
      assert.match(homeScreenSource, /onPress=\{\(\) => setTodaySheetVisible\(true\)\}/);
      assert.match(homeScreenSource, /onPickTodaySession\?\.\(session\.id\)/);
      // One session is not a choice.
      assert.match(homeScreenSource, /planSessions\.length < 2/);

      // Dated, not sticky. A pick that outlived its day would quietly replace
      // the programme's rotation with one session forever.
      const handlerStart = appSource.indexOf('async function handlePickTodaySession(');
      assert.ok(handlerStart > 0, 'handlePickTodaySession not found');
      const handler = appSource.slice(handlerStart, handlerStart + 800);
      assert.match(handler, /todaySession: \{/);
      assert.match(handler, /dayStart:/);

      // And the card only honours it while that day IS today.
      assert.match(appSource, /preferences\.todaySession\.dayStart === todayDayStart/);

      // The pencil is offered only where a rename can actually land: the
      // catalog's templates are immutable at runtime.
      assert.match(
        appSource,
        /homeActivePlanCard\?\.programType === 'custom'\s*\r?\n\s*\? \(sessionId, name\) =>/,
      );
    },
  },

  {
    /**
     * The week list carried two chips that predicted — TÄNÄÄN from the
     * calendar, SEURAAVAKSI from the rotation — and on any day those differ the
     * reader has to work out which one the row's outline meant. Asked for
     * 2026-08-21: show what was done instead.
     */
    name: 'the week list reports what happened rather than predicting',
    run() {
      assert.doesNotMatch(homeScreenSource, /'programs\.today'/);
      assert.doesNotMatch(homeScreenSource, /t\(language, 'plan\.upNext'\)\s*\}/);
      assert.match(homeScreenSource, /doneThisWeekSessionIds\.includes\(session\.id\)/);
      assert.match(i18nSource, /'home\.plan\.doneThisWeek': 'Tehty'/);

      // And the hero carries no label of its own: the answer to a name being
      // misread turned out to be fewer words, not better ones.
      assert.doesNotMatch(homeScreenSource, /'home\.hero\.nextUp'/);
      assert.doesNotMatch(homeScreenSource, /'home\.hero\.loggedToday'/);
    },
  },

  {
    name: 'an unknown training week asks for the days instead of guessing them',
    run() {
      // setupAvailableDays is only written when the user explicitly picks
      // weekdays: the ready-program path never asks, and neither does the
      // guided path when the app is left to decide. That left the calendar,
      // the week strip and the home widget blank with no route to fill them.
      // Four writers, on purpose: onboarding, the weekday picker, the reset,
      // and the rhythm strip on the programme screen — the last one added when
      // the two halves of the week were joined, so moving a day there moves the
      // reminders too. None of them fills an unknown week without being asked.
      const writes = appSource.match(/setupAvailableDays: [^,\r\n]+/g) ?? [];
      assert.ok(
        writes.length <= 4,
        'a new setupAvailableDays writer appeared — check whether the empty-week prompt is still needed',
      );

      // The blank asks the question. It must never answer it: deriving
      // Mon/Wed/Fri from "3 a week" is the invention the dots exist to avoid.
      assert.match(homeScreenSource, /home\.calendar\.setDays/);
      assert.match(homeScreenSource, /onSetTrainingDays/);
      // editSchedule: true, because landing on a read-only schedule with an
      // Edit button is not what "Pick your training days" promised.
      assert.match(appSource, /screen: 'training_plan', editSchedule: true/);
      assert.match(appSource, /startEditingSchedule=\{route\.editSchedule === true\}/);

      // The dots themselves stay gated on real data in both calendar views.
      // The gate is a schedule now rather than a weekday count, because a
      // rhythm need not repeat every seven days — but it is still a gate.
      assert.match(homeScreenSource, /const scheduleKnown = isScheduleKnown\(trainingSchedule\)/);
      assert.match(homeScreenSource, /weekStripDotUnknown/);
    },
  },
];
