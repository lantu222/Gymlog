const assert = require('node:assert/strict');

const {
  PROGRAM_SEASONS,
  getProgramSeason,
  getSeasonForDate,
  getSeasonProgramIds,
  orderSeasons,
  getSeasonProgramTitleKey,
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
    /**
     * Seasons are PARKED, not deleted (decision 2026-08-31).
     *
     * The distinction is the whole point of this test. Parked means the tab's
     * entry point is gone and everything behind it still works, so bringing it
     * back is putting a section back rather than rebuilding a feature. Half a
     * removal — a screen nobody can reach and nobody remembers is parked —
     * rots, and this repo has already lost a screen that way.
     */
    name: 'seasons are parked: off the tab, intact behind it',
    run() {
      const fs = require('node:fs');
      const path = require('node:path');
      const read = (...segments) => fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');
      // Comments stripped first. The tab carries a note explaining that
      // seasons are parked, and a guard that trips on its own explanation is
      // a guard that teaches people to delete the explanation.
      const stripComments = (source) =>
        source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
      const screen = stripComments(read('src', 'screens', 'ProgramsHomeScreen.tsx'));
      const workoutTab = read('src', 'app', 'renderWorkoutTab.tsx');

      // Off the tab: no cards, no rows, no sheet variant that opened one.
      assert.doesNotMatch(screen, /seasonCards/, 'the season cards are back on the tab');
      assert.doesNotMatch(screen, /seasonRows/, 'the tab reads season rows again');
      assert.doesNotMatch(screen, /kind: 'season'/, 'the season sheet variant is back');

      // Intact behind it: the route, the screen, and everything the screen
      // needs to answer for itself.
      assert.match(workoutTab, /route\.screen === 'season'/, 'the season route is gone, not parked');
      assert.match(workoutTab, /<SeasonScreen/, 'SeasonScreen is no longer rendered anywhere');
      assert.match(workoutTab, /resolveSeasonWindow\(\)/);
      assert.match(workoutTab, /getSeasonProgramId\(seasonInView\)/);

      // And the libraries the screen stands on still resolve. A parked feature
      // whose data source rotted is not parked.
      const { SEASON_PROGRAM_IDS } = require('../../.test-dist/lib/programSeasons.js');
      assert.ok(SEASON_PROGRAM_IDS.summer && SEASON_PROGRAM_IDS.winter);

      // Free, still: no entitlement check anywhere on the season path.
      assert.doesNotMatch(
        read('src', 'screens', 'SeasonScreen.tsx'),
        /isProUnlocked|programSlots/,
        'a Pro gate appeared on the season screen while it was parked',
      );
    },
  },
  {
    name: 'a season programme goes by the season name, others keep their own',
    run() {
      const assert = require('node:assert/strict');
      const { SEASON_PROGRAM_IDS } = require('../../.test-dist/lib/programSeasons.js');
      assert.equal(getSeasonProgramTitleKey(SEASON_PROGRAM_IDS.summer), 'season.programTitle.summer');
      assert.equal(getSeasonProgramTitleKey(SEASON_PROGRAM_IDS.winter), 'season.programTitle.winter');
      // Not a season programme: no rename, it keeps its catalogue name.
      assert.equal(getSeasonProgramTitleKey('tpl_not_a_season'), null);
    },
  },
];