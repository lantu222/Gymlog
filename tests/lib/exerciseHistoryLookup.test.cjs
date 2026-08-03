const assert = require('node:assert/strict');

const {
  findLatestEntryForExerciseName,
  findHistoricalSetForIndex,
} = require('../../.test-dist/lib/exerciseHistoryLookup.js');

function entry(overrides = {}) {
  return {
    slotId: 'tpl_a:day_1:primary_squat',
    templateId: 'tpl_a',
    templateName: 'Strong Starter',
    exerciseName: 'Back Squat',
    substitutionGroup: 'squat_pattern',
    performedAt: '2026-07-20T10:00:00.000Z',
    sessionId: 'session_1',
    sets: [
      { setIndex: 0, loadKg: 60, reps: 8, completedAt: '2026-07-20T10:05:00.000Z' },
      { setIndex: 1, loadKg: 62.5, reps: 7, completedAt: '2026-07-20T10:10:00.000Z' },
    ],
    skipped: false,
    ...overrides,
  };
}

module.exports = [
  {
    name: 'a lift is found by name across slots, newest session wins',
    run() {
      // The same lift in three places: another program, another day of this
      // program, and an empty workout. Slot-keyed history cannot see any of
      // them from a fresh slot — that is the whole point of this lookup.
      const slotHistory = {
        'tpl_a:day_1:primary_squat': [entry({ performedAt: '2026-07-10T10:00:00.000Z' })],
        'tpl_b:day_3:legs_1': [
          entry({
            slotId: 'tpl_b:day_3:legs_1',
            performedAt: '2026-07-24T10:00:00.000Z',
            sets: [{ setIndex: 0, loadKg: 70, reps: 6, completedAt: '2026-07-24T10:05:00.000Z' }],
          }),
        ],
        empty_workout_slot: [
          entry({ slotId: 'empty_workout_slot', performedAt: '2026-07-18T10:00:00.000Z' }),
        ],
      };

      const found = findLatestEntryForExerciseName(slotHistory, 'Back Squat');
      assert.equal(found.performedAt, '2026-07-24T10:00:00.000Z');
      assert.equal(found.sets[0].loadKg, 70);

      // Matching ignores case and stray whitespace, like every other name
      // comparison in the app.
      assert.equal(findLatestEntryForExerciseName(slotHistory, '  back squat ').sets[0].loadKg, 70);

      // A lift never done is null, not a guess.
      assert.equal(findLatestEntryForExerciseName(slotHistory, 'Hip Thrust'), null);
      assert.equal(findLatestEntryForExerciseName(slotHistory, '   '), null);
      assert.equal(findLatestEntryForExerciseName({}, 'Back Squat'), null);
    },
  },
  {
    name: 'skipped, empty and all-zero entries are not a weight',
    run() {
      const slotHistory = {
        skipped_slot: [entry({ slotId: 'skipped_slot', performedAt: '2026-07-30T10:00:00.000Z', skipped: true })],
        no_sets: [entry({ slotId: 'no_sets', performedAt: '2026-07-29T10:00:00.000Z', sets: [] })],
        zero_slot: [
          entry({
            slotId: 'zero_slot',
            performedAt: '2026-07-28T10:00:00.000Z',
            sets: [{ setIndex: 0, loadKg: 0, reps: 6, completedAt: '2026-07-28T10:05:00.000Z' }],
          }),
        ],
        real_slot: [entry({ slotId: 'real_slot', performedAt: '2026-07-01T10:00:00.000Z' })],
      };

      // These zeroes are real data: the guided player used to hide the weight
      // field, so sets went in at 0 kg. Prefilling one is worse than
      // prefilling nothing — it looks like an answer.
      const loaded = findLatestEntryForExerciseName(slotHistory, 'Back Squat', { requireLoaded: true });
      assert.equal(loaded.slotId, 'real_slot');

      // Bodyweight work must not pass requireLoaded: there 0 kg is the truth,
      // and the zero entry is the most recent thing that happened.
      const bodyweight = findLatestEntryForExerciseName(slotHistory, 'Back Squat');
      assert.equal(bodyweight.slotId, 'zero_slot');
    },
  },
  {
    name: 'the set for an index is the logged one, else the one in that position',
    run() {
      const source = entry({
        sets: [
          { setIndex: 2, loadKg: 80, reps: 5, completedAt: '2026-07-20T10:05:00.000Z' },
          { setIndex: 3, loadKg: 85, reps: 4, completedAt: '2026-07-20T10:10:00.000Z' },
        ],
      });

      // Exact setIndex wins…
      assert.equal(findHistoricalSetForIndex(source, 2).loadKg, 80);
      // …and positional fallback covers a session that logged fewer sets.
      assert.equal(findHistoricalSetForIndex(source, 0).loadKg, 80);
      assert.equal(findHistoricalSetForIndex(source, 9), null);
      assert.equal(findHistoricalSetForIndex(null, 0), null);
    },
  },
];
