const assert = require('node:assert/strict');

const {
  FOCUS_ACCESSORY_POOL,
  SUPPLEMENTAL_DAY_POOL,
  isCatalogExercise,
  getCatalogBodyPart,
  getCatalogTrackingMode,
  resolveCatalogBodyPart,
  sessionFocusAffinity,
  pickPoolVariant,
} = require('../../.test-dist/lib/catalogExercisePools.js');
const { EQUIPMENT_FALLBACKS } = require('../../.test-dist/lib/equipmentExerciseFilter.js');
const { getFocusEmphasisCount } = require('../../.test-dist/lib/focusEmphasis.js');

/**
 * The guard for a bug family that appeared in three separate tables: exercise
 * names written by hand that exist in no catalog. A user got "Arms" and
 * "Glute Bridge" on a saved plan — no demo, no instructions, nothing to swap.
 */
module.exports = [
  {
    name: 'every focus accessory is a real catalog exercise',
    run() {
      const missing = [];
      for (const [area, pool] of Object.entries(FOCUS_ACCESSORY_POOL)) {
        for (const variant of ['bodyweight', 'loaded']) {
          for (const name of pool[variant]) {
            if (!isCatalogExercise(name)) {
              missing.push(`${area}.${variant}: ${name}`);
            }
          }
        }
      }
      assert.deepEqual(missing, [], 'these names would reach a plan with no demo and no instructions');
    },
  },
  {
    name: 'every supplemental-day exercise is a real catalog exercise',
    run() {
      const missing = [];
      for (const [kind, pool] of Object.entries(SUPPLEMENTAL_DAY_POOL)) {
        for (const variant of ['bodyweight', 'loaded']) {
          for (const name of pool[variant]) {
            if (!isCatalogExercise(name)) {
              missing.push(`${kind}.${variant}: ${name}`);
            }
          }
        }
      }
      assert.deepEqual(missing, []);
    },
  },
  {
    name: 'every equipment fallback is a real catalog exercise',
    run() {
      const missing = [];
      for (const [pattern, candidates] of EQUIPMENT_FALLBACKS) {
        for (const name of candidates) {
          if (!isCatalogExercise(name)) {
            missing.push(`${pattern} → ${name}`);
          }
        }
      }
      // A swap onto an unknown name strips the very demo it was rescuing.
      assert.deepEqual(missing, []);
    },
  },
  {
    name: 'a focus area always has enough accessories for the emphasis it promises',
    run() {
      for (const [area, pool] of Object.entries(FOCUS_ACCESSORY_POOL)) {
        const needed = getFocusEmphasisCount(area);
        for (const variant of ['bodyweight', 'loaded']) {
          assert.ok(
            pool[variant].length >= needed,
            `${area}.${variant} promises ${needed} accessories but offers ${pool[variant].length}`,
          );
        }
      }
    },
  },
  {
    name: 'tracking mode comes from the catalog, not from the name',
    run() {
      // Neither of these matches the keyword lists that used to decide this.
      assert.equal(getCatalogTrackingMode('Butt Lift (Bridge)'), 'bodyweight');
      assert.equal(getCatalogTrackingMode('Bench Dips'), 'bodyweight');
      assert.equal(getCatalogTrackingMode('Leg Press'), 'load_and_reps');
      assert.equal(getCatalogTrackingMode('Barbell Hip Thrust'), 'load_and_reps');
      // An unknown name must not claim to be bodyweight.
      assert.equal(getCatalogTrackingMode('Arms'), 'load_and_reps');
    },
  },
  {
    name: 'body parts resolve for names the templates spell differently',
    run() {
      const { GENERATED_EXERCISE_LIBRARY } = require('../../.test-dist/data/generatedExerciseLibrary.js');
      const { findGuidedLibraryIndex } = require('../../.test-dist/lib/guidedPlayer.js');
      const names = GENERATED_EXERCISE_LIBRARY.map((entry) => entry.name);

      // The ready templates say "Bench Press"; the library says "Barbell Bench
      // Press - Medium Grip". Exact lookup finds nothing for most of the catalog.
      assert.equal(getCatalogBodyPart('Bench Press'), null);
      assert.equal(resolveCatalogBodyPart('Bench Press'), 'chest');
      assert.equal(resolveCatalogBodyPart('Back Squat'), 'legs');
      assert.equal(resolveCatalogBodyPart('Lat Pulldown'), 'back');
      assert.equal(resolveCatalogBodyPart('Arms'), null, 'a category word is still not an exercise');

      // Must agree with the matcher the media zone uses, or a day could show a
      // photo of one muscle group while emphasis treats it as another.
      for (const name of ['Bench Press', 'Back Squat', 'Lat Pulldown', 'Barbell Row', 'Hip Thrust']) {
        const index = findGuidedLibraryIndex(name, names);
        assert.ok(index !== null);
        assert.equal(resolveCatalogBodyPart(name), GENERATED_EXERCISE_LIBRARY[index].bodyPart, name);
      }
    },
  },
  {
    name: 'affinity finds the day that already trains the area',
    run() {
      const upper = ['Barbell Bench Press - Medium Grip', 'Bent Over Two-Dumbbell Row', 'Triceps Pushdown'];
      const lower = ['Barbell Squat', 'Romanian Deadlift', 'Leg Press'];

      assert.ok(sessionFocusAffinity(lower, 'glutes') > sessionFocusAffinity(upper, 'glutes'));
      assert.ok(sessionFocusAffinity(upper, 'chest') > sessionFocusAffinity(lower, 'chest'));

      // Mobility matches nothing on purpose — it may go anywhere.
      assert.equal(sessionFocusAffinity(lower, 'mobility'), 0);
      assert.equal(sessionFocusAffinity(upper, 'mobility'), 0);
    },
  },
  {
    name: 'a user with no equipment gets the bodyweight variant',
    run() {
      const pool = FOCUS_ACCESSORY_POOL.glutes;
      assert.deepEqual(pickPoolVariant(pool, []), pool.bodyweight);
      assert.deepEqual(pickPoolVariant(pool, ['Barbells', 'Bench']), pool.loaded);
      // null means the setup never said, so nothing is assumed missing.
      assert.deepEqual(pickPoolVariant(pool, null), pool.loaded);
    },
  },
];
