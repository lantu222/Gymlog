const assert = require('node:assert/strict');

const { rankExerciseAlternatives } = require('../../.test-dist/lib/exerciseAlternatives.js');

function item(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    category: overrides.category ?? 'compound',
    bodyPart: overrides.bodyPart ?? 'back',
    equipment: overrides.equipment ?? 'bodyweight',
    primaryMuscles: overrides.primaryMuscles ?? [],
    secondaryMuscles: overrides.secondaryMuscles ?? [],
  };
}

module.exports = [
  {
    name: 'exercise alternatives rank primary muscle matches before broad body part matches',
    run() {
      const current = item({
        id: 'band-assisted-pull-up',
        name: 'Band Assisted Pull-Up',
        primaryMuscles: ['lats'],
        secondaryMuscles: ['biceps', 'rear delts'],
      });
      const unrelatedBack = item({
        id: 'behind-head-chest-stretch',
        name: 'Behind Head Chest Stretch',
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
      });
      const primaryMatch = item({
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        primaryMuscles: ['lats'],
        secondaryMuscles: ['biceps'],
      });
      const secondaryMatch = item({
        id: 'biceps-curl',
        name: 'Biceps Curl',
        bodyPart: 'biceps',
        primaryMuscles: ['biceps'],
        secondaryMuscles: [],
      });

      const ranked = rankExerciseAlternatives(current, [unrelatedBack, secondaryMatch, primaryMatch, current], 3);

      assert.deepEqual(ranked.map((exercise) => exercise.id), ['lat-pulldown', 'biceps-curl']);
    },
  },
  {
    name: 'exercise alternatives fall back to body part only when muscle data is missing',
    run() {
      const current = item({
        id: 'machine-row',
        name: 'Machine Row',
        primaryMuscles: [],
        secondaryMuscles: [],
      });
      const sameBodyPart = item({
        id: 'cable-row',
        name: 'Cable Row',
        primaryMuscles: [],
        secondaryMuscles: [],
      });
      const unrelated = item({
        id: 'leg-press',
        name: 'Leg Press',
        bodyPart: 'legs',
        primaryMuscles: [],
        secondaryMuscles: [],
      });

      const ranked = rankExerciseAlternatives(current, [unrelated, sameBodyPart], 3);

      assert.deepEqual(ranked.map((exercise) => exercise.id), ['cable-row']);
    },
  },
];
