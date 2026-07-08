const assert = require('node:assert/strict');

const { buildHomePlanProgress } = require('../../.test-dist/lib/homePlanProgress.js');

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
        },
      );
    },
  },
];
