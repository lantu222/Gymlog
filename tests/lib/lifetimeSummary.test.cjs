const assert = require('node:assert/strict');

const { getLifetimeTrainingSummary } = require('../../.test-dist/lib/lifetimeSummary.js');

// Completed log with a single comparable working set so the session counts as
// "completed" under getCanonicalCompletedSessions.
function createLog(sessionId, weight = 100) {
  return {
    id: `log_${sessionId}`,
    sessionId,
    exerciseTemplateId: null,
    exerciseNameSnapshot: 'Barbell Squat',
    weight,
    repsPerSet: [5],
    sets: [{ orderIndex: 0, weight, reps: 5, kind: 'working', outcome: 'completed' }],
    tracked: true,
    orderIndex: 0,
    skipped: false,
    sessionInserted: false,
  };
}

function createSession(id, performedAt, totalVolumeKg) {
  return {
    id,
    workoutTemplateId: 'tpl_1',
    workoutTemplateSessionId: null,
    workoutNameSnapshot: 'Leg Day',
    performedAt,
    totalVolumeKg,
  };
}

function buildDatabase(sessions) {
  return {
    workoutSessions: sessions,
    exerciseLogs: sessions.map((session) => createLog(session.id)),
  };
}

module.exports = [
  {
    name: 'lifetime summary aggregates sessions, volume, and distinct active weeks',
    run() {
      // 2026-06-01 is a Monday. Two sessions in the week of Jun 1, one in Jun 8.
      const database = buildDatabase([
        createSession('s1', '2026-06-02T12:00:00', 1000),
        createSession('s2', '2026-06-04T12:00:00', 1500),
        createSession('s3', '2026-06-09T12:00:00', 2000),
      ]);

      const summary = getLifetimeTrainingSummary(database, new Date('2026-06-09T12:00:00'));

      assert.equal(summary.sessionCount, 3);
      assert.equal(summary.totalVolumeKg, 4500);
      assert.equal(summary.weeksActive, 2);
      assert.equal(summary.weeksSinceStart, 2);
      assert.equal(summary.bestWeekStreak, 2);
      assert.equal(summary.firstSessionAt, '2026-06-02T12:00:00');
    },
  },
  {
    name: 'lifetime summary returns a zeroed result when no sessions are completed',
    run() {
      const summary = getLifetimeTrainingSummary({ workoutSessions: [], exerciseLogs: [] }, new Date('2026-06-09T12:00:00'));

      assert.equal(summary.sessionCount, 0);
      assert.equal(summary.totalVolumeKg, 0);
      assert.equal(summary.weeksActive, 0);
      assert.equal(summary.weeksSinceStart, 0);
      assert.equal(summary.bestWeekStreak, 0);
      assert.equal(summary.firstSessionAt, null);
    },
  },
  {
    name: 'lifetime summary best streak counts the longest consecutive run, not total active weeks',
    run() {
      // Active weeks: Jun 1, Jun 8 (run of 2), gap on Jun 15, then Jun 22, Jun 29, Jul 6 (run of 3).
      const database = buildDatabase([
        createSession('s1', '2026-06-01T12:00:00', 500),
        createSession('s2', '2026-06-08T12:00:00', 500),
        createSession('s3', '2026-06-22T12:00:00', 500),
        createSession('s4', '2026-06-29T12:00:00', 500),
        createSession('s5', '2026-07-06T12:00:00', 500),
      ]);

      const summary = getLifetimeTrainingSummary(database, new Date('2026-07-06T12:00:00'));

      assert.equal(summary.weeksActive, 5);
      assert.equal(summary.bestWeekStreak, 3);
      // Jun 1 week through Jul 6 week inclusive spans 6 calendar weeks (one gap week included).
      assert.equal(summary.weeksSinceStart, 6);
    },
  },
];
