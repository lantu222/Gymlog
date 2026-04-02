const assert = require('node:assert/strict');

const { getExerciseProgressSignal } = require('../../.test-dist/lib/progression.js');

function createSummary(overrides = {}) {
  return {
    key: 'bench press',
    name: 'Bench Press',
    logs: [{ id: '1' }, { id: '2' }],
    latestWeight: 85,
    previousWeight: 82.5,
    latestReps: '8,7,6',
    bestWeight: 85,
    bestReps: 21,
    ...overrides,
  };
}

module.exports = [
  {
    name: 'progress signal marks a new best when the latest log matches the best weight',
    run() {
      const signal = getExerciseProgressSignal(createSummary());
      assert.equal(signal.kind, 'new_best');
      assert.equal(signal.label, 'New best');
    },
  },
  {
    name: 'progress signal marks moving up when latest weight beats the previous log but not the best',
    run() {
      const signal = getExerciseProgressSignal(
        createSummary({
          latestWeight: 82.5,
          previousWeight: 80,
          bestWeight: 85,
        }),
      );

      assert.equal(signal.kind, 'moving_up');
    },
  },
  {
    name: 'progress signal falls back to building or starting when weight comparisons are missing',
    run() {
      assert.equal(
        getExerciseProgressSignal(
          createSummary({
            logs: [{ id: '1' }, { id: '2' }, { id: '3' }],
            latestWeight: null,
            previousWeight: null,
            bestWeight: null,
          }),
        ).kind,
        'building',
      );

      assert.equal(
        getExerciseProgressSignal(
          createSummary({
            logs: [{ id: '1' }],
            latestWeight: null,
            previousWeight: null,
            bestWeight: null,
          }),
        ).kind,
        'starting',
      );
    },
  },
];
