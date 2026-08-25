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
    name: 'coach quota: the reset says which day it is and how far off, not just "Monday"',
    run() {
      const { coachQuotaReset } = require('../../.test-dist/lib/aiCoachQuota.js');
      const on = (iso) => coachQuotaReset(new Date(`${iso}T12:00:00`));

      // Tuesday: six days to go, not "Monday" with no distance in it.
      assert.equal(on('2026-08-25').inDays, 6);
      assert.equal(on('2026-08-25').at.getDay(), 1, 'lands on a Monday');
      assert.equal(on('2026-08-30').inDays, 1, 'Sunday is one day out');

      // Monday itself: this week's quota is live, so the next reset is the
      // Monday after — reporting zero would say the questions are back when
      // they already are.
      assert.equal(on('2026-08-31').inDays, 7);

      // Counted between local midnights, so late Sunday is still one day.
      const lateSunday = coachQuotaReset(new Date('2026-08-30T23:55:00'));
      assert.equal(lateSunday.inDays, 1);
    },
  },
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
  {
    name: 'coach quota: a reply that only asks a question does not spend one',
    run() {
      // The other half of the same rule lives in the chat screen, and it is a
      // condition rather than a function — so it is guarded at the source.
      // Losing the `!answer.unanswered` term would charge for every follow-up
      // question the coach asks, which is exactly what it was added to stop.
      const fs = require('node:fs');
      const path = require('node:path');
      const screen = fs.readFileSync(
        path.join(__dirname, '../../src/screens/AICoachChatScreen.tsx'),
        'utf8',
      );

      assert.match(screen, /if \(!proUnlocked && !answer\.unanswered\) \{\s*\n\s*onFreeQuestionUsed\(\);/);
    },
  },
];
