const assert = require('node:assert/strict');

const { resolveProgramTrainingDays } = require('../../.test-dist/lib/programTrainingDays.js');

module.exports = [
  {
    // The reported bug: a one-session demo lit three dots, because the strip
    // marked the days the reader said they were AVAILABLE.
    name: 'the count comes from the plan, not from availability',
    run() {
      assert.deepEqual(resolveProgramTrainingDays([1, 2, 3], 1).length, 1);
      assert.deepEqual(resolveProgramTrainingDays([1, 2, 3], 2).length, 2);
      assert.deepEqual(resolveProgramTrainingDays([1, 2, 3], 3), [1, 2, 3]);
    },
  },
  {
    name: 'more sessions than open days keeps every open day and invents none',
    run() {
      assert.deepEqual(resolveProgramTrainingDays([0, 2], 5), [0, 2]);
    },
  },
  {
    name: 'sessions spread across the open days rather than bunching',
    run() {
      // Mon–Fri open, two sessions: not Mon+Tue.
      const days = resolveProgramTrainingDays([0, 1, 2, 3, 4], 2);
      assert.equal(days.length, 2);
      assert.equal(days[0], 0);
      assert.ok(days[1] - days[0] >= 2, `landed on ${days.join(',')}`);
    },
  },
  {
    name: 'no open days and no sessions both mean no dots, never a guess',
    run() {
      assert.deepEqual(resolveProgramTrainingDays([], 3), []);
      assert.deepEqual(resolveProgramTrainingDays([0, 1], 0), []);
    },
  },
  {
    name: 'duplicates and out-of-range indexes are dropped',
    run() {
      assert.deepEqual(resolveProgramTrainingDays([2, 2, 9, -1, 0], 3), [0, 2]);
    },
  },
];
