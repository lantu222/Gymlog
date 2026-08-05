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
    name: 'programs tab is browsing only: hero, tiles, seasons, trending, library',
    run() {
      assert.match(programsHomeSource, /useThemedStyles\(makeStyles\)/);
      assert.doesNotMatch(programsHomeSource, /Your plan, and the programs behind it\./);

      // The active program is GONE from this tab. It led the screen behind a
      // 320px photo hero, which meant the reader had to leave the screen they
      // were already on to find out what week they are in. It lives on Home
      // now; keeping a copy here would give the same week two owners.
      assert.doesNotMatch(programsHomeSource, /programsHeroScrim/);
      assert.doesNotMatch(programsHomeSource, /programs\.thisWeek/);
      assert.doesNotMatch(programsHomeSource, /styles\.dayRow\b/);
      assert.doesNotMatch(programsHomeSource, /programs\.noActive/);
      assert.doesNotMatch(programsHomeSource, /onStartActiveSession/);
      // What survives is the program's NAME, because the switch sheet says
      // what you are leaving.
      assert.match(programsHomeSource, /activeProgramTitle/);

      assert.doesNotMatch(programsHomeSource, /onAdjustSchedule/);

      // Exactly ONE way to start a new program on this page. There were two,
      // one at the top and one at the bottom, and both were the same action.
      assert.equal((programsHomeSource.match(/setCreateOpen\(true\)/g) ?? []).length, 2,
        'one button plus the campaign slide, and nothing else, may open the sheet');
      assert.doesNotMatch(programsHomeSource, /t\(language, 'csv\.newProgram'\)/);
      assert.match(programsHomeSource, /<NewProgramSheet/);

      // Designed gradient covers (oklch pre-converted to sRGB), not photos.
      assert.doesNotMatch(programsHomeSource, /EXPLORE PROGRAMS/);
      assert.match(programsHomeSource, /const COVER_STYLES/);
      assert.match(programsHomeSource, /function ProgramCover/);
      assert.match(programsHomeSource, /RadialGradient/);

      // Categories are TILES, not text chips. Colour and shape are read
      // before a word is, which is the only reason a browse row is coloured;
      // the first build quietly shipped nine identical grey pills instead.
      assert.match(programsHomeSource, /styles\.catTile\b/);
      assert.match(programsHomeSource, /d=\{entry\.icon\}/);
      assert.match(programsHomeSource, /stroke=\{entry\.tint\.ink\}/);
      assert.match(programsHomeSource, /backgroundColor: entry\.tint\.bg/);
      // A tile that says 8 has to open 8: the count and the rail read the
      // same source.
      assert.match(programsHomeSource, /categoryCounts\[entry\.key\]/);
      assert.match(programsHomeSource, /categoryMembers\[category\]/);
      // The catalog rail only exists once a tile is tapped — an always-open
      // rail underneath made the tiles above look decorative.
      assert.match(programsHomeSource, /\{category !== null \?/);
      assert.match(programsHomeSource, /onPress=\{\(\) => setPicked\(item\)\}/);

      // The rotating hero, and the four season tiles.
      assert.match(programsHomeSource, /function CampaignHero/);
      assert.match(programsHomeSource, /setInterval\(/);
      // Touching it stops the timer for good: a card that moves under your
      // thumb while you read it is hostile.
      assert.match(programsHomeSource, /onScrollBeginDrag=\{\(\) => setRunning\(false\)\}/);
      assert.match(programsHomeSource, /orderSeasonTiles\(\)\.map/);
      assert.match(programsHomeSource, /currentSeasonTile\(\)/);
      // Every slide and tile goes somewhere real, including the season CTA,
      // which scrolls to a measured offset rather than a guessed one.
      assert.match(programsHomeSource, /const handleCampaignTarget = \(target: CampaignTarget\)/);
      assert.match(programsHomeSource, /seasonOffset\.current = event\.nativeEvent\.layout\.y/);

      // Continue: real logged work only.
      assert.match(programsHomeSource, /continueItems\.length > 0/);
      assert.match(programsHomeSource, /'programs\.continue\.sessions'/);

      // Cards come in three sizes now. A page where five sections draw the
      // same 274×176 card has told the reader nothing about what matters.
      const sizes = new Set(
        [...programsHomeSource.matchAll(/width=\{(\d+)\}\s*\n\s*height=\{(\d+)\}/g)].map(
          (match) => `${match[1]}x${match[2]}`,
        ),
      );
      assert.ok(sizes.size >= 2, `covers still draw at one size: ${[...sizes].join(', ')}`);

      // Trending has a way out of it.
      assert.match(programsHomeSource, /'programs\.trending\.all'/);
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
      //
      // This sheet shipped in English inside a Finnish screen for weeks,
      // together with an "or 'program'" fallback that named nothing. Both the
      // sentence and the meta line go through the dictionary now.
      assert.doesNotMatch(programsHomeSource, /Switching starts a fresh block/);
      assert.doesNotMatch(programsHomeSource, /\?\? 'program'/);
      assert.match(programsHomeSource, /'programs\.switchSheet\.body'/);
      assert.match(programsHomeSource, /'programs\.switchSheet\.meta'/);
      assert.match(programsHomeSource, /programs\.switchConfirm/);
      assert.match(programsHomeSource, /onOpenExploreProgram\(id\)/);
      // Your programs + create + library.
      assert.match(programsHomeSource, /programs\.yourPrograms/);
      assert.match(programsHomeSource, /customPrograms\.map/);
      assert.match(programsHomeSource, /programs\.create/);
      assert.match(programsHomeSource, /programs\.exerciseLibrary/);
      assert.match(programsHomeSource, /count: exerciseLibraryCount/);
    },
  },
  {
    name: 'app wires programs home to real stores and existing handlers',
    run() {
      assert.match(appSource, /import \{ ProgramsHomeScreen, ProgramsExploreItem \} from '\.\/src\/screens\/ProgramsHomeScreen'/);
      assert.match(appSource, /route\.tab === 'workout' && route\.screen === 'programs_home'/);
      // App hands this tab the program's NAME and nothing else; the plan
      // card itself goes to Home, which is the screen that runs it.
      assert.match(appSource, /activeProgramTitle=\{homeActivePlanCard\?\.title \?\? null\}/);
      assert.match(appSource, /onOpenActivePlan=\{\(\) => \{/);
      // The curated eight-program Explore rail is gone with the always-open
      // catalog row it fed; the category tiles are the way in now.
      assert.doesNotMatch(appSource, /const programsExploreItems = useMemo/);
      assert.match(appSource, /getReadyProgramContent\(template\.id, preferences\.appLanguage\)\?\.summary/);
      assert.match(appSource, /coverIndex: index % 5/);
      assert.match(appSource, /const programsCustomItems = useMemo/);
      // Continue is built from logged sessions, and never from the active
      // program — that one already owns the hero and the whole week above.
      assert.match(appSource, /resolveContinueEntries\(workoutSessions, \{/);
      assert.match(appSource, /excludeTemplateId: homeActivePlanCard\?\.programId \?\? null/);
      // Campaign counts read the same catalog the tiles filter, so a slide
      // cannot advertise a season with nothing in it.
      assert.match(appSource, /seasonCount: programsSeasonTileCounts\[getSeasonForDate\(\)\]/);
      assert.match(appSource, /exerciseCount: exerciseBrowserItems\.length/);
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
