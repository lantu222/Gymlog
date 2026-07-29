const assert = require('node:assert/strict');

const {
  FREE_COACH_QUESTIONS_PER_WEEK,
  coachQuotaWeekStart,
  resolveCoachQuota,
  recordCoachQuestion,
} = require('../../.test-dist/lib/aiCoachQuota.js');

// Local dates on purpose: the quota week is the user's Monday, not UTC's.
const WED = new Date(2026, 6, 22, 18, 30); // Wednesday 22 Jul 2026
const SUN = new Date(2026, 6, 26, 23, 59);
const NEXT_MON = new Date(2026, 6, 27, 0, 5);

module.exports = [
  {
    name: 'coach quota: the week key is the local Monday',
    run() {
      assert.equal(coachQuotaWeekStart(WED), '2026-07-20');
      assert.equal(coachQuotaWeekStart(SUN), '2026-07-20');
      assert.equal(coachQuotaWeekStart(NEXT_MON), '2026-07-27');
      // A Monday maps to itself.
      assert.equal(coachQuotaWeekStart(new Date(2026, 6, 20, 8, 0)), '2026-07-20');
    },
  },
  {
    name: 'coach quota: three questions a week, then zero remaining',
    run() {
      assert.equal(FREE_COACH_QUESTIONS_PER_WEEK, 3);

      let state = null;
      assert.equal(resolveCoachQuota(state, WED).remaining, 3);

      state = recordCoachQuestion(state, WED);
      state = recordCoachQuestion(state, WED);
      assert.equal(resolveCoachQuota(state, WED).remaining, 1);

      state = recordCoachQuestion(state, WED);
      assert.equal(resolveCoachQuota(state, WED).remaining, 0);

      // A fourth record does not go negative on the read side.
      state = recordCoachQuestion(state, WED);
      assert.equal(resolveCoachQuota(state, WED).remaining, 0);
    },
  },
  {
    name: 'coach quota: resets by comparison when the week rolls over',
    run() {
      let state = null;
      state = recordCoachQuestion(state, WED);
      state = recordCoachQuestion(state, WED);
      state = recordCoachQuestion(state, WED);
      assert.equal(resolveCoachQuota(state, SUN).remaining, 0, 'same week — still spent');
      assert.equal(resolveCoachQuota(state, NEXT_MON).remaining, 3, 'Monday resets the week');

      // Recording in the new week starts a fresh counter.
      const next = recordCoachQuestion(state, NEXT_MON);
      assert.deepEqual(next, { weekStart: '2026-07-27', used: 1 });
    },
  },
  {
    name: 'coach quota: malformed stored state is treated as unused, never as extra credit',
    run() {
      assert.equal(resolveCoachQuota({ weekStart: '2026-07-20', used: -5 }, WED).used, 0);
      assert.equal(resolveCoachQuota({ weekStart: 'garbage', used: 2 }, WED).remaining, 3);
    },
  },
];
