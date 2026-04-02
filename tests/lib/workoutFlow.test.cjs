const assert = require('node:assert/strict');

const {
  getWorkoutFlowPhase,
  getWorkoutFlowPhasePreview,
  getWorkoutFlowTrail,
  formatWorkoutExerciseQueueMeta,
} = require('../../.test-dist/lib/workoutFlow.js');

function makeExercise(overrides = {}) {
  return {
    templateExerciseId: overrides.templateExerciseId ?? 'exercise',
    persistedExerciseTemplateId: null,
    slotId: overrides.slotId ?? 'slot',
    templateSlotId: overrides.templateSlotId ?? overrides.slotId ?? 'slot',
    exerciseName: overrides.exerciseName ?? 'Exercise',
    role: overrides.role ?? 'primary',
    progressionPriority: overrides.progressionPriority ?? 'medium',
    trackingMode: overrides.trackingMode ?? 'load_and_reps',
    restSecondsMin: 60,
    restSecondsMax: 90,
    substitutionGroup: overrides.substitutionGroup ?? 'group',
    orderIndex: overrides.orderIndex ?? 0,
    sets: overrides.sets ?? [
      {
        setIndex: 0,
        plannedRepsMin: 6,
        plannedRepsMax: 8,
        draftLoadText: '',
        draftRepsText: '',
        status: 'pending',
        edited: false,
      },
    ],
    status: overrides.status ?? 'pending',
    isExpanded: false,
  };
}

module.exports = [
  {
    name: 'workout flow treats pre-primary exercises as warm up and later roles as main/build/finish',
    run() {
      const exercises = [
        makeExercise({ slotId: 'prep', role: 'accessory', trackingMode: 'bodyweight', orderIndex: 0 }),
        makeExercise({ slotId: 'main', role: 'primary', orderIndex: 1 }),
        makeExercise({ slotId: 'build', role: 'secondary', orderIndex: 2 }),
        makeExercise({ slotId: 'finish', role: 'accessory', orderIndex: 3 }),
      ];

      assert.equal(getWorkoutFlowPhase(exercises, 'prep'), 'warmup');
      assert.equal(getWorkoutFlowPhase(exercises, 'main'), 'main');
      assert.equal(getWorkoutFlowPhase(exercises, 'build'), 'build');
      assert.equal(getWorkoutFlowPhase(exercises, 'finish'), 'finish');
    },
  },
  {
    name: 'workout flow trail deduplicates phases and marks the current phase',
    run() {
      const exercises = [
        makeExercise({ slotId: 'main_a', role: 'primary', orderIndex: 0 }),
        makeExercise({ slotId: 'main_b', role: 'primary', orderIndex: 1 }),
        makeExercise({ slotId: 'build_a', role: 'secondary', orderIndex: 2 }),
        makeExercise({ slotId: 'finish_a', role: 'accessory', orderIndex: 3 }),
      ];

      const trail = getWorkoutFlowTrail(exercises, 'build_a');

      assert.deepEqual(
        trail.map((item) => ({ phase: item.phase, state: item.state })),
        [
          { phase: 'main', state: 'complete' },
          { phase: 'build', state: 'current' },
          { phase: 'finish', state: 'upcoming' },
        ],
      );
    },
  },
  {
    name: 'workout flow queue meta formats set count and rep range compactly',
    run() {
      const exercise = makeExercise({
        role: 'secondary',
        sets: [
          {
            setIndex: 0,
            plannedRepsMin: 10,
            plannedRepsMax: 12,
            draftLoadText: '',
            draftRepsText: '',
            status: 'pending',
            edited: false,
          },
          {
            setIndex: 1,
            plannedRepsMin: 10,
            plannedRepsMax: 12,
            draftLoadText: '',
            draftRepsText: '',
            status: 'pending',
            edited: false,
          },
        ],
      });

      assert.equal(formatWorkoutExerciseQueueMeta(exercise), '2 sets | 10-12 reps');
    },
  },
  {
    name: 'workout flow phase preview groups exercises into visible warm up main build and finish blocks',
    run() {
      const exercises = [
        makeExercise({ slotId: 'prep', exerciseName: 'Band pull-apart', role: 'accessory', orderIndex: 0 }),
        makeExercise({ slotId: 'main', exerciseName: 'Bench Press', role: 'primary', orderIndex: 1 }),
        makeExercise({ slotId: 'build', exerciseName: 'Chest Supported Row', role: 'secondary', orderIndex: 2 }),
        makeExercise({ slotId: 'finish', exerciseName: 'Cable Curl', role: 'accessory', orderIndex: 3 }),
      ];

      const preview = getWorkoutFlowPhasePreview(exercises);

      assert.deepEqual(
        preview.map((item) => ({
          phase: item.phase,
          leadExerciseName: item.leadExerciseName,
          exerciseCount: item.exerciseCount,
        })),
        [
          { phase: 'warmup', leadExerciseName: 'Band pull-apart', exerciseCount: 1 },
          { phase: 'main', leadExerciseName: 'Bench Press', exerciseCount: 1 },
          { phase: 'build', leadExerciseName: 'Chest Supported Row', exerciseCount: 1 },
          { phase: 'finish', leadExerciseName: 'Cable Curl', exerciseCount: 1 },
        ],
      );
    },
  },
];
