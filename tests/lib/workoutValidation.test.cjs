const assert = require('node:assert/strict');

const {
  canCompleteWorkoutSet,
  getWorkoutSetValidationMessage,
} = require('../../.test-dist/lib/workoutValidation.js');

module.exports = [
  {
    name: 'load-and-reps sets require both fields before completion',
    run() {
      assert.equal(canCompleteWorkoutSet('load_and_reps', '', ''), false);
      assert.equal(canCompleteWorkoutSet('load_and_reps', '100', ''), false);
      assert.equal(canCompleteWorkoutSet('load_and_reps', '', '8'), false);
      assert.equal(canCompleteWorkoutSet('load_and_reps', '100', '8'), true);
    },
  },
  {
    name: 'bodyweight sets only require reps before completion',
    run() {
      assert.equal(canCompleteWorkoutSet('bodyweight', '', ''), false);
      assert.equal(canCompleteWorkoutSet('bodyweight', '', '12'), true);
    },
  },
  {
    name: 'validation messages explain the missing field',
    run() {
      assert.equal(getWorkoutSetValidationMessage('load_and_reps', '', ''), null);
      assert.equal(getWorkoutSetValidationMessage('load_and_reps', '100', ''), 'Add reps to complete this set.');
      assert.equal(getWorkoutSetValidationMessage('load_and_reps', '', '8'), 'Add load to complete this set.');
      assert.equal(getWorkoutSetValidationMessage('bodyweight', '', ''), 'Add reps to complete this set.');
      assert.equal(getWorkoutSetValidationMessage('bodyweight', '', '12'), null);
    },
  },
];
