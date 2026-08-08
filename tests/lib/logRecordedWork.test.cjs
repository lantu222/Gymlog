const assert = require('node:assert/strict');

const { logRecordedWork } = require('../../.test-dist/lib/exerciseLog.js');
const { getTrackedExerciseProgress } = require('../../.test-dist/lib/progression.js');

function set(reps, weight, status) {
  return { orderIndex: 0, weight, reps, kind: 'working', outcome: null, status, effort: null, completedAt: null, skippedReason: null };
}

function db(logs) {
  return {
    exerciseTemplates: [],
    exerciseLibrary: [],
    workoutSessions: [{ id: 's1', performedAt: new Date(2026, 7, 6, 12).toISOString() }],
    exerciseLogs: logs,
    preferences: { trackedExerciseLibraryItemIds: [] },
  };
}

module.exports = [
  {
    name: 'a set nobody did is not work; a bodyweight set is',
    run() {
      // The rows an abandoned workout leaves behind: on the board, never done.
      assert.equal(
        logRecordedWork({ sets: [set(0, 0, 'active'), set(0, 0, 'active')], weight: 0, repsPerSet: [0, 0] }),
        false,
      );
      // Zero kilos is a real pull-up, so the test is reps and not weight.
      assert.equal(logRecordedWork({ sets: [set(8, 0, 'completed')], weight: 0, repsPerSet: [8] }), true);
      assert.equal(logRecordedWork({ sets: [set(5, 80, 'completed')], weight: 80, repsPerSet: [5] }), true);
      assert.equal(logRecordedWork(null), false);
      assert.equal(
        logRecordedWork({ sets: [set(5, 80, 'completed')], weight: 80, repsPerSet: [5], skipped: true }),
        false,
      );
    },
  },
  {
    name: 'an abandoned exercise does not drag a lift down to zero',
    run() {
      // Exactly the shape that shipped: bench at 80 kg, then the same lift put
      // on the board in a later session and never performed.
      const summaries = getTrackedExerciseProgress(
        db([
          {
            id: 'l1',
            sessionId: 's1',
            exerciseNameSnapshot: 'Barbell Bench Press',
            weight: 80,
            repsPerSet: [5],
            sets: [set(5, 80, 'completed')],
            tracked: true,
            skipped: false,
            status: 'completed',
          },
          {
            id: 'l2',
            sessionId: 's1',
            exerciseNameSnapshot: 'Barbell Bench Press',
            weight: 0,
            repsPerSet: [0, 0, 0],
            sets: [set(0, 0, 'active'), set(0, 0, 'active'), set(0, 0, 'active')],
            tracked: true,
            skipped: false,
            status: 'active',
          },
        ]),
      );

      const bench = summaries.find((summary) => summary.name.includes('Bench'));
      assert.ok(bench, 'the lift is still tracked');
      assert.equal(bench.logs.length, 1, 'only the session that happened counts');
      assert.equal(bench.latestWeight, 80, 'not 0 — the headline said "0 kg x 0" before this');
    },
  },
  {
    name: 'a lift that was only ever put on the board is not tracked at all',
    run() {
      const summaries = getTrackedExerciseProgress(
        db([
          {
            id: 'l1',
            sessionId: 's1',
            exerciseNameSnapshot: 'Barbell Squat',
            weight: 0,
            repsPerSet: [0],
            sets: [set(0, 0, 'active')],
            tracked: true,
            skipped: false,
            status: 'active',
          },
        ]),
      );
      assert.deepEqual(summaries, [], 'it appeared in the list reading "0 kg x 0"');
    },
  },
];
