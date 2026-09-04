const assert = require('node:assert/strict');

const { setNumberLanguage } = require('../../.test-dist/lib/format.js');
setNumberLanguage('en');

const { buildWarmupBrief } = require('../../.test-dist/lib/warmupBrief.js');

const lift = (exerciseName, bodyPart, extra = {}) => ({
  exerciseName,
  bodyPart,
  setCount: 4,
  repsLabel: '7',
  timed: false,
  loadKg: 62.5,
  ...extra,
});

module.exports = [
  {
    name: 'the brief names the areas today loads, once each, in the order they arrive',
    run() {
      const brief = buildWarmupBrief(
        [
          lift('Incline Bench Press', 'chest'),
          lift('Overhead Press', 'shoulders'),
          lift('Dumbbell Bench Press', 'chest'),
          lift('Triceps Pushdown', 'triceps'),
        ],
        null,
        'en',
      );
      assert.deepEqual(brief.areas, ['Chest', 'Shoulders', 'Triceps']);
      // Finnish reads Finnish — the areas come from the library as English keys.
      assert.deepEqual(
        buildWarmupBrief([lift('Incline Bench Press', 'chest')], null, 'fi').areas,
        ['Rinta'],
      );
    },
  },
  {
    name: 'the first lift is the one the workout opens with, weight and all',
    run() {
      const brief = buildWarmupBrief(
        [lift('Incline Bench Press', 'chest'), lift('Overhead Press', 'shoulders')],
        null,
        'en',
      );
      assert.equal(brief.firstLift.exerciseName, 'Incline Bench Press');
      assert.equal(brief.firstLift.scheme, '4 × 7 · 62.5 kg');
      // A bodyweight opener has no weight to promise.
      assert.equal(
        buildWarmupBrief([lift('Pullups', 'back', { loadKg: null })], null, 'en').firstLift.scheme,
        '4 × 7',
      );
      // No exercises at all: no claim.
      const empty = buildWarmupBrief([], null, 'en');
      assert.equal(empty.firstLift, null);
      assert.deepEqual(empty.areas, []);
    },
  },
  {
    name: 'a flagged area appears once, however many of today lifts touch it',
    run() {
      const flags = [{ area: 'shoulders', level: 'careful', refinements: [] }];
      const brief = buildWarmupBrief(
        [
          lift('Incline Bench Press', 'chest'),
          lift('Overhead Press', 'shoulders'),
          lift('Lateral Raise', 'shoulders'),
        ],
        flags,
        'en',
      );
      assert.equal(brief.cautions.length, 1);
      assert.equal(brief.cautions[0].area, 'shoulders');
      assert.equal(brief.cautions[0].level, 'careful');
      // Nothing flagged, nothing claimed.
      assert.deepEqual(buildWarmupBrief([lift('Barbell Curl', 'biceps')], flags, 'en').cautions, []);
      // A lift the reader was told to avoid outranks a careful on the chip too.
      const avoid = buildWarmupBrief(
        [lift('Overhead Press', 'shoulders')],
        [{ area: 'shoulders', level: 'avoid', refinements: [] }],
        'en',
      );
      assert.equal(avoid.cautions[0].level, 'avoid');
    },
  },
  {
    name: 'a lift the library does not know contributes no area rather than a blank chip',
    run() {
      const brief = buildWarmupBrief(
        [lift('Something Home-Made', null), lift('Incline Bench Press', 'chest')],
        null,
        'en',
      );
      assert.deepEqual(brief.areas, ['Chest']);
      // It is still the session's first lift — the brief does not reorder.
      assert.equal(brief.firstLift.exerciseName, 'Something Home-Made');
    },
  },
];
