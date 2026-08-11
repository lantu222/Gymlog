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
const {
  GENERATED_EXERCISE_LIBRARY,
} = require('../../.test-dist/data/generatedExerciseLibrary');

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
      // A name with no entry keeps its own rather than guessing. Every name
      // IN the library has one now, so this has to be something invented.
      assert.equal(exerciseNameLabel('fi', 'Quantum Deadlift'), 'Quantum Deadlift');
      assert.equal(exerciseNameLabel('fi', '  Plank  '), 'Lankku');
    },
  },
  {
    // The browsable library is 873 exercises. The reachable-names walk above
    // covers what the catalogs and the composer prescribe; this covers what a
    // user can simply scroll past in Liikekirjasto, which was 771 of them.
    name: 'every exercise in the browsable library has a Finnish name',
    run() {
      const missing = GENERATED_EXERCISE_LIBRARY
        .map((item) => item.name)
        .filter((name) => !TRANSLATED_EXERCISE_NAMES[name.trim()]);

      assert.deepEqual(
        missing,
        [],
        `${missing.length} library exercises would read in English: ${missing.slice(0, 8).join(', ')}`,
      );
    },
  },
  {
    name: 'no Finnish name is left as its English source',
    run() {
      // Case-insensitive on purpose: "Muscle Up" → "Muscle up" is a copy, not
      // a translation, and a case-sensitive check waves it through. Tightening
      // it surfaced three entries that had been sitting here since before the
      // library sweep.
      //
      // Which is why the loan words have to be listed: for these, the
      // lower-cased form IS the Finnish one. Finnish gyms say "dead bug" and
      // "muscle up"; inventing a Finnish word for them would be worse than
      // the English, which is the same rule the module doc states.
      const FINNISH_LOAN_WORDS = [
        'Burpee',
        'Hack Squat',
        'Pec Deck',
        'Dead Bug',
        'Bird Dog',
        'Dragon Flag',
        'Muscle Up',
        'London Bridges',
      ];
      const unchanged = Object.entries(TRANSLATED_EXERCISE_NAMES)
        .filter(([english, finnish]) => english.toLowerCase() === finnish.toLowerCase())
        .filter(([english]) => !FINNISH_LOAN_WORDS.includes(english))
        .map(([english]) => english);

      assert.deepEqual(unchanged, [], `left in English: ${unchanged.join(', ')}`);
    },
  },
];
