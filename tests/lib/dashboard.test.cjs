const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const {
  getCurrentWeekStreak,
  getMonthlyActivityCalendar,
  getRecentActivityStrip,
  getSessionsLast30Days,
  getSessionsThisWeek,
} = require('../../.test-dist/lib/completedSessions.js');

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
];
