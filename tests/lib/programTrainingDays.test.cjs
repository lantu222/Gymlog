const assert = require('node:assert/strict');

const {
  resolveProgramTrainingDays,
  planWeekdayIndexes,
  sessionsOnTrainingDays,
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
  {
    /**
     * The programme page's week strip names the session the plan trains.
     *
     * It paired days with the programme's sessions by position. A day with no
     * exercises never reaches the plan, so once one was dragged to the top the
     * strip put it on Monday while Home trained day 1 there (backfill review
     * of #33, 2026-09-16).
     */
    name: 'the week strip pairs each day with the plan session, not the programme position',
    run() {
      const sessions = [
        { id: 'd3', name: 'Day 3', exerciseCount: 0 },
        { id: 'd1', name: 'Day 1', exerciseCount: 4 },
        { id: 'd2', name: 'Day 2', exerciseCount: 5 },
      ];
      const names = (map) => [...map.entries()].map(([day, session]) => [day, session.name]);

      // Mon:D1, Thu:D2 in the plan.
      assert.deepEqual(names(sessionsOnTrainingDays([0, 3], ['d1', 'd2'], sessions)), [[0, 'Day 1'], [3, 'Day 2']]);
      // Order carries the answer: a plan that runs D2 first says so.
      assert.deepEqual(names(sessionsOnTrainingDays([3, 0], ['d2', 'd1'], sessions)), [[3, 'Day 2'], [0, 'Day 1']]);

      // Without usable ids — none, a count that does not match, an entry that
      // stands for the whole template, or an id the programme no longer has —
      // the days take the sessions that have something in them, in order.
      for (const ids of [null, [], ['d1'], [null, 'd2'], ['d1', 'gone']]) {
        assert.deepEqual(
          names(sessionsOnTrainingDays([0, 3], ids, sessions)),
          [[0, 'Day 1'], [3, 'Day 2']],
          JSON.stringify(ids),
        );
      }
      // More days than trained sessions leaves the extra day unnamed rather
      // than naming the empty one.
      assert.deepEqual(names(sessionsOnTrainingDays([0, 2, 4], null, sessions)), [[0, 'Day 1'], [2, 'Day 2']]);
    },
  },
];
