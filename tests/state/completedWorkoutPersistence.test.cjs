const assert = require('node:assert/strict');

const { createEmptyDatabase } = require('../../.test-dist/data/seed.js');
const { persistCompletedWorkoutSessionToDatabase } = require('../../.test-dist/state/completedWorkoutPersistence.js');
const { exerciseLogRepository } = require('../../.test-dist/storage/repositories.js');

function createLog(overrides = {}) {
  return {
    exerciseTemplateId: null,
    exerciseNameSnapshot: 'Bench Press',
    sets: [
      { orderIndex: 1, weight: 102.5, reps: 6, kind: 'working', outcome: 'completed' },
      { orderIndex: 0, weight: 100, reps: 8, kind: 'working', outcome: 'completed' },
    ],
    tracked: true,
    orderIndex: 0,
    skipped: false,
    sessionInserted: false,
    ...overrides,
  };
}

module.exports = [
  {
    name: 'completed workout persistence is idempotent and keeps log ordering stable',
    run() {
      let idCounter = 0;
      const createIdFn = (prefix) => `${prefix}_${++idCounter}`;
      const input = {
        sessionId: 'feature_session_1',
        workoutTemplateId: 'tpl_4_day_upper_lower_v1',
        workoutNameSnapshot: '4-Day Upper/Lower',
        startedAt: '2026-03-19T10:00:00.000Z',
        performedAt: '2026-03-19T10:35:00.000Z',
        logs: [
          createLog({ exerciseNameSnapshot: 'Overhead Press', orderIndex: 2 }),
          createLog({ exerciseNameSnapshot: 'Bench Press', orderIndex: 0 }),
          createLog({
            exerciseNameSnapshot: 'Calf Raise',
            orderIndex: 5,
            tracked: false,
            skipped: true,
            sets: [],
          }),
        ],
      };

      const first = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase(), input, createIdFn);
      assert.equal(first.didPersist, true);
      assert.equal(first.database.workoutSessions.length, 1);

      const persistedLogs = exerciseLogRepository.listBySessionId(first.database, input.sessionId);
      assert.deepEqual(
        persistedLogs.map((log) => [log.orderIndex, log.exerciseNameSnapshot]),
        [
          [0, 'Bench Press'],
          [2, 'Overhead Press'],
          [5, 'Calf Raise'],
        ],
      );
      assert.deepEqual(persistedLogs[0].sets.map((set) => set.orderIndex), [0, 1]);
      assert.equal(first.database.workoutSessions[0].durationMinutes, 35);
      assert.equal(first.database.workoutSessions[0].setsCompleted, 4);
      assert.equal(first.summary.entriesSaved, 3);
      assert.equal(first.summary.sessionId, 'feature_session_1');

      const second = persistCompletedWorkoutSessionToDatabase(first.database, input, createIdFn);
      assert.equal(second.didPersist, false);
      assert.equal(second.database.workoutSessions.length, 1);
      assert.equal(second.database.exerciseLogs.length, 3);
      assert.deepEqual(second.summary, first.summary);
    },
  },
  {
    name: 'completed workout summary counts skipped exercises the same way as finish review',
    run() {
      const input = {
        sessionId: 'feature_session_skipped_only',
        workoutTemplateId: 'tpl_4_day_upper_lower_v1',
        workoutNameSnapshot: '4-Day Upper/Lower',
        startedAt: '2026-03-19T10:00:00.000Z',
        performedAt: '2026-03-19T10:09:00.000Z',
        logs: [
          createLog({
            exerciseNameSnapshot: 'Lat Pulldown',
            tracked: false,
            skipped: true,
            sets: [],
          }),
        ],
      };

      const result = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase(), input);
      assert.equal(result.didPersist, true);
      assert.equal(result.summary.entriesSaved, 1);
      assert.equal(result.summary.exercisesLogged, 1);
      assert.equal(result.summary.trackedExercisesUpdated, 0);
      assert.equal(result.summary.setsCompleted, 0);
    },
  },
  {
    name: 'completed workout persistence keeps notes, swaps, and set status fidelity',
    run() {
      const result = persistCompletedWorkoutSessionToDatabase(createEmptyDatabase(), {
        sessionId: 'feature_session_fidelity',
        workoutTemplateId: 'tpl_4_day_upper_lower_v1',
        workoutNameSnapshot: '4-Day Upper/Lower',
        startedAt: '2026-03-19T10:00:00.000Z',
        performedAt: '2026-03-19T10:20:00.000Z',
        legacyShapeMismatches: [],
        logs: [
          createLog({
            exerciseNameSnapshot: 'Machine Chest Press',
            sessionInserted: true,
            status: 'swapped',
            notes: 'Controlled eccentric on every rep',
            swappedFrom: 'Bench Press',
            sets: [
              { orderIndex: 0, weight: 60, reps: 10, kind: 'working', outcome: 'completed', status: 'completed', completedAt: '2026-03-19T10:11:00.000Z' },
              { orderIndex: 1, weight: 0, reps: 0, kind: 'working', outcome: 'skipped', status: 'skipped', skippedReason: 'Shoulder tweak' },
              { orderIndex: 2, weight: 0, reps: 0, kind: 'working', outcome: null, status: 'pending', completedAt: null },
            ],
          }),
        ],
      });

      assert.equal(result.didPersist, true);
      const session = result.database.workoutSessions[0];
      const log = result.database.exerciseLogs[0];

      assert.equal(session.noteCount, 1);
      assert.equal(session.exercisesSwapped, 1);
      assert.equal(session.sessionInsertedCount, 1);
      assert.equal(log.notes, 'Controlled eccentric on every rep');
      assert.equal(log.swappedFrom, 'Bench Press');
      assert.equal(log.status, 'swapped');
      assert.deepEqual(log.sets.map((set) => set.status), ['completed', 'skipped', 'pending']);
      assert.equal(log.sets[0].completedAt, '2026-03-19T10:11:00.000Z');
      assert.equal(log.sets[1].skippedReason, 'Shoulder tweak');
      assert.equal(result.summary.notesSaved, 1);
      assert.equal(result.summary.exercisesSwapped, 1);
      assert.equal(result.summary.sessionInsertedExercises, 1);
    },
  },
];

