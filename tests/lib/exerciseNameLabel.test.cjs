const assert = require('node:assert/strict');

const {
  exerciseNameLabel,
  TRANSLATED_EXERCISE_NAMES,
} = require('../../.test-dist/lib/exerciseNameLabel');
const {
  WORKOUT_TEMPLATES_V1,
  WORKOUT_SUBSTITUTION_GROUPS,
} = require('../../.test-dist/features/workout/workoutCatalog');
const {
  FOCUS_ACCESSORY_POOL,
  SUPPLEMENTAL_DAY_POOL,
} = require('../../.test-dist/lib/catalogExercisePools');

function collectStrings(value, into) {
  if (typeof value === 'string') {
    into.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, into));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStrings(entry, into));
  }
}

/**
 * Every exercise name a reader can actually meet.
 *
 * This used to walk WORKOUT_TEMPLATES_V1 alone, which is what the ready
 * programs prescribe — about a quarter of the reachable names. The other
 * three quarters arrive through the swap sheet (the substitution groups)
 * and through the plan composer (the focus and supplemental pools), and
 * they were all still in English.
 */
function reachableExerciseNames() {
  const names = new Set();
  for (const template of WORKOUT_TEMPLATES_V1) {
    for (const session of template.sessions ?? []) {
      for (const exercise of session.exercises ?? []) {
        if (exercise.name) {
          names.add(exercise.name);
        }
      }
    }
  }
  for (const group of WORKOUT_SUBSTITUTION_GROUPS) {
    for (const name of group.allowedExerciseNames ?? []) {
      names.add(name);
    }
  }
  collectStrings(FOCUS_ACCESSORY_POOL, names);
  collectStrings(SUPPLEMENTAL_DAY_POOL, names);
  return [...names];
}

module.exports = [
  {
    name: 'every exercise a reader can reach has a Finnish name',
    run() {
      const reachable = reachableExerciseNames();
      // The swap sheet alone offers four times what the catalog prescribes;
      // if this number collapses, the walk above stopped finding a source.
      assert.ok(reachable.length > 300, `only ${reachable.length} names reachable`);
      const missing = reachable.filter((name) => !TRANSLATED_EXERCISE_NAMES[name]);
      assert.deepEqual(
        missing,
        [],
        `these exercises would still read in English: ${missing.join(', ')}`,
      );
    },
  },
  {
    name: 'a lift spelled two ways is translated under both spellings',
    run() {
      // The catalog, the swap pools and the generated library do not agree on
      // singular vs plural, and the lookup is exact — so "Dumbbell Flyes"
      // reached the screen in English while "Dumbbell Fly" was translated.
      // Same lift, same Finnish, both keys.
      for (const [a, b] of [
        ['Dumbbell Fly', 'Dumbbell Flyes'],
        ['Bench Dip', 'Bench Dips'],
        ['Mountain Climbers', 'Mountain Climber'],
      ]) {
        assert.equal(exerciseNameLabel('fi', a), exerciseNameLabel('fi', b));
        assert.notEqual(exerciseNameLabel('fi', b), b, `${b} still reads in English`);
      }
    },
  },
  {
    name: 'English is returned untouched and unknown names pass through',
    run() {
      assert.equal(exerciseNameLabel('en', 'Back Squat'), 'Back Squat');
      assert.equal(exerciseNameLabel('fi', 'Back Squat'), 'Takakyykky');
      // A library exercise with no entry keeps its own name rather than guessing.
      assert.equal(exerciseNameLabel('fi', 'Smith Machine Bent Over Row'), 'Smith Machine Bent Over Row');
      assert.equal(exerciseNameLabel('fi', '  Plank  '), 'Lankku');
    },
  },
  {
    name: 'no Finnish name is left as its English source',
    run() {
      const unchanged = Object.entries(TRANSLATED_EXERCISE_NAMES)
        .filter(([english, finnish]) => english === finnish)
        // Loan words that are the same in both languages are fine.
        .filter(([english]) => !['Burpee', 'Hack Squat', 'Pec Deck'].includes(english))
        .map(([english]) => english);

      assert.deepEqual(unchanged, [], `left in English: ${unchanged.join(', ')}`);
    },
  },
];
