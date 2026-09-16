const assert = require('node:assert/strict');

const { buildHomePlanProgress, weekOfLastLoggedSession } = require('../../.test-dist/lib/homePlanProgress.js');

module.exports = [
  {
    name: 'home plan progress starts visible before the first workout',
    run() {
      assert.deepEqual(
        buildHomePlanProgress({
          completedSessions: 0,
          sessionsPerWeek: 2,
          totalWeeks: 8,
        }),
        {
          weekLabel: 'Week 1 of 8',
          progressPercent: 1,
          weekProgressLabel: 'Week 1 · 0 of 2 done',
          weekProgressPercent: 0,
          currentWeek: 1,
          totalWeeks: 8,
          sessionsDone: 0,
          sessionsTotal: 16,
        },
      );
    },
  },
  {
    name: 'home plan progress advances by completed workouts across planned sessions',
    run() {
      assert.deepEqual(
        buildHomePlanProgress({
          completedSessions: 1,
          sessionsPerWeek: 2,
          totalWeeks: 8,
        }),
        {
          weekLabel: 'Week 1 of 8',
          progressPercent: 6,
          weekProgressLabel: 'Week 1 · 1 of 2 done',
          weekProgressPercent: 50,
          currentWeek: 1,
          totalWeeks: 8,
          sessionsDone: 1,
          sessionsTotal: 16,
        },
      );

      assert.deepEqual(
        buildHomePlanProgress({
          completedSessions: 2,
          sessionsPerWeek: 2,
          totalWeeks: 8,
        }),
        {
          weekLabel: 'Week 2 of 8',
          progressPercent: 13,
          weekProgressLabel: 'Week 2 · 0 of 2 done',
          weekProgressPercent: 0,
          currentWeek: 2,
          totalWeeks: 8,
          sessionsDone: 2,
          sessionsTotal: 16,
        },
      );

      assert.deepEqual(
        buildHomePlanProgress({
          completedSessions: 16,
          sessionsPerWeek: 2,
          totalWeeks: 8,
        }),
        {
          weekLabel: 'Week 8 of 8',
          progressPercent: 100,
          weekProgressLabel: 'Week 8 · 2 of 2 done',
          weekProgressPercent: 100,
          currentWeek: 8,
          totalWeeks: 8,
          sessionsDone: 16,
          sessionsTotal: 16,
        },
      );
    },
  },
  {
    name: 'the summary names the week the session it summarises filled',
    run() {
      // A three-day plan over eight weeks. The third session of week 1 is
      // saved, so Home is already in week 2 — but the summary is about that
      // third session, and it belongs to week 1. This read "WEEK 2 · 3/3".
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 3, sessionsTotal: 24, totalWeeks: 8 }), 1);
      assert.equal(buildHomePlanProgress({ completedSessions: 3, sessionsPerWeek: 3, totalWeeks: 8 }).currentWeek, 2);

      // Mid-week the two agree: nothing has rolled over.
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 4, sessionsTotal: 24, totalWeeks: 8 }), 2);
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 1, sessionsTotal: 24, totalWeeks: 8 }), 1);

      // The block's last session belongs to the block's last week, not to a
      // ninth week that does not exist.
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 24, sessionsTotal: 24, totalWeeks: 8 }), 8);

      // Nothing logged yet, and unusable numbers, both answer week 1 rather
      // than dividing by zero.
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 0, sessionsTotal: 24, totalWeeks: 8 }), 1);
      assert.equal(weekOfLastLoggedSession({ sessionsDone: 2, sessionsTotal: 0, totalWeeks: 0 }), 1);
    },
  },
];
