const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const {
  getCurrentWeekStreak,
  getMonthlyActivityCalendar,
  getRecentActivityStrip,
  getSessionsLast30Days,
  getSessionsThisWeek,
} = require('../../.test-dist/lib/completedSessions.js');
const { getNextWorkoutCandidate } = require('../../.test-dist/lib/dashboard.js');

function createSession(id, performedAt, workoutTemplateId = 'workout_upper', workoutNameSnapshot = 'Upper') {
  return { id, workoutTemplateId, workoutNameSnapshot, performedAt };
}

function createCompletedLog(sessionId, orderIndex = 0, weight = 100, reps = [5]) {
  return {
    id: `${sessionId}_log_${orderIndex}`,
    sessionId,
    exerciseTemplateId: 'exercise_upper_bench',
    exerciseNameSnapshot: 'Bench Press',
    weight,
    repsPerSet: reps,
    sets: reps.map((rep, index) => ({
      orderIndex: index,
      weight,
      reps: rep,
      kind: 'working',
      outcome: 'completed',
    })),
    tracked: true,
    orderIndex,
    skipped: false,
  };
}

module.exports = [
  {
    name: 'completing one workout this week results in Current Streak = 1',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [createSession('session_this_week', '2026-03-18T18:00:00.000Z')];
      database.exerciseLogs = [createCompletedLog('session_this_week')];

      const now = new Date('2026-03-19T12:00:00.000Z');
      assert.equal(getCurrentWeekStreak(database, now), 1);
      assert.equal(getSessionsThisWeek(database, now), 1);
      assert.equal(getSessionsLast30Days(database, now), 1);
    },
  },
  {
    name: 'workouts in three consecutive active weeks result in streak = 3',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [
        createSession('session_week_1', '2026-03-18T18:00:00.000Z'),
        createSession('session_week_2', '2026-03-11T18:00:00.000Z'),
        createSession('session_week_3', '2026-03-04T18:00:00.000Z'),
      ];
      database.exerciseLogs = [
        createCompletedLog('session_week_1'),
        createCompletedLog('session_week_2'),
        createCompletedLog('session_week_3'),
      ];

      const now = new Date('2026-03-19T12:00:00.000Z');
      assert.equal(getCurrentWeekStreak(database, now), 3);
      assert.equal(getSessionsThisWeek(database, now), 1);
      assert.equal(getSessionsLast30Days(database, now), 3);
    },
  },
  {
    name: 'missing the current week results in streak = 0',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [
        createSession('session_last_week', '2026-03-11T18:00:00.000Z'),
        createSession('session_two_weeks_ago', '2026-03-04T18:00:00.000Z'),
      ];
      database.exerciseLogs = [createCompletedLog('session_last_week'), createCompletedLog('session_two_weeks_ago')];

      const now = new Date('2026-03-19T12:00:00.000Z');
      assert.equal(getCurrentWeekStreak(database, now), 0);
      assert.equal(getSessionsThisWeek(database, now), 0);
      assert.equal(getSessionsLast30Days(database, now), 2);
    },
  },
  {
    name: 'duplicate completed-session records do not inflate streak or weekly session counts',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [
        createSession('session_primary', '2026-03-18T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_duplicate', '2026-03-18T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_last_week', '2026-03-11T18:00:00.000Z', 'workout_upper', 'Upper'),
      ];
      database.exerciseLogs = [
        createCompletedLog('session_primary'),
        createCompletedLog('session_duplicate'),
        createCompletedLog('session_last_week'),
      ];

      const now = new Date('2026-03-19T12:00:00.000Z');
      assert.equal(getCurrentWeekStreak(database, now), 2);
      assert.equal(getSessionsThisWeek(database, now), 1);
      assert.equal(getSessionsLast30Days(database, now), 2);
    },
  },
  {
    name: 'monthly activity calendar marks completed dates once even with duplicate sessions',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [
        createSession('session_primary', '2026-03-22T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_duplicate', '2026-03-22T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_previous', '2026-03-16T18:00:00.000Z', 'workout_upper', 'Upper'),
      ];
      database.exerciseLogs = [
        createCompletedLog('session_primary'),
        createCompletedLog('session_duplicate'),
        createCompletedLog('session_previous'),
      ];

      const now = new Date('2026-03-22T12:00:00.000Z');
      const calendar = getMonthlyActivityCalendar(database, now);
      const activeDays = calendar.weeks.flat().filter((day) => day.active);
      const today = calendar.weeks.flat().find((day) => day.isToday);

      assert.equal(calendar.monthLabel, 'maaliskuu 2026');
      assert.equal(activeDays.length, 2);
      assert.deepEqual(
        activeDays.map((day) => day.dayNumber),
        [16, 22],
      );
      assert.equal(today?.dayNumber, 22);
      assert.equal(today?.isToday, true);
    },
  },
  {
    name: 'recent activity strip stays ordered and deduplicated',
    run() {
      const database = createEmptyDatabase();
      database.workoutSessions = [
        createSession('session_primary', '2026-03-22T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_duplicate', '2026-03-22T18:00:00.000Z', 'workout_upper', 'Upper'),
        createSession('session_previous', '2026-03-20T18:00:00.000Z', 'workout_upper', 'Upper'),
      ];
      database.exerciseLogs = [
        createCompletedLog('session_primary'),
        createCompletedLog('session_duplicate'),
        createCompletedLog('session_previous'),
      ];

      const now = new Date('2026-03-22T12:00:00.000Z');
      const strip = getRecentActivityStrip(database, now, 5);
      const activeDays = strip.filter((day) => day.active);
      const today = strip.find((day) => day.isToday);

      assert.equal(strip.length, 5);
      assert.deepEqual(
        strip.map((day) => day.dayNumber),
        [18, 19, 20, 21, 22],
      );
      assert.deepEqual(
        activeDays.map((day) => day.dayNumber),
        [20, 22],
      );
      assert.equal(today?.dayNumber, 22);
      assert.equal(today?.weekdayLabel, 'su');
    },
  },
  {
    name: 'recent activity strip keeps a day trained before a clock change',
    run() {
      // Finland moves its clocks on 29 March 2026, so a strip ending 5 April
      // spans a 23-hour day. Built from fixed 24-hour chunks, every day before
      // the change lands at 01:00 instead of midnight and matches nothing.
      const originalTimezone = process.env.TZ;
      process.env.TZ = 'Europe/Helsinki';

      try {
        const database = createEmptyDatabase();
        database.workoutSessions = [
          createSession('session_before_dst', new Date(2026, 2, 20, 18, 0, 0).toISOString()),
        ];
        database.exerciseLogs = [createCompletedLog('session_before_dst')];

        const strip = getRecentActivityStrip(database, new Date(2026, 3, 5, 12, 0, 0), 21);

        assert.equal(strip.find((day) => day.dayNumber === 20)?.active, true);
        strip.forEach((day) => {
          assert.equal(new Date(day.dayStart).getHours(), 0);
        });
      } finally {
        if (originalTimezone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTimezone;
        }
      }
    },
  },
  {
    name: 'the 30-day window holds its edge across a clock change, both directions',
    run() {
      // Finland moves its clocks on 29 March 2026, so the thirty days ending
      // 10 April contain a 23-hour day and span 719 real hours, not 720.
      // Subtracting 30 * DAY_MS therefore starts the window at 11:00 rather
      // than 12:00 and counts a session that is thirty days and half an hour
      // old — older than the figure claims to cover.
      const originalTimezone = process.env.TZ;
      process.env.TZ = 'Europe/Helsinki';

      try {
        // Without this the test is vacuous: under UTC there is no clock change,
        // the window is a flat 720 hours, and the assertions below pass against
        // the very arithmetic they exist to reject. A runner that ignores a
        // mid-process TZ override should fail here rather than go quietly green.
        assert.notEqual(
          new Date(2026, 3, 10).getTimezoneOffset(),
          new Date(2026, 2, 10).getTimezoneOffset(),
          'TZ override did not take effect, so this test proves nothing',
        );

        // Spring: the thirty days ending 10 April span 719 real hours, so
        // subtracting 720 starts the window at 11:00 and counts a session that
        // is thirty days and half an hour old.
        const spring = createEmptyDatabase();
        spring.workoutSessions = [
          createSession('session_just_outside', new Date(2026, 2, 11, 11, 30, 0).toISOString()),
          createSession('session_just_inside', new Date(2026, 2, 11, 12, 30, 0).toISOString()),
        ];
        spring.exerciseLogs = [
          createCompletedLog('session_just_outside'),
          createCompletedLog('session_just_inside'),
        ];

        assert.equal(getSessionsLast30Days(spring, new Date(2026, 3, 10, 12, 0, 0)), 1);

        // Autumn is the same fault in the other direction, and the one a reader
        // would not guess: clocks go back 25 October 2026, so the thirty days
        // ending 20 November span 721 hours and subtracting 720 starts the
        // window at 13:00 — dropping a session that is inside thirty days.
        const autumn = createEmptyDatabase();
        autumn.workoutSessions = [
          createSession('session_inside_autumn', new Date(2026, 9, 21, 12, 30, 0).toISOString()),
        ];
        autumn.exerciseLogs = [createCompletedLog('session_inside_autumn')];

        assert.equal(getSessionsLast30Days(autumn, new Date(2026, 10, 20, 12, 0, 0)), 1);
      } finally {
        if (originalTimezone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalTimezone;
        }
      }
    },
  },
  {
    name: 'active plan rotation advances by workout template session id',
    run() {
      const database = createEmptyDatabase();
      database.workoutTemplates = [
        {
          id: 'custom_full_body',
          name: 'Full Body',
          description: '',
          mode: 'custom',
          exerciseIds: [],
          sessions: [
            { id: 'day_a', name: 'Full Body A', orderIndex: 0, exerciseIds: [] },
            { id: 'day_b', name: 'Full Body B', orderIndex: 1, exerciseIds: [] },
          ],
          createdAt: '2026-05-25T00:00:00.000Z',
          updatedAt: '2026-05-25T00:00:00.000Z',
        },
      ];
      database.workoutPlans = [
        {
          id: 'plan_full_body',
          name: 'Full Body Plan',
          mode: 'rotation',
          isActive: true,
          createdAt: '2026-05-25T00:00:00.000Z',
          updatedAt: '2026-05-25T00:00:00.000Z',
          entries: [
            { id: 'entry_a', workoutTemplateId: 'custom_full_body', workoutTemplateSessionId: 'day_a', label: 'Mon', orderIndex: 0 },
            { id: 'entry_b', workoutTemplateId: 'custom_full_body', workoutTemplateSessionId: 'day_b', label: 'Thu', orderIndex: 1 },
          ],
        },
      ];
      database.preferences.activePlanId = 'plan_full_body';
      database.workoutSessions = [
        {
          id: 'completed_a',
          workoutTemplateId: 'custom_full_body',
          workoutTemplateSessionId: 'day_a',
          workoutNameSnapshot: 'Full Body A',
          performedAt: '2026-05-25T12:00:00.000Z',
        },
      ];
      database.exerciseLogs = [createCompletedLog('completed_a')];

      const candidate = getNextWorkoutCandidate(database);
      assert.equal(candidate?.entry?.id, 'entry_b');
      assert.equal(candidate?.entry?.workoutTemplateSessionId, 'day_b');
    },
  },
];
