const assert = require('node:assert/strict');

const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const {
  SHEET_HISTORY_SESSIONS,
  buildExerciseSheetHistory,
} = require('../../.test-dist/lib/exerciseSheetHistory.js');

const session = (performedAt, sets) => ({
  performedAt,
  sets: sets.map(([loadKg, reps]) => ({ loadKg, reps })),
});

module.exports = [
  {
    name: 'the chart is the last eight sessions, oldest first, today last',
    run() {
      const past = Array.from({ length: 12 }).map((_, index) =>
        session(`2026-06-${`${index + 1}`.padStart(2, '0')}T18:00:00.000Z`, [[50 + index, 8]]),
      );
      const view = buildExerciseSheetHistory(past, session('2026-09-04T18:00:00.000Z', [[70, 8]]), 'en');
      assert.equal(view.bars.length, SHEET_HISTORY_SESSIONS);
      // Today is the last bar and the only one marked as today.
      assert.equal(view.bars[view.bars.length - 1].isToday, true);
      assert.equal(view.bars.filter((bar) => bar.isToday).length, 1);
      // Tallest bar is full height; every bar has enough height to be seen.
      assert.equal(view.bars[view.bars.length - 1].ratio, 1);
      assert.ok(view.bars.every((bar) => bar.ratio >= 0.08));
      // The count is every session, not just the window.
      assert.equal(view.sessionCount, 13);
    },
  },
  {
    name: 'unsorted history still reads oldest to newest',
    run() {
      const view = buildExerciseSheetHistory(
        [
          session('2026-08-27T18:00:00.000Z', [[60, 8]]),
          session('2026-08-13T18:00:00.000Z', [[50, 8]]),
          session('2026-08-20T18:00:00.000Z', [[55, 8]]),
        ],
        null,
        'en',
      );
      assert.deepEqual(view.bars.map((bar) => bar.value), [50, 55, 60]);
      // Rows read the other way: newest at the top, where a reader starts.
      assert.equal(view.rows[0].loadLabel, '60 kg');
      assert.equal(view.rows[2].loadLabel, '50 kg');
    },
  },
  {
    name: 'today is a PR only once it actually beats every session before it',
    run() {
      const past = [session('2026-08-27T18:00:00.000Z', [[60, 8]])];
      // Same weight is not a record.
      assert.equal(buildExerciseSheetHistory(past, session('2026-09-04T18:00:00.000Z', [[60, 9]]), 'en').rows[0].isPr, false);
      // Heavier is.
      const pr = buildExerciseSheetHistory(past, session('2026-09-04T18:00:00.000Z', [[62.5, 6]]), 'en');
      assert.equal(pr.rows[0].isPr, true);
      assert.equal(pr.rows[0].isToday, true);
      // A first-ever session is not a PR — there is nothing to have beaten.
      const first = buildExerciseSheetHistory([], session('2026-09-04T18:00:00.000Z', [[40, 10]]), 'en');
      assert.equal(first.rows[0].isPr, false);
      // And a past session never carries the badge.
      assert.ok(pr.rows.slice(1).every((row) => row.isPr === false));
    },
  },
  {
    name: 'today grows set by set rather than appearing whole',
    run() {
      const past = [session('2026-08-27T18:00:00.000Z', [[60, 8], [60, 7]])];
      // Nothing logged yet: today is not in the series at all.
      const before = buildExerciseSheetHistory(past, { performedAt: '2026-09-04T18:00:00.000Z', sets: [] }, 'en');
      assert.equal(before.bars.length, 1);
      assert.equal(before.rows.length, 1);
      // One set in: today is there, with one pill.
      const after = buildExerciseSheetHistory(past, session('2026-09-04T18:00:00.000Z', [[62.5, 7]]), 'en');
      assert.deepEqual(after.rows[0].pills, ['7']);
      assert.equal(after.rows[0].dateLabel, 'Today');
      assert.equal(buildExerciseSheetHistory(past, session('2026-09-04T18:00:00.000Z', [[62.5, 7]]), 'fi').rows[0].dateLabel, 'Tänään');
    },
  },
  {
    name: 'the stats read the whole history, and an empty one claims nothing',
    run() {
      const view = buildExerciseSheetHistory(
        [session('2026-08-20T18:00:00.000Z', [[60, 8], [60, 6]]), session('2026-08-27T18:00:00.000Z', [[55, 12]])],
        null,
        'en',
      );
      assert.equal(view.bestSetLabel, '60 kg × 8');
      assert.ok(view.estimatedOneRepMaxKg > 60);
      const empty = buildExerciseSheetHistory([], null, 'en');
      assert.equal(empty.bestSetLabel, null);
      assert.equal(empty.estimatedOneRepMaxKg, null);
      assert.equal(empty.sessionCount, 0);
      assert.deepEqual(empty.bars, []);
      assert.deepEqual(empty.rows, []);
    },
  },
  {
    name: 'an unloaded lift charts its reps rather than a row of zeroes',
    run() {
      const view = buildExerciseSheetHistory(
        [session('2026-08-20T18:00:00.000Z', [[0, 10]]), session('2026-08-27T18:00:00.000Z', [[0, 14]])],
        null,
        'en',
        'bodyweight',
      );
      assert.deepEqual(view.bars.map((bar) => bar.value), [10, 14]);
      // And says so without inventing a weight.
      assert.equal(view.rows[0].loadLabel, null);
      assert.equal(view.bestSetLabel, '14 reps');
    },
  },
];
