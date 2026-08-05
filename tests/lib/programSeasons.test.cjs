const assert = require('node:assert/strict');

const {
  PROGRAM_SEASONS,
  getProgramSeason,
  getSeasonForDate,
  getSeasonProgramIds,
  orderSeasons,
} = require('../../.test-dist/lib/programSeasons.js');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

const CATALOG_IDS = new Set(WORKOUT_TEMPLATES_V1.map((template) => template.id));

module.exports = [
  {
    name: 'every seasonal id is a program that exists',
    run() {
      // The trap this guards is a quiet one: a mistyped id does not throw, it
      // just never matches, and the season row renders one program short with
      // nothing to indicate anything is wrong. Same failure mode as the swap
      // pools that sat untranslated for months because their guard only walked
      // the catalog.
      const unknown = Object.keys(PROGRAM_SEASONS).filter((id) => !CATALOG_IDS.has(id));
      assert.deepEqual(unknown, [], `not in the catalog: ${unknown.join(', ')}`);
    },
  },
  {
    name: 'both seasons have enough programs to be worth a row',
    run() {
      const winter = getSeasonProgramIds('winter');
      const summer = getSeasonProgramIds('summer');
      // A row with two entries reads as an oversight rather than a selection.
      assert.ok(winter.length >= 8, `winter has ${winter.length}`);
      assert.ok(summer.length >= 8, `summer has ${summer.length}`);
      // And no program can be in both, which a hand-written map makes possible.
      assert.equal(winter.filter((id) => summer.includes(id)).length, 0);
    },
  },
  {
    name: 'most of the catalog belongs to no season, on purpose',
    run() {
      // Deriving the season from goalType would sort all 55 into two buckets
      // and file Prenatal Fitness under summer cutting. Saying "this one is
      // not seasonal" is the more useful answer for most of them.
      const seasonal = Object.keys(PROGRAM_SEASONS).length;
      assert.ok(seasonal < CATALOG_IDS.size * 0.7, `${seasonal} of ${CATALOG_IDS.size} is too many`);
      for (const id of ['tpl_gainer_prenatal_fitness_v1', 'tpl_gainer_postpartum_recovery_v1']) {
        assert.equal(getProgramSeason(id), null, `${id} must not be seasonal`);
      }
      assert.equal(getProgramSeason('tpl_does_not_exist'), null);
    },
  },
  {
    name: 'the season follows the daylight, not the calendar quarter',
    run() {
      // October to March is winter: by October the evenings are dark enough
      // that outdoor training stops being the default, and it does not come
      // back until April.
      for (const month of [9, 10, 11, 0, 1, 2]) {
        assert.equal(getSeasonForDate(new Date(2026, month, 15)), 'winter', `month ${month}`);
      }
      for (const month of [3, 4, 5, 6, 7, 8]) {
        assert.equal(getSeasonForDate(new Date(2026, month, 15)), 'summer', `month ${month}`);
      }
    },
  },
  {
    name: 'the current season leads, and the other stays reachable',
    run() {
      // Someone cutting for a holiday in January is not doing anything wrong,
      // so both rows always exist — the order is the only thing that moves.
      assert.deepEqual(orderSeasons(new Date(2026, 10, 1)), ['winter', 'summer']);
      assert.deepEqual(orderSeasons(new Date(2026, 5, 1)), ['summer', 'winter']);
    },
  },
  {
    name: 'the season rows are rendered, free, and built from the catalog',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const read = (...segments) => fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
      const screen = read('src', 'screens', 'ProgramsHomeScreen.tsx');
      const app = read('App.tsx');

      // A lib with no consumer is dead code by the standard applied to the
      // rest of this app, so the row has to be reachable on the screen.
      //
      // It is no longer two permanently open rails. "Kesäkausi" and
      // "Talvikausi" both sat fully expanded under the four season tiles, in
      // the same card size as every other row, which made the tiles above them
      // decoration and gave the page two more identical rows. The tile is the
      // filter now, and the rail is what a tap opens.
      assert.doesNotMatch(screen, /seasonRows\.map\(\(row\) =>/);
      assert.match(screen, /seasonRows\.find\(\(row\) => row\.season === sheet\.season\)/);
      // A season is a dated window with a screen of its own now, not four
      // tiles over two blocks that narrowed a list. The row shows exactly two
      // cards — the season running and the one after it — and the card opens
      // the season rather than filtering anything.
      assert.doesNotMatch(screen, /orderSeasonTiles/);
      assert.match(screen, /seasonCards\.map\(\(card\) =>/);
      assert.match(screen, /onOpenSeason\(card\.season\)/);
      assert.match(app, /navigate\(\{ tab: 'workout', screen: 'season', season \}\)/);
      // Two, never four: the row is "what is running and what is next".
      assert.match(app, /return \[build\(current, true\), build\(next, false\)\];/);
      // "Poista suodatin" is gone with the rail it belonged to. With nothing
      // selected the section had no rail at all, so the link read as "remove
      // the seasons" — which is what the reader saw it do.
      assert.doesNotMatch(screen, /programs\.cat\.clear/);
      assert.match(app, /seasonRows=\{programsSeasonRows\}/);

      // Built from workout.templates rather than a parallel list, so a season
      // cannot drift into offering a program the catalog no longer has.
      assert.match(app, /getSeasonProgramIds\(season\)[\s\S]{0,120}byId\.get\(id\)/);

      // Free. Seasonal content is the reason to open the app in November, and
      // no entitlement check may appear on this path.
      const rows = app.slice(app.indexOf('const programsSeasonRows'), app.indexOf('const programsCustomItems'));
      assert.doesNotMatch(rows, /proUnlocked|isProUnlocked|programSlots/);
    },
  },
];
