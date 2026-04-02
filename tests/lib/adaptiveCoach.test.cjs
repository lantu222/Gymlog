const assert = require('node:assert/strict');

const { buildAdaptiveCoachRecommendation } = require('../../.test-dist/lib/adaptiveCoach.js');

function makeSet(overrides = {}) {
  return {
    setIndex: overrides.setIndex ?? 0,
    plannedLoadKg: overrides.plannedLoadKg ?? 80,
    plannedRepsMin: overrides.plannedRepsMin ?? 5,
    plannedRepsMax: overrides.plannedRepsMax ?? 8,
    draftLoadText: '',
    draftRepsText: '',
    actualLoadKg: overrides.actualLoadKg ?? 80,
    actualReps: overrides.actualReps ?? 8,
    status: overrides.status ?? 'completed',
    edited: true,
  };
}

function makeExercise(overrides = {}) {
  return {
    templateExerciseId: overrides.templateExerciseId ?? 'exercise',
    slotId: overrides.slotId ?? 'slot',
    templateSlotId: overrides.templateSlotId ?? overrides.slotId ?? 'slot',
    exerciseName: overrides.exerciseName ?? 'Bench Press',
    role: overrides.role ?? 'primary',
    progressionPriority: overrides.progressionPriority ?? 'high',
    trackingMode: overrides.trackingMode ?? 'load_and_reps',
    restSecondsMin: overrides.restSecondsMin ?? 120,
    restSecondsMax: overrides.restSecondsMax ?? 180,
    substitutionGroup: overrides.substitutionGroup ?? 'press',
    orderIndex: overrides.orderIndex ?? 0,
    sets: overrides.sets ?? [makeSet({ status: 'completed' }), makeSet({ setIndex: 1, status: 'pending' })],
    status: overrides.status ?? 'active',
    isExpanded: true,
  };
}

module.exports = [
  {
    name: 'adaptive coach pushes load up after easy top-end set',
    run() {
      const exercise = makeExercise();
      const recommendation = buildAdaptiveCoachRecommendation({
        completedExercise: exercise,
        completedSet: makeSet({ actualReps: 8, plannedRepsMin: 5, plannedRepsMax: 8, actualLoadKg: 80 }),
        effort: 'easy',
        nextExercise: exercise,
        nextSetNumber: 2,
        unitPreference: 'kg',
        previousEntries: [],
      });

      assert.equal(recommendation.tone, 'push');
      assert.equal(recommendation.title, 'You have room to push');
      assert.match(recommendation.targetLine, /82\.5 kg x 5-8/);
      assert.equal(recommendation.suggestedRestSeconds, 105);
    },
  },
  {
    name: 'adaptive coach holds line after good effort set',
    run() {
      const exercise = makeExercise();
      const recommendation = buildAdaptiveCoachRecommendation({
        completedExercise: exercise,
        completedSet: makeSet({ actualReps: 6, plannedRepsMin: 5, plannedRepsMax: 8, actualLoadKg: 80 }),
        effort: 'good',
        nextExercise: exercise,
        nextSetNumber: 2,
        unitPreference: 'kg',
        previousEntries: [],
      });

      assert.equal(recommendation.tone, 'steady');
      assert.equal(recommendation.title, 'Hold this line');
      assert.match(recommendation.targetLine, /80 kg x 5-8/);
      assert.equal(recommendation.suggestedRestSeconds, 150);
    },
  },
  {
    name: 'adaptive coach backs off when hard set falls under floor',
    run() {
      const exercise = makeExercise();
      const recommendation = buildAdaptiveCoachRecommendation({
        completedExercise: exercise,
        completedSet: makeSet({ actualReps: 4, plannedRepsMin: 5, plannedRepsMax: 8, actualLoadKg: 80 }),
        effort: 'hard',
        nextExercise: exercise,
        nextSetNumber: 2,
        unitPreference: 'kg',
        previousEntries: [],
      });

      assert.equal(recommendation.tone, 'recovery');
      assert.equal(recommendation.title, 'Back off and protect the next set');
      assert.match(recommendation.targetLine, /77\.5 kg x 5-8/);
      assert.equal(recommendation.suggestedRestSeconds, 200);
    },
  },
  {
    name: 'adaptive coach points into the next lift when the block changes',
    run() {
      const completedExercise = makeExercise({ slotId: 'bench', exerciseName: 'Bench Press' });
      const nextExercise = makeExercise({
        slotId: 'row',
        exerciseName: 'Barbell Row',
        restSecondsMin: 90,
        restSecondsMax: 120,
      });

      const recommendation = buildAdaptiveCoachRecommendation({
        completedExercise,
        completedSet: makeSet({ actualReps: 7, plannedRepsMin: 5, plannedRepsMax: 8, actualLoadKg: 80 }),
        effort: 'hard',
        nextExercise,
        nextSetNumber: 1,
        unitPreference: 'kg',
        previousEntries: [],
      });

      assert.equal(recommendation.tone, 'recovery');
      assert.equal(recommendation.title, 'Take a longer reset');
      assert.match(recommendation.targetLine, /Next lift: Barbell Row \| start controlled/);
      assert.equal(recommendation.suggestedRestSeconds, 120);
    },
  },
];
