const assert = require('node:assert/strict');

const { parseNumberInput } = require('../../.test-dist/lib/format.js');
const { getActiveSetAutoFocusTarget } = require('../../.test-dist/lib/workoutLoggingFocus.js');

module.exports = [
  {
    name: 'load input parsing accepts 5, 10, 100, and 12.5 without coercing to a single digit',
    run() {
      assert.equal(parseNumberInput('5'), 5);
      assert.equal(parseNumberInput('10'), 10);
      assert.equal(parseNumberInput('100'), 100);
      assert.equal(parseNumberInput('12.5'), 12.5);
      assert.equal(parseNumberInput('12,5'), 12.5);
    },
  },
  {
    name: 'active set autofocus does not jump away from load after a partial kg edit',
    run() {
      assert.equal(
        getActiveSetAutoFocusTarget({
          autoFocusNextInput: true,
          completedSetsIncreased: false,
          trackingMode: 'load_and_reps',
          draftLoadText: '1',
          draftRepsText: '',
        }),
        null,
      );

      assert.equal(
        getActiveSetAutoFocusTarget({
          autoFocusNextInput: true,
          completedSetsIncreased: true,
          trackingMode: 'load_and_reps',
          draftLoadText: '',
          draftRepsText: '',
        }),
        'load',
      );

      assert.equal(
        getActiveSetAutoFocusTarget({
          autoFocusNextInput: true,
          completedSetsIncreased: true,
          trackingMode: 'bodyweight',
          draftLoadText: '',
          draftRepsText: '',
        }),
        'reps',
      );
    },
  },
];
