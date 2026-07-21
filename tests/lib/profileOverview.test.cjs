const assert = require('node:assert/strict');

const {
  buildProfilePersonalRecords,
  countPersonalRecords,
  formatRecordWhenLabel,
} = require('../../.test-dist/lib/profileOverview.js');

// A tracked-lift log as progression.ts hands it over: real sets plus the
// session timestamp merged in.
function createLog(performedAt, sets) {
  return {
    id: `log_${performedAt}`,
    sessionId: `session_${performedAt}`,
    exerciseTemplateId: null,
    exerciseNameSnapshot: 'Barbell Squat',
    weight: sets[0].weight,
    repsPerSet: sets.map((set) => set.reps),
    sets: sets.map((set, index) => ({
      orderIndex: index,
      weight: set.weight,
      reps: set.reps,
      kind: 'working',
      outcome: 'completed',
    })),
    tracked: true,
    orderIndex: 0,
    skipped: false,
    performedAt,
    workoutNameSnapshot: 'Leg Day',
  };
}

function createSummary(key, name, logs) {
  return { key, name, logs, latestWeight: null, previousWeight: null, latestReps: '-', bestWeight: null, bestReps: 0 };
}

module.exports = [
  {
    name: 'countPersonalRecords: the first logged session is a starting point, not a record',
    run() {
      const summary = createSummary('squat', 'Barbell Squat', [
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 100, reps: 5 }]),
      ]);

      assert.equal(countPersonalRecords([summary]), 0);
    },
  },
  {
    name: 'countPersonalRecords: counts every improvement over the previous best',
    run() {
      const summary = createSummary('squat', 'Barbell Squat', [
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 100, reps: 5 }]),
        createLog('2026-07-08T10:00:00.000Z', [{ weight: 105, reps: 5 }]),
        createLog('2026-07-15T10:00:00.000Z', [{ weight: 102.5, reps: 5 }]),
        createLog('2026-07-22T10:00:00.000Z', [{ weight: 110, reps: 3 }]),
      ]);

      // 105 and 110 beat the running best; 102.5 did not.
      assert.equal(countPersonalRecords([summary]), 2);
    },
  },
  {
    name: 'countPersonalRecords: equalling the best is not a new record',
    run() {
      const summary = createSummary('bench', 'Bench Press', [
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 80, reps: 5 }]),
        createLog('2026-07-08T10:00:00.000Z', [{ weight: 80, reps: 8 }]),
      ]);

      assert.equal(countPersonalRecords([summary]), 0);
    },
  },
  {
    name: 'countPersonalRecords: sums across lifts and ignores unordered input',
    run() {
      const squat = createSummary('squat', 'Barbell Squat', [
        // Deliberately newest-first, the order progression.ts produces.
        createLog('2026-07-08T10:00:00.000Z', [{ weight: 105, reps: 5 }]),
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 100, reps: 5 }]),
      ]);
      const bench = createSummary('bench', 'Bench Press', [
        createLog('2026-07-02T10:00:00.000Z', [{ weight: 60, reps: 8 }]),
        createLog('2026-07-09T10:00:00.000Z', [{ weight: 62.5, reps: 8 }]),
      ]);

      assert.equal(countPersonalRecords([squat, bench]), 2);
    },
  },
  {
    name: 'buildProfilePersonalRecords: reports the heaviest set with its reps and the day it was set',
    run() {
      const squat = createSummary('squat', 'Barbell Squat', [
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 90, reps: 5 }]),
        createLog('2026-07-15T10:00:00.000Z', [
          { weight: 90, reps: 5 },
          { weight: 92.5, reps: 5 },
        ]),
        // Re-hitting the same load later must not move the record date.
        createLog('2026-07-22T10:00:00.000Z', [{ weight: 92.5, reps: 4 }]),
      ]);

      const [record] = buildProfilePersonalRecords([squat]);

      assert.equal(record.name, 'Barbell Squat');
      assert.equal(record.weightKg, 92.5);
      assert.equal(record.reps, 5);
      assert.equal(record.achievedAt, '2026-07-15T10:00:00.000Z');
    },
  },
  {
    name: 'buildProfilePersonalRecords: sorts by load and honours the limit',
    run() {
      const summaries = [
        createSummary('bench', 'Bench Press', [createLog('2026-07-01T10:00:00.000Z', [{ weight: 72.5, reps: 6 }])]),
        createSummary('deadlift', 'Deadlift', [createLog('2026-07-01T10:00:00.000Z', [{ weight: 130, reps: 3 }])]),
        createSummary('squat', 'Barbell Squat', [createLog('2026-07-01T10:00:00.000Z', [{ weight: 92.5, reps: 5 }])]),
      ];

      const records = buildProfilePersonalRecords(summaries, 2);

      assert.deepEqual(
        records.map((record) => record.name),
        ['Deadlift', 'Barbell Squat'],
      );
    },
  },
  {
    name: 'buildProfilePersonalRecords: lifts with no comparable sets are skipped',
    run() {
      const empty = createSummary('plank', 'Plank', []);
      const bodyweight = createSummary('pushup', 'Push-Up', [
        createLog('2026-07-01T10:00:00.000Z', [{ weight: 0, reps: 20 }]),
      ]);

      assert.deepEqual(buildProfilePersonalRecords([empty, bodyweight]), []);
    },
  },
  {
    name: 'formatRecordWhenLabel: calendar-day wording, not elapsed hours',
    run() {
      // Local-time literals (no trailing Z) so the assertion holds in any
      // timezone — the label is about calendar days on the user's device.
      const now = new Date('2026-07-21T08:00:00');

      assert.equal(formatRecordWhenLabel('2026-07-21T07:00:00', now), 'Today');
      assert.equal(formatRecordWhenLabel('2026-07-20T23:50:00', now), 'Yesterday');
      assert.equal(formatRecordWhenLabel('2026-07-18T10:00:00', now), '3 days ago');
      assert.equal(formatRecordWhenLabel('2026-07-01T10:00:00', now), '1 Jul');
      assert.equal(formatRecordWhenLabel('not-a-date', now), '');
    },
  },
];
