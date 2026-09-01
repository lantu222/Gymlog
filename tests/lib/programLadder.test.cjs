const assert = require('node:assert/strict');

const {
  availableLadderSorts,
  formatWeeklyLoad,
  pickRecommendedProgram,
  sortProgramLadder,
  shouldShowLevelBadge,
} = require('../../.test-dist/lib/programLadder.js');

/**
 * A family of programmes read as a ladder.
 *
 * The six changes this covers come from a review of the live sheet
 * (2026-08-31): a recommended row that knows the reader, a meta line saying
 * what differs, a level badge only where it adds something, and a sort,
 * because twenty-one rows one step apart are not a list you scan.
 */

const row = (id, days, minutes, weeks, level = 'advanced') => ({ id, days, minutes, weeks, level });

const FAMILY = [
  row('huge_builder', 3, 50, 8, 'beginner'),
  row('huge', 3, 55, 8),
  row('huge_pro', 4, 55, 8),
  row('huge_pro_plus', 5, 55, 12),
  row('huge_advanced', 6, 55, 8),
];

module.exports = [
  {
    name: 'ladder: the meta line multiplies so the reader does not have to',
    run() {
      assert.equal(formatWeeklyLoad(4, 55, 'en'), '4 × 55 min = 3 h 40 / wk');
      assert.equal(formatWeeklyLoad(3, 50, 'en'), '3 × 50 min = 2 h 30 / wk');
      // An exact hour drops the minutes rather than printing "3 h 0".
      assert.equal(formatWeeklyLoad(4, 60, 'en'), '4 × 60 min = 4 h / wk');
      // Under an hour reads as minutes: "0 h 45" is arithmetic, not an amount
      // of training.
      assert.equal(formatWeeklyLoad(1, 45, 'en'), '1 × 45 min = 45 min / wk');
      assert.equal(formatWeeklyLoad(3, 50, 'fi'), '3 × 50 min = 2 h 30 / vk');
    },
  },
  {
    name: 'ladder: a missing or nonsense number does not print NaN at the reader',
    run() {
      for (const [days, minutes] of [[0, 55], [3, 0], [NaN, 55], [3, NaN], [-2, 55]]) {
        const text = formatWeeklyLoad(days, minutes, 'en');
        assert.doesNotMatch(text, /NaN|Infinity|undefined/, `${days} × ${minutes} → ${text}`);
      }
    },
  },
  {
    /**
     * Exact match only. A four-day programme offered to someone who said three
     * is a guess wearing a badge, and this badge is the only thing on the
     * sheet claiming to know anything about the reader.
     */
    name: 'ladder: the recommendation fits the week the reader said they have',
    run() {
      const three = pickRecommendedProgram(FAMILY, 3);
      assert.equal(three.id, 'huge_builder', 'the first exact match wins');

      assert.equal(pickRecommendedProgram(FAMILY, 6).id, 'huge_advanced');

      // Nothing fits: no recommendation rather than the nearest thing.
      assert.equal(pickRecommendedProgram(FAMILY, 2), null);
      // Nothing known about the reader: no recommendation at all.
      assert.equal(pickRecommendedProgram(FAMILY, null), null);
      assert.equal(pickRecommendedProgram(FAMILY, undefined), null);
      assert.equal(pickRecommendedProgram(FAMILY, 0), null);
      assert.equal(pickRecommendedProgram([], 3), null);
    },
  },
  {
    name: 'ladder: recommended floats one row up and keeps the catalog order under it',
    run() {
      const pick = pickRecommendedProgram(FAMILY, 4);
      const sorted = sortProgramLadder(FAMILY, 'recommended', pick);

      assert.equal(sorted[0].id, 'huge_pro');
      assert.deepEqual(
        sorted.slice(1).map((entry) => entry.id),
        ['huge_builder', 'huge', 'huge_pro_plus', 'huge_advanced'],
        'the rest keeps the catalog order, which IS the ladder',
      );
      assert.equal(sorted.length, FAMILY.length, 'the recommended row is moved, not duplicated');

      // With nothing to recommend the order is untouched.
      assert.deepEqual(
        sortProgramLadder(FAMILY, 'recommended', null).map((entry) => entry.id),
        FAMILY.map((entry) => entry.id),
      );
    },
  },
  {
    name: 'ladder: sorting by days or length ignores the recommendation',
    run() {
      const pick = pickRecommendedProgram(FAMILY, 6);

      const byDays = sortProgramLadder(FAMILY, 'days', pick);
      assert.deepEqual(byDays.map((entry) => entry.days), [3, 3, 4, 5, 6]);
      assert.notEqual(byDays[0].id, pick.id, 'an explicit sort is the reader overriding the offer');

      const byLength = sortProgramLadder(FAMILY, 'length', pick);
      assert.deepEqual(byLength.map((entry) => entry.weeks), [8, 8, 8, 8, 12]);

      // Ties break on id, so the same family never shuffles between renders.
      assert.deepEqual(
        sortProgramLadder(FAMILY, 'days', null).slice(0, 2).map((entry) => entry.id),
        ['huge', 'huge_builder'],
      );

      // The input is never mutated.
      assert.deepEqual(FAMILY.map((entry) => entry.id), [
        'huge_builder',
        'huge',
        'huge_pro',
        'huge_pro_plus',
        'huge_advanced',
      ]);
    },
  },
  {
    /**
     * With "Advanced" selected, an ADVANCED badge on every row is the reader's
     * own choice read back to them eleven times.
     */
    name: 'ladder: the level badge appears only where it adds something',
    run() {
      assert.equal(shouldShowLevelBadge('beginner', null), true, 'no filter: every level is news');
      assert.equal(shouldShowLevelBadge('advanced', null), true);
      assert.equal(shouldShowLevelBadge('advanced', 'advanced'), false, 'the filter already said it');
      assert.equal(shouldShowLevelBadge('beginner', 'advanced'), true, 'this row differs from the ask');
    },
  },
  {
    /**
     * A chip that visibly does nothing when tapped is worse than no chip: the
     * reader taps it, the list does not move, and now they distrust the other
     * two as well.
     */
    name: 'ladder: a sort is only offered when it can reorder what is shown',
    run() {
      assert.deepEqual(availableLadderSorts(FAMILY), ['recommended', 'days', 'length']);

      // Every row the same length — Focus is exactly this, all eleven rows.
      const sameLength = FAMILY.map((entry) => ({ ...entry, weeks: 8 }));
      assert.deepEqual(availableLadderSorts(sameLength), ['recommended', 'days']);

      const sameDays = FAMILY.map((entry) => ({ ...entry, days: 3 }));
      assert.deepEqual(availableLadderSorts(sameDays), ['recommended', 'length']);

      // 'recommended' survives even when it moves nothing: it is the default,
      // and the way back from either of the others.
      assert.deepEqual(availableLadderSorts([FAMILY[0]]), ['recommended']);
      assert.deepEqual(availableLadderSorts([]), ['recommended']);

      // A missing number is not a second value that makes a sort meaningful.
      const broken = [
        { id: 'a', days: 3, minutes: 50, weeks: 8, level: 'beginner' },
        { id: 'b', days: 3, minutes: 50, weeks: 0, level: 'beginner' },
        { id: 'c', days: 3, minutes: 50, weeks: NaN, level: 'beginner' },
      ];
      assert.deepEqual(availableLadderSorts(broken), ['recommended']);
    },
  },
  {
    /**
     * The real catalog, asked through the same helpers the sheet uses.
     *
     * Reading a source file with a regex produced three wrong numbers in this
     * repo in one evening, so this measures the shipped modules: every
     * category × level view the sheet can show, built from the same templates.
     *
     * The assertions are the two ways this feature dies quietly. It offers a
     * chip row with nothing in it, or it never hides anything and the guard I
     * just wrote is decoration — both directions have to be observed on real
     * data, because a guard that only ever fires one way is one I have shipped
     * twice this week.
     */
    name: 'ladder: the sort chips hide and appear across the real catalog',
    run() {
      const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
      const { getReadyProgramBlockWeeks } = require('../../.test-dist/lib/readyProgramDuration.js');
      const { PROGRAM_CATEGORIES, filterByCategory } = require('../../.test-dist/lib/programCategories.js');

      let views = 0;
      let lengthOffered = 0;
      let lengthHidden = 0;

      for (const category of PROGRAM_CATEGORIES) {
        for (const level of [null, 'beginner', 'intermediate', 'advanced']) {
          const templates = filterByCategory(WORKOUT_TEMPLATES_V1, category.key)
            .filter((template) => (level ? template.level === level : true));
          if (templates.length === 0) {
            continue;
          }
          views += 1;

          const rows = templates.map((template) => ({
            id: template.id,
            days: template.daysPerWeek ?? (template.sessions || []).length,
            minutes: template.estimatedSessionDuration ?? 0,
            weeks: getReadyProgramBlockWeeks(template),
            level: template.level,
          }));

          const where = `${category.key}/${level ?? 'all'}`;
          const offered = availableLadderSorts(rows);
          assert.ok(offered.includes('recommended'), `${where}: an empty chip row`);
          if (offered.includes('length')) {
            lengthOffered += 1;
          } else {
            lengthHidden += 1;
            const weeks = new Set(rows.map((row) => row.weeks));
            assert.equal(weeks.size, 1, `${where}: Length hidden while lengths differ`);
          }

          // Sorting is a permutation: 57 templates is enough real data to
          // catch a comparator that drops or duplicates a row.
          for (const sort of offered) {
            const after = sortProgramLadder(rows, sort, rows[0]);
            assert.equal(after.length, rows.length, `${where}/${sort}: row count changed`);
            assert.deepEqual(
              [...after.map((row) => row.id)].sort(),
              [...rows.map((row) => row.id)].sort(),
              `${where}/${sort}: not a permutation of the rows`,
            );
          }
        }
      }

      assert.ok(views > 20, `only ${views} views measured — the catalog moved`);
      assert.ok(lengthOffered > 0, 'Length is never offered — the chip is gone, not guarded');
      assert.ok(lengthHidden > 0, 'Length is never hidden — the guard is decoration');
    },
  },
];
