const assert = require('node:assert/strict');

const {
  exerciseNameLabel,
  TRANSLATED_EXERCISE_NAMES,
} = require('../../.test-dist/lib/exerciseNameLabel');
const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog');

function catalogExerciseNames() {
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
  return [...names];
}

module.exports = [
  {
    name: 'every exercise the ready programs prescribe has a Finnish name',
    run() {
      const missing = catalogExerciseNames().filter((name) => !TRANSLATED_EXERCISE_NAMES[name]);
      assert.deepEqual(
        missing,
        [],
        `these catalog exercises would still read in English: ${missing.join(', ')}`,
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
