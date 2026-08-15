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

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
}

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
      // The screen no longer PICKS the style — it paints the one the item
      // carries, chosen from the programme's family in App.tsx (2026-08-13).
      // Picking here is what let the rail disagree with the catalog.
      assert.doesNotMatch(programsHomeSource, /EXPLORE PROGRAMS/);
      assert.match(programsHomeSource, /const style = item\.cover;/);
      assert.doesNotMatch(programsHomeSource, /COVER_STYLES\[/);
      assert.match(programsHomeSource, /function ProgramCover/);
      assert.match(programsHomeSource, /RadialGradient/);

      // Categories are TILES, not text chips. Colour and shape are read
      // before a word is, which is the only reason a browse row is coloured;
      // the first build quietly shipped nine identical grey pills instead.
      assert.match(programsHomeSource, /styles\.catTile\b/);
      assert.match(programsHomeSource, /d=\{entry\.icon\}/);
      assert.match(programsHomeSource, /stroke=\{entry\.tint\.ink\}/);
      // A3: the tile is a drawn shape now, so the tint is the path's fill and
      // its stroke rather than a background colour.
      assert.match(programsHomeSource, /fill=\{entry\.tint\.bg\}/);
      // Near-black at 2.4, not the tint's own pale border at 1: nine pastel
      // tiles side by side had nothing holding them apart, and the count badge
      // sat ON the cut corner, which sliced the digit in half.
      assert.match(programsHomeSource, /stroke=\{theme\.ink\}[\s\S]{0,60}strokeWidth=\{2\.4\}/);
      assert.match(programsHomeSource, /catTileCount: \{[\s\S]{0,200}bottom: 5,/);
      // A tile that says 8 has to open 8: the count and the rail read the
      // same source.
      assert.match(programsHomeSource, /categoryCounts\[entry\.key\]/);
      assert.match(programsHomeSource, /categoryMembers\[sheet\.key\]/);
      // A tile opens a SHEET, not a rail. Nine categories sharing one
      // horizontal rail gave every one of them the same eight-card shape, no
      // way to narrow further, and nowhere to say what the category is for or
      // what level its programs are.
      assert.match(programsHomeSource, /function ProgramSheet/);
      assert.match(programsHomeSource, /setSheet\(\{ kind: 'category', key: entry\.key \}\)/);
      assert.doesNotMatch(programsHomeSource, /\{category !== null \?/);
      // The level is the one fact that decides whether a program is for this
      // reader, and no card on this screen carried it before.
      assert.match(programsHomeSource, /const LEVEL_FILTERS/);
      assert.match(programsHomeSource, /items\.filter\(\(item\) => item\.level === level\)/);
      assert.match(programsHomeSource, /LEVEL_STYLES\[item\.level\]/);
      // A filter left over from the last category would silently hide
      // programs in the next one.
      assert.match(programsHomeSource, /if \(!visible\) \{[\s\S]{0,40}setLevel\(null\)/);
      // "Avaa kausi" opens the season's SCREEN. It opened the sheet — a bare
      // list of that season's programs — which is what the button was for
      // before the season had a screen of its own.
      assert.match(programsHomeSource, /case 'season':[\s\S]{0,200}onOpenSeason\(target\.season\)/);

      // Nothing on this tab routes to the old plans list any more. "Näytä
      // kaikki" expands the tiles in place, trending's "Kaikki" opens the
      // whole catalog in the same sheet, and the sheet's own button clears
      // the level filter instead of navigating away from a list it is
      // already showing in full.
      assert.doesNotMatch(programsHomeSource, /onViewAllPrograms/);
      assert.match(programsHomeSource, /setAllCategories\(\(value\) => !value\)/);
      assert.match(programsHomeSource, /setSheet\(\{ kind: 'all' \}\)/);
      assert.match(programsHomeSource, /\{level !== null \? \(/);

      // The rotating hero, and the four season tiles.
      assert.match(programsHomeSource, /function CampaignHero/);
      assert.match(programsHomeSource, /setInterval\(/);
      // Touching it stops the timer for good: a card that moves under your
      // thumb while you read it is hostile.
      assert.match(programsHomeSource, /onScrollBeginDrag=\{\(\) => setRunning\(false\)\}/);
      assert.match(programsHomeSource, /seasonCards\.map\(\(card\) =>/);
      // Every slide and tile goes somewhere real. The season CTA opens the
      // season's sheet now rather than scrolling to a rail that no longer
      // exists.
      assert.match(programsHomeSource, /const handleCampaignTarget = \(target: CampaignTarget\)/);
      assert.doesNotMatch(programsHomeSource, /seasonOffset/);

      // "Jatka siitä mihin jäit" is gone. It listed programmes with logged
      // work as covers you could tap, which is what "Omat ohjelmasi" below it
      // already is and what the active programme on Home already is — three
      // answers to one question.
      assert.doesNotMatch(programsHomeSource, /'programs\.continue/);

      // Cards come in three sizes now. A page where five sections draw the
      // same 274×176 card has told the reader nothing about what matters.
      const sizes = new Set(
        [...programsHomeSource.matchAll(/width=\{(\d+)\}\s*\n\s*height=\{(\d+)\}/g)].map(
          (match) => `${match[1]}x${match[2]}`,
        ),
      );
      assert.ok(sizes.size >= 2, `covers still draw at one size: ${[...sizes].join(', ')}`);

      // Trending has a way out of it, and a ranking that looks like one.
      assert.match(programsHomeSource, /'programs\.trending\.all'/);
      assert.match(programsHomeSource, /const MEDALS/);
      assert.match(programsHomeSource, /<RankMedal index=\{index\} \/>/);
      // Three metals, not four: a fourth would invent a rank that does not
      // exist, so ranks 4 and up keep the plain tile.
      assert.match(programsHomeSource, /const medal = MEDALS\[index\];[\s\S]{0,20}if \(!medal\)/);
      // And the card is not inset twice. It carried marginHorizontal: 20
      // INSIDE the page's own 20px gutter, so it drew 40px narrower than
      // every other block on the screen.
      assert.doesNotMatch(programsHomeSource, /trendingCard: \{[\s\S]{0,12}marginHorizontal/);

      // The tile rows bled 20px past the gutter, so the category and season
      // tiles started left of every heading and card around them.
      assert.match(programsHomeSource, /tileRow: \{[\s\S]{0,40}paddingHorizontal: 20,/);
      // The hero clipped its own CTA at 186: "Avaa kirjasto" was cut off by
      // the card's bottom edge.
      assert.match(programsHomeSource, /const CAMPAIGN_H = 21[0-9];/);
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
      // Identity, not position: `index % 5` painted the same programme a
      // different colour in every list it appeared in. Hashing the id fixed
      // that but scattered each FAMILY across five colours and handed motifs
      // to strangers, so the ready catalog and the Programs tab disagreed
      // about the same programme. The style comes from the family now, with
      // the hash left as the fallback for names that have none (2026-08-13).
      assert.doesNotMatch(appSource, /coverIndex: index % 5/);
      assert.doesNotMatch(appSource, /coverIndex: programCoverIndex\(/);
      assert.match(appSource, /cover: programCoverStyle\(template\.id, template\.name\)/);
      assert.match(appSource, /const programsCustomItems = useMemo/);
      // Continue is built from logged sessions, and never from the active
      // program — that one already owns the hero and the whole week above.
      // Campaign counts read the same catalog the tiles filter, so a slide
      // cannot advertise a season with nothing in it.
      // Weeks, not a programme count: a season has exactly ONE programme, so
      // "10 ohjelmaa kevyempään työhön" advertised a shelf it does not have.
      assert.match(appSource, /seasonWeeks: SEASON_WEEKS/);
      assert.match(appSource, /exerciseCount: exerciseBrowserItems\.length/);
      // Handlers reuse existing navigation, nothing new invented.
      assert.match(appSource, /onOpenExploreProgram=\{handleOpenReadyProgramDetail\}/);
      assert.match(appSource, /onOpenCustomProgram=\{handleOpenCustomProgramDetail\}/);
      assert.match(appSource, /onOpenLibrary=\{\(\) => navigate\(\{ tab: 'workout', screen: 'list' \}\)\}/);
      // ...and the library can be left again. ExercisesScreen declared an
      // onBack prop and then never took it, so the only way out was noticing
      // that tapping the Programs tab resets the screen.
      assert.match(appSource, /<ExercisesScreen[\s\S]{0,200}onBack=\{\(\) => navigateBack/);
      const library = read('src', 'screens', 'ExercisesScreen.tsx');
      assert.match(library, /onBack,/);
      assert.match(library, /onPress=\{onBack\}/);
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
