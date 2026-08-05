const assert = require('assert');
const fs = require('fs');
const path = require('path');

const programsHomeSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'ProgramsHomeScreen.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'App.tsx'), 'utf8');
const routesSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'navigation', 'routes.ts'), 'utf8');
const bottomTabBarSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'BottomTabBar.tsx'),
  'utf8',
);
const modelsSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'types', 'models.ts'), 'utf8');
const databaseSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'), 'utf8');
const seedSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'seed.ts'), 'utf8');
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

module.exports = [
  {
    name: 'programs tab is gated by a default-off flag and a dedicated route',
    run() {
      // Feature flag: typed, normalized like the other booleans, and defaulted
      // ON (phase 4) so the Programs tab is the live landing page; flipping the
      // seed default back to false is the data-free rollback.
      assert.match(modelsSource, /programsTabEnabled: boolean/);
      assert.match(seedSource, /programsTabEnabled: true/);
      assert.match(databaseSource, /programsTabEnabled:\s*\n?\s*typeof input\?\.preferences\?\.programsTabEnabled === 'boolean'/);
      // Dedicated route, not the legacy list.
      assert.match(routesSource, /tab: 'workout';\s*screen: 'programs_home';/);
      // Tab press honours the flag; default (off) keeps the legacy behaviour.
      assert.match(appSource, /if \(tab === 'workout' && preferences\.programsTabEnabled\)/);
      assert.match(appSource, /resetToRoute\(\{ tab: 'workout', screen: 'programs_home' \}\)/);
    },
  },
  {
    name: 'programs tab is labelled Programs with a layers icon (internal key unchanged)',
    run() {
      assert.match(bottomTabBarSource, /\{ key: 'workout', labelKey: 'tabs\.programs' \}/);
      assert.doesNotMatch(bottomTabBarSource, /label: 'Exercises'/);
      // Layers glyph replaces the dumbbell rects for the workout tab.
      assert.match(bottomTabBarSource, /Programs = a stacked-layers glyph/);
    },
  },
  {
    name: 'programs home screen composes photo hero, this-week plan, actions, switch rail, and library',
    run() {
      assert.match(programsHomeSource, /useThemedStyles\(makeStyles\)/);
      // Redesign: no screen header — the full-bleed photo-placeholder hero leads.
      assert.doesNotMatch(programsHomeSource, /Your plan, and the programs behind it\./);
      assert.match(programsHomeSource, /programsHeroScrim/);
      assert.match(programsHomeSource, /t\(language, 'programs\.activeProgram'\)/);
      assert.match(i18nSource, /'programs\.activeProgram': 'ACTIVE PROGRAM'/);
      assert.match(programsHomeSource, /activeProgram\.weekLabel/);
      assert.match(programsHomeSource, /phaseNote\(currentWeek, totalWeeks, language\)/);
      assert.match(programsHomeSource, /Array\.from\(\{ length: totalWeeks \}/);
      assert.match(programsHomeSource, /index < currentWeek \? styles\.heroSegmentFilled : styles\.heroSegmentEmpty/);
      // THIS WEEK plan: day rows land on the saved plan's own weekday labels
      // (weekday truth, P6). TODAY highlight stays; the old next-session Start
      // strip is intentionally gone.
      assert.match(programsHomeSource, /t\(language, 'programs\.thisWeek', \{ count: activeProgram\.sessionsPerWeek \}\)/);
      assert.match(i18nSource, /'programs\.thisWeek': 'THIS WEEK · \{count\} DAYS \/ WEEK'/);
      assert.match(programsHomeSource, /function resolveSessionWeekday\(/);

      // The generic spread fills a GAP in a week that has real weekdays; it
      // must never invent the whole week. With nothing scheduled this screen
      // showed MA/KE/PE while Home and Progress showed nothing for the same
      // plan, because those two refuse to invent a rhythm and this one did not.
      assert.match(programsHomeSource, /anyFixedWeekday \? weekdayForSession\(index, sessionCount\) : null/);
      assert.match(programsHomeSource, /const anyFixedWeekday = allSessions\.some\(/);
      // Unknown weekday falls back to the session number, not a made-up day.
      assert.match(programsHomeSource, /: `\$\{index \+ 1\}`/);
      assert.match(programsHomeSource, /dayRowToday/);
      assert.match(programsHomeSource, /t\(language, 'programs\.today'\)/);
      assert.doesNotMatch(programsHomeSource, /NEXT SESSION/);
      // Actions: solid-accent View full plan, sub-actions, outlined New program → sheet.
      assert.match(programsHomeSource, /t\(language, 'programs\.viewPlan'\)/);
      assert.match(programsHomeSource, /t\(language, 'programs\.swapExercises'\)/);
      assert.match(i18nSource, /'programs\.swapExercises': 'Swap exercises'/);
      assert.match(programsHomeSource, /onPress=\{onAdjustSchedule\}/);
      assert.match(programsHomeSource, /t\(language, 'csv\.newProgram'\)/);
      assert.match(programsHomeSource, /setCreateOpen\(true\)/);
      assert.match(programsHomeSource, /<NewProgramSheet/);
      // Switch rail: designed gradient covers (oklch pre-converted to sRGB), not
      // photos. Tapping a card opens the switch-program sheet.
      assert.match(programsHomeSource, /programs\.switchProgram/);
      assert.doesNotMatch(programsHomeSource, /EXPLORE PROGRAMS/);
      assert.match(programsHomeSource, /const COVER_STYLES/);
      assert.match(programsHomeSource, /function ProgramCover/);
      assert.match(programsHomeSource, /RadialGradient/);
      // The rail is filterable now: no category shows the curated eight,
      // a category shows the whole catalog narrowed to it. A tile saying
      // "Voima 8" filtering the curated list would have opened three.
      assert.match(programsHomeSource, /category === null[\s\S]{0,40}exploreItems/);
      assert.match(programsHomeSource, /categoryMembers\[category\]/);
      assert.match(programsHomeSource, /onPress=\{\(\) => setPicked\(item\)\}/);
      // The cover meta went through the dictionary after an emulator pass
      // found "3d / wk", "3 days / week", "Muscle" and "Strength" on cards
      // in the Finnish app — directly under category chips reading the same
      // words in Finnish.
      assert.match(programsHomeSource, /'programs\.card\.daysShort'/);
      assert.doesNotMatch(programsHomeSource, /days \/ week|\}d \/ wk/);
      // An emulator pass found four more English strings on this screen in
      // the Finnish app. A grep is cheaper than another pass: no bare
      // English sentence may sit in JSX here.
      assert.doesNotMatch(programsHomeSource, /exercises · browse|browse &amp; swap/);
      assert.match(programsHomeSource, /'programs\.library\.sub'/);
      // Switch-program sheet: explainer + Cancel / Switch program; confirm opens
      // the picked program (existing ready-program detail path).
      assert.match(programsHomeSource, /Switching starts a fresh block/);
      assert.match(programsHomeSource, /programs\.switchConfirm/);
      assert.match(programsHomeSource, /onOpenExploreProgram\(id\)/);
      // Your programs + create + library.
      assert.match(programsHomeSource, /programs\.yourPrograms/);
      assert.match(programsHomeSource, /customPrograms\.map/);
      assert.match(programsHomeSource, /programs\.create/);
      assert.match(programsHomeSource, /programs\.exerciseLibrary/);
      assert.match(programsHomeSource, /count: exerciseLibraryCount/);
      // Empty state when there is no active program.
      assert.match(programsHomeSource, /programs\.noActive/);
    },
  },
  {
    name: 'app wires programs home to real stores and existing handlers',
    run() {
      assert.match(appSource, /import \{ ProgramsHomeScreen, ProgramsExploreItem \} from '\.\/src\/screens\/ProgramsHomeScreen'/);
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'programs_home'/);
      // Active program reuses the already-computed home plan card.
      assert.match(appSource, /activeProgram=\{\s*homeActivePlanCard/);
      // Explore comes from the ready templates via getReadyProgramContent, each
      // assigned one of the designed cover styles.
      assert.match(appSource, /const programsExploreItems = useMemo<ProgramsExploreItem\[\]>/);
      assert.match(appSource, /getReadyProgramContent\(template\.id, preferences\.appLanguage\)\?\.summary/);
      assert.match(appSource, /coverIndex: index % 5/);
      assert.match(appSource, /const programsCustomItems = useMemo/);
      // Handlers reuse existing navigation, nothing new invented.
      assert.match(appSource, /onOpenExploreProgram=\{handleOpenReadyProgramDetail\}/);
      assert.match(appSource, /onOpenCustomProgram=\{handleOpenCustomProgramDetail\}/);
      assert.match(appSource, /onViewAllPrograms=\{\(\) => navigate\(WORKOUT_PLAN_ROUTE\)\}/);
      assert.match(appSource, /onOpenLibrary=\{\(\) => navigate\(\{ tab: 'workout', screen: 'list' \}\)\}/);
      // Status-bar/shell treatment matches the other light workout screens.
      assert.match(appSource, /const programsHomeActive = route\.tab === 'workout' && route\.screen === 'programs_home'/);
    },
  },
  {
    name: 'bottom bar center action is the AI button with no text caption',
    run() {
      assert.doesNotMatch(bottomTabBarSource, /<Text[^>]*centerLabel[^>]*>Start<\/Text>/);
      assert.doesNotMatch(bottomTabBarSource, /styles\.centerLabel/);
      // The center action is the raised "AI" button; a11y label preserved.
      assert.match(bottomTabBarSource, /accessibilityLabel=\{t\(language, 'tabs\.aiCoach'\)\}/);
    },
  },
];
