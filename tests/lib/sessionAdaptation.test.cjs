const assert = require('node:assert/strict');

const {
  EMPTY_SESSION_ADAPTATION,
  applySessionAdaptation,
  hasSessionAdaptation,
} = require('../../.test-dist/lib/sessionAdaptation.js');

const DAY = [
  { slotId: 'primary_squat', role: 'primary', sets: 4 },
  { slotId: 'secondary_press', role: 'secondary', sets: 3 },
  { slotId: 'accessory_curl', role: 'accessory', sets: 3 },
  { slotId: 'accessory_calf', role: 'accessory', sets: 3 },
];

function template(exercises = DAY) {
  return {
    id: 'tpl_1',
    name: 'Plan - Day 1: Legs',
    defaultScheduleMode: 'rolling_sequence',
    sessions: [
      {
        id: 'day_1',
        name: 'Legs',
        orderIndex: 0,
        exercises: exercises.map((exercise, index) => ({
          id: `ex_${index}`,
          exerciseName: `Lift ${index}`,
          slotId: exercise.slotId,
          role: exercise.role,
          progressionPriority: 'medium',
          trackingMode: 'load_and_reps',
          sets: exercise.sets,
          repsMin: 6,
          repsMax: 8,
          restSecondsMin: 90,
          restSecondsMax: 120,
          substitutionGroup: 'squat_pattern',
        })),
      },
    ],
  };
}

module.exports = [
  {
    name: 'an adaptation applies swaps to the runtime template',
    run() {
      const source = template();
      const adapted = applySessionAdaptation(source, {
        swaps: { primary_squat: 'Hack Squat' },
        drops: [],
      });

      const exercises = adapted.sessions[0].exercises;
      assert.equal(exercises[0].exerciseName, 'Hack Squat');
      // Swapping does not change the prescription — same sets, same reps, same
      // slot. It is the same work done on something else.
      assert.equal(exercises[0].sets, 4);
      assert.equal(exercises[0].slotId, 'primary_squat');

      // The source template is a catalog object shared across sessions; it must
      // come back unchanged.
      assert.equal(source.sessions[0].exercises[0].exerciseName, 'Lift 0');
    },
  },
  {
    name: 'no adaptation is a no-op, by identity',
    run() {
      const source = template();
      assert.equal(hasSessionAdaptation(EMPTY_SESSION_ADAPTATION), false);
      assert.equal(hasSessionAdaptation(null), false);
      assert.equal(hasSessionAdaptation({ swaps: { a: 'B' }, drops: [] }), true);
      assert.equal(hasSessionAdaptation({ swaps: {}, drops: ['accessory_curl'] }), true);
      // The set trim went with the Adapt sheet that was its only way in
      // (2026-08-30), so "nothing to apply" is now swaps and drops alone.
      assert.equal(hasSessionAdaptation({ swaps: {}, drops: [] }), false);

      // Same object back, not a copy: the ordinary start path pays nothing.
      assert.equal(applySessionAdaptation(source, EMPTY_SESSION_ADAPTATION), source);
      assert.equal(applySessionAdaptation(source, null), source);
    },
  },
];
