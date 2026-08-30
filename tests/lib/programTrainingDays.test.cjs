const assert = require('node:assert/strict');

const {
  resolveProgramTrainingDays,
  planWeekdayIndexes,
} = require('../../.test-dist/lib/programTrainingDays.js');

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
  {
    name: 'a plan that names weekdays is believed; one that names positions is not',
    run() {
      assert.deepEqual(planWeekdayIndexes([{ label: 'mon' }, { label: 'thu' }]), [0, 3]);
      // Entry order, not Monday-first order. The schedule reads a day's
      // POSITION in this list as its session number, so sorting here moved
      // session one onto whichever training day fell earliest in the week —
      // and a plan adopted on a Sunday printed WED on its first session.
      assert.deepEqual(
        planWeekdayIndexes([{ label: 'sun' }, { label: 'wed' }, { label: 'fri' }]),
        [6, 2, 4],
        'the plan runs sun, then wed, then fri — in that order',
      );
      // "Day 1" is a position, not a weekday — returning 0 for it would put
      // every position-labelled plan on Monday.
      assert.deepEqual(planWeekdayIndexes([{ label: 'Day 1' }]), []);
      assert.deepEqual(planWeekdayIndexes([{ label: 'mon' }, { label: 'Day 2' }]), []);
      assert.deepEqual(planWeekdayIndexes([]), []);
    },
  },
];
