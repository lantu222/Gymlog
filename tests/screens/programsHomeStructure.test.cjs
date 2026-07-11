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
      assert.match(bottomTabBarSource, /\{ key: 'workout', label: 'Programs' \}/);
      assert.doesNotMatch(bottomTabBarSource, /label: 'Exercises'/);
      // Layers glyph replaces the dumbbell rects for the workout tab.
      assert.match(bottomTabBarSource, /Programs = a stacked-layers glyph/);
    },
  },
  {
    name: 'programs home screen composes active program, explore, your programs, and library',
    run() {
      assert.match(programsHomeSource, /import \{ HG3 \} from '\.\.\/lightTheme'/);
      assert.match(programsHomeSource, />Programs<\/Text>/);
      assert.match(programsHomeSource, /Your plan, and the programs behind it\./);
      // Active program card: eyebrow, week label, segmented block bar, tags,
      // next-session Start, and the view-plan row.
      assert.match(programsHomeSource, /ACTIVE PROGRAM/);
      assert.match(programsHomeSource, /activeProgram\.weekLabel/);
      assert.match(programsHomeSource, /Array\.from\(\{ length: totalWeeks \}/);
      assert.match(programsHomeSource, /index < currentWeek \? styles\.segmentFilled : styles\.segmentEmpty/);
      assert.match(programsHomeSource, /activeProgram\.sessionsPerWeek\} days \/ week/);
      assert.match(programsHomeSource, /NEXT SESSION/);
      assert.match(programsHomeSource, /onStartActiveSession\(nextSession\.id\)/);
      assert.match(programsHomeSource, /View plan, edit days &amp; swap exercises/);
      // Explore is a horizontal carousel of ready programs.
      assert.match(programsHomeSource, /EXPLORE PROGRAMS/);
      assert.match(programsHomeSource, /exploreItems\.map/);
      assert.match(programsHomeSource, /onOpenExploreProgram\(item\.id\)/);
      // Your programs + create + library.
      assert.match(programsHomeSource, /YOUR PROGRAMS/);
      assert.match(programsHomeSource, /customPrograms\.map/);
      assert.match(programsHomeSource, /Create a program/);
      assert.match(programsHomeSource, /Exercise library/);
      assert.match(programsHomeSource, /\{exerciseLibraryCount\} exercises/);
      // Empty state when there is no active program.
      assert.match(programsHomeSource, /No active program/);
    },
  },
  {
    name: 'app wires programs home to real stores and existing handlers',
    run() {
      assert.match(appSource, /import \{ ProgramsHomeScreen, ProgramsExploreItem \} from '\.\/src\/screens\/ProgramsHomeScreen'/);
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'programs_home'/);
      // Active program reuses the already-computed home plan card.
      assert.match(appSource, /activeProgram=\{\s*homeActivePlanCard/);
      // Explore comes from the ready templates via getReadyProgramContent.
      assert.match(appSource, /const programsExploreItems = useMemo<ProgramsExploreItem\[\]>/);
      assert.match(appSource, /getReadyProgramContent\(template\.id\)\?\.summary/);
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
];
